'use strict'
const helpers         = require('../utils').helpers
const databaseService = require('../services').databaseService
const _               = require('lodash')


class databaseController {
  static setup(req, res) {
    let difference = _.difference(['dbAlias','dbUrl'], Object.keys(req.body))
    if ( difference.length > 0 ) { return res.status(http.BAD_REQUEST).send({missing_keys_from_body: difference})}
    let dbAlias = req.body.dbAlias
    let dbUrl    = req.body.dbUrl.replace(/\/$/,'')
    databaseService.checkDatabaseVersion(dbUrl, res)
      .then(()            => databaseService.getNodeLabels(dbUrl))
      .then(labels        => databaseService.queryFromLabels(_.flatten(labels), 'relationsQuery', dbUrl))
      .then(relatedLabels => databaseService.addLabelAndRelatedLabels(_.flatten(relatedLabels)))
      .then(graph         => databaseService.queryFromLabels(Object.keys(graph), 'propertiesQuery', dbUrl))
      .then(properties    => databaseService.addProperties(_.flatten(properties)))
      .then(graph         => databaseService.writeGraphToJson(dbAlias, graph))
      .then(message       => helpers.sendResponse(message, res))
      .catch(err          => helpers.sendErr(err.status || 'INTERNAL_SERVER_ERROR', err.response || err.stack, res))
  }
}

module.exports = databaseController
