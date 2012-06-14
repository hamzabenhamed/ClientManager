var connect        = require('connect'),
    express        = require('express'),
    connectTimeout = require('connect-timeout'),
    mongoose       = require('mongoose'),
    utils          = require('./lib/utils'),
    EventEmitter   = require('events').EventEmitter,
    AppEmitter     = new EventEmitter(),
    app            = express.createServer(),
    ENV            = process.env.NODE_ENV || 'development',
    log            = console.log,
    dbPath;

utils.loadConfig(__dirname + '/config', function(config) {
  app.use(function(req, res, next) {
    res.removeHeader("X-Powered-By");
    next();
  });
  app.configure(function() {
    utils.ifEnv('production', function() {
      // enable gzip compression
      app.use(connect.compress({
        level: 9,
        memLevel: 9
      }));
    });
    app.use(express.favicon());
    utils.ifEnv('production', function() {
      app.use(express.staticCache());
    });
    app.use(express['static'](__dirname + '/public'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    utils.ifEnv('production', function() {
      app.use(connectTimeout({
        time: parseInt(config[ENV].REQ_TIMEOUT, 10)
      }));
    });
  });

  mongoose = utils.connectToDatabase(mongoose, config.db[ENV].main);

  // register models
  require('./app/models/client')(mongoose);

  // register controllers
  ['clients', 'errors'].forEach(function(controller) {
    require('./app/controllers/' + controller + '_controller')(app, mongoose, config);
  });

  app.on('error', function (e) {
    if (e.code == 'EADDRINUSE') {
      log('Address in use, retrying...');
      setTimeout(function () {
        app.close();
        app.listen(config[ENV].PORT, function() {
          app.serverUp = true;
        });
      }, 1000);
    }
  });

  if (!module.parent) {
    app.listen(config[ENV].PORT, function() {
      app.serverUp = true;
    });
    log('Express server listening on port %d, environment: %s', app.address().port, app.settings.env);
  }

  AppEmitter.on('checkApp', function() {
    AppEmitter.emit('getApp', app);
  });

});

/**
 * export AppEmitter for external services so that the callback can execute
 * when the app has finished loading the configuration
 */
module.exports = AppEmitter;
