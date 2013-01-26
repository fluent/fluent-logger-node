var util = require('util');
var EventEmitter = require('events').EventEmitter;
var pack = require('msgpack').pack;
var net = require('net');

function FluentSender(tag, options){
  options = options || {};
  this.tag = tag;
  this.timeout = options.timeout || 3.0;
  this.verbose = this.verbose || false;
  this._timeResolution = options.milliseconds ? 1 : 1000;
  this._sendQueue  = [];    // queue for items waiting for being sent.
  this._sendQueueTail = -1;
  this._eventEmitter = new EventEmitter();
}

FluentSender.prototype.emit = function(label, data, callback){
  var self = this;
  var item = self._makePacketItem(label, data);
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


FluentSender.prototype._makePacketItem = function(label, data, callback){
  var self = this;
  var tag = [self.tag, label].join('.');
  var time = (new Date()).getTime() / this._timeResolution;
  return {
    record: {
      tag: tag,
      time: time,
      data: data
    }
  };
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
    self._writeRecord(item.record, function(){
      item.callback && item.callback();
    });
    process.nextTick(function(){
      self._flushSendQueue();
    });
    // TODO: how should we recorver if dequeued items are not sent.
  }
};

// Connect to fluentd.
FluentSender.prototype._connect = function(callback){
  throw new Error("Not implemented");
};

// A method write record on the existent connection. `record` would be an object like:
//    {
//      tag: tag,
//      time: time,
//      data: data
//    }
FluentSender.prototype._writeRecord = function(record, callback){
  throw new Error("Not implemented");
}

// Close the connection.
FluentSender.prototype._close = function(){
  throw new Error("Not implemented");
};

module.exports = exports = {};
exports.FluentSender = FluentSender;
