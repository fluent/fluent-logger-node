var createFluentSender = require('./sender').createFluentSender;
var sender = null;

module.exports = {
  configure: function(tag, options){
    if( sender !== null ){
      sender.end();
    }
    sender = createFluentSender(tag, options);
  },

  emit: function(label, data, callback){
    if( sender === null ){
      sender = new FluentSender('debug');
    }
    sender.emit(label, data, callback);
  },

  end: function(label, data){
    if( sender !== null ){
      sender.end(label, data);
    }
  },

  createFluentSender: createFluentSender,

  support: {
    log4jsAppender: function(options){
      var log4jsSupport = require('../lib/log4js');
      return log4jsSupport.appender(options);
    }
  }
}