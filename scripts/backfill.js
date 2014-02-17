var mysql = require('mysql')
var Config = require('../config')
var manta = require('manta-client')
var assert = require('assert')
var moment = require('moment')
var async = require('async')
var uuid = require('uuid')

var client = manta();
assert.ok(client)

console.log('manta ready: %s', client.toString());

var dbConfig = Config.db
dbConfig['connectionLimit'] = 1 // to avoid deadlocks on huge inserts
var pool = mysql.createPool(dbConfig);

// insert a day's downloads as a single giant insert
var insertBatch = function(day,counts,cb) {

  pool.getConnection(function(err, connection) {

    assert.ifError(err)

    console.log("preparing batch for " + day + ", " + counts.length + " packages")

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
          var vals = [
            mysql.escape(uuid.v1()),
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
        //console.log(sql)

        var runQuery = function() {
          connection.query(sql, function(err, result) {
            assert.ifError(err)
            console.log(result)
            // And done with the connection.
            connection.release();
            cb()
          });
        }

        var tries = 0;

        try {
          runQuery()
        } catch (e) {
          runQuery()
        }
      }
    )

  })

}

// get a day's downloads from manta
var loadDay = function(day,cb) {

  client.get(Config.manta.statsDir + day, function (err, stream) {

    assert.ifError(err);

    var dayDownloads = ''

    stream.setEncoding('utf8');
    stream.on('data', function (chunk) {
      dayDownloads += chunk
    });
    stream.on('end',function() {
      var lines = dayDownloads.split("\n")

      // package counts can appear multiple times in the same day
      // sum them up
      var dedupe = {}
      lines.forEach(function(line,index) {
        var lineParts = line.trim().split(' ')
        var package = lineParts[0].toLowerCase()
        var downloads = lineParts[1]
        if (!package || !downloads) {
          console.log("Ignored line: " + line)
          return;
        }
        if (dedupe[package]) dedupe[package] += downloads
        else dedupe[package] = downloads
      })

      // convert the object into an array
      var counts = []
      for(var p in dedupe) {
        counts.push({package:p, downloads: dedupe[p]})
      }

      console.log(lines.length + " rows yielding " + counts.length + " unique packages")
      //console.log(counts)

      insertBatch(day,counts,cb)
    })
  });

}

// find all the days we have to load
var loadAllDays = function(days) {
  // filter by start day
  var startDay = moment(Config.backfill.startDate)
  var startDayIndex = days.indexOf(startDay)
  if ( startDayIndex > -1 ) {
    days = days.slice(startDayIndex)
  }

  if (Config.backfill.limit) {
    days = days.slice(0,Config.backfill.limit)
  }

  // fetch all the days, a few at a time
  async.eachLimit(days,Config.backfill.parallel,loadDay,function(err) {
    assert.ifError(err)
    pool.end()
    client.close()
    console.log('done')
  })

}

// find all the days available to load in manta
var getAvailableDays = function(cb) {

  var days = []

  client.ls(Config.manta.statsDir, function (err, res) {

    assert.ifError(err);

    res.on('object',function(obj) {
      days.push(obj.name)
    })

    res.once('error', function (err) {
      console.error(err.stack);
      process.exit(1);
    });

    res.once('end',function() {
      days.sort()
      console.log('got ' + days.length + ' available days')
      cb(days)
    })

  })

}

// go!
getAvailableDays(loadAllDays)