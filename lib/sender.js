var util = require('util');
var EventEmitter = require('events').EventEmitter;
var pack = require('../vendor/uupa-js/msgpack').pack;
var net = require('net');


function FluentSender(tag, options){
  options = options || {};
  this.tag = tag;
  this.host = options.host || 'localhost';
  this.port = options.port || 24224;
  this.timeout = options.timeout || 3.0;
  this.verbose = this.verbose || false;
  this._socket = null;
  this._queue  = [];
  this._queueTail = -1;
  this._eventEmitter = new EventEmitter();
}
// util.inherits(FluentSender, EventEmitter);

FluentSender.prototype.emit = function(label, data, callback){
  var self = this;
  var item = self._makePacketItem(label, data);
  item.callback = callback;
  self._queue.push(item);
  self._queueTail++;
  self._connect(function(){
    self._sendQueue();
  });
};

['addListener', 'on', 'once', 'removeListener', 'removeAllListeners'].forEach(function(attr, i){
  FluentSender.prototype[attr] = function(){
    this._eventEmitter[attr].apply(this._eventEmitter, Array.prototype.slice.call(arguments));
  };
});

FluentSender.prototype.end = function(label, data){
  var self = this;
  if( (label != null && data != null) ){
    self.emit(label, data, function(err){
      self._close();
    });
  }else{
    self._close();
  }
};

FluentSender.prototype._close = function(){
  if( this._socket ){
    this._socket.end();
    this._socket = null;
  }
};


FluentSender.prototype._makePacketItem = function(label, data, callback){
  var self = this;
  var tag = [self.tag, label].join('.');
      var time = (new Date()).getTime() / 1000;
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
    callback();
  }
};

FluentSender.prototype._sendQueue = function(){
  var self = this;
  var pos = self._queue.length - self._queueTail - 1;
  var item = self._queue[pos];
  if( item === undefined ){
    // nothing written;
  }else{
    self._queueTail--;
    self._socket.write(new Buffer(item.packet), function(){
      self._queue.shift();
      self._sendQueue();
      process.nextTick(function(){
        item.callback && item.callback();
      });
    });
  }
};


module.exports = exports = {};
exports.FluentSender = FluentSender;
