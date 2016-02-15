//'use strict'
const config      = require('./config')
const routes      = require('./routes')
const express     = require('express')
const bodyParser  = require('body-parser')
const app         = express()
const router      = express.Router()

app.use(bodyParser.json())
app.use('/api', router)
routes(router)

app.listen(config.port, config.host, function () {
  console.log('Server started on port:' + config.port)
})
