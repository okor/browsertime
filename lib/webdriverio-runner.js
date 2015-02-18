/**
 * Browsertime (http://www.browsertime.com)
 * Copyright (c) 2014, Peter Hedenskog, Tobias Lidskog
 * and other contributors
 * Released under the Apache 2.0 License
 */
var webdriverio = require('webdriverio'),
    async = require('async'),
    logger = require('./logger');

module.exports.run = function(bt, options, iteration, totalIterations, callback) {
  var windowSize = bt._parseWindowSize(options.size) || {x: 800, y: 600};

  var log = logger.getLog();

  log.info('Fetching ' + pageUrl + ' (' + iteration + ' of ' + totalIterations + ')');

  webdriverio
      .remote({
        desiredCapabilities: {
          browserName: options.browser
        }
      })
      .init(function(e, response) {
        bt.browserVersion = response.value.version;
        bt.os = response.value.platform;
        bt.browserName = response.value.browserName;
      })
      .windowHandleSize({width: windowSize.x, height: windowSize.y})
      .url(options.url)
      //.
      .execute(function() {
        return window.document.URL;
      }, function(err, ret) {
        console.log(ret.value); // outputs: 10
      })
      .end(callback);
};
