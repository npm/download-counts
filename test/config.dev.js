var fs = require('fs')

// this should be the hostname of your MySQL server
var DOWNLOADS_HOST = '192.168.33.10'

// used by the web service
exports.server = {
  port: process.argv[2],
  options: {
    cors: true
  }
}

// used by the backfill process. read-write.
exports.readDb = {
  host     : DOWNLOADS_HOST,
  user     : 'localtest',
  password : 'localtest',
  database : 'stats'
}

// only apply to backfill
exports.writeDb = {
  host     : DOWNLOADS_HOST,
  user     : 'localtest',
  password : 'localtest',
  database : 'stats'
}

exports.manta = {
  statsDir: '/npm/stor/stats/downloads/'
}

// only applies to backfill
exports.backfill = {
  startDate: process.argv[2],
  parallel: 10, // how many parallel fetches to manta to make at once
  defaultLimit: 1000,
  limit: process.argv[3]
}
