'use strict'
const helpers         = require('../utils').helpers
const searchService   = require('../services').searchService

class search {

  static getGraph(req, res) {
    helpers.keyDifference(['dbAlias'], req.body)
      .then(()            => searchService.getGraph(req.body.dbAlias))
      .then(message       => helpers.sendResponse(message, res))
      .catch(err          => helpers.sendErr(err.status || 'INTERNAL_SERVER_ERROR', err.response || err.stack, res))

  }

  static search (req, res) {
    helpers.keyDifference(['dbUrl', 'dbAlias','node', 'offset', 'limit', 'filters'], req.body)
      .then(()            => searchService.search(req.body))
      .then(message       => helpers.sendResponse(message, res))
      .catch(err          => helpers.sendErr(err.status || 'INTERNAL_SERVER_ERROR', err.response || err.stack, res))
  }
}

module.exports = search
