var createFluentSender = require('./sender').createFluentSender;
var sender = null;

module.exports = {
  configure: function(tag, options){
    if( sender !== null ){
      sender.end();
    }
    sender = createFluentSender(tag, options);
  },

  createFluentSender: createFluentSender,

  support: {
    log4jsAppender: function(options){
      var log4jsSupport = require('../lib/log4js');
      return log4jsSupport.appender(options);
    }
  }
};

// delegate logger interfaces to default sender object
var methods = ['emit', 'end', 'addListener', 'on', 'once', 'removeListener', 'removeAllListeners'];
methods.forEach(function(attr, i){
  module.exports[attr] = function(){
    if( sender === null ){
      sender = new FluentSender('debug');
    }
    sender[attr].apply(sender, Array.prototype.slice.call(arguments));
  };
});
