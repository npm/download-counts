var mysql = require('mysql')

exports.get = function (request, reply) {

  console.log(request.server.plugins)

  request.server.plugins['hapi-mysql'].pool.getConnection(function(err, connection) {

    console.log(request.params)

    // Use the connection
    connection.query(
      'SELECT package, downloads FROM downloads WHERE package = ? AND day = ?',
      [
        request.params.package,
        request.params.period
      ],
      function(err, rows) {

        if(err) {
          throw new Error(err)
        }

        // And done with the connection.
        connection.release();

        if (rows.length == 0) {
          reply({
            error: "no stats for this package for this period"
          })
        } else {
          var result = rows[0]

          reply({
            package: result.package,
            downloads: result.downloads
          });
        }

      }
    );
  });

}