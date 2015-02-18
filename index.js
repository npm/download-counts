var Hapi = require('hapi');
var Joi = require('joi')

// load config
var Config = require('./config')

// load controllers
var downloads = require('./controllers/downloads')

// Create the server
var server = Hapi.createServer('0.0.0.0', process.env.PORT || Config.server.port, Config.server.options);
server.pack.require('./node_modules/hapi-mysql', Config.readDb, function(err) {
  if (err) {
    console.error(err);
    throw err;
  }
});

// Validation for parameters
var downloadsSchema = {
  // valid periods: 2014-02-01, 2014-01-02:2014-01-04, all-time, last-day, last-week
  period: Joi.string().regex(/(\d{4}-\d{2}-\d{2}(:\d{4}-\d{2}-\d{2})?|[\w-]+)/).required(),
  // valid package names: jquery, jquery-express, socket.io, socket.io-express
  package: Joi.string().regex(/(^[a-zA-Z0-9]([^\/\(\)&\?#\|<>@:%\s\\\*'"!~`])*)*/).allow('')
};

// Add the routes
server.route({
  method: 'GET',
  path: '/downloads/point/{period}/{package?}',
  config: {
    handler: downloads.point,
    validate: {
      path: downloadsSchema
    }
  }
});
server.route({
  method: 'GET',
  path: '/downloads/range/{period}/{package?}',
  handler: downloads.range
});

// Start the server
server.start(function() {
  console.log("Downloads API running on port " + server._port)
});
