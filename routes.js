'use strict'
const databaseController = require('./controllers').databaseController
const searchController   = require('./controllers').searchController

module.exports = function routes (router) {
  router.post('/setupdb', databaseController.setup)
  router.post('/getgraph',searchController.getGraph)
  router.post('/search',searchController.search)
}
