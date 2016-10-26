#!/usr/bin/env node

var assert = require('assert')
var mysql = require('mysql')
var Config = require('../config')
var eachLimit = require('async').eachLimit
var populateDailyTotal = require('../lib/populate-daily-total')

var dbConfig = Config.writeDb
dbConfig['connectionLimit'] = 1 // to avoid deadlocks on inserts
var pool = mysql.createPool(dbConfig)

pool.getConnection(function(err, connection) {

  assert.ifError(err)

  connection.query('SELECT distinct(day) FROM downloads', function(err, result) {
    eachLimit(result, 5, function (day, done) {
      populateDailyTotal(connection, day.day, done)
    }, function (err) {
      if (err) console.error(err)
      connection.release()
      pool.end()
    })
  })
})
