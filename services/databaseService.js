'use strict'
const http    = require('../utils').httpStatusCodes
const  db     = require('../neo4j_driver')
const Promise = require('bluebird')
const request = require('superagent')
const co      = require('co')
const _       = require('lodash')
const fs      = require('fs')

let graph   = {}
let queries =  {
  labelsQuery: { 'statement': 'MATCH (node) RETURN collect(distinct(labels(node)))' },
  relationsQuery: { 'statement': ['MATCH (node:__label__)-[]-(relationedNode)',
                   'WITH collect(distinct(labels(relationedNode))) as relatedLabel',
                   'RETURN collect({label: "__label__", relatedLabels:relatedLabel})'].join(' ') },
  propertiesQuery: { 'statement': ['MATCH (node:__label__)',
                    'WITH collect(distinct(keys(node))) as properties',
                    'RETURN collect({label: "__label__", properties:properties})'].join(' ') }
                  }


class databaseService {

  static writeGraphToJson (alias, graph) {
    return new Promise ((resolve, reject) => {
      try {
        let json = fs.createWriteStream(`./graphs/${alias}.json`)
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
        let currentLabel               = arrayItem.label
        let properties                 = _.flatten(arrayItem.properties)
        properties.push('id')
        graph[currentLabel].properties = _.uniq(properties)
        return resolve(graph)
      })
    }, this))
  }

  static addLabelAndRelatedLabels (relatedLabels) {
    return new Promise (_.bind((resolve, reject) => {
      relatedLabels.forEach(arrayItem => {
        let currentLabel                  = arrayItem.label
        graph[currentLabel]               = {}
        graph[currentLabel].label         = currentLabel
        graph[currentLabel].relatedNodes  = _.flatten(arrayItem.relatedLabels)
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
        currentQuery.statement = currentQuery.statement.replace(/__label__/g, label)
        result.push(yield db.query([currentQuery], dbUrl))
        let hrStopInt          = process.hrtime(hrStartInt)
        console.log(`[ Intermediary ] ${label} => ${queryName} (hr): %ds %dms`, hrStopInt[0], hrStopInt[1]/1000000)
      }
      let hrStopFin  = process.hrtime(hrStartFin)
      console.log(`[ Total ] ${queryName} (hr): %ds %dms`, hrStopFin[0], hrStopFin[1]/1000000)
      return result
    }, this))
  }

  static getNodeLabels (dbUrl) {
    return db.query([queries.labelsQuery], dbUrl)
  }

  static checkDatabaseVersion (dbUrl, res) {
    return new Promise ((resolve, reject) => {
      request
        .get(dbUrl  + '/db/data/')
        .end((err, result) => {
          if (err) {
            return reject({status: 'INTERNAL_SERVER_ERROR',response: {response: err}})
          }
          let version = result.body.neo4j_version
          var regex = /([0-9])\.([0-9])\.([0-9])/
          var match = regex.exec(version)
          if (parseInt(match[1]) >= 2 && parseInt(match[2]) >= 2){
            return resolve(version)
          }
          else {
            return reject({status: 'BAD_REQUEST',response: {response: 'db_version_lower_than_required'}})
          }
        })
    })
  }

}

module.exports = databaseService
