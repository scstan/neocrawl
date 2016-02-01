'use strict'
const services = require('./services')

module.exports = function routes (router) {
  router.post('/setupdb', services.database.setup)
}
