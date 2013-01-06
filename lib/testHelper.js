var net = require('net');
var fs = require('fs');
var msgpack = require('msgpack');

function MockFluentdServer(){
  var self = this;
  this._port = null;
  this._received = [];
  this._server = net.createServer(function(socket){
    var ms = new msgpack.Stream(socket);
    ms.on('msg', function(m){
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

MockFluentdServer.prototype.close = function(){
  this._server.close();
  this._port = null;
  this._received = [];
};

module.exports = {
  runServer: function(callback){
    var server = new MockFluentdServer();
    server.listen(function(){
      callback(server, function(_callback){
        // wait 100 ms and then close
        setTimeout(function(){
          var messages = server.messages;
          _callback(messages);
          server.close();
        }, 100);
      });
    });
  }
};
