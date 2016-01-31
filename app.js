'use strict'
var config      = require("./config")
var express     = require('express')
var bodyParser 	= require('body-parser')
var app         = express()
var router      = express.Router()

app.use(bodyParser.json())

app.listen(config.port, function () {
	console.log('Server started on port:' + config.port)
})
