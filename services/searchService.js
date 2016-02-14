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

  static buildReturn (node, graph, reqQuery) {
    if (reqQuery.return) {
      return reqQuery.return
    }
    else {
      return 'ID(' + node + ')'
    }
  }

  static transfPseudoStr(value) {
    if (value.constructor !== Array) {
      value = [value]
    }
    value = _.map(value, item => {
      if (item.constructor === String && item.indexOf('"') === -1){
        return '"' + item + '"'
      }
      else{
        return item
      }
    })
    return value.length === 1? value[0]:value
  }

  static buildFilter (label, property, filterObj) {
    const objectCheck = filterObj.constructor === Object
    const filter = objectCheck ? Object.keys(filterObj)[0] : 'eq'
    let value
    let nodeProperty = label + '.' + property
    if (filter !== 'like' && filter !== 'regex') {
      value = objectCheck ? this.transfPseudoStr(filterObj[filter]) : this.transfPseudoStr(filterObj)
    }
    else {
      value = objectCheck ? filterObj[filter] : filterObj
    }
    if (property === 'ID'){
      nodeProperty =  'ID(' + label + ')'
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
      case 'like':
        return 'TOSTRING(' + nodeProperty + ')' + operatorMap.regex + '"(?i).*' + value + '.*"'
      case 'regex':
        return 'TOSTRING(' + nodeProperty + ')' + operatorMap.regex + '"' + value + '"'
      default:
        return nodeProperty + operatorMap[filter] + value
    }
  }

  static buildCurrentNodeWhere (filters, propertiesList, label, where) {
    if (propertiesList.length>0) {
      _.each(propertiesList, property => {
        if (where.length > 1) {
          where.push('and')
        }
        where.push(this.buildFilter(label, property, filters[label + '.' + property]))
      })
      return where
    }
    else {
      return []
    }
  }

  static buildWith (currentNode, node, customReturn) {
    let qWith = ['WITH']
    if (currentNode !== node && customReturn.indexOf(currentNode) !== -1) {
      qWith.push([currentNode, node].join(', '))
    }
    else {
      qWith.push(node)
    }
    return qWith
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
        _.each(relatedNodes, relatedNode =>{
          if (!tree.hasOwnProperty(relatedNode)) {
            q.push(relatedNode)
            tree[relatedNode] = {leafOf: currentNode}
          }
        })
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
        const properties          = _.map(Object.keys(reqQuery.filters), property => {
          return property.replace(currentNode+'.','')
        })
        let currentNodeProperties = this.getNodeProperties(currentNode, graph)
        currentNodeProperties     = _.intersection(currentNodeProperties, properties)
        where = this.buildCurrentNodeWhere(reqQuery.filters, currentNodeProperties, currentNode, where)
        if (where.length > 1) {
          const optionalQuery = [baseOptional, where.join(' '), this.buildWith(currentNode, node, reqQuery.return).join(' ')]
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
      const orderBy      = reqQuery.orderBy ? 'ORDER BY ' + node + '.' + reqQuery.orderBy + ' ' + reqQuery.direction : ''
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
      query.push(orderBy + ' RETURN DISTINCT ' + this.buildReturn(node,graph,reqQuery) + ' SKIP ' + skip + ' LIMIT ' + limit)
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
