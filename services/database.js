'use strict'
const http    = require('../utils').httpStatusCodes
const helpers = require('../utils').helpers
const  db     = require('../neo4j_driver')
const _       = require('lodash')
const Promise = require('bluebird')

let labelsQuery    =  { "statement": "MATCH (node) RETURN collect(distinct(labels(node)))" }
let relationsQuery =  { "statement": ["MATCH (node:__label__)-[]-(relationedNode)",
                                     "WITH distinct labels(node) as label, collect(distinct(labels(relationedNode))) as relatedLabel",
                                     "RETURN collect({label: label, relatedLabels:relatedLabel})"].join(' ') }
let getRelatedLabels = function (labels, dbUrl) {
  let queryArray = []
  _.each(labels, label => {
    let currentQuery = _.clone(relationsQuery)
    currentQuery.statement = relationsQuery.statement.replace('__label__', label)
    queryArray.push(currentQuery)
  })
  return db.query(queryArray, dbUrl)
}

class database {
  static setup(req, res) {
    let difference = _.difference(['dbAlias','dbUrl'], Object.keys(req.body))
    if ( difference.length > 0 ) { return res.status(http.BAD_REQUEST).send({missing_keys_from_body: difference})}
    let nickName = req.body.nickName
    let dbUrl    = req.body.dbUrl.replace(/\/$/,'') + '/db/data/transaction/commit'
    db.query([labelsQuery], dbUrl)
      .then(labels => getRelatedLabels(_.flatten(labels), dbUrl))
      .then(relatedLabels => helpers.sendResponse(_.flatten(relatedLabels), res))
      .catch(err => helpers.sendErr(err, res))
  }
}

module.exports = database
