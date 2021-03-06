'use strict'
const db      = require('../neo4j_driver')
const helpers = require('../utils').helpers
const Promise = require('bluebird')
const _       = require('lodash')
const co      = require('co')
const path    = require('path')

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
        graph = require(path.join(__dirname, '..', 'graphs', `${dbAlias}.json`))
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

  static buildReturn (node, reqQuery) {
    if (reqQuery.return) {
      return reqQuery.return
    }
    else {
      return 'ID(' + node + ')'
    }
  }

  static transfPseudoStr(value) {
    if (!_.isArray(value)) {
      value = [value]
    }
    value = _.map(value, item => {
      if (isNaN(parseInt(item)) && item.indexOf('(') > -1) return item
      if (isNaN(parseInt(item)) && item.indexOf('"') === -1){
        return '"' + item + '"'
      }
      else{
        return parseInt(item)
      }
    })
    return value.length === 1?value[0]:value
  }

  static buildFilter (label, property, filterObj) {
    const objectCheck = filterObj?filterObj.constructor === Object:false
    const filter = objectCheck ? Object.keys(filterObj)[0] : 'eq'
    let value = objectCheck ? filterObj[filter] : filterObj
    let nodeProperty = label + '.' + property
    if (filter !== 'like' && filter !== 'regex' && !_.isBoolean(value)) {
      value = this.transfPseudoStr(value)
    }
    if (property.toLowerCase() === 'id'){
      nodeProperty =  'ID(' + label + ')'
    }

    switch (filter) {
      case 'isRelated':
        value = value.replace(/"/g,'')
        return `(${label}:${label})-[]-(:${value})`
      case 'notRelated':
        value = value.replace(/"/g,'')
        return `NOT (${label}:${label})-[]-(:${value})`
      case 'between':
        return nodeProperty + operatorMap['ge'] + value[0] + ' and ' + nodeProperty + operatorMap['le'] + value[1]
      case 'in':
        return nodeProperty + ' IN [' + value + ']'
      case 'out':
        return 'NOT ' + nodeProperty + ' IN [' + value + ']'
      case 'has':
        return 'has(' + nodeProperty + ') = ' + value
      case 'containsAny':
        return 'ANY (x IN ' + '[' + value + ']' + ' WHERE x in ' + nodeProperty + ')'
      case 'containsAll':
        return 'All (x IN ' + '[' + value + ']' + ' WHERE x in ' + nodeProperty + ')'
      case 'excludesAny':
        return 'NOT ANY (x IN ' + '[' + value + ']' + ' WHERE x in ' + nodeProperty + ')'
      case 'excludesAll':
        return 'NOT All (x IN ' + '[' + value + ']' + ' WHERE x in ' + nodeProperty + ')'
      case 'like':
        return 'TOSTRING(' + nodeProperty + ')' + operatorMap.regex + '"(?i).*' + value + '.*"'
      case 'regex':
        return 'TOSTRING(' + nodeProperty + ')' + operatorMap.regex + '"' + value + '"'
      default:
        return nodeProperty + operatorMap[filter] + value
    }
  }

  static buildWhere (filters, propertiesList, label, where) {
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

  static buildWith (currentNode, customReturn, withArr, node) {
    if (withArr.indexOf(node) === -1) {
      withArr.push(node)
    }
    let returnFormat = customReturn
    if (helpers.isJson(customReturn)) {
      returnFormat = customReturn.replace(/"/g,'')
    }
    const customReturnExists = returnFormat && returnFormat.indexOf(withArr[withArr.length-1]) === -1
    const withArrContainsCurrentNode = withArr[withArr.length-1] !== node
    if (withArr.length > 0 && customReturnExists && withArrContainsCurrentNode) {
      withArr.pop()
    }
    if (withArr.indexOf(currentNode) === -1) {
      withArr.push(currentNode)
    }
    return withArr
  }

  static buildSearchQuery (reqQuery, node, graph) {
    return new Promise ((resolve, reject) => {
      let q         = []
      q.push(node)
      let optionals = []
      let tree      = {}
      tree[node]    = {leafOf: ''}
      let withArr   = []
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
          baseOptional            = 'MATCH (' + currentNode + ':' + currentNode + ')'
          tree[currentNode].initialQuery = baseOptional
        }
        let where                 = ['WHERE']
        const properties          = _.map(Object.keys(reqQuery.filters), property => {
          return property.replace(currentNode+'.','')
        })

        let currentNodeProperties     = this.getNodeProperties(currentNode, graph)
        currentNodeProperties.push('node')
        currentNodeProperties         = _.intersection(currentNodeProperties, properties)
        where                         = this.buildWhere(reqQuery.filters, currentNodeProperties, currentNode, where)
        const nodeNotInFilters        = JSON.stringify(reqQuery.filters).indexOf(currentNode+'.') === -1
        const nodeNotRequested        = reqQuery.node !== currentNode
        let nodeInReturn              = false
        if (reqQuery.return) {
          const regex = new RegExp(`\\b${currentNode}\\b`)
          nodeInReturn = regex.test(reqQuery.return)
        }
        else nodeInReturn = false
        const additionalNodeCondition = nodeInReturn && nodeNotInFilters && nodeNotRequested
        if (where.length > 1 || additionalNodeCondition) {
          if (additionalNodeCondition) baseOptional = baseOptional.replace('MATCH', 'OPTIONAL MATCH')
          let qWith = ['WITH']
          withArr   = this.buildWith(currentNode, reqQuery.return, withArr, node)
          qWith.push(withArr.slice(0).join(', '))
          const optionalQuery = [baseOptional, where.join(' '), qWith.join(' ')]
          optionals = optionals.concat(optionalQuery.join(' '))
        }

        q = helpers.dequeue(q)
      }
      return resolve(optionals.join(' '))
    })
  }

  static search (reqQuery) {
    return co(function*() {
      let processStart = process.hrtime()
      const graph        = yield this.getGraph(reqQuery.dbAlias)
      const node         = reqQuery.node
      const skip         = parseInt(reqQuery.offset) * parseInt(reqQuery.limit) - parseInt(reqQuery.limit) || 0
      const limit        = parseInt(reqQuery.limit) || 10
      const orderBy      = reqQuery.orderBy ? 'ORDER BY ' + reqQuery.orderBy + ' ' + reqQuery.direction : ''
      let builtSearchQuery = ''
      let basicQuery     = []

      if (Object.keys(reqQuery).length > 5 && !_.isEmpty(reqQuery.filters)) {
        builtSearchQuery = yield this.buildSearchQuery(reqQuery, node, graph)
      }

      basicQuery.push(builtSearchQuery)
      if (builtSearchQuery === '') {
        basicQuery.push('MATCH (' + node + ':' + node + ') WITH ' + node + ' ')
      }
      let query         = basicQuery.slice(0)
      let builtReturn = this.buildReturn(node,reqQuery)

      if (helpers.isJson(builtReturn)) {
        builtReturn = JSON.parse(builtReturn)
        let finalWith =  ['WITH']
        let withArr = []
        _.forOwn(builtReturn, (value,key) => {
          withArr.push(`${value} AS ${key}`)
          builtReturn[key] = key
        })
        builtReturn = JSON.stringify(builtReturn).replace(/"/g,'')
        finalWith.push(withArr.join(', '))
        query.push(finalWith.join(' '))
      }
      query.push(orderBy + ' RETURN DISTINCT ' + builtReturn + ' SKIP ' + skip + ' LIMIT ' + limit)
      query             = query.join(' ')
      let countQuery    = basicQuery.slice(0)
      countQuery.push('RETURN COUNT(DISTINCT ' + node + ')')
      countQuery        = countQuery.join(' ')

      const dbUrl       = reqQuery.dbUrl.replace(/\/$/,'')
      let queryResults
      let queryStart    = process.hrtime()
      try {
        queryResults    = yield db.query([{statement: query}, {statement: countQuery}], dbUrl)
        let queryStop   = process.hrtime(queryStart)
        if (reqQuery.debug) console.log(`[ DBQuery ] => ${reqQuery.node} <= (hr): %ds %dms`, queryStop[0], queryStop[1]/1000000)
      }
      catch (err){
        throw err
      }


      let result = {count: queryResults.constructor === Array ? queryResults.pop() : 0, results: queryResults || []}
      if (reqQuery.debug) result.query = query
      let processStop  = process.hrtime(processStart)
      if (reqQuery.debug) console.log(`[ Process Total ] => ${reqQuery.node} <= (hr): %ds %dms`, processStop[0], processStop[1]/1000000)
      return result
    }.bind(this))
  }

}

module.exports = searchService
