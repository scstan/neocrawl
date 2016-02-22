'use strict'
const neocrawl = require('../neocrawl')
const helpers  = require('../utils').helpers

class databaseController {

  static setup(req, res) {
    helpers.promiseResolver(neocrawl.setupdb(req.body), res)
  }

}

module.exports = databaseController
