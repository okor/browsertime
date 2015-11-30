'use strict';

let Promise = require('bluebird'),
  log = require('intel'),
  path = require('path'),
  merge = require('lodash.merge'),
  BmpRunner = require('./bmp_runner'),
  harBuilder = require('../support/har_builder'),
  trafficShapeParser = require('../support/traffic_shape_parser'),
  SeleniumRunner = require('./selenium_runner');

const defaults = {
  'scripts': [],
  'iterations': 3,
  'delay': 0
};

class Engine {
  constructor(options) {
    this.options = merge({}, defaults, options);
    this.bmpRunner = new BmpRunner();
  }

  start() {
    return this.bmpRunner.start();
  }

  run(url) {
    let options = this.options;
    let scripts = options.scripts;
    let pageCompleteCheck = options.pageCompleteCheck;
    let delay = options.delay;
    let bmpRunner = this.bmpRunner;

    let trafficShapeConfig = trafficShapeParser.parseTrafficShapeConfig(options);

    function runScripts(runner) {
      return Promise.reduce(scripts, function(results, script) {
        let name = path.basename(script.path, '.js');
        let result = runner.runScript(script.source);

        return Promise.join(name, result, function(n, r) {
          results[n] = r;
          return results;
        });
      }, {});
    }

    function runIteration() {
      let runner = new SeleniumRunner(options);

      return runner.start()
        .tap(function(capabilities) {
          log.verbose('Capabilities %:1j', capabilities.serialize());
        })
        .tap(() => runner.loadAndWait(url, pageCompleteCheck))
        .then(() => runScripts(runner))
        .tap((result) => {
          if (options.browser === 'firefox') {
            // TODO fix timings via performance.timing, see https://github.com/firebug/har-export-trigger/issues/5
            const script = `
            var callback = arguments[arguments.length - 1];
            function triggerExport() {
              HAR.triggerExport({'token':'test', 'getData':true})
              .then((result) => callback(result.data))
              .catch((e) => callback(e));
            };
            if (typeof HAR === 'undefined') {
              addEventListener('har-api-ready', triggerExport, false);
            } else {
              triggerExport();
            }`;
            return runner.runAsyncScript(script).then(JSON.parse).then((har) => {
              // TODO potentially remove incomplete entries, such as with response.status=0 or time=null
              result.ffHar = har;
            });
          }
        })
        .finally(() => runner.stop());
    }

    function shouldDelay(runIndex, totalRuns) {
      let moreRunsWillFollow = ((totalRuns - runIndex) > 1);
      return (delay > 0) && moreRunsWillFollow;
    }

    let iterations = new Array(this.options.iterations);

    let result = {};
    return bmpRunner.startProxy()
      .tap(function(proxyPort) {
        options.proxyPort = proxyPort;
      })
      .tap(() => {
        if (trafficShapeConfig) {
          return bmpRunner.setLimit(trafficShapeConfig);
        }
      })
      .then(() => bmpRunner.createHAR())
      .then(() => Promise.reduce(iterations, function(results, item, runIndex, totalRuns) {
          let promise = Promise.resolve();

          if (runIndex > 0) {
            promise = promise.then(() => bmpRunner.startNewPage());
          }

          promise = promise
            .then(runIteration)
            .then(function(r) {
              results.push(r);
              return results;
            });

          if (shouldDelay(runIndex, totalRuns)) {
            promise = promise.delay(delay);
          }

          return promise;
        }, [])
      )
      .tap(function(data) {
        if (options.browser === 'firefox') {
          let ffHars = [];
          data = data.map((iterationData) => {
            let ffHar = iterationData.ffHar;
            delete iterationData.ffHar;
            if (ffHar) {
              ffHars.push(ffHar);
            }
            return iterationData;
          });
          if (ffHars.length > 0) {
            result.ffHar = harBuilder.mergeHars(ffHars);
          }
        }
        result.browsertimeData = data;
      })
      .then(() => bmpRunner.getHAR())
      .then(JSON.parse)
      .then((har) => {
        harBuilder.addCreator(har);
        result.har = har;
        return result;
      })
      .tap(() => bmpRunner.stopProxy());
  }

  stop() {
    log.debug('Stopping proxy process');
    return this.bmpRunner.stop()
      .tap(function() {
        log.debug('Stopped proxy process');
      });
  }
}

module.exports = Engine;
