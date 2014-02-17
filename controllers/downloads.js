exports.get = function (request, reply) {

  console.log(request.server.plugins)

  request.server.plugins['hapi-mysql'].pool.getConnection(function(err, connection) {

    // Use the connection
    connection.query( 'SELECT * FROM bob', function(err, rows) {

      console.log(rows)

      // And done with the connection.
      connection.release();

      reply('hello world');

    });
  });

}