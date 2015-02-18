/**
 * Browsertime (http://www.browsertime.com)
 * Copyright (c) 2014, Peter Hedenskog, Tobias Lidskog
 * and other contributors
 * Released under the Apache 2.0 License
 */
var stats = require('./statistics'),
    fs = require('fs'),
    async = require('async'),
    path = require('path'),
    logger = require('./logger'),
    url = require('url'),
    util = require('util'),
    EventEmitter = require('async-node-events'),
    seleniumRunner = require('./selenium-runner'),
    webdriverioRunner = require('./webdriverio-runner');

var defaultWaitScript = 'return window.performance.timing.loadEventEnd>0';

function Browsertime(b) {
  this.log = logger.getLog();
  EventEmitter.call(this);
  this.result = [];
  this.scripts = [];
  this.browserVersion = '';
  this.os = '';
  this.browserName = '';
  this.userAgent = '';
  this.browsers = b;

}

util.inherits(Browsertime, EventEmitter);

Browsertime.prototype.fetch = function(options, callback) {

  callback = callback || function() {};

  this._setupDefaults(options);
  this._populateScripts(options);

  var self = this;

  async.series([
    function(cb) {
      self.emit('beforeRun', cb);
    },
    function(cb) {
      self._do(options, cb);
    },
    function(cb) {
      self.emit('afterRun', cb);
    }
  ], function(err, results) {
    callback(err);
  });
};

Browsertime.prototype._do = function(options, cb) {
  var browserRuns = [];
  var self = this;
  for (var i = 1; i <= options.runs; i++) {
    browserRuns.push(self._collectFromTheBrowser(options, i, options.runs));
  }

  async.series(browserRuns,
    function(err, results) {
      if (err) {
        self.log.error(err.message);
        return cb(err);
      }
      var data = self._getFormattedResult(options);
      self._saveToFile(data, options, cb);
    });
};

Browsertime.prototype._collectFromTheBrowser = function(options, iteration, totalIterations) {
  var self = this;

  return function(callback) {
    if (options.webdriverio) {
      webdriverioRunner.run(self, options, iteration, totalIterations, callback);
    } else {
      seleniumRunner.run(self, options, iteration, totalIterations, callback);
    }
  };
};

Browsertime.prototype._getFormattedResult = function(options) {
  // fetch timings for each run and make some statistics
  var timings = {};
  this.result.forEach(function(run) {
    stats.setupTimingsStatistics(timings, run);
    stats.setupStatistics(timings, run, 'speedIndex');
    stats.setupStatistics(timings, run, 'firstPaint');
    stats.setupUserTimingsStatistics(timings, run);
  });
  return {
    url: options.url,
    runs: options.runs,
    browserName: this.browserName,
    browserVersion: this.browserVersion,
    platform: this.os,
    userAgent: options.userAgent || this.userAgent,
    windowSize: 'unknown',
    browserTimeVersion: require('../package.json').version,
    statistics: stats.formatStatistics(timings),
    data: this.result
  };
};

Browsertime.prototype._saveToFile = function(data, options, cb) {
  var self = this;

  // lets store the files
  async.parallel([
      function(callback) {
        fs.writeFile(options.filename, JSON.stringify(data), function(err) {
          self.log.info('Storing ' + options.filename);
          callback(err);
        });
      },
      function(callback) {
        self.emit('savingResults', { data: data }, callback);
      }
    ], cb);
};

Browsertime.prototype._setupDefaults = function(options) {

  options.runs = options.runs || 3;
  options.filename = options.filename || path.join(process.cwd(), url.parse(options.url).hostname + '.json');
  options.seleniumServer = options.seleniumServer || 'http://localhost:4444/wd/hub';
  options.waitScript = options.waitScript || defaultWaitScript;
};

Browsertime.prototype._populateScripts = function(options) {
  var scriptRoots = [path.join(__dirname, 'scripts')];
  if (options.scriptPath) {
    scriptRoots.push(path.resolve(options.scriptPath));
  }

  var self = this;

  scriptRoots.forEach(function(rootPath) {
    fs.readdirSync(rootPath).forEach(function(file) {
      self.scripts.push(require(path.join(rootPath, file)));
    });
  });
};

Browsertime.prototype._parseWindowSize = function(size) {
  if (!size) {
    return undefined;
  }

  var coordinates = size.split('x');
  var parsedSize;

  if (coordinates.length === 2) {
    parsedSize = {
      'x': parseInt(coordinates[0], 10),
      'y': parseInt(coordinates[1], 10)
    };
  }

  if (!parsedSize || isNaN(parsedSize.x) || isNaN(parsedSize.y)) {
    this.log.warn('%s is not a valid windows size. It needs to be formatted as WIDTHxHEIGHT, e.g. 640x480.', size);
  }

  return parsedSize;
};

module.exports = Browsertime;
