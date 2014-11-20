#!/usr/bin/env node

var proxy = require('../lib/proxy');
var browsers = require('../lib/browsers');

require('whereis')('java', function searched(err) {
  // yep, we need Java for Selenium & the proxy
  if (err) {
    console.error(
      'Could not find Java, make sure it is installed in your $PATH');
  } else {
    var Browsertime = require('../lib/browsertime'),
      cli = require('../lib/cli'),
      argv = require('minimist')(process.argv.slice(2), {
        alias: {
          'u': 'url',
          'b': 'browser',
          'n': 'runs',
          'w': 'size',
          'f': 'filename',
          'V': 'version'
        }
      });

    cli.verifyInput(argv);

    var p = proxy.createProxy(argv);
    browsers.setProxy(p);

    var bt = new Browsertime(browsers);

    bt.on('beforeRun', function(cb) {
      p.start(cb);
    });

    bt.on('afterRun', function(cb) {
      p.stop(cb);
    });

    bt.on('callingBrowser', function(cb) {
      async.series([
        function(callback) {
          console.log('new page!');
          self.proxy.newPage('myname', callback);
        },
        function(callback) {
          console.log('reset dns!');
          self.proxy.clearDNS(callback);
        }
      ], function(err, result) {
        cb(err)
      });
    });

    bt.on('savingResults', function(data, cb) {
      proxy.saveHar('/tmp/tmp.har', data, cb);
    });

    bt.fetch(
      argv
    );
  }
});
