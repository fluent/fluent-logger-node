'use strict';

var FluentSender = require('./sender').FluentSender;
var sender = new FluentSender('debug');
var log4jsSupport = require('../lib/log4js');

module.exports = {
  configure: function(config){
    sender.end();
    var tag = config;
    var options = arguments[1];
    sender = new FluentSender(tag, options);
    sender._setupErrorHandler();
  },

  createFluentSender: function(tag, options){
    var _sender = new FluentSender(tag, options);
    _sender._setupErrorHandler();
    return _sender;
  },

  support: {
    log4jsAppender: function(tag, options){
      var appender = log4jsSupport.appender(tag, options);
      appender._setupErrorHandler();
      return appender;
    },
    winstonTransport: function() {
      var winstonSupport = require('../lib/winston');
      var transport = winstonSupport.Transport;
      return transport;
    }
  },

  appender: log4jsSupport.appender
};

// delegate logger interfaces to default sender object
var methods = ['emit', 'end', 'addListener', 'on', 'once', 'removeListener', 'removeAllListeners', 'setMaxListeners', 'getMaxListeners'];
methods.forEach(function(attr, i){
  module.exports[attr] = function(){
    if( sender ){
      return sender[attr].apply(sender, Array.prototype.slice.call(arguments));
    }
    return undefined;
  };
});
