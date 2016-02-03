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
      if (err) { return reject(err) }
      let rezObj = JSON.parse(result.text).results
      rezObj = _.map(rezObj, 'data[0].row[0]')
      rezObj = rezObj[1]?rezObj:rezObj[0]
      return resolve(rezObj)
    }
  }
  static query(queryArray, dbUrl) {
    return new Promise(_.bind((resolve, reject) => {
      request
        .post(dbUrl  + '/db/data/transaction/commit')
        .send(this.queryTemplate(queryArray))
        .end(this.serializer(resolve, reject))
    },this))
  }
}

module.exports = DB
