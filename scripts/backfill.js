var mysql = require('mysql')
var Config = require('../config')
var manta = require('manta-client')
var assert = require('assert')
var moment = require('moment')
var async = require('async')

var client = manta();
assert.ok(client)

console.log('manta ready: %s', client.toString());

var pool = mysql.createPool(Config.db);

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
      console.log(lines.length + " in " + day)
      cb()
    })
  });

}

var loadAllDays = function(days) {
  // filter by start day
  var startDay = moment(Config.backfill.startDate)
  var startDayIndex = days.indexOf(startDay)
  if ( startDayIndex > -1 ) {
    days = days.slice(startDayIndex)
  }

  // fetch all the days, a few at a time
  async.eachLimit(days,Config.backfill.parallel,loadDay,function(err) {
    assert.ifError(err)
    pool.end()
    client.close()
    console.log('done')
  })

}

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

getAvailableDays(loadAllDays)


/*
pool.getConnection(function(err, connection) {

  assert.ifError(err)

  console.log('mysql connected')

  connection.release()

});
*/

/*
 // Use the connection
 connection.query( 'SELECT * FROM bob', function(err, rows) {

 console.log(rows)

 // And done with the connection.
 connection.release();

 reply('hello world');
 });
 */
