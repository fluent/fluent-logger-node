'use strict';
var net = require('net');
var fs = require('fs');
var msgpack = require('msgpack-lite');
var crypto = require('crypto');

function MockFluentdServer(options) {
  this._port = null;
  this._options = options;
  this._received = [];
  this._clients  = {};
  this._state = null;
  this._nonce = null;
  this._userAuthSalt = null;
  this._server = net.createServer((socket) => {
    var clientKey = socket.remoteAddress + ":" + socket.remotePort;
    this._clients[clientKey] = socket;
    socket.on('end', () => {
      delete(this._clients[clientKey]);
    });
    var stream = msgpack.createDecodeStream();
    socket.pipe(stream).on('data', (m) => {
      if (this._state === 'pingpong') {
        let authResult = this._checkPing(m);
        socket.write(msgpack.encode(this._generatePong(authResult, this._nonce, this._options.security.sharedKey)));
        if (authResult.succeeded) {
          this._state= 'established';
        } else {
          socket.end();
        }
      } else if (this._state === 'established') {
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
      }
    });
  });
  this._server.on('connection', (socket) => {
    if (this._options.security && this._options.security.sharedKey && this._options.security.serverHostname) {
      this._state = 'helo';
      this._nonce = crypto.randomBytes(16);
      this._userAuthSalt = crypto.randomBytes(16);
    } else {
      this._state = 'established';
    }
    if (this._state === 'helo') {
      socket.write(msgpack.encode(this._generateHelo(this._nonce, this._userAuthSalt)));
      this._state = 'pingpong';
    }
  });
}

MockFluentdServer.prototype.__defineGetter__('port', function() {
  return this._port;
});

MockFluentdServer.prototype.__defineGetter__('messages', function() {
  return this._received;
});

MockFluentdServer.prototype._generateHelo = function(nonce, userAuthSalt) {
  // ['HELO', options(hash)]
  let options = {
    "nonce": nonce,
    "auth": this._options.security ? userAuthSalt : '',
    "keepalive": false
  };
  return ['HELO', options];
};

MockFluentdServer.prototype._checkPing = function(m) {
  // this._options.checkPing() should return { succeeded: true, reason: "why", sharedKeySalt: "salt" }
  return this._options.checkPing(m);
};

MockFluentdServer.prototype._generatePong = function(authResult, nonce, sharedKey) {
  // this._options.generatePong() should return PONG message
  // [
  //   'PONG',
  //   bool(authentication result),
  //  'reason if authentication failed',
  //  serverHostname,
  //  sha512_hex(salt + serverHostname + nonce + sharedkey)
  // ]
  if (authResult.succeeded) {
    let sharedKeyDigestHex = crypto.createHash('sha512')
        .update(authResult.sharedKeySalt)
        .update(this._options.security.serverHostname)
        .update(nonce)
        .update(sharedKey)
        .digest('hex');
    return ['PONG', true, '', this._options.security.serverHostname, sharedKeyDigestHex];
  } else {
    return ['PONG', false, authResult.reason, '', ''];
  }
};

MockFluentdServer.prototype.listen = function(callback) {
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
