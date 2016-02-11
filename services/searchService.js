'use strict'
const db      = require('../neo4j_driver')
const helpers = require('../utils').helpers
const co      = require('co')
const Promise = require('bluebird')
const _       = require('lodash')

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

  static buildCurrentNodeWhere (filters, propertiesList, label, where) {
      propertiesList.forEach(function (property) {
        const requestedProperty = label + '.' + property
        if (where.length > 1) {
          where.push('and')
        }
        if (property !== 'id') {
          where.push('toString(' + requestedProperty + ') =~ "(?i).*' + filters[requestedProperty] + '.*"')
        }
        else {
          where.push('id(' + label + ') = ' + filters[requestedProperty])
        }
      })
      return where
  }

  static buildOptionals (reqQuery, node, graph) {
    return co(function*() {
      let q = []
      q.push(node)
      let optionals = []
      let tree = {}
      tree[node] = {leafOf: ''}

      while (q.length > 0) {
        const currentNode = q[0]
        let relatedNodes  = searchService.getRelatedNodes(currentNode, graph)
        for (let n=0, len = relatedNodes.length; n<len; n++) {
          if (!tree.hasOwnProperty(relatedNodes[n])) {
            let relatedNode = relatedNodes[n]
            q.push(relatedNode)
            tree[relatedNode] = {leafOf: currentNode}
          }
        }
        const properties = Object.keys(reqQuery.filters).map( property => { return property.replace(currentNode+'.', '')})
        let currentNodeProperties = searchService.getNodeProperties(currentNode, graph)
        currentNodeProperties = _.intersection(currentNodeProperties, properties)
        let baseOptional = ''
        const father = tree[tree[currentNode].leafOf]
        if (father && father.initialQuery) {
          baseOptional = father.initialQuery + '-[]-(' + currentNode + ':' + currentNode + ')'
          tree[currentNode].initialQuery = baseOptional
        }
        else {
          baseOptional = 'match (' + currentNode + ':' + currentNode + ')'
          tree[currentNode].initialQuery = baseOptional
        }
        let where = ['where']
        where = searchService.buildCurrentNodeWhere(reqQuery.filters, currentNodeProperties, currentNode, where)
        if (where.length > 1) {
          const optionalQuery = [baseOptional, where.join(' ')]
          optionals = optionals.concat(optionalQuery.join(' '))
        }
        q = helpers.dequeue(q)
      }
      return optionals.join(' ')
    })
  }

  static search (reqQuery) {
    return co(function*() {
      const graph        = yield searchService.getGraph(reqQuery.dbAlias)
      const node         = reqQuery.node
      const skip         = parseInt(reqQuery.offset) * parseInt(reqQuery.limit) - parseInt(reqQuery.limit) || 0
      const limit        = parseInt(reqQuery.limit) || 10
      let builtOptionals = ''
      let basicQuery     = []

      if (Object.keys(reqQuery).length > 5 && !_.isEmpty(reqQuery.filters)) {
        builtOptionals = yield searchService.buildOptionals(reqQuery, node, graph)
      }
      if (builtOptionals) {
        basicQuery.push('')
      }
      else if (!builtOptionals) {
        basicQuery.push('match (' + node + ':' + node + ') ')
      }

      basicQuery.push(builtOptionals)
      let query      = basicQuery.slice(0)
      query.push('return distinct id(' + node + ') skip ' + skip + ' limit ' + limit)
      query          = query.join(' ')
      let countQuery = basicQuery.slice(0)
      countQuery.push('return count(distinct id(' + node + '))')
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
    })
  }
}

module.exports = searchService
