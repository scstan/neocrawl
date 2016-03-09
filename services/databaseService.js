'use strict'
const db            = require('../neo4j_driver')
const request       = require('superagent')
const Promise       = require('bluebird')
const co            = require('co')
const _             = require('lodash')
const fs            = require('fs')
const path          = require('path')
const NeoCrawlError = require('../utils/NeoCrawlError')

let graph   = {}
let queries =  {
  labelsQuery: { 'statement': 'MATCH (node) RETURN collect(distinct(labels(node)))' },
  relationsQuery: { 'statement': ['MATCH (node:__label__)-[]-(relationedNode)',
                   'WITH collect(distinct(labels(relationedNode))) as related',
                   'RETURN {label: "__label__", relatedLabels:related}'].join(' ') },
  propertiesQuery: { 'statement': ['MATCH (node:__label__)',
                    'WITH keys(node) as props UNWIND props AS prop',
                    'WITH collect(distinct(prop)) AS properties',
                    'RETURN {label: "__label__", properties:properties}'].join(' ') }
                  }

class databaseService {

  static checkGraphExists (alias, update) {
    return new Promise ( (resolve, reject) => {
      if(!update || update === false) {
        try {
          fs.accessSync(path.join(__dirname,'..','graphs', `${alias}.json`))
          reject(new NeoCrawlError({status: 'CONFLICT', response: {response: {db_alias_exists: 'use_update_boolean_param'}}}))
        }
        catch (err) {
          if (err) return resolve(err)
        }
      }
      else {
        resolve()
      }
    })
  }

  static writeGraphToJson (alias, graph) {
    return new Promise ((resolve, reject) => {
      try {
        let json = fs.createWriteStream(path.join(__dirname,'..','graphs', `${alias}.json`))
        json.end(JSON.stringify(graph))
      }
      catch (err) {
        if (err) return reject(err)
      }
      return resolve({response: 'process_finished'})
    })
  }

  static addProperties (properties) {
    return new Promise (_.bind((resolve, reject) => {
      properties.forEach(arrayItem => {
        properties.push('id')
        graph[arrayItem.label].properties = arrayItem.properties
        return resolve(graph)
      })
    }, this))
  }

  static addRelatedNodes (relatedLabels) {
    return new Promise (_.bind((resolve, reject) => {
      relatedLabels.forEach(arrayItem => {
        graph[arrayItem.label]               = {}
        graph[arrayItem.label].relatedNodes  = _.flatten(arrayItem.relatedLabels)
        return resolve(graph)
      })

    }, this))
  }

  static queryFromLabels (labels, queryName, dbUrl) {
    return co(_.bind(function*() {
      let hrStartFin = process.hrtime()
      let result     = []
      let label      = ''
      for (label of labels) {
        let hrStartInt         = process.hrtime()
        let currentQuery       = _.clone(queries[queryName])
        let queryResult        = {}
        currentQuery.statement = currentQuery.statement.replace(/__label__/g, label)
        try {
          queryResult = yield db.query([currentQuery], dbUrl)
        }
        catch (err) {
          throw new Error(JSON.stringify(err))
        }
        result.push(queryResult)
        let hrStopInt = process.hrtime(hrStartInt)
        console.log(`[ Intermediary ] ${label} => ${queryName} (hr): %ds %dms`, hrStopInt[0], hrStopInt[1]/1000000)
      }
      let hrStopFin = process.hrtime(hrStartFin)
      console.log(`[ Total ] ${queryName} (hr): %ds %dms`, hrStopFin[0], hrStopFin[1]/1000000)
      return result
    }, this))
  }

  static getNodeLabels (dbUrl) {
    return db.query([queries.labelsQuery], dbUrl)
  }

  static checkDatabaseVersion (dbUrl) {
    return new Promise ((resolve, reject) => {
      request
        .get(dbUrl  + '/db/data/')
        .end((err, result) => {
          if (err) {
            return reject(new NeoCrawlError({status: 'BAD_REQUEST',response: {response: 'dbUrl_not_valid'}}))
          }
          let version = result.body.neo4j_version
          var regex = /([0-9])\.([0-9])\.([0-9])/
          var match = regex.exec(version)
          if (parseInt(match[1]) >= 2 && parseInt(match[2]) >= 2){
            return resolve(version)
          }
          else {
            return reject(new NeoCrawlError({status: 'UPGRADE_REQUIRED',response: {response: 'db_version_lower_than_required'}}))
          }
        })
    })
  }

}

module.exports = databaseService
