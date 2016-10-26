var _ = require('lodash')
var mysql = require('mysql')
var moment = require('moment')

var MAX_RANGE = 31 // no more than 1 month of data at a time
//var NPM_EPOCH = '2009-09-29' totals are in their own table

/**
 * Valid periods: 2014-02-01, 2014-01-02:2014-01-04, last-day, last-week
 * @param periodString
 * @returns {*}
 */
var parsePeriod = function(periodString) {
  var period = {
    range: null,
    start: null,
    end: null
  }

  // date range or shorthand?
  if (periodString.match(/\d{4}-\d{2}-\d{2}(:\d{4}-\d{2}-\d{2})?/)) {
    // date range
    var dates = periodString.split(':')
    if (!dates[0]) {
      return false
    }
    period.start = dates[0]
    if (dates[1]) {
      period.end = dates[1]
    } else {
      period.end = dates[0]
    }

    // is this range too big?
    var dayDiff = moment(period.end).diff(moment(period.start),'days')
    if ( dayDiff > MAX_RANGE ) {
      period.outOfRange = true
      return period
    }
  } else {
    // shorthand. Which one?
    var periodNames = [
      'all-time',
      'last-day',
      'last-week',
      'last-month'
    ]
    if (periodNames.indexOf(periodString) == -1) {
      return false
    }
    period.range = periodString
  }
  return period
}

/**
 * We've got a specific start and end day for the data, and
 * we want the sum of downloads for that range.
 * @param request
 * @param reply
 * @param conditions
 * @param period
 */
var getSumOfDays = function(request,reply,conditions,period) {

  var sql = null
  if (conditions.package)
    sql = 'SELECT package, sum(downloads) as downloads FROM downloads WHERE day BETWEEN cast(? as datetime) and cast(? as datetime)'
  else
    sql = 'SELECT sum(downloads) as downloads FROM total_daily_downloads WHERE day BETWEEN cast(? as datetime) and cast(? as datetime)'
  var bindValues = []
  var qmarks = []
  var bulk = false

  bindValues.push(period.start)
  bindValues.push(period.end)

  if(conditions.package) {
    bulk = conditions.package.indexOf(',') > -1
    conditions.package.split(',').forEach(function(package, i) {
      qmarks.push('?')
      bindValues.push(package)
    })
    sql += ' AND package in (' + qmarks.join(',') + ') GROUP BY package'
  }

  request.server.plugins['hapi-mysql'].pool.getConnection(function(err, connection) {

    // Use the connection
    connection.query(
      sql,
      bindValues,
      function(er, rows) {
        if(er) {
          reply({
            error: "query failed (0001)"
          })
        } else {
          if (rows.length == 0) {
            reply({
              error: "no stats for this package for this period (0002)"
            })
          } else {
            var outputs = []

            rows.forEach(function(result) {
              var output = {
                downloads: result.downloads,
                start: period.start,
                end: period.end
              }
              if (!conditions.all) {
                output.package = result.package
              }
              outputs.push(output)
            })

            if (bulk) outputs = _.indexBy(outputs, 'package');
            else outputs = outputs[0];

            reply(outputs)
          }
        }

        // And done with the connection.
        connection.release()
      }
    )
  })

}

/**
 * Got a specific start and end date, and want the daily count
 * for each day in that range.
 * @param request
 * @param reply
 * @param conditions
 * @param period
 */
var getRangeOfDays = function(request,reply,conditions,period) {
  var sql = ''
  var bindValues = []
  var qmarks = []
  var bulk = false

  bindValues.push(period.start)
  bindValues.push(period.end)

  if(conditions.package) {
    bulk = conditions.package.indexOf(',') > -1
    conditions.package.split(',').forEach(function(package, i) {
      qmarks.push('?')
      bindValues.push(package)
    })

    sql += 'SELECT package, day, downloads FROM downloads WHERE day BETWEEN cast(? as datetime) and cast(? as datetime) AND package in (' + qmarks.join(',') + ') GROUP BY package,day'
  } else {
    // if all packages, group by day
    sql += 'SELECT day, SUM(downloads) as downloads FROM total_daily_downloads WHERE day BETWEEN cast(? as datetime) and cast(? as datetime) GROUP BY day'
  }
  sql += ' ORDER BY day'

  request.server.plugins['hapi-mysql'].pool.getConnection(function(err, connection) {

    // Use the connection
    connection.query(
      sql,
      bindValues,
      function(er, rows) {
        if(er) {
          reply({
            error: "query failed (0001)"
          })
        } else {
          if (rows.length == 0) {
            reply({
              error: "no stats for this package for this range (0008)"
            })
          } else if (bulk) {
            handleBulkRange(rows, period, reply)
          } else {
            rows = sortByDay(rows);

            var dayCounts = rows.map(function(row) {
              return {
                day: moment(row.day).format('YYYY-MM-DD'),
                downloads: row.downloads
              }
            })
            var output = {
              downloads: dayCounts,
              start: period.start,
              end: period.end
            }
            if (!conditions.all) {
              output.package = conditions.package
            }
            reply(output)
          }
        }

        // And done with the connection.
        connection.release()
      }
    )
  })

}

