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
      return period;
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

  var sql = 'SELECT package, sum(downloads) as downloads FROM downloads WHERE day >= ? and day <= ?'
  var bindValues = []

  bindValues.push(period.start)
  bindValues.push(period.end)

  if(conditions.package) {
    sql += ' AND package = ?'
    bindValues.push(conditions.package)
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
            var result = rows[0]
            var output = {
              downloads: result.downloads,
              start: period.start,
              end: period.end
            }
            if (!conditions.all) {
              output.package = result.package
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

  bindValues.push(period.start)
  bindValues.push(period.end)

  if(conditions.package) {
    sql += 'SELECT day, downloads FROM downloads WHERE day >= ? and day <= ? AND package = ?'
    bindValues.push(conditions.package)
  } else {
    // if all packages, group by day
    sql += 'SELECT day, SUM(downloads) FROM downloads WHERE day >= ? and day <= ? GROUP BY day'
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
          } else {
            var dayCounts = rows.map(function(row) {
              row.day = moment(row.day).format('YYYY-MM-DD')
              return row
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
      'SELECT max(day) as last_day FROM downloads',
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
                period.start = lastMoment.subtract('days',7).format('YYYY-MM-DD')
                break;
              case 'last-month':
                period.start = lastMoment.subtract('days',30).format('YYYY-MM-DD')
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