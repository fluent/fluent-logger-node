/**
 * winston appender support
 */
var sender = require('./sender');
var util = require('util');
var DEFAULT_TAG = 'winston';
var winston = require('winston');
var Transport = winston.Transport;

function FluentTransport(tag, options) {
  if (arguments.length === 0) {
    tag = DEFAULT_TAG;
  } else {
    if (typeof(tag) == 'object') {
      options = tag;
      tag = DEFAULT_TAG;
    }
  }

  options = options || {};

  this.sender = new sender.FluentSender(tag, options);

  Transport.call(this);
}

util.inherits(FluentTransport, Transport);

FluentTransport.prototype.log = function(level, msg, meta, callback) {
  var self = this;
  var sender = self.sender;

  var data = {
    level: level,
    message: msg,
    meta: meta
  };


  sender.emit(data);
  callback(null, true);
  self.emit('logged');
};

FluentTransport.prototype.name = module.exports.name = 'fluent';
module.exports.Transport = FluentTransport;