var handleBulkRange = function(rows, period, reply) {
  var grouped = _.groupBy(rows, 'package'),
    outputs = []

  Object.keys(grouped).forEach(function(key) {
    grouped[key] = sortByDay(grouped[key]);

    var dayCounts = _.map(grouped[key], function(r) {
      return {
        day: moment(r.day).format('YYYY-MM-DD'),
        downloads: r.downloads
      }
    });

    var output = {
      downloads: dayCounts,
      start: period.start,
      end: period.end,
      package: key
    }

    outputs.push(output)
  })

  reply(_.indexBy(outputs, 'package'));
}

var sortByDay = function (rows) {
  return rows.sort(function(a, b) {return a.day.getTime() - b.day.getTime()});
}

/**
 * We've got a last-* range. Work out what it is, and pass
 * those days as arguments to the data fetch callback.
 * @param request
 * @param reply
 * @param conditions
 * @param period
 * @param cb
 */
var getDaysFromRange = function(request,reply,conditions,period,cb) {

  request.server.plugins['hapi-mysql'].pool.getConnection(function(err, connection) {

    // we need the current max day
    connection.query(
      'SELECT max(day) as last_day FROM total_daily_downloads',
      function(er,rows) {

        if(er) {
          reply({
            error: "query failed (0003)"
          })
        } else {
          if (rows.length == 0 || !rows[0]['last_day']) {
            reply({
              error: "no daily data available (0004)"
            })
          } else {
            var result = rows[0]['last_day']
            var lastMoment = moment(result)
            var lastDay = lastMoment.format('YYYY-MM-DD')

            switch(period.range) {
              case 'last-day':
                period.start = lastDay
                break;
              case 'last-week':
                // period is inclusive, so 6 days back for 7 days total
                period.start = lastMoment.subtract('days',6).format('YYYY-MM-DD')
                break;
              case 'last-month':
                // period is inclusive, so 29 days back for 30 days total
                period.start = lastMoment.subtract('days',29).format('YYYY-MM-DD')
                break;
            }
            period.range = null
            period.end = lastDay
            cb(request,reply,conditions,period)
          }

        }

        // done with connection
        connection.release()

      }
    )

  })

}

var getAllTimeData = function(request,reply,conditions) {

  if (conditions.all) {
    reply({
      error: "all-time data for all packages is unavailable; specify a package name"
    })
    return;
  }

  var sql = "SELECT package, total_downloads FROM download_totals WHERE package = ?"
  var bindValues = [conditions.package]

  request.server.plugins['hapi-mysql'].pool.getConnection(function(err, connection) {

    // Use the connection
    connection.query(
      sql,
      bindValues,
      function(er, rows) {

        if(er) {
          reply({
            error: "query failed (0005)"
          })
        } else {
          if (rows.length == 0) {
            reply({
              error: "no totals data for this package (0006)"
            })
          } else {
            var result = rows[0]
            var output = {
              package: result.package,
              downloads: result['total_downloads']
              // TODO: could return start and end days here?
              //start: period.start,
              //end: period.end
            }
            reply(output)
          }
        }

        // And done with the connection.
        connection.release()
      }
    )
  })


}

exports.point = function (request, reply) {

  console.log("downloads.point:")
  console.log(request.params)

  var conditions = {}

  var packageName = request.params.package
  if(packageName) {
    conditions.package = packageName
  } else {
    conditions.all = true
  }

  var period = parsePeriod(request.params.period,request.server.plugins['hapi-mysql'].pool)
  if (period == false) {
    reply({
      error: "Invalid period specified"
    })
    return
  }
  if (period.outOfRange) {
    reply({
      error: "Date range requested is too large"
    })
    return
  }

  if (period.range == 'all-time') {
    getAllTimeData(request,reply,conditions)
  } else if (period.range) {
    getDaysFromRange(request,reply,conditions,period,getSumOfDays)
  } else {
    getSumOfDays(request,reply,conditions,period)
  }

}

/**
 * Same rules, but results grouped by day for nice graphs.
 * @param request
 * @param reply
 */
exports.range = function(request, reply) {

  var conditions = {}

  var packageName = request.params.package
  if(packageName) {
    conditions.package = packageName
  } else {
    conditions.all = true
  }

  var period = parsePeriod(request.params.period,request.server.plugins['hapi-mysql'].pool)
  if (period == false) {
    reply({
      error: "Invalid period specified"
    })
    return
  }

  if (period.range == 'all-time') {
    reply({
      error: "Cannot supply range date for all time (0007)"
    })
    return
  } else if (period.range) {
    getDaysFromRange(request,reply,conditions,period,getRangeOfDays)
  } else {
    getRangeOfDays(request,reply,conditions,period)
  }

}
