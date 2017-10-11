'use strict';
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var msgpack = require('msgpack-lite');
var net = require('net');
var stream = require('stream');
var crypto = require('crypto');
var zlib = require('zlib');
var FluentLoggerError = require('./logger-error');
var EventTime = require('./event-time').EventTime;

var codec = msgpack.createCodec();
codec.addExtPacker(0x00, EventTime, EventTime.pack);
codec.addExtUnpacker(0x00, EventTime.unpack);

function FluentSender(tag_prefix, options){
  options = options || {};
  this._eventMode = options.eventMode || 'Message'; // Message, PackedForward, CompressedPackedForward
  if (!/^Message|PackedForward|CompressedPackedForward$/.test(this._eventMode)) {
    throw new FluentLoggerError.ConfigError('Unknown event mode: ' + this._eventMode);
  }
  this.tag_prefix = tag_prefix;
  this.host = options.host || 'localhost';
  this.port = options.port || 24224;
  this.path = options.path;
  this.timeout = options.timeout || 3.0;
  this.reconnectInterval = options.reconnectInterval || 600000; // Default is 10 minutes
  this.requireAckResponse = options.requireAckResponse;
  this.ackResponseTimeout = options.ackResponseTimeout || 190000; // Default is 190 seconds
  this.internalLogger = options.internalLogger || console;
  this._timeResolution = options.milliseconds ? 1 : 1000;
  this._socket = null;
  if (this._eventMode === 'Message') {
    this._sendQueue = []; // queue for items waiting for being sent.
    this._flushInterval = 0;
  } else {
    this._sendQueue = new Map();
    this._flushInterval = options.flushInterval || 100;
    this._sendQueueSizeLimit = 8 * 1024 * 1024; // 8MiB
    this._sendQueueSize = 0;
    this._flushSendQueueTimeoutId = null;
    this._compressed = (this._eventMode === 'CompressedPackedForward');
  }
  this._eventEmitter = new EventEmitter();
  // options.security = { clientHostname: "client.localdomain", sharedKey: "very-secret-shared-key" }
  this.security = options.security || {
    clientHostname: null,
    sharedKey: null,
    username: '',
    passwort: ''
  };
  this.sharedKeySalt = crypto.randomBytes(16).toString('hex');
  // helo, pingpong, established
  this._status = null;
  this._connecting = false;
}

FluentSender.prototype.emit = function(/*[label] <data>, [timestamp], [callback] */){
  var label, data, timestamp, callback;
  var args = Array.prototype.slice.call(arguments);
  // Label must be string always
  if (typeof args[0] === 'string') label = args.shift();

  // Data can be almost anything
  data = args.shift();

  // Date can be either timestamp number or Date object
  if (typeof args[0] !== 'function') timestamp = args.shift();

  // Last argument is an optional callback
  if (typeof args[0] === 'function') callback = args.shift();

  let tag = this._makeTag(label);
  let error;
  let options;
  if (tag === null) {
    options = {
      tag_prefix: this.tag_prefix,
      label: label
    };
    error = new FluentLoggerError.MissingTag('tag is missing', options);
    this._handleEvent('error', error, callback);
    return;
  }
  if (typeof data !== 'object') {
    options = {
      tag_prefix: this.tag_prefix,
      label: label,
      record: data
    };
    error = new FluentLoggerError.DataTypeError('data must be an object', options);
    this._handleEvent('error', error, callback);
    return;
  }

  this._push(tag, timestamp, data, callback);
  this._connect(() => {
    this._flushSendQueue();
  });
};

['addListener', 'on', 'once', 'removeListener', 'removeAllListeners', 'setMaxListeners', 'getMaxListeners'].forEach(function(attr, i){
  FluentSender.prototype[attr] = function(){
    return this._eventEmitter[attr].apply(this._eventEmitter, Array.prototype.slice.call(arguments));
  };
});

FluentSender.prototype.end = function(label, data, callback){
  if ((label != null && data != null)) {
    this.emit(label, data, (err) => {
      this._close();
      if (err) {
        this._handleEvent('error', err, callback);
      } else {
        callback && callback();
      }
    });
  } else {
    process.nextTick(() => {
      this._close();
      callback && callback();
    });
  }
};

