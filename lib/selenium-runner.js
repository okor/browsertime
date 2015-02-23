/**
 * Browsertime (http://www.browsertime.com)
 * Copyright (c) 2014, Peter Hedenskog, Tobias Lidskog
 * and other contributors
 * Released under the Apache 2.0 License
 */
var webdriver = require('selenium-webdriver'),
    async = require('async'),
    logger = require('./logger');

module.exports.run = function(bt, options, iteration, totalIterations, callback) {
  var pageUrl = options.url,
      pageLoadTimeout = 60000;

  var log = logger.getLog();

  webdriver.promise.controlFlow().on('uncaughtException', function(e) {
    callback(e);
  });

  async.series([
        function(cb) {
          bt.emit('callingBrowser', cb);
        }
      ],
      function(err, results) {
        var driver = bt.browsers.getBrowser(options.browser).getDriver(options);

        driver.getCapabilities().then(function(cap) {
          bt.browserVersion = cap.get('version');
          bt.os = cap.get('platform');
          bt.browserName = cap.get('browserName');
        });

        driver.manage().window().setPosition(0, 0);

        var windowSize = bt._parseWindowSize(options.size) || {x: 800, y: 600};
        if (windowSize) {
          driver.manage().window().setSize(windowSize.x, windowSize.y);
        }

        // fetch the URL and wait until the load event ends or we get the time out
        log.info('Fetching ' + pageUrl + ' (' + iteration + ' of ' + totalIterations + ')');
        driver.get(pageUrl);

        var afterFetchTime = Date.now();

        driver.wait(function() {
              return driver.executeScript(options.waitScript)
                  .then(function(b) {
                    return b;
                  });
            },
            pageLoadTimeout
        ).then(function() {
              var afterLoadTime = Date.now();

              log.verbose('loading url took %d milliseconds', (afterLoadTime - afterFetchTime));
              // This is needed since the Firefox driver executes the success callback even when driver.wait
              // took too long.
              if ((afterLoadTime - afterFetchTime) > pageLoadTimeout) {
                return callback(new Error('The url ' + pageUrl + ' timed out'));
              }

              // lets run all scripts
              var promises = [];
              bt.scripts.forEach(function(script) {
                promises.push(driver.executeScript(script));
              });

              var callbacks = [];
              promises.forEach(function(promise) {
                callbacks.push(function(cb) {
                  promise.then(function(value) {
                    cb(null, value);
                  });
                });
              });

              // when we are finished, push the result and stop the browser
              async.parallel(callbacks,
                  function(err, results) {
                    var eachRun = {};
                    results.forEach(function(metric) {
                      Object.keys(metric).forEach(function(key) {
                        eachRun[key] = metric[key];
                      });
                    });
                    bt.result.push(eachRun);
                    driver.quit();
                    callback();
                  });
            },
            function() {
              var afterLoadTime = Date.now();

              log.verbose('loading url took %d milliseconds', (afterLoadTime - afterFetchTime));

              driver.quit().thenFinally(function() {
                return callback(new Error('The url ' + pageUrl + ' timed out'));
              });
            });
      });
};
