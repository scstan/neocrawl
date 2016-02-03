'use strict'
const http    = require('./httpStatusCodes')

class utils {
  static sendResponse(result, res) {
    return res.status(http.OK).send(result)
  }
  static sendErr(status, err, res) {
    return res.status(http[status]).send(err)
  }
}

module.exports= utils
