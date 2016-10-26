var Code = require('code'),
  Lab = require('lab'),
  lab = exports.lab = Lab.script(),
  helper = require('../test-helper'),
  port = 9999,
  url = 'http://127.0.0.1:' + port,
  request = require('request'),
  dateFormat = /[0-9]{4}-[0-9]{2}-[0-9]{2}/;

lab.experiment('Downloads Controller', function () {

  lab.before(function(done) {
    helper.createServer(port, done);
  });

  lab.after(function(done) {
    helper.stopServer(done);
  });

  var expressLastDay = null;

  lab.experiment('point values', function() {

    var npmLastDay = null;

    lab.before(function(done) {
      request.get({
        url: url + '/downloads/point/last-day/npm',
        json: true
      }, function(err, res, body) {
        npmLastDay = body;
        return done();
      });
    });

    lab.experiment('for packages', function() {

      lab.it('allows point values to be fetched for last day', function(done) {
        request.get({
          url: url + '/downloads/point/last-day/express',
          json: true
        }, function(err, res, body) {
          expressLastDay = body;
          Code.expect(body.package).to.equal('express');
          Code.expect(body.downloads).to.be.greaterThan(10000);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });

      lab.it('allows point values to be fetched for specific date', function(done) {
        request.get({
          url: url + '/downloads/point/2014-03-07/express',
          json: true
        }, function(err, res, body) {
          Code.expect(body.package).to.equal('express');
          Code.expect(body.downloads).to.be.greaterThan(10000);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });

      lab.it('allows point values to be fetched for last week', function(done) {
        request.get({
          url: url + '/downloads/point/last-week/express',
          json: true
        }, function(err, res, body) {
          Code.expect(body.package).to.equal('express');
          Code.expect(body.downloads).to.be.greaterThan(10000);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });

      lab.it('allows point values to be fetched for period', function(done) {
        request.get({
          url: url + '/downloads/point/2014-02-06:2014-03-07/npm',
          json: true
        }, function(err, res, body) {
          Code.expect(body.package).to.equal('npm');
          Code.expect(body.downloads).to.be.greaterThan(10000);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });

      lab.it('allows point values to be fetched for last 30 days', function(done) {
        request.get({
          url: url + '/downloads/point/last-month/npm',
          json: true
        }, function(err, res, body) {
          Code.expect(body.package).to.equal('npm');
          Code.expect(body.downloads).to.be.greaterThan(10000);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });
    });

    lab.experiment('aggregate', function() {
      lab.it('allows point values to be fetched for last day', function(done) {
        request.get({
          url: url + '/downloads/point/last-day',
          json: true
        }, function(err, res, body) {
          Code.expect(body.package).to.equal(undefined);
          Code.expect(body.downloads).to.be.greaterThan(1000000);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });

      lab.it('allows point values to be fetched for specific date', function(done) {
        request.get({
          url: url + '/downloads/point/2014-03-07',
          json: true
        }, function(err, res, body) {
          Code.expect(body.package).to.equal(undefined);
          Code.expect(body.downloads).to.be.greaterThan(1000000);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });

      lab.it('allows point values to be fetched for last week', function(done) {
        request.get({
          url: url + '/downloads/point/last-week',
          json: true
        }, function(err, res, body) {
          Code.expect(body.package).to.equal(undefined);
          Code.expect(body.downloads).to.be.greaterThan(1000000);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });

      lab.it('allows point values to be fetched for period', function(done) {
        request.get({
          url: url + '/downloads/point/2014-02-06:2014-03-07/',
          json: true
        }, function(err, res, body) {
          Code.expect(body.package).to.equal(undefined);
          Code.expect(body.downloads).to.be.greaterThan(1000000);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });

      lab.it('allows point values to be fetched for last 30 days', function(done) {
        request.get({
          url: url + '/downloads/point/last-month',
          json: true
        }, function(err, res, body) {
          Code.expect(body.package).to.equal(undefined);
          Code.expect(body.downloads).to.be.greaterThan(1000000);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });
    });

    lab.experiment('bulk', function(done) {
      lab.it('allows point values to be fetched for last day', function(done) {
        request.get({
          url: url + '/downloads/point/last-day/express,npm',
          json: true
        }, function(err, res, body) {
          Code.expect(body.express).to.deep.equal(expressLastDay);
          Code.expect(body.npm).to.deep.equal(npmLastDay);
          return done();
        });
      });

      lab.it('allows point values to be fetched for period', function(done) {
        request.get({
          url: url + '/downloads/point/2014-02-06:2014-03-07/express,npm',
          json: true
        }, function(err, res, body) {
          Code.expect(body.express.package).to.equal('express');
          Code.expect(body.express.downloads).to.be.greaterThan(5000);
          Code.expect(body.express.start).to.match(dateFormat);
          Code.expect(body.express.end).to.match(dateFormat);

          Code.expect(body.npm.package).to.equal('npm');
          Code.expect(body.npm.downloads).to.be.greaterThan(5000);
          return done();
        });
      });
    });

  });

  lab.experiment('range', function() {

    var expressLastWeek = null,
      npmLastWeek = null;

    lab.before(function(done) {
      request.get({
        url: url + '/downloads/range/last-week/npm',
        json: true
      }, function(err, res, body) {
        npmLastWeek = body;
        return done();
      });
    });

    lab.experiment('for packages', function() {
      lab.it('allows range values to be fetched for last day', function(done) {
        request.get({
          url: url + '/downloads/range/last-day/express',
          json: true
        }, function(err, res, body) {
          expressLastDay = body;

          Code.expect(body.package).to.equal('express');
          Code.expect(body.downloads.length).to.equal(1);
          Code.expect(body.downloads[0].downloads).to.be.greaterThan(10000);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });

      lab.it('allows range values to be fetched for specific date', function(done) {
        request.get({
          url: url + '/downloads/range/2014-03-07/express',
          json: true
        }, function(err, res, body) {
          Code.expect(body.package).to.equal('express');
          Code.expect(body.downloads.length).to.equal(1);
          Code.expect(body.downloads[0].downloads).to.be.greaterThan(10000);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });

      lab.it('allows range values to be fetched for last week', function(done) {
        request.get({
          url: url + '/downloads/range/last-week/express',
          json: true
        }, function(err, res, body) {
          expressLastWeek = body;
          Code.expect(body.package).to.equal('express');
          Code.expect(body.downloads.length).to.equal(7);
          Code.expect(body.downloads[0].downloads).to.be.greaterThan(10000);
          Code.expect(body.downloads[0].day < body.downloads[6].day).to.equal(true);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });

      lab.it('allows range values to be fetched for period', function(done) {
        request.get({
          url: url + '/downloads/range/2014-03-06:2014-03-08/npm',
          json: true
        }, function(err, res, body) {
          Code.expect(body.package).to.equal('npm');
          Code.expect(body.downloads.length).to.equal(2);
          Code.expect(body.downloads[0].downloads).to.be.greaterThan(5000);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });
    });

    lab.experiment('aggregate', function() {
      lab.it('allows range values to be fetched for last day', function(done) {
        request.get({
          url: url + '/downloads/range/last-day',
          json: true
        }, function(err, res, body) {
          Code.expect(body.package).to.equal(undefined);
          Code.expect(body.downloads.length).to.equal(1);
          Code.expect(body.downloads[0].downloads).to.be.greaterThan(1000000);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });

      lab.it('allows point values to be fetched for period', function(done) {
        request.get({
          url: url + '/downloads/range/2014-03-01:2014-03-12/',
          json: true
        }, function(err, res, body) {
          Code.expect(body.package).to.equal(undefined);
          Code.expect(body.downloads.length).to.equal(7);
          Code.expect(body.downloads[0].downloads).to.be.greaterThan(1000000);
          Code.expect(body.start).to.match(dateFormat);
          Code.expect(body.end).to.match(dateFormat);
          return done();
        });
      });
    });

    lab.experiment('bulk', function() {
      lab.it('allows range values to be fetched for last week', function(done) {
        request.get({
          url: url + '/downloads/range/last-week/express,npm',
          json: true
        }, function(err, res, body) {
          Code.expect(body.npm.downloads[0].day < body.npm.downloads[6].day).to.equal(true);
          Code.expect(body.express).to.deep.equal(expressLastWeek);
          Code.expect(body.npm).to.deep.equal(npmLastWeek);
          return done();
        });
      });
    });
  });

});