FluentSender.prototype._close = function() {
  if (this._socket) {
    this._socket.end();
    this._socket = null;
    this._status = null;
  }
};

FluentSender.prototype._makeTag = function(label) {
  let tag = null;
  if (this.tag_prefix && label) {
    tag = [this.tag_prefix, label].join('.');
  } else if (this.tag_prefix) {
    tag = this.tag_prefix;
  } else if (label) {
    tag = label;
  }
  return tag;
};

FluentSender.prototype._makePacketItem = function(tag, time, data){
  if (typeof time !== 'number' && !(time instanceof EventTime)) {
    time = Math.floor((time ? time.getTime() : Date.now()) / this._timeResolution);
  }

  var packet = [tag, time, data];
  var options = {};
  if (this.requireAckResponse) {
    options = {
      chunk: crypto.randomBytes(16).toString('base64')
    };
    packet.push(options);
  }
  return {
    packet: msgpack.encode(packet, { codec: codec }),
    tag: tag,
    time: time,
    data: data,
    options: options
  };
};

FluentSender.prototype._makeEventEntry = function(time, data) {
  if (typeof time !== 'number' && !(time instanceof EventTime)) {
    time = Math.floor((time ? time.getTime() : Date.now()) / this._timeResolution);
  }

  return msgpack.encode([time, data], { codec: codec });
};

FluentSender.prototype._push = function(tag, time, data, callback) {
  if (this._eventMode === 'Message') {
    // Message mode
    let item = this._makePacketItem(tag, time, data);
    item.callback = callback;
    this._sendQueue.push(item);
  } else {
    // PackedForward mode
    let eventEntry = this._makeEventEntry(time, data);
    this._sendQueueSize += eventEntry.length;
    if (this._sendQueue.has(tag)) {
      let eventEntryData = this._sendQueue.get(tag);
      eventEntryData.eventEntry = Buffer.concat([eventEntryData.eventEntry, eventEntry]);
      eventEntryData.callbacks.push(callback);
      this._sendQueue.set(tag, eventEntryData);
    } else {
      this._sendQueue.set(tag, { eventEntry: eventEntry, callbacks: [callback] });
    }
  }
};

FluentSender.prototype._connect = function(callback){
  if (this._connecting) {
    return;
  }

  this._connecting = true;
  process.nextTick(() => {
    if (this._socket === null) {
      this._doConnect(() => {
        this._connecting = false;
        callback();
      });
    } else {
      if (!this._socket.writable) {
        this._disconnect();
        process.nextTick(() => {
          this._connecting = false;
          this._connect(callback);
        });
      } else {
        process.nextTick(() => {
          this._connecting = false;
          callback();
        });
      }
    }
  });
};

FluentSender.prototype._doConnect = function(callback) {
  this._socket = new net.Socket();
  this._socket.setTimeout(this.timeout);
  this._socket.on('error', (err) => {
    if (this._socket) {
      this._disconnect();
      this._handleEvent('error', err);
    }
  });
  this._socket.on('connect', () => {
    this._handleEvent('connect');
  });
  if (this.path) {
    this._socket.connect(this.path, () => {
      callback();
    });
  } else {
    this._socket.connect(this.port, this.host, () => {
      if (this.security.clientHostname && this.security.sharedKey) {
        this._handshake(callback);
      } else {
        this._status = 'established';
        callback();
      }
    });
  }
};

FluentSender.prototype._disconnect = function() {
  this._socket && this._socket.destroy();
  this._socket = null;
  this._status = null;
  this._connecting = false;
};

FluentSender.prototype._handshake = function(callback) {
  if (this._status === 'established') {
    return;
  }
  this._status = 'helo';
  this._socket.once('data', (data) => {
    this._socket.pause();
    let heloStatus = this._checkHelo(data);
    if (!heloStatus.succeeded) {
      this.internalLogger.error("Received invalid HELO message from " + this._socket.remoteAddress);
      this._disconnect();
      return;
    }
    this._status = 'pingpong';
    this._socket.write(new Buffer(this._generatePing()), () => {
      this._socket.resume();
      this._socket.once('data', (data) => {
        let pongStatus = this._checkPong(data);
        if (!pongStatus.succeeded) {
          this.internalLogger.error(pongStatus.message);
          let error = new FluentLoggerError.HandshakeError(pongStatus.message);
          this._handleEvent('error', error);
          this._disconnect();
          return;
        }
        this._status = 'established';
        this.internalLogger.info('Established');
        callback();
      });
    });
  });
};

