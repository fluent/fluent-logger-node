'use strict';
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var msgpack = require('msgpack-lite');
var net = require('net');
var stream = require('stream');
var crypto = require('crypto');
var FluentLoggerError = require('./logger-error');
var EventTime = require('./event-time').EventTime;

var codec = msgpack.createCodec();
codec.addExtPacker(0x00, EventTime, EventTime.pack);
codec.addExtUnpacker(0x00, EventTime.unpack);

function FluentSender(tag_prefix, options){
  options = options || {};
  this.tag_prefix = tag_prefix;
  this.host = options.host || 'localhost';
  this.port = options.port || 24224;
  this.path = options.path;
  this.timeout = options.timeout || 3.0;
  this.reconnectInterval = options.reconnectInterval || 600000; // Default is 10 minutes
  this.requireAckResponse = options.requireAckResponse;
  this.ackResponseTimeout = options.ackResponseTimeout || 190000; // Default is 190 seconds
  this.internalLogger = options.internalLogger || console;
  this._timeResolution = options.milliseconds ? 1 : 1000;
  this._socket = null;
  this._data = null;
  this._sendQueue = []; // queue for items waiting for being sent.
  this._eventEmitter = new EventEmitter();
}

FluentSender.prototype.emit = function(/*[label] <data>, [timestamp], [callback] */){
  var label, data, timestamp, callback;
  var args = Array.prototype.slice.call(arguments);
  // Label must be string always
  if (typeof args[0] === 'string') label = args.shift();

  // Data can be almost anything
  data = args.shift();

  // Date can be either timestamp number or Date object
  if (typeof args[0] !== 'function') timestamp = args.shift();

  // Last argument is an optional callback
  if (typeof args[0] === 'function') callback = args.shift();


  var self = this;
  var item = self._makePacketItem(label, data, timestamp);

  var error;
  var options;
  if (item.tag === null) {
    options = {
      tag_prefix: self.tag_prefix,
      label: label
    };
    error = new FluentLoggerError.MissingTag('tag is missing', options);
    self._handleEvent('error', error, callback);
    return;
  }
  if (typeof item.data !== 'object') {
    options = {
      tag_prefix: self.tag_prefix,
      label: label,
      record: item.data
    };
    error = new FluentLoggerError.DataTypeError('data must be an object', options);
    self._handleEvent('error', error, callback);
    return;
  }

  item.callback = callback;

  self._sendQueue.push(item);
  self._connect(function(){
    self._flushSendQueue();
  });
};

['addListener', 'on', 'once', 'removeListener', 'removeAllListeners', 'setMaxListeners', 'getMaxListeners'].forEach(function(attr, i){
  FluentSender.prototype[attr] = function(){
    return this._eventEmitter[attr].apply(this._eventEmitter, Array.prototype.slice.call(arguments));
  };
});

FluentSender.prototype.end = function(label, data, callback){
  var self = this;
  if ((label != null && data != null)) {
    self.emit(label, data, function(err) {
      self._close();
      if (err) {
        self._handleEvent('error', err, callback);
      } else {
        callback && callback();
      }
    });
  } else {
    process.nextTick(function() {
      self._close();
      callback && callback();
    });
  }
};

FluentSender.prototype._close = function() {
  if (this._socket) {
    this._socket.end();
    this._socket = null;
  }
};


FluentSender.prototype._makePacketItem = function(label, data, time){
  var tag = null;
  if (this.tag_prefix && label) {
    tag = [this.tag_prefix, label].join('.');
  } else if (this.tag_prefix) {
    tag = this.tag_prefix;
  } else if (label) {
    tag = label;
  }

  if (typeof time !== 'number' && !(time instanceof EventTime)) {
    time = Math.floor((time ? time.getTime() : Date.now()) / this._timeResolution);
  }

  var packet = [tag, time, data];
  var options = {};
  if (this.requireAckResponse) {
    options = {
      chunk: crypto.randomBytes(16).toString('base64')
    };
    packet.push(options);
  }
  return {
    packet: msgpack.encode(packet, { codec: codec }),
    tag: tag,
    time: time,
    data: data,
    options: options
  };
};

