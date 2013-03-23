var log4js = require('log4js')
var fluentd = require('./lib/index');

log4js.addAppender(fluentd.support.log4jsAppender('fluentd.test', {
   host: 'log4js',
   port: 24224,
   timeout: 0.1
}));

var logger = log4js.getLogger('foo');
logger.info('this log record is sent to fluent daemon'); 
