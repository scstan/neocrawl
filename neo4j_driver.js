'use strict'
const	request	= require('superagent')
const	_				= require('lodash')
const	Promise = require('bluebird')

class DB {

  static queryTemplate(queryArray){
    return {
        statements : queryArray      // queryArray is an array of objects composed of statements and parameters e.g.
      }															 // [ {"statement" : "MATCH (a {name: name})-[b]->(c) RETURN c.name",  "parameters" : {name: "John Smith"}} }, ]
  }

  static serializer(resolve, reject){
    return (err, result) => {
      const resp = JSON.parse(result.text)
      if (resp.errors.length > 0) {return reject(resp.errors[0])}
      let rezObj = resp.results
      rezObj = _.map(_.flatten(_.map(rezObj, 'data')), '.row[0]')
      rezObj = rezObj[1]?rezObj:rezObj[0]
      return resolve(rezObj)
    }
  }

  static query(queryArray, dbUrl) {
    return new Promise((resolve, reject) => {
      request
        .post(dbUrl  + '/db/data/transaction/commit')
        .send(this.queryTemplate(queryArray))
        .end(this.serializer(resolve, reject))
    })
  }

}

module.exports = DB