FluentSender.prototype._connect = function(callback){
  var self = this;
  if (self._socket === null) {
    self._socket = new net.Socket();
    self._socket.setTimeout(self.timeout);
    self._socket.on('error', function(err) {
      if (self._socket) {
        self._socket.destroy();
        self._socket = null;
        self._handleEvent('error', err);
      }
    });
    self._socket.on('connect', function() {
      self._handleEvent('connect');
    });
    if (self.path) {
      self._socket.connect(self.path, callback);
    } else {
      self._socket.connect(self.port, self.host, callback);
    }
  } else {
    if (!self._socket.writable) {
      self._socket.destroy();
      self._socket = null;
      process.nextTick(function() {
        self._connect(callback);
      });
    } else {
      process.nextTick(function() {
        callback();
      });
    }
  }
};

FluentSender.prototype._flushSendQueue = function() {
  var self = this;
  if (self._flushingSendQueue)
    return;

  self._flushingSendQueue = true;
  process.nextTick(function waitToWrite() {
    if (!self._socket) {
      self._flushingSendQueue = false;
      return;
    }

    if (self._socket.writable) {
      self._doFlushSendQueue();
    } else {
      process.nextTick(waitToWrite);
    }
  });
};

FluentSender.prototype._doFlushSendQueue = function() {
  var self = this;
  var item = self._sendQueue.shift();
  var timeoutId = null;
  if (item === undefined) {
    self._flushingSendQueue = false;
    // nothing written;
  } else {
    self._socket.write(new Buffer(item.packet), function(){
      if (self.requireAckResponse) {
        self._socket.once('data', function(data) {
          timeoutId && clearTimeout(timeoutId);
          var response = msgpack.decode(data, { codec: codec });
          if (response.ack !== item.options.chunk) {
            var error = new FluentLoggerError.ResponseError('ack in response and chunk id in sent data are different',
                                                            { ack: response.ack, chunk: item.options.chunk });
            self._handleEvent('error', error, item.callback);
          }
          item.callback && item.callback();
          process.nextTick(function() {
            self._doFlushSendQueue(); // if socket is still available
          });
        });
        timeoutId = setTimeout(function() {
          var error = new FluentLoggerError.ResponseTimeout('ack response timeout');
          self._handleEvent('error', error, item.callback);
        }, self.ackResponseTimeout);
      } else {
        item.callback && item.callback();
        process.nextTick(function() {
          self._doFlushSendQueue(); // if socket is still available
        });
      }
    });
    // TODO: how should we recorver if dequeued items are not sent.
  }
};

FluentSender.prototype._handleEvent = function _handleEvent(signal, data, callback) {
  var self = this;
  callback && callback(data);
  if (self._eventEmitter.listenerCount(signal) > 0) {
    self._eventEmitter.emit(signal, data);
  }
};

FluentSender.prototype._setupErrorHandler = function _setupErrorHandler() {
  var self = this;
  if (!self.reconnectInterval) {
    return;
  }
  self.on('error', function(error) {
    self._flushingSendQueue = false;
    self.internalLogger.error('Fluentd error', error);
    self.internalLogger.info('Fluentd will reconnect after ' + self.reconnectInterval / 1000 + ' seconds');
    setTimeout(function() {
      self.internalLogger.info('Fluentd is reconnecting...');
      self._connect(function() {
        self.internalLogger.info('Fluentd reconnection finished!!');
      });
    }, self.reconnectInterval);
  });
};

FluentSender.prototype.toStream = function(options) {
  if (typeof options === 'string') {
    options = {label: options};
  } else {
    options = options || {};
  }
  var label = options.label;
  if (!label) {
    throw new Error('label is needed');
  }
  var defaultEncoding = options.encoding || 'UTF-8';
  var self = this;
  var writable = new stream.Writable();
  var dataString = '';
  writable._write = function(chunk, encoding, callback) {
    var dataArray = chunk.toString(defaultEncoding).split(/\n/);
    function next() {
      if (dataArray.length) {
        dataString += dataArray.shift();
      }
      if (!dataArray.length) {
        process.nextTick(callback);
        return;
      }
      self.emit(label, { message: dataString }, function(err) {
        if (err) {
          self._handleEvent('error', err, callback);
          return;
        }
        dataString = '';
        next();
      });
    };
    next();
  };
  return writable;
};

module.exports = exports = {};
exports.FluentSender = FluentSender;
