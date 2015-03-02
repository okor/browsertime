/**
 * Wait until a condition, given by a javascript snippet, is met. The condition is
 * evaluated in the browser every 100ms, until it returns true, or the provided timeout
 * time has passed.
 *
 * @param {String|Function} script     the wait condition to test
 * @param {Number=}  ms       time to wait in ms (default: 500)
 * @param {Boolean=} reverse  if true it waits for script to return false (default: false)
 *
 * <example>
 :waitForCondition.js
 it('some title', function(done) {

        client
            .click('#elemA')
            .waitForCondition('return document.querySelectorAll('a').length === 42')
            .click('#elemB')
            .call(done);

    });
 * </example>
 *
 * @uses protocol/executeAsync, protocol/timeoutsAsyncScript
 * @type utility
 */

var async = require('async'),
    ErrorHandler = require('webdriverio').ErrorHandler;

module.exports = function waitForCondition(script, ms, reverse) {

  /*!
   * make sure that callback contains chainit callback
   */
  var callback = arguments[arguments.length - 1];

  /*!
   * parameter check
   */
  if (typeof script !== 'string' && typeof script !== 'function') {
    return callback(new ErrorHandler.CommandError('number or type of arguments don\'t agree with waitForCondition command'));
  }

  if (typeof script === 'function') {
    script = 'return (' + script + ').apply(null, arguments)';
  }

  /*!
   * ensure that ms is set properly
   */
  if (typeof ms !== 'number') {
    ms = this.options.waitforTimeout;
  }

  if (typeof reverse !== 'boolean') {
    reverse = false;
  }

  var conditionScript = function checkCondition(condition, expected, cb) {
    var conditionFunction = new Function(condition); // jshint ignore:line
    if (conditionFunction() === expected) {
      return cb(true);
    } else {
      setTimeout(checkCondition, 100, condition, expected, cb);
    }
  };

  var self = this,
      response = {};

  async.waterfall([
    function(cb) {
      self.timeoutsAsyncScript(ms, cb);
    },
    function(result, cb) {
      response.timeoutsAsyncScript = result;
      self.executeAsync(conditionScript, script, !reverse, function(err, ret) {
        return cb(err, ret && ret.value);
      });
    },
    function(result, cb) {
      response.checkCondition = result;
      cb();
    }
  ], function(err) {
    return callback(err, response.checkCondition, response);
  });
};
