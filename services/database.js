'use strict'
const http    = require('../utils').httpStatusCodes
const helpers = require('../utils').helpers
const  db     = require('../neo4j_driver')
const _       = require('lodash')

let labelsQuery =  { "statement": "MATCH (n) RETURN collect(distinct(labels(n)))" }

class database {
  static setup(req, res) {
    let difference = _.difference(['dbAlias','dbUrl'], Object.keys(req.body))
    if ( difference.length > 0 ) { return res.status(http.BAD_REQUEST).send({missing_keys_from_body: difference})}
    let nickName = req.body.nickName
    let dbUrl    = req.body.dbUrl.replace(/\/$/,'') + '/db/data/transaction/commit'
    db.query([labelsQuery], dbUrl)
      .then(result => helpers.sendResponse(_.flatten(result), res))
      .catch(err => helpers.sendErr(err, res))
  }
}

module.exports = database
