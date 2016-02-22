'use strict'

const helpers         = require('./utils').helpers
const searchService   = require('./services').searchService
const databaseService = require('./services').databaseService
const _               = require('lodash')

class neocrawl {

  static setupdb (details) {
    let dbAlias  = ''
    let dbUrl    = ''
    return helpers.keyDifference(['dbAlias','dbUrl'], details)
      .then(()            => { dbAlias = details.dbAlias; dbUrl   = details.dbUrl.replace(/\/$/,'')})
      .then(()            => databaseService.checkGraphExists(dbAlias, details.update))
      .then(()            => databaseService.checkDatabaseVersion(dbUrl))
      .then(()            => databaseService.getNodeLabels(dbUrl))
      .then(labels        => databaseService.queryFromLabels(_.flatten(labels), 'relationsQuery', dbUrl))
      .then(relatedLabels => databaseService.addRelatedNodes(_.flatten(relatedLabels)))
      .then(graph         => databaseService.queryFromLabels(Object.keys(graph), 'propertiesQuery', dbUrl))
      .then(properties    => databaseService.addProperties(_.flatten(properties)))
      .then(graph         => databaseService.writeGraphToJson(dbAlias, graph))
  }

  static getGraph(details) {
    return helpers.keyDifference(['dbAlias'], details)
      .then(()            => searchService.getGraph(details.dbAlias))
  }

  static search (details) {
    return helpers.keyDifference(['dbUrl', 'dbAlias','node', 'offset', 'limit', 'filters'], details)
      .then(()            => searchService.search(details))
  }

}

module.exports = neocrawl


