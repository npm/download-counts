var mysql = require('mysql')
var Config = require('../config')
var fastly = require('fastly')(Config.fastly.key)
var assert = require('assert')
var moment = require('moment')
var async = require('async')
var _ = require('lodash')
var CompactUuid = require('compact-uuid')
var populateDailyTotal = require('../lib/populate-daily-total')

var AWS = require('aws-sdk')
var s3 = new AWS.S3();

var dbConfig = Config.writeDb
dbConfig['connectionLimit'] = 1 // to avoid deadlocks on inserts
var pool = mysql.createPool(dbConfig);

// insert a day's downloads as a single giant insert
var insertBatch = function(day,counts,cb) {

  pool.getConnection(function(err, connection) {

    assert.ifError(err)

    console.log("preparing batch for " + day + ", " + counts.length + " packages")

    // Danger! ALWAYS REPLACES the existing data. This is slow!
    // If you're re-running for a date, it's because something went wrong
    // REPLACE means you never have to delete the crappy old data.
    var sql = 'REPLACE INTO downloads (id,package,downloads,day,updated) VALUES '
    var values = []

    async.each(
      counts,
      function(count,cb) {
        var package = count.package
        var downloads = count.downloads
        if (!package || !downloads) {
          console.log("Pad package ignored")
          cb()
        } else {
          var compactId = CompactUuid.generate()
          var vals = [
            mysql.escape(compactId),
            mysql.escape(package),
            mysql.escape(downloads),
            mysql.escape(day),
            'now()'
          ]
          values.push('(' + vals.join(',') + ')')
          cb()
        }
      },
      function(err) {
        sql = sql + values.join(',')

        var runQuery = function() {
          connection.query(sql, function(err, result) {
            assert.ifError(err)
            console.info('finished populating package download counts', result)
            populateDailyTotal(connection, day, function (err) {
              if (err) console.error(err)
              // we've finished populating stats for all packages,
              // along with the daily rollup.
              fastly.purgeAll(Config.fastly.service, function (err, res) {
                console.info('purged download counts in fastly', res)
                connection.release()
                return cb()
              })
            })
          })
        }

        var tries = 0;

        try {
          // try query
          runQuery()
        } catch (e) {
          console.log("ERROR: " + e)
        }
      }
    )

  })

}

// get a day's downloads from S3
// a "day" consists of several dozen keys, each containing a chunk of that day's data
// they must be combined into an array of {package: name, downloads: count} objects
var loadDay = function(dayKeys,cb) {

  var packageDownloads = []
  var day;

  async.eachLimit(dayKeys,Config.backfill.parallel,
    function(key,cb) {

      // what day is this? the next step needs the string.
      if (!day) {
        day = key.substring(0,10)
      }

      var params = {
        Bucket: Config.backfill.bucket,
        Key: Config.backfill.prefix + key
      };
      s3.getObject(params, function(err, data) {
        if (err) {
          console.log(err, err.stack)
          cb(err)
        } else {
          var packageLines = data.Body.toString('utf-8').split("\n")
          async.each(
            packageLines,
            function(line,cb) {
              var packageLine = line.trim().split(" ")
              var package = packageLine[0]

              // ignore empty package names
              if(!package || package == "") {
                cb()
                return
              }

              // do not import mixed-case packages; mySQL doesn't know what to do with them
              if (package != package.toLowerCase()) {
                cb()
                return
              }

              var count = packageLine[1]
              packageDownloads.push({
                package: package,
                downloads: count
              })
              cb() // this line is pushed
            },
            function(err) {
              cb() // all lines in this chunk are pushed
            }
          )
        }
      });

    },
    function(err) {
      // this day is complete. Import it into mySQL.
      insertBatch(day,packageDownloads,cb)
    }
  )

}

// start importing days, in parallel
var loadAllDays = function(days) {

  // limit the number we do at once
  var limit = Config.backfill.limit || Config.backfill.defaultLimit
  days = days.slice(0,limit)

  // fetch all the days, a few at a time
  async.eachLimit(days,Config.backfill.parallel,loadDay,function(err) {
    assert.ifError(err)
    pool.end()
    console.log("all days imported")
  })

}

// starting at our start date, get the paths of the days we want to import
// days can get re-calculated, so always pick the most recent re-run
var getAvailableDays = function(callback) {

  var startDay = moment(Config.backfill.startDate).format('YYYY-MM-DD')

  // find the first key from the first day
  var params = {
    Bucket: Config.backfill.bucket,
    MaxKeys: Config.backfill.maxDays,
    Prefix: Config.backfill.prefix + startDay
  }
  console.log("fetch all with prefix " + params.Prefix)
  s3.listObjects(params, function(err, data) {
    if (err) {
      console.log(err, err.stack)
      return
    } else {
      if(data.Contents.length > 0) {
        var firstKey = data.Contents[0].Key
        fetchAllAfterKey(firstKey)
      } else {
        console.log("No data found for " + startDay)
        return
      }
    }
  })

  // find all keys from that day or afterwards
  function fetchAllAfterKey(key) {
    var params = {
      Bucket: Config.backfill.bucket,
      MaxKeys: Config.backfill.maxDays,
      Marker: key
    }
    console.log("fetch all after key " + key)
    s3.listObjects(params, function(err, data) {
      if (err) {
        console.log(err, err.stack)
        return
      } else {
        splitKeysByDay(data.Contents.map(function(o) {
          return o.Key.substr(Config.backfill.prefix.length)
        }))
      }
    })

  }

  // split the keys into days, and each day into runs within that day
  function splitKeysByDay(keys) {
    var allDays = {}
    async.each(
      keys,
      function(key,cb) {
        var day = key.substr(0,10)
        var ts = key.substr(11).split("/")[0]
        if(!allDays[day]) allDays[day] = []
        if(!allDays[day][ts]) allDays[day][ts] = []
        if(key.indexOf('_SUCCESS') < 0) { // skip the "success" key
          allDays[day][ts].push(key)
        }
        cb()
      },
      function(er) {
        getBestDays(allDays)
      }
    )
  }

  // the "best" run for each day is the one with the highest timestamp
  function getBestDays(days) {

    var bestDays = _.map(
      days,
      function(day) {
        var highestTs = Math.max.apply(null,Object.keys(day))
        return day[highestTs]
      }
    )
    callback(bestDays)
  }

}

// go!
getAvailableDays(loadAllDays)
