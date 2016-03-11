'use strict'
const http    = require('./httpStatusCodes')
const _       = require('lodash')

class helpers {

  static sendResponse(result, res) {
    return res.status(http.OK).send(result)
  }

  static sendErr(status, err, res) {
    return res.status(http[status]).send(err)
  }

  static keyDifference (keys, body) {
    return new Promise((resolve, reject) => {
      let difference = _.difference(keys, Object.keys(body))
      if (difference.length > 0) {
        return reject({status: 'BAD_REQUEST', response: {missing_keys: difference}})
      }
      return resolve()
    })
  }

  static dequeue(arr) {
    let rez = []
    for (let i = 1, len = arr.length; i < len; i++) {
      rez.push(arr.pop())
    }
    return rez.reverse()
  }

  static promiseResolver (promise, res) {
    promise
      .then(message       => helpers.sendResponse(message, res))
      .catch(err          => helpers.sendErr(err.status || 'INTERNAL_SERVER_ERROR', err.response || err.stack, res))
  }

  static isJson (str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
  }

}

module.exports= helpers
