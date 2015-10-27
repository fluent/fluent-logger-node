'use strict';
var net = require('net');
var fs = require('fs');
var msgpack = require('msgpack-lite');

function MockFluentdServer(){
  var self = this;
  this._port = null;
  this._received = [];
  this._clients  = {};
  this._server = net.createServer(function(socket){
    var clientKey = socket.remoteAddress + ":" + socket.remotePort;
    self._clients[clientKey] = socket;
    socket.on('end', function(){
      delete(self._clients[clientKey]);
    });
    var stream = msgpack.createDecodeStream();
    socket.pipe(stream).on('data', function(m){
      self._received.push({
        tag: m[0],
        time: m[1],
        data: m[2]
      });
    });
  });
}

MockFluentdServer.prototype.__defineGetter__('port', function(){
  return this._port;
});

MockFluentdServer.prototype.__defineGetter__('messages', function(){
  return this._received;
});


MockFluentdServer.prototype.listen = function(callback){
  var self = this;
  this._server.listen(function(){
    self._port = self._server.address().port;
    callback();
  });
};

MockFluentdServer.prototype.close = function(callback){
  var self = this;
  if( process.version.match(/^v0\.6\./) ){ // 0.6.x does not support callback for server.close();
    this._server.close();
    (function waitForClose(){
      if( Object.keys(self._clients).length > 0 ){
        setTimeout(waitForClose, 100);
      }else{
        callback();
      }
    })();
  }else{
    this._server.close(function(){
      callback();
    });
  }
  for(var i in self._clients){
    self._clients[i].end();
    // self._clients[i].destroy();
  }
};

module.exports = {
  runServer: function(callback){
    var server = new MockFluentdServer();
    server.listen(function(){
      callback(server, function(_callback){
         // wait 100 ms to receive all messages and then close
         setTimeout(function(){
           var messages = server.messages;
           server.close(function(){
             _callback(messages);
           });
         }, 100);
       });
    });
  }
};
