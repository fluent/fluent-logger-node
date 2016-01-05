'use strict';
/**
 * log4js appender support
 */
var sender = require('./sender');
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
  var logSender = new sender.FluentSender(tag, options);
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
    if (options.levelTag !== false) {
      logSender.emit(loggingEvent.level.levelStr, rec);
    } else {
      logSender.emit(rec);
    }
  };
  ['addListener', 'on', 'once', 'removeListener', 'removeAllListeners', 'setMaxListeners', 'getMaxListeners', '_setupErrorHandler'].forEach(function(attr, i){
    appender[attr] = function(){
      return logSender[attr].apply(logSender, Array.prototype.slice.call(arguments));
    };
  });
  // For Node.js v0.12 or earlier
  appender._eventEmitter = logSender._eventEmitter;
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
