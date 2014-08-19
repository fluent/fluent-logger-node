"use strict;"
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var pack = require('msgpack').pack;
var net = require('net');


function FluentSender(tag, options){
  options = options || {};
  this.tag = tag;
  this.host = options.host || 'localhost';
  this.port = options.port || 24224;
  this.timeout = options.timeout || 3.0;
  this.verbose = this.verbose || false;
  this._timeResolution = options.milliseconds ? 1 : 1000;
  this._socket = null;
  this._sendQueue  = [];    // queue for items waiting for being sent.
  this._eventEmitter = new EventEmitter();
  this.__flushSendQueue = this._flushSendQueue.bind(this);
}

FluentSender.prototype.emit = function(label, data, timestamp, callback){

  // Label must be string always
  if( typeof label !== "string" ){
    callback = timestamp;
    timestamp = data;
    data = label;
    label = undefined;
  }

  // Date can be anything but a function
  if( typeof timestamp !== "number" && !(timestamp instanceof Date) ){
    callback = timestamp;
    timestamp = undefined;
  }

  this._sendQueue.push(
    this._makePacketItem(label, data, timestamp, callback)
  );
  this._connect(this.__flushSendQueue);
};

['addListener', 'on', 'once', 'removeListener', 'removeAllListeners'].forEach(function(attr, i){
  FluentSender.prototype[attr] = function(){
    this._eventEmitter[attr].apply(this._eventEmitter, Array.prototype.slice.call(arguments));
  };
});

FluentSender.prototype.end = function(label, data, callback){
  var self = this;

  function done(err){
    self._close();
    callback && callback(err);
  }

  if( (label != null && data != null) ){
    self.emit(label, data, done);
  }else{
    process.nextTick(done);
  }
};

FluentSender.prototype._close = function(){
  if( this._socket ){
    this._socket.end();
    this._socket = null;
  }
};


FluentSender.prototype._makePacketItem = function(label, data, time, callback){
  var self = this;
  var tag = label ? [self.tag, label].join('.') : self.tag;

  if( typeof time != "number" ){
    time = (time ? time.getTime() : Date.now()) / this._timeResolution;
  }

  var packet = [tag, time, data];
  return {
    packet: new Buffer(pack(packet)),
    callback: callback
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
        self._eventEmitter.emit('error', err);
      }
    });
    self._socket.connect(self.port, self.host, function(){
      callback();
    });
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
  // socket is still available
  if( this._socket && this._socket.writable ){
    var item = this._sendQueue.shift();
    if( item === undefined ){
      // nothing written;
    }else{
      this._socket.write(item.packet, function(){
        // TODO: how should we recover if dequeued items are not sent.
        item.callback && item.callback();
      });
      process.nextTick(this.__flushSendQueue);
    }
  }
};


module.exports = exports = {};
exports.FluentSender = FluentSender;
