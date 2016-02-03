'use strict'
const databaseController = require('./controllers').databaseController

module.exports = function routes (router) {
  router.post('/setupdb', databaseController.setup)
}
