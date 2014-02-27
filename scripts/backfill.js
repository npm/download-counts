var mysql = require('mysql')
var Config = require('../config')
var manta = require('manta-client')
var assert = require('assert')
var moment = require('moment')
var async = require('async')
var CompactUuid = require('compact-uuid')

var client = manta();
assert.ok(client)

console.log('manta ready: %s', client.toString());

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
          // try query
          runQuery()
        } catch (e) {
          console.log("ERROR: " + e)
          //console.log(sql)
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
      var dedupe = Object.create(null) // because {} has a key called "constructor" and there's a package called that
      lines.forEach(function(line,index) {
        var lineParts = line.trim().split(' ')
        var package = lineParts[0].toLowerCase()
        var downloads = parseInt(lineParts[1])
        if (!package || !downloads) {
          // ignore blank lines or null downloads
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

      console.log(day + ": " + lines.length + " rows yielding " + counts.length + " unique packages")
      //console.log(counts)

      insertBatch(day,counts,cb)
    })
  });

}

// find all the days we have to load
var loadAllDays = function(days) {
  // filter by start day
  var startDay = moment(Config.backfill.startDate).format('YYYY-MM-DD')

  var startDayIndex = days.indexOf(startDay)
  if ( startDayIndex > -1 ) {
    days = days.slice(startDayIndex)
    console.log("Start day was in range")
  } else {
    console.log("Start date was out of range")
    exit(1)
  }

  // limit the number we do at once
  var limit = Config.backfill.limit || Config.backfill.defaultLimit
  days = days.slice(0,limit)

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