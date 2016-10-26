var mysql = require('mysql')

module.exports = function (connection, day, done) {
  connection.query('SELECT sum(downloads) as downloads FROM downloads WHERE day = ?', [day], function (err, res) {
    if (err) return done(err)
    console.info('total daily downloads', day, ' = ', res[0].downloads)

    connection.query('REPLACE into total_daily_downloads SET ?', {
      day: day,
      downloads: res[0].downloads,
      updated: new Date()
    }, function (err, res) {
      if (err) return done(err)
      console.info('finished populating daily download totals for', day)
      return done()
    })
  })
}
