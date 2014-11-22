var async = require('async');

function BrowserListenerProxy(browsertime, proxy) {
    this.browsertime = browsertime;
    this.proxy = proxy;
}

BrowserListenerProxy.prototype.setupListeners = function () {
    var p = this.proxy;
    this.browsertime
        .on('beforeRun', function (cb) {
            p.start(cb);
        })
        .on('afterRun', function (cb) {
            p.stop(cb);
        })
        .on('callingBrowser', function (callback) {
            async.series([
                    function (cb) {
                        p.newPage('myname', cb);
                    },
                    function (cb) {
                        p.clearDNS(cb);
                    }
                ],
                callback);
        })
        .on('savingResults', function (data, cb) {
            console.log('Storing /tmp/tmp.har');
            p.saveHar('/tmp/tmp.har', data.data, cb);
        });
};

module.exports.setup = function(browsertime, proxy) {
    var blp = new BrowserListenerProxy(browsertime, proxy);
    blp.setupListeners();
};
