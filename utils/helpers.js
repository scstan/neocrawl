'use strict'
const http    = require('./httpStatusCodes')

class utils {
  static sendResponse(result, res) {
    return res.status(http.OK).send(result)
  }
  static sendErr(err, res){
    res.status(http.INTERNAL_SERVER_ERROR).send()
    return console.log(err)
  }
}

module.exports= utils
