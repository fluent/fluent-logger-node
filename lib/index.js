'use strict';

var FluentSender = require('./sender').FluentSender;
var sender = new FluentSender('debug');

module.exports = {
  configure: function(tag, options){
    sender.end();
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
      var log4jsSupport = require('../lib/log4js');
      return log4jsSupport.appender(tag, options);
    }
  }
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
