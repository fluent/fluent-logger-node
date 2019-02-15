'use strict';
const net = require('net');
const tls = require('tls');
const msgpack = require('msgpack-lite');
const crypto = require('crypto');
const zlib = require('zlib');

class MockFluentdServer {
  constructor(options, tlsOptions) {
    this._port = null;
    this._options = options;
    this._tlsOptions = tlsOptions || {};
    this._received = [];
    this._clients  = {};
    this._state = null;
    this._nonce = null;
    this._userAuthSalt = null;
    let server = (socket) => {
      const clientKey = socket.remoteAddress + ':' + socket.remotePort;
      this._clients[clientKey] = socket;
      socket.on('end', () => {
        delete this._clients[clientKey];
      });
      const stream = msgpack.createDecodeStream();
      socket.pipe(stream).on('data', (m) => {
        if (this._state === 'pingpong') {
          const authResult = this._checkPing(m);
          socket.write(msgpack.encode(this._generatePong(authResult, this._nonce, this._options.security.sharedKey)));
          if (authResult.succeeded) {
            this._state = 'established';
          } else {
            socket.end();
          }
        } else if (this._state === 'established') {
          let entries = m[1];
          let options = null;
          if (entries instanceof Buffer) {
            options = m[2];
            if (options.compressed === 'gzip') {
              entries = zlib.gunzipSync(entries);
            }
            let s = msgpack.createDecodeStream();
            s.on('data', (data) => {
              let _time = data[0];
              let record = data[1];
              this._received.push({
                tag: m[0],
                data: record,
                options: options
              });
            });
            s.write(entries);
          } else {
            this._received.push({
              tag: m[0],
              time: m[1],
              data: m[2],
              options: m[3]
            });
            options = m[3];
          }
          if (this._options.requireAckResponse && options && options.chunk) {
            const response = {
              ack: options.chunk
            };
            socket.write(msgpack.encode(response));
          }
        }
      });
    };
    let connectionEventType = 'connection';
    if (this._tlsOptions.tls) {
      connectionEventType = 'secureConnection';
      this._server = tls.createServer(this._tlsOptions, server);
    } else {
      this._server = net.createServer(server);
    }
    this._server.on(connectionEventType, (socket) => {
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

  get port() {
    return this._port;
  }

  get messages() {
    return this._received;
  }

  _generateHelo(nonce, userAuthSalt) {
    // ['HELO', options(hash)]
    let options = {
      'nonce': nonce,
      'auth': this._options.security ? userAuthSalt : '',
      'keepalive': false
    };
    return ['HELO', options];
  }

  _checkPing(m) {
    // this._options.checkPing() should return { succeeded: true, reason: 'why', sharedKeySalt: 'salt' }
    if (this._options.checkPing) {
      return this._options.checkPing(m);
    } else {
      // ['PING', self_hostname, shared_key_salt, sha512_hex(shared_key_salt + self_hostname + nonce + shared_key), username || '', sha512_hex(auth_salt + username + password) || '']
      if (m.length !== 6) {
        return { succeeded: false, reason: 'Invalid ping message size' };
      }
      if (m[0] !== 'PING') {
        return { succeeded: false, reason: 'Invalid ping message' };
      }
      const _ping = m[0];
      const hostname = m[1];
      const sharedKeySalt = m[2];
      const sharedKeyHexDigest = m[3];
      const _username = m[4];
      const passwordDigest = m[5];
      const serverSideDigest = crypto.createHash('sha512')
        .update(sharedKeySalt)
        .update(hostname)
        .update(this._nonce)
        .update(this._options.security.sharedKey)
        .digest('hex');
      if (sharedKeyHexDigest !== serverSideDigest) {
        return { succeeded: false, reason: 'shared key mismatch' };
      }
      if (this._options.security.username && this._options.security.password) {
        const serverSidePasswordDigest = crypto.createHash('sha512')
          .update(this._userAuthSalt)
          .update(this._options.security.username)
          .update(this._options.security.password)
          .digest('hex');
        if (passwordDigest !== serverSidePasswordDigest) {
          return { succeeded: false, reason: 'username/password mismatch' };
        }
      }
      return { succeeded: true, sharedKeySalt: sharedKeySalt };
    }
  }

  _generatePong(authResult, nonce, sharedKey) {
    // this._options.generatePong() should return PONG message
    // [
    //   'PONG',
    //   bool(authentication result),
    //  'reason if authentication failed',
    //  serverHostname,
    //  sha512_hex(salt + serverHostname + nonce + sharedkey)
    // ]
    if (authResult.succeeded) {
      const sharedKeyDigestHex = crypto.createHash('sha512')
        .update(authResult.sharedKeySalt)
        .update(this._options.security.serverHostname)
        .update(nonce)
        .update(sharedKey)
        .digest('hex');
      return ['PONG', true, '', this._options.security.serverHostname, sharedKeyDigestHex];
    } else {
      return ['PONG', false, authResult.reason, '', ''];
    }
  }

  listen(callback) {
    let options = {
      port: this._options.port
    };
    this._server.listen(options, () => {
      this._port = this._server.address().port;
      callback();
    });
  }

  close(callback) {
    this._server.close(() => {
      callback();
    });
    for (const i in this._clients) {
      this._clients[i].end();
      // this._clients[i].destroy();
    }
  }
}

module.exports = {
  runServer: function(options, tlsOptions, callback) {
    const server = new MockFluentdServer(options, tlsOptions);
    server.listen(() => {
      callback(server, (_callback) => {
        // wait 100 ms to receive all messages and then close
        setTimeout(() => {
          const messages = server.messages;
          server.close(() => {
            _callback && _callback(messages);
          });
        }, 100);
      });
    });
  }
};
