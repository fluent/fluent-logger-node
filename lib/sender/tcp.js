var util = require('util');
var EventEmitter = require('events').EventEmitter;
var pack = require('msgpack').pack;
var net = require('net');
var FluentSender = require('./base').FluentSender;

function TcpSender(tag, options){
  options   = options || {};
  this.host = options.host || 'localhost';
  this.port = options.port || 24224;
  this._socket = null;
  FluentSender.call(this, tag, options);
}
util.inherits(TcpSender, FluentSender);

TcpSender.prototype._connect = function(callback){
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
    process.nextTick(function(){
      callback();
    });
  }
};

FluentSender.prototype._writeRecord = function(record, callback){
  var packet = [record.tag, record.time, record.data];
  this._socket.write(new Buffer(pack(packet)), callback);
};

FluentSender.prototype._close = function(){
  if( this._socket ){
    this._socket.end();
    this._socket = null;
  }
};

module.exports = exports = {};
exports.TcpSender = TcpSender;
