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
  this._sendQueueTail = -1;
  this._eventEmitter = new EventEmitter();
}

FluentSender.prototype.emit = function(label, data /*, timestamp, callback */){
  var timestamp, callback;
  if (arguments.length == 3 && typeof arguments[2] == 'function') {
    callback  = arguments[2];
  } else {
    timestamp = arguments[2];
    callback  = arguments[3];
  }

  var self = this;
  var item = self._makePacketItem(label, data, timestamp);

  item.callback = callback;

  self._sendQueue.push(item);
  self._sendQueueTail++;
  self._connect(function(){
    self._flushSendQueue();
  });
};

['addListener', 'on', 'once', 'removeListener', 'removeAllListeners'].forEach(function(attr, i){
  FluentSender.prototype[attr] = function(){
    this._eventEmitter[attr].apply(this._eventEmitter, Array.prototype.slice.call(arguments));
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
      callback && callback(err);
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
  var tag = [self.tag, label].join('.');

  if (typeof time != "number") {
    var dateTime = time || new Date();
    time = dateTime.getTime() / this._timeResolution;
  }

  var packet = [tag, time, data];
  return {
    packet: pack(packet),
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
      self._flushSendQueue();
    });
    // TODO: how should we recorver if dequeued items are not sent.
  }
};


module.exports = exports = {};
exports.FluentSender = FluentSender;
