var manta = require('manta-client')
var assert = require('assert')
var moment = require('moment')
var async = require('async')

var client = manta.createClient({
  sign: manta.privateKeySigner({
    key: Config.manta.key,
    keyId: Config.manta.key_id,
    user: Config.manta.user
  }),
  user: Config.manta.user,
  url: Config.manta.url
});
assert.ok(client)

console.log('manta ready: %s', client.toString());

var pool = mysql.createPool(Config.db);
pool.getConnection(function(err, connection) {

  assert.ifError(err)

  console.log('mysql connected')

  getAvailableDays()

});

var getAvailableDays = function() {

  var days = []

  client.ls(Config.manta.statsDir, function (err, res) {

    assert.ifError(err);

    res.on('object',function(obj) {
      console.log(obj)
    })

    res.once('end',function() {
      //importFiles(days)
      console.log('done')
    })

  })

}