FluentSender.prototype._flushSendQueue = function() {
  if (this._flushingSendQueue)
    return;

  this._flushingSendQueue = true;
  process.nextTick(() => {
    if (!this._socket) {
      this._flushingSendQueue = false;
      return;
    }

    if (this._socket.writable) {
      if (this._eventMode === 'Message') {
        this._doFlushSendQueue();
      } else {
        if (this._sendQueueSize >= this._sendQueueSizeLimit) {
          this._flushSendQueueTimeoutId && clearTimeout(this._flushSendQueueTimeoutId);
          this._doFlushSendQueue();
        } else {
          this._flushSendQueueTimeoutId && clearTimeout(this._flushSendQueueTimeoutId);
          this._flushSendQueueTimeoutId = setTimeout(() => {
            this._doFlushSendQueue();
          }, this._flushInterval);
        }
      }

    } else {
      process.nextTick(waitToWrite);
    }
  });
};

FluentSender.prototype._doFlushSendQueue = function(timeoutId) {
  if (this._eventMode === 'Message') {
    let item = this._sendQueue.shift();
    if (item === undefined) {
      this._flushingSendQueue = false;
      // nothing written;
      return;
    }
    this._doWrite(item.packet, item.options, timeoutId, [item.callback]);
  } else {
    if (this._sendQueue.size === 0) {
      this._flushingSendQueue = false;
      return;
    }
    let tag = Array.from(this._sendQueue.keys())[0];
    let eventEntryData = this._sendQueue.get(tag);
    let entries = eventEntryData.eventEntry;
    let size = eventEntryData.eventEntry.length;
    this._sendQueue.delete(tag);
    if (this._compressed) {
      entries = zlib.gzipSync(entries);
      size = entries.length;
    }
    let options = {
      chunk: crypto.randomBytes(16).toString('base64'),
      size: size,
      compressed: this._compressed ? 'gzip' : 'text'
    };
    let packet = msgpack.encode([tag, entries, options], { codec: codec });
    this._doWrite(packet, options, timeoutId, eventEntryData.callbacks);
  }
};

FluentSender.prototype._doWrite = function(packet, options, timeoutId, callbacks) {
  this._socket.write(new Buffer(packet), () => {
    if (this.requireAckResponse) {
      this._socket.once('data', (data) => {
        timeoutId && clearTimeout(timeoutId);
        var response = msgpack.decode(data, { codec: codec });
        if (response.ack !== options.chunk) {
          var error = new FluentLoggerError.ResponseError('ack in response and chunk id in sent data are different',
                                                          { ack: response.ack, chunk: options.chunk });
          callbacks.forEach((callback) => {
            this._handleEvent('error', error, callback);
          });
        }
        callbacks.forEach((callback) => {
          callback && callback();
        });
        process.nextTick(() => {
          this._doFlushSendQueue(); // if socket is still available
        });
      });
      timeoutId = setTimeout(() => {
        var error = new FluentLoggerError.ResponseTimeout('ack response timeout');
        callbacks.forEach((callback) => {
          this._handleEvent('error', error, callback);
        });
      }, this.ackResponseTimeout);
    } else {
      callbacks.forEach((callback) => {
        callback && callback();
      });
      process.nextTick(() => {
        this._doFlushSendQueue(); // if socket is still available
      });
    }
  });
};

FluentSender.prototype._handleEvent = function _handleEvent(signal, data, callback) {
  callback && callback(data);
  if (this._eventEmitter.listenerCount(signal) > 0) {
    this._eventEmitter.emit(signal, data);
  }
};

FluentSender.prototype._setupErrorHandler = function _setupErrorHandler() {
  if (!this.reconnectInterval) {
    return;
  }
  this.on('error', (error) => {
    this._flushingSendQueue = false;
    this._status = null;
    this.internalLogger.error('Fluentd error', error);
    this.internalLogger.info('Fluentd will reconnect after ' + this.reconnectInterval / 1000 + ' seconds');
    setTimeout(() => {
      this.internalLogger.info('Fluentd is reconnecting...');
      this._connect(() => {
        this.internalLogger.info('Fluentd reconnection finished!!');
      });
    }, this.reconnectInterval);
  });
};

