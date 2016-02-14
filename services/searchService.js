'use strict'
const db      = require('../neo4j_driver')
const helpers = require('../utils').helpers
const Promise = require('bluebird')
const _       = require('lodash')
const co      = require('co')

const operatorMap = {
  'regex': ' =~ ',
  'eq': ' = ',
  'lt': ' < ',
  'le': ' <= ',
  'gt': ' > ',
  'ge': ' >= ',
  'ne': ' <> '
}

class searchService {

  static getGraph (dbAlias) {
    return new Promise ((resolve, reject) => {
      let graph = {}
      try {
        graph = require('../graphs/' + dbAlias + '.json')
        return resolve(graph)
      }
      catch (err) {
        return reject({status: 'BAD_REQUEST',response: {invalid_dbAlias: dbAlias}})
      }
    })
  }

  static getNodeProperties (node, graph) {
    return graph[node].properties
  }

  static getRelatedNodes (node, graph) {
    return graph[node].relatedNodes
  }

  static transfPseudoStr(value) {
    if (value.constructor !== Array) {
      value = [value]
    }
    value = value.map(function(item){
      if (item.constructor === String && item.indexOf('"') === -1){
        return '"' + item + '"'
      }
      else{
        return item
      }
    })
    return value.length === 1? value[0]:value
  }

  static buildFilter (nodeProperty, filterObj) {
    const objectCheck = filterObj.constructor === Object
    const filter = objectCheck ? Object.keys(filterObj)[0] : 'eq'
    let value
    if (filter !== 'like' && filter !== 'regex') {
      value = objectCheck ? this.transfPseudoStr(filterObj[filter]) : this.transfPseudoStr(filterObj)
    }
    else {
      value = objectCheck ? filterObj[filter] : filterObj
    }
    switch (filter) {
      case 'in':
        return nodeProperty + ' IN [' + value + ']'
      case 'out':
        return 'NOT ' + nodeProperty + ' IN [' + value + ']'
      case 'contains':
        return 'ANY (x IN ' + '[' + value + ']' + ' WHERE x in ' + nodeProperty + ')'
      case 'excludes':
        return 'NOT ANY (x IN ' + '[' + value + ']' + ' WHERE x in ' + nodeProperty + ')'
      case 'eq':
        return nodeProperty + operatorMap.eq + value
      case 'lt':
        return nodeProperty + operatorMap.lt + value
      case 'le':
        return nodeProperty + operatorMap.le + value
      case 'gt':
        return nodeProperty + operatorMap.gt + value
      case 'ge':
        return nodeProperty + operatorMap.ge + value
      case 'ne':
        return nodeProperty + operatorMap.ne + value
      case 'like':
        return 'TOSTRING(' + nodeProperty + ')' + operatorMap.regex + '"(?i).*' + value + '.*"'
      case 'regex':
        return 'TOSTRING(' + nodeProperty + ')' + operatorMap.regex + '"' + value + '"'
      default:
        throw Error('Filter not recognized: ' + filter);
    }
  }

  static buildCurrentNodeWhere (filters, propertiesList, label, where) {
    if (propertiesList.length>0) {
      propertiesList.forEach(function (property) {
        const requestedProperty = label + '.' + property
        if (where.length > 1) {
          where.push('and')
        }
        where.push(this.buildFilter(requestedProperty, filters[requestedProperty]))
      }.bind(this))
      return where
    }
    else {
      return []
    }
  }

  static buildWith (match) {
    const regex = /\((\w+):/g
    let result = match.match(regex)
    return result.map(item => item.slice(1,item.length-1) ).join(', ')
  }

  static buildOptionals (reqQuery, node, graph) {
    return new Promise ((resolve, reject) => {
      let q         = []
      q.push(node)
      let optionals = []
      let tree      = {}
      tree[node]    = {leafOf: ''}

      while (q.length > 0) {
        const currentNode = q[0]
        let relatedNodes  = this.getRelatedNodes(currentNode, graph)
        for (let n=0, len = relatedNodes.length; n<len; n++) {
          if (!tree.hasOwnProperty(relatedNodes[n])) {
            let relatedNode   = relatedNodes[n]
            q.push(relatedNode)
            tree[relatedNode] = {leafOf: currentNode}
          }
        }
        let baseOptional = ''
        const father     = tree[tree[currentNode].leafOf]
        if (father && father.initialQuery) {
          baseOptional                   = father.initialQuery + '-[]-(' + currentNode + ':' + currentNode + ')'
          tree[currentNode].initialQuery = baseOptional
        }
        else {
          baseOptional                   = 'MATCH (' + currentNode + ':' + currentNode + ')'
          tree[currentNode].initialQuery = baseOptional
        }
        let where                 = ['WHERE']
        const properties          = Object.keys(reqQuery.filters).map( property => { return property.replace(currentNode+'.','')})
        let currentNodeProperties = this.getNodeProperties(currentNode, graph)
        currentNodeProperties     = _.intersection(currentNodeProperties, properties)
        where = this.buildCurrentNodeWhere(reqQuery.filters, currentNodeProperties, currentNode, where)
        if (where.length > 1) {
          //const qWith = ['WITH']
          //qWith.push(this.buildWith(baseOptional))
          const optionalQuery = [baseOptional/*, qWith.join(' ')*/, where.join(' ')]
          optionals = optionals.concat(optionalQuery.join(' '))
        }
        q = helpers.dequeue(q)
      }
      return resolve(optionals.join(' '))
    })
  }

  static search (reqQuery) {
    return co(function*() {
      const graph        = yield this.getGraph(reqQuery.dbAlias)
      const node         = reqQuery.node
      const skip         = parseInt(reqQuery.offset) * parseInt(reqQuery.limit) - parseInt(reqQuery.limit) || 0
      const limit        = parseInt(reqQuery.limit) || 10
      //const orderBy      = reqQuery.orderBy ? ' ORDER BY ' + node + '.' + reqQuery.orderBy + ' ' + reqQuery.direction : ''
      const orderBy      = '' // TBD when returning full node details
      let builtOptionals = ''
      let basicQuery     = []

      if (Object.keys(reqQuery).length > 5 && !_.isEmpty(reqQuery.filters)) {
        builtOptionals = yield this.buildOptionals(reqQuery, node, graph)
      }
      if (builtOptionals) {
        basicQuery.push('')
      }
      else if (!builtOptionals) {
        basicQuery.push('MATCH (' + node + ':' + node + ') ')
      }

      basicQuery.push(builtOptionals)
      let query      = basicQuery.slice(0)
      query.push('RETURN DISTINCT ID(' + node + ')' + orderBy + ' SKIP ' + skip + ' LIMIT ' + limit)
      query          = query.join(' ')
      let countQuery = basicQuery.slice(0)
      countQuery.push('RETURN COUNT(DISTINCT ID(' + node + '))')
      countQuery     = countQuery.join(' ')

      const dbUrl    = reqQuery.dbUrl.replace(/\/$/,'')
      let queryResults
      try {
        queryResults = yield db.query([{statement: query}, {statement: countQuery}], dbUrl)
      }
      catch (err){
        return err
      }

      let result = {count: queryResults ? queryResults.pop() : 0, results: queryResults || []}
      if (reqQuery.debug) result.query = query
      return result
    }.bind(this))
  }

}

module.exports = searchService
