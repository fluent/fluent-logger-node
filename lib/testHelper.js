'use strict';
var net = require('net');
var fs = require('fs');
var msgpack = require('msgpack-lite');

function MockFluentdServer(options) {
  this._port = null;
  this._options = options;
  this._received = [];
  this._clients  = {};
  this._server = net.createServer((socket) => {
    var clientKey = socket.remoteAddress + ":" + socket.remotePort;
    this._clients[clientKey] = socket;
    socket.on('end', () => {
      delete(this._clients[clientKey]);
    });
    var stream = msgpack.createDecodeStream();
    socket.pipe(stream).on('data', (m) => {
      this._received.push({
        tag: m[0],
        time: m[1],
        data: m[2],
        options: m[3]
      });
      var options = m[3];
      if (this._options.requireAckResponse && options && options.chunk) {
        var response = {
          ack: options.chunk
        };
        socket.write(msgpack.encode(response));
      }
    });
  });
}

MockFluentdServer.prototype.__defineGetter__('port', function() {
  return this._port;
});

MockFluentdServer.prototype.__defineGetter__('messages', function() {
  return this._received;
});


MockFluentdServer.prototype.listen = function(callback){
  this._server.listen(() => {
    this._port = this._server.address().port;
    callback();
  });
};

MockFluentdServer.prototype.close = function(callback) {
  this._server.close(function() {
    callback();
  });
  for (var i in this._clients) {
    this._clients[i].end();
    // this._clients[i].destroy();
  }
};

module.exports = {
  runServer: function(options, callback) {
    var server = new MockFluentdServer(options);
    server.listen(function() {
      callback(server, function(_callback) {
         // wait 100 ms to receive all messages and then close
         setTimeout(function() {
           var messages = server.messages;
           server.close(function() {
             _callback && _callback(messages);
           });
         }, 100);
       });
    });
  }
};