FluentSender.prototype._checkHelo = function _checkHelo(data) {
  // ['HELO', options(hash)]
  this.internalLogger.info('Checking HELO...');
  var message = msgpack.decode(data);
  if (message.length !== 2) {
    return { succeeded: false, message: 'Invalid format for HELO message' };
  }
  if (message[0] !== 'HELO') {
    return { succeeded: false, message: 'Invalid format for HELO message' };
  }
  var options = message[1] || {};
  this.sharedKeyNonce = options['nonce'] || '';
  this.authentication = options['auth'] || '';
  return { succeeded: true };
};

FluentSender.prototype._generatePing = function _generatePing() {
  // [
  //   'PING',
  //   client_hostname,
  //   shared_key_salt,
  //   sha512_hex(sharedkey_salt + client_hostname + nonce + shared_key),
  //   username || '',
  //   sha512_hex(auth_salt + username + password) || ''
  // ]
  var sharedKeyHexdigest = crypto.createHash('sha512')
      .update(this.sharedKeySalt)
      .update(this.security.clientHostname)
      .update(this.sharedKeyNonce)
      .update(this.security.sharedKey)
      .digest('hex');
  var ping = ['PING', this.security.clientHostname, this.sharedKeySalt, sharedKeyHexdigest];
  if (Buffer.isBuffer(this.authentication) && Buffer.byteLength(this.authentication) !== 0) {
    var passwordHexDigest = crypto.createHash('sha512')
        .update(this.authentication)
        .update(this.security.username || '')
        .update(this.security.password || '')
        .digest('hex');
    ping.push(this.username, passwordHexDigest);
  } else {
    ping.push('', '');
  }
  return msgpack.encode(ping);
};

FluentSender.prototype._checkPong = function _checkPong(data) {
  // [
  //   'PONG',
  //   bool(authentication result),
  //   'reason if authentication failed',
  //   server_hostname,
  //   sha512_hex(salt + server_hostname + nonce + sharedkey)
  // ]
  this.internalLogger.info('Checking PONG...');
  var message = msgpack.decode(data);
  if (message.length !== 5) {
    return false;
  }
  if (message[0] !== 'PONG') {
    return { succeeded: false, message: 'Invalid format for PONG message' };
  }
  var _pong = message[0];
  var authResult = message[1];
  var reason = message[2];
  var hostname = message[3];
  var sharedKeyHexdigest = message[4];
  if (!authResult) {
    return { succeeded: false, message: 'Authentication failed: ' + reason };
  }
  if (hostname === this.security.clientHostname) {
    return { succeeded: false, message: 'Same hostname between input and output: invalid configuration' };
  }
  var clientsideHexdigest = crypto.createHash('sha512')
      .update(this.sharedKeySalt)
      .update(hostname)
      .update(this.sharedKeyNonce)
      .update(this.security.sharedKey)
      .digest('hex');
  if (sharedKeyHexdigest !== clientsideHexdigest) {
    return { succeeded: false, message: 'Sharedkey mismatch' };
  }
  return { succeeded: true };
};

FluentSender.prototype.toStream = function(options) {
  if (typeof options === 'string') {
    options = {label: options};
  } else {
    options = options || {};
  }
  var label = options.label;
  if (!label) {
    throw new Error('label is needed');
  }
  var defaultEncoding = options.encoding || 'UTF-8';
  var writable = new stream.Writable();
  var dataString = '';
  writable._write = (chunk, encoding, callback) => {
    var dataArray = chunk.toString(defaultEncoding).split(/\n/);
    var next = () => {
      if (dataArray.length) {
        dataString += dataArray.shift();
      }
      if (!dataArray.length) {
        process.nextTick(callback);
        return;
      }
      this.emit(label, { message: dataString }, (err) => {
        if (err) {
          this._handleEvent('error', err, callback);
          return;
        }
        dataString = '';
        next();
      });
    };
    next();
  };
  return writable;
};

module.exports = exports = {};
exports.FluentSender = FluentSender;
