'use strict'
const neocrawl = require('../neocrawl')
const helpers  = require('../utils').helpers

class search {

  static getGraph(req, res) {
    helpers.promiseResolver(neocrawl.getGraph(req.body), res)
  }

  static search (req, res) {
    helpers.promiseResolver(neocrawl.search(req.body), res)
  }
}

module.exports = search
