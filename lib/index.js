'use strict';

var FluentSender = require('./sender').FluentSender;
var sender = new FluentSender('debug');

module.exports = {
  configure: function(tag, options){
    sender.end();
    sender = new FluentSender(tag, options);
    
    // Default reconnect interval is 10 minutes
    var reconnectInterval = options && options.reconnectInterval || 600000;
    
    // Error handling: reconnect after a reconnectInterval
    sender.on("error", function(error) {
      console.error("Fluentd error", error);
      console.info("Fluentd will reconnect after 10 minutes.");
      setTimeout(function() {
        console.info("Fluentd is reconnecting...");
        sender._connect(function() {
          console.info("Fluentd reconnection finished!");
        });
      }, reconnectInterval);
    });
  },

  createFluentSender: function(tag, options){
    return new FluentSender(tag, options);
  },

  support: {
    log4jsAppender: function(tag, options){
      var log4jsSupport = require('../lib/log4js');
      return log4jsSupport.appender(tag, options);
    }
  }
};

// delegate logger interfaces to default sender object
var methods = ['emit', 'end', 'addListener', 'on', 'once', 'removeListener', 'removeAllListeners'];
methods.forEach(function(attr, i){
  module.exports[attr] = function(){
    if( sender ){
      sender[attr].apply(sender, Array.prototype.slice.call(arguments));
    }
  };
});
