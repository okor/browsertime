'use strict';

let Promise = require('bluebird'),
  log = require('intel'),
  path = require('path'),
  JarLauncher = require('../support/jar_launcher'),
  MobProxy = require('browsermob-proxy-api'),
  merge = require('lodash.merge'),
  getport = require('getport');

getport = Promise.promisify(getport);
Promise.promisifyAll(MobProxy.prototype);

const defaults = {};

class BmpRunner {
  constructor(options) {
    this.options = merge({}, defaults, options);

    this.jarPath = path.resolve(__dirname, '..', '..', 'vendor', 'bmpwrapper-2.0.0-full.jar');

    this.jarLauncher = new JarLauncher(
      {
        'jarPath': this.jarPath,
        'stdoutLogLevel': log.DEBUG,
        'stderrLogLevel': log.DEBUG,
        'startupCriteria': {
          'success': {
            'stdout': null,
            'stderr': 'Started SelectChannelConnector'
          },
          'failure': {
            'stdout': null,
            'stderr': 'Failed to start Jetty server'
          }
        }
      }
    );

  }

  start() {
    return getport()
      .then((port) => {
        this.restPort = port;
        return this.jarLauncher.start(['-port', port]);
      })
      .timeout(10000, this.jarPath + ' hasn\'t started after 10 seconds');
  }

  stop() {
    return this.jarLauncher.stop();
  }

  startProxy() {
    log.debug('starting proxy');

    return getport()
      .then((port) => {
        this.proxyPort = port;
        this.proxy = new MobProxy({
          'host': 'localhost',
          'port': this.restPort
        });
        return this.proxy.startPortAsync(port);
      })
      .then(() => this.proxyPort);
  }

  stopProxy() {
    log.debug('stopping proxy');
    return this.proxy.stopPortAsync(this.proxyPort);
  }

  setLimit(limit) {
    log.debug('Setting connection limit %:1j', limit);
    return this.proxy.setLimitAsync(this.proxyPort, limit);
  }

  createHAR(harOptions) {
    const defaultHarOptions = {'captureHeaders': true};
    let options = merge({}, harOptions, defaultHarOptions);
    return this.proxy.createHARAsync(this.proxyPort, options);
  }

  startNewPage(name) {
    return this.proxy.startNewPageAsync(this.proxyPort, name);
  }

  getHAR() {
    return this.proxy.getHARAsync(this.proxyPort);
  }
}
module.exports = BmpRunner;
