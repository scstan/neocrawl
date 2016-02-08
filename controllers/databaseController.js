'use strict'
const helpers         = require('../utils').helpers
const databaseService = require('../services').databaseService
const _               = require('lodash')




class databaseController {
  static setup(req, res) {
    let dbAlias  = ''
    let dbUrl    = ''
    helpers.keyDifference(['dbAlias','dbUrl'], req.body)
      .then(()            => {
        dbAlias = req.body.dbAlias
        dbUrl   = req.body.dbUrl.replace(/\/$/,'')
      })
      .then(()            => databaseService.checkDatabaseVersion(dbUrl))
      .then(()            => databaseService.getNodeLabels(dbUrl))
      .then(labels        => databaseService.queryFromLabels(_.flatten(labels), 'relationsQuery', dbUrl))
      .then(relatedLabels => databaseService.addRelatedNodes(_.flatten(relatedLabels)))
      .then(graph         => databaseService.queryFromLabels(Object.keys(graph), 'propertiesQuery', dbUrl))
      .then(properties    => databaseService.addProperties(_.flatten(properties)))
      .then(graph         => databaseService.writeGraphToJson(dbAlias, graph))
      .then(message       => helpers.sendResponse(message, res))
      .catch(err          => helpers.sendErr(err.status || 'INTERNAL_SERVER_ERROR', err.response || err.stack, res))
  }
}

module.exports = databaseController
