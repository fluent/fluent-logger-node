'use strict';
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var msgpack = require('msgpack-lite');
var net = require('net');


function FluentSender(tag, options){
  options = options || {};
  this.tag = tag;
  this.host = options.host || 'localhost';
  this.port = options.port || 24224;
  this.path = options.path;
  this.timeout = options.timeout || 3.0;
  this.reconnectInterval = options.reconnectInterval || 600000; // Default is 10 minutes
  this._timeResolution = options.milliseconds ? 1 : 1000;
  this._socket = null;
  this._sendQueue  = [];    // queue for items waiting for being sent.
  this._sendQueueTail = -1;
  this._eventEmitter = new EventEmitter();
}

FluentSender.prototype.emit = function(/*[label] <data>, [timestamp], [callback] */){
  var label, data, timestamp, callback;
  var args = Array.prototype.slice.call(arguments);
  // Label must be string always
  if (typeof args[0] === "string") label = args.shift();

  // Data can be almost anything
  data = args.shift();

  // Date can be either timestamp number or Date object
  if (typeof args[0] !== "function") timestamp = args.shift();

  // Last argument is an optional callback
  if (typeof args[0] === "function") callback = args.shift();


  var self = this;
  var item = self._makePacketItem(label, data, timestamp);

  item.callback = callback;

  self._sendQueue.push(item);
  self._sendQueueTail++;
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
  if( (label != null && data != null) ){
    self.emit(label, data, function(err){
      self._close();
      callback && callback(err);
    });
  }else{
    process.nextTick(function(){
      self._close();
      callback && callback();
    });
  }
};

FluentSender.prototype._close = function(){
  if( this._socket ){
    this._socket.end();
    this._socket = null;
  }
};


FluentSender.prototype._makePacketItem = function(label, data, time){
  var self = this;
  var tag = label ? [self.tag, label].join('.') : self.tag;

  if (typeof time != "number") {
    time = Math.floor((time ? time.getTime() : Date.now()) / this._timeResolution);
  }

  var packet = [tag, time, data];
  return {
    packet: msgpack.encode(packet),
    tag: tag,
    time: time,
    data: data
  };
};

FluentSender.prototype._connect = function(callback){
  var self = this;
  if( self._socket === null ){
    self._socket = new net.Socket();
    self._socket.setTimeout(self.timeout);
    self._socket.on('error', function(err){
      if( self._socket ){
        self._socket.destroy();
        self._socket = null;
        if( self._eventEmitter.listeners('error').length > 0 ){
          self._eventEmitter.emit('error', err);
        }
      }
    });
    if (self.path) {
      self._socket.connect(self.path, function() {
        callback();
      });
    } else {
      self._socket.connect(self.port, self.host, function() {
        callback();
      });
    }
  }else{
    if( !self._socket.writable ){
      self._socket.destroy();
      self._socket = null;
      process.nextTick(function(){
        self._connect(callback);
      });
    }else{
      process.nextTick(function(){
        callback();
      });
    }
  }
};

FluentSender.prototype._flushSendQueue = function(){
  var self = this;
  var pos = self._sendQueue.length - self._sendQueueTail - 1;
  var item = self._sendQueue[pos];
  if( item === undefined ){
    // nothing written;
  }else{
    self._sendQueueTail--;
    self._sendQueue.shift();
    self._socket.write(new Buffer(item.packet), function(){
      item.callback && item.callback();
    });
    process.nextTick(function(){
      // socket is still available
      if( self._socket && self._socket.writable ){
        self._flushSendQueue();
      }
    });
    // TODO: how should we recorver if dequeued items are not sent.
  }
};

FluentSender.prototype._setupErrorHandler = function() {
  var self = this;
  if (!self.reconnectInterval) {
    return;
  }
  self.on('error', function(error) {
    console.error('Fluentd error', error);
    console.info('Fluentd will reconnect after ' + self.reconnectInterval / 1000 + ' seconds');
    setTimeout(function() {
      console.info("Fluentd is reconnecting...");
      self._connect(function() {
        console.info('Fluentd reconnection finished!!');
      });
    }, self.reconnectInterval);
  });
};


module.exports = exports = {};
exports.FluentSender = FluentSender;
