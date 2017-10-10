'use strict';
/**
 * winston transport support
 */

var sender = require('./sender');
var util = require('util');
var winston = require('winston');
var Transport = winston.Transport;
var DEFAULT_TAG = 'winston';

function fluentTransport(tag, options) {
  if (arguments.length === 0) {
    tag = DEFAULT_TAG;
  } else {
    if (typeof(tag) === 'object') {
      options = tag;
      tag = DEFAULT_TAG;
    }
  }

  options = options || {};

  this.sender = new sender.FluentSender(tag, options);

  Transport.call(this);
}

util.inherits(fluentTransport, Transport);

fluentTransport.prototype.log = function(level, message, meta, callback) {
  var sender = this.sender;

  var data = {
    level: level,
    message: message,
    meta: meta
  };


  sender.emit(data, (error) => {
    if (error) {
      this.emit('error', error);
      callback(error, false);
    } else {
      this.emit('logged');
      callback(null, true);
    }
  });

};

fluentTransport.prototype.name = 'fluent';
exports.Transport = fluentTransport;
