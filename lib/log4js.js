/**
 * log4js appender support
 */
var createFluentSender = require('./sender').createFluentSender;
var util = require('util');
var DEFAULT_TAG = 'log4js';

function fluentAppender(tag, options){
  if( arguments.length === 0 ){
    tag = DEFAULT_TAG;
  }else{
    if( typeof(tag) == 'object' ){
      options = tag;
      tag = DEFAULT_TAG;
    }
  }
  var logSender = createFluentSender(tag, options);
  // FIXME
  process.on('exit', function(){
    logSender.end();
  });
  var appender = function(loggingEvent){
    var data =  util.format.apply(null, loggingEvent.data);
    var rec = {
      timestamp: loggingEvent.startTime.getTime(),
      category: loggingEvent.categoryName,
      levelInt: loggingEvent.level.level,
      levelStr: loggingEvent.level.levelStr,
      data: data
    };
    logSender.emit(loggingEvent.level.levelStr, rec);
  };
  return appender;
}

function configure(config){
  var layout;
  if (config.layout) {
	  layout = layouts.layout(config.layout.type, config.layout);
  }
  return fluentAppender();
}

exports.name = 'fluent';
exports.appender = fluentAppender;
exports.configure = configure;
