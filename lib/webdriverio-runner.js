/**
 * Browsertime (http://www.browsertime.com)
 * Copyright (c) 2014, Peter Hedenskog, Tobias Lidskog
 * and other contributors
 * Released under the Apache 2.0 License
 */
'use strict';

var urlParser = require('url'),
    webdriverio = require('webdriverio'),
    async = require('async'),
    logger = require('./logger'),
    waitForCondition = require('./webdriverio-waitForCondition');

var spawn = require('cross-spawn'),
    webdrvr = require('webdrvr'),
    getport = require('getport');

var seleniumStartupTimeout = 10000;
var seleniumProcess;

function launchSelenium(port, cb) {
  var timeout;

  logger.getLog().verbose('Starting Selenium on port ' + port);

  function removeStartupLogListeners() {
    seleniumProcess.stdout.removeListener('data', tailStdOutForSuccess);
    seleniumProcess.stderr.removeListener('data', tailStdErrForFailure);
  }

  function tailStdOutForSuccess(data) {
    if (data.toString().indexOf('Started org.openqa.jetty.jetty.Server') > -1) {
      removeStartupLogListeners();
      clearTimeout(timeout);

      cb(null, port);
    }
  }

  function tailStdErrForFailure(data) {
    var logLine = data.toString();
    if (logLine.indexOf('Started org.openqa.jetty.jetty.Server') > -1) {
      removeStartupLogListeners();
      clearTimeout(timeout);

      cb(null, port);
    } else if (logLine.indexOf('Failed to start ') > -1) {
      removeStartupLogListeners();
      clearTimeout(timeout);

      cb(new Error('Selenium failed to start: ' + logLine));
    }
  }

  function endWithTimeout() {
    removeStartupLogListeners();

    cb(new Error('timeout, waited ' + seleniumStartupTimeout + ' milliseconds, and Selenium didn\'t start'));
  }

  seleniumProcess = spawn('java', ['-jar', webdrvr.selenium.path, '-port', port]);

  timeout = setTimeout(endWithTimeout, seleniumStartupTimeout);

  seleniumProcess.stdout.on('data', tailStdOutForSuccess);

  seleniumProcess.stderr.on('data', tailStdErrForFailure);
}

function stopSelenium() {
  if (seleniumProcess) {
    logger.getLog().verbose('Stopping Selenium');
    seleniumProcess.kill();
  }
}

function runWebDriver(options, bt, iteration, totalIterations, callback) {
  var pageUrl = options.url,
      pageLoadTimeout = 6000;

  var windowSize = bt._parseWindowSize(options.size) || {x: 800, y: 600};

  var log = logger.getLog();

  log.info('Fetching ' + pageUrl + ' (' + iteration + ' of ' + totalIterations + ')');

  async.series([
        function(cb) {
          bt.emit('callingBrowser', cb);
        }
      ],
      function(err) {
        if (err) {
          return callback(err);
        }

        var browserOptions = {
          desiredCapabilities: {
            browserName: options.browser
          }
        };

        var seleniumUrl = urlParser.parse(options.seleniumServer);
        browserOptions.host = seleniumUrl.hostname;
        browserOptions.port = seleniumUrl.port;

        var proxy = bt.browsers.getProxy();

        var proxyUrl = proxy.getProxyUrl();
        if (proxyUrl) {
          browserOptions.desiredCapabilities.proxy = {
            proxyType: 'manual',
            httpProxy: proxyUrl
          };
        }

        var client = webdriverio
            .remote(browserOptions);

        client.addCommand('waitForCondition', waitForCondition.bind(client));

        client = client
            .init(function(e, response) {
              var browserInfo = response.value;
              bt.browserVersion = browserInfo.version;
              bt.os = browserInfo.platform;
              bt.browserName = browserInfo.browserName;
            })
            .windowHandleSize({width: windowSize.x, height: windowSize.y})
            .url(options.url)
            .waitForCondition(options.waitScript, pageLoadTimeout, false);

        var result = {};
        bt.scripts.forEach(function(script) {
          client = client.execute(script)
              .then(function(res) {
                var metric = res.value;
                Object.keys(metric).forEach(function(key) {
                  result[key] = metric[key];
                });
              });
        });

        client.call(function() {
          bt.result.push(result);
        }).end(callback);
      });
}

module.exports.run = function(bt, options, iteration, totalIterations, callback) {
  async.waterfall([
        function(cb) {
          getport(cb);
        },
        function(port, cb) {
          launchSelenium(port, cb);
        },
        function(port, cb) {
          options.seleniumServer = 'http://localhost:' + port;
          runWebDriver(options, bt, iteration, totalIterations, cb);
        }],
      function(err) {
        stopSelenium();
        callback(err);
      }
  );
};
