'use strict';
const EventEmitter = require('events').EventEmitter;
const msgpack = require('msgpack-lite');
const net = require('net');
const stream = require('stream');
const crypto = require('crypto');
const tls = require('tls');
const zlib = require('zlib');
const FluentLoggerError = require('./logger-error');
const EventTime = require('./event-time');

const codec = msgpack.createCodec();
codec.addExtPacker(0x00, EventTime, EventTime.pack);
codec.addExtUnpacker(0x00, EventTime.unpack);

class FluentSender {
  constructor(tag_prefix, options) {
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
    this.tls = !!options.tls;
    this.tlsOptions = options.tlsOptions || {};
    this.enableReconnect = typeof options.enableReconnect === 'boolean' ? options.enableReconnect : true;
    this.reconnectInterval = options.reconnectInterval || 600000; // Default is 10 minutes
    this.requireAckResponse = options.requireAckResponse;
    this.ackResponseTimeout = options.ackResponseTimeout || 190000; // Default is 190 seconds
    this.internalLogger = options.internalLogger || console;
    this._timeResolution = options.milliseconds ? 1 : 1000;
    this._socket = null;
    if (this._eventMode === 'Message') {
      this._sendQueue = []; // queue for items waiting for being sent.
      this._flushInterval = 0;
      this._messageQueueSizeLimit = options.messageQueueSizeLimit || 0;
    } else {
      this._sendQueue = new Map();
      this._flushInterval = options.flushInterval || 100;
      this._sendQueueSizeLimit = options.sendQueueSizeLimit || 8 * 1024 * 1024; // 8MiB
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
      password: ''
    };
    this.sharedKeySalt = crypto.randomBytes(16).toString('hex');
    // helo, pingpong, established
    this._status = null;
    this._connecting = false;
  }

  emit(/*[label] <data>, [timestamp], [callback] */a0, a1, a2, a3) {
    let label, data, timestamp, callback;
    let timestampOrCallback, cbArg;
    // Label must be string always
    // Data can be almost anything
    // Date can be either timestamp number or Date object
    // Last argument is an optional callback
    if (typeof a0 === 'string') {
      label = a0;
      data = a1;
      timestampOrCallback = a2;
      cbArg = a3;
    } else {
      data = a0;
      timestampOrCallback = a1;
      cbArg = a2;
    }

    if (typeof timestampOrCallback === 'function') {
      callback = timestampOrCallback;
    } else if (timestampOrCallback) {
      timestamp = timestampOrCallback;
      if (typeof cbArg === 'function') {
        callback = cbArg;
      }
    }

    const tag = this._makeTag(label);
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
  }

  end(label, data, callback) {
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
  }

  _close() {
    if (this._socket) {
      this._socket.end();
      this._socket = null;
      this._status = null;
    }
  }

  _makeTag(label) {
    let tag = null;
    if (this.tag_prefix && label) {
      tag = `${this.tag_prefix}.${label}`;
    } else if (this.tag_prefix) {
      tag = this.tag_prefix;
    } else if (label) {
      tag = label;
    }
    return tag;
  }

  _makePacketItem(tag, time, data) {
    if (!time || (typeof time !== 'number' && !(time instanceof EventTime))) {
      time = Math.floor((time ? time.getTime() : Date.now()) / this._timeResolution);
    }

    const packet = [tag, time, data];
    const options = {};
    if (this.requireAckResponse) {
      options.chunk = crypto.randomBytes(16).toString('base64');
      packet.push(options);
    }
    return {
      packet: msgpack.encode(packet, { codec: codec }),
      tag: tag,
      time: time,
      data: data,
      options: options
    };
  }

  _makeEventEntry(time, data) {
    if (!time || (typeof time !== 'number' && !(time instanceof EventTime))) {
      time = Math.floor((time ? time.getTime() : Date.now()) / this._timeResolution);
    }

    return msgpack.encode([time, data], { codec: codec });
  }

  _push(tag, time, data, callback) {
    if (this._eventMode === 'Message') {
      // Message mode
      const item = this._makePacketItem(tag, time, data);
      item.callback = callback;
      if (this._messageQueueSizeLimit && this._sendQueue.length === this._messageQueueSizeLimit) {
        this._sendQueue.shift();
      }
      this._sendQueue.push(item);
    } else {
      // PackedForward mode
      const eventEntry = this._makeEventEntry(time, data);
      this._sendQueueSize += eventEntry.length;
      if (this._sendQueue.has(tag)) {
        const eventEntryData = this._sendQueue.get(tag);
        eventEntryData.eventEntries.push(eventEntry);
        eventEntryData.size += eventEntry.length;
        if (callback) eventEntryData.callbacks.push(callback);
      } else {
        const callbacks = callback ? [callback] : [];
        this._sendQueue.set(tag, {
          eventEntries: [eventEntry],
          size: eventEntry.length,
          callbacks: callbacks
        });
      }
    }
  }

  _connect(callback) {
    if (this._connecting) {
      return;
    }

    if (this._socket === null) {
      this._connecting = true;
      this._doConnect(() => {
        this._connecting = false;
        callback();
      });
    } else if (!this._socket.writable) {
      this._disconnect();
      this._connect(callback);
    } else {
      this._connecting = false;
      process.nextTick(callback);
    }
  }

  _doConnect(callback) {
    const addHandlers = () => {
      const errorHandler = (err) => {
        if (this._socket) {
          this._disconnect();
          this._handleEvent('error', err);
        }
      };
      this._socket.on('error', errorHandler);
      this._socket.on('connect', () => {
        this._handleEvent('connect');
      });
      if (this.tls) {
        this._socket.on('tlsClientError', errorHandler);
        this._socket.on('secureConnect', () => {
          this._handleEvent('connect');
        });
      }
    };
    if (!this.tls) {
      this._socket = new net.Socket();
      this._socket.setTimeout(this.timeout);
      addHandlers();
    }
    if (this.path) {
      if (this.tls) {
        this._socket = tls.connect(Object.assign({}, this.tlsOptions, { path: this.path }), () => {
          callback();
        });
        addHandlers();
      } else {
        this._socket.connect(this.path, () => {
          callback();
        });
      }
    } else {
      const postConnect = () => {
        if (this.security.clientHostname && this.security.sharedKey !== null) {
          this._handshake(callback);
        } else {
          this._status = 'established';
          callback();
        }
      };
      if (this.tls) {
        this._socket = tls.connect(Object.assign({}, this.tlsOptions, { host: this.host, port: this.port }), () => {
          postConnect();
        });
        addHandlers();
      } else {
        this._socket.connect(this.port, this.host, () => {
          postConnect();
        });
      }
    }
  }

  _disconnect() {
    this._socket && this._socket.destroy();
    this._socket = null;
    this._status = null;
    this._connecting = false;
  }

  _handshake(callback) {
    if (this._status === 'established') {
      return;
    }
    this._status = 'helo';
    this._socket.once('data', (data) => {
      this._socket.pause();
      const heloStatus = this._checkHelo(data);
      if (!heloStatus.succeeded) {
        this.internalLogger.error('Received invalid HELO message from ' + this._socket.remoteAddress);
        this._disconnect();
        return;
      }
      this._status = 'pingpong';
      this._socket.write(this._generatePing(), () => {
        this._socket.resume();
        this._socket.once('data', (data) => {
          const pongStatus = this._checkPong(data);
          if (!pongStatus.succeeded) {
            this.internalLogger.error(pongStatus.message);
            const error = new FluentLoggerError.HandshakeError(pongStatus.message);
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
  }

  _flushSendQueue() {
    if (this._flushingSendQueue)
      return;

    this._flushingSendQueue = true;
    this._waitToWrite();
  }

  _waitToWrite() {
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
            if (!this._socket) {
              this._flushingSendQueue = false;
              return;
            }
            this._doFlushSendQueue();
          }, this._flushInterval);
        }
      }
    } else {
      process.nextTick(() => {
        this._waitToWrite();
      });
    }
  }

  _doFlushSendQueue(timeoutId) {
    if (this._eventMode === 'Message') {
      const item = this._sendQueue.shift();
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
      const first = this._sendQueue.entries().next().value;
      const tag = first[0];
      const eventEntryData = first[1];
      let entries = Buffer.concat(eventEntryData.eventEntries, eventEntryData.size);
      let size = entries.length;
      this._sendQueue.delete(tag);
      if (this._compressed) {
        entries = zlib.gzipSync(entries);
        size = entries.length;
      }
      const options = {
        chunk: crypto.randomBytes(16).toString('base64'),
        size: size,
        compressed: this._compressed ? 'gzip' : 'text',
        eventEntryDataSize: eventEntryData.size
      };
      const packet = msgpack.encode([tag, entries, options], { codec: codec });
      this._doWrite(packet, options, timeoutId, eventEntryData.callbacks);
    }
  }

  _doWrite(packet, options, timeoutId, callbacks) {
    const sendPacketSize = (options && options.eventEntryDataSize) || this._sendQueueSize;
    this._socket.write(packet, () => {
      if (this.requireAckResponse) {
        this._socket.once('data', (data) => {
          timeoutId && clearTimeout(timeoutId);
          const response = msgpack.decode(data, { codec: codec });
          if (response.ack !== options.chunk) {
            const error = new FluentLoggerError.ResponseError(
              'ack in response and chunk id in sent data are different',
              { ack: response.ack, chunk: options.chunk }
            );
            callbacks.forEach((callback) => {
              this._handleEvent('error', error, callback);
            });
          } else { // no error on ack
            callbacks.forEach((callback) => {
              callback && callback();
            });
          }
          this._sendQueueSize -= sendPacketSize;
          process.nextTick(() => {
            this._waitToWrite();
          });
        });
        timeoutId = setTimeout(() => {
          const error = new FluentLoggerError.ResponseTimeout('ack response timeout');
          callbacks.forEach((callback) => {
            this._handleEvent('error', error, callback);
          });
        }, this.ackResponseTimeout);
      } else {
        this._sendQueueSize -= sendPacketSize;
        callbacks.forEach((callback) => {
          callback && callback();
        });
        process.nextTick(() => {
          this._waitToWrite();
        });
      }
    });
  }

  _handleEvent(signal, data, callback) {
    callback && callback(data);
    if (this._eventEmitter.listenerCount(signal) > 0) {
      this._eventEmitter.emit(signal, data);
    }
  }

  _setupErrorHandler(callback) {
    if (!this.reconnectInterval || !this.enableReconnect) {
      return;
    }
    this.on('error', (error) => {
      this._flushingSendQueue = false;
      this._status = null;
      this.internalLogger.error('Fluentd error', error);
      this.internalLogger.info('Fluentd will reconnect after ' + this.reconnectInterval / 1000 + ' seconds');
      const timeoutId = setTimeout(() => {
        this.internalLogger.info('Fluentd is reconnecting...');
        this._connect(() => {
          this._flushSendQueue();
          this.internalLogger.info('Fluentd reconnection finished!!');
        });
      }, this.reconnectInterval);
      callback && callback(timeoutId);
    });
  }

  _checkHelo(data) {
    // ['HELO', options(hash)]
    this.internalLogger.info('Checking HELO...');
    const message = msgpack.decode(data);
    if (message.length !== 2) {
      return { succeeded: false, message: 'Invalid format for HELO message' };
    }
    if (message[0] !== 'HELO') {
      return { succeeded: false, message: 'Invalid format for HELO message' };
    }
    const options = message[1] || {};
    this.sharedKeyNonce = options['nonce'] || '';
    this.authentication = options['auth'] || '';
    return { succeeded: true };
  }

  _generatePing() {
    // [
    //   'PING',
    //   client_hostname,
    //   shared_key_salt,
    //   sha512_hex(sharedkey_salt + client_hostname + nonce + shared_key),
    //   username || '',
    //   sha512_hex(auth_salt + username + password) || ''
    // ]
    const sharedKeyHexdigest = crypto.createHash('sha512')
      .update(this.sharedKeySalt)
      .update(this.security.clientHostname)
      .update(this.sharedKeyNonce)
      .update(this.security.sharedKey)
      .digest('hex');
    const ping = ['PING', this.security.clientHostname, this.sharedKeySalt, sharedKeyHexdigest];
    if (Buffer.isBuffer(this.authentication) && this.authentication.length !== 0) {
      const passwordHexDigest = crypto.createHash('sha512')
        .update(this.authentication)
        .update(this.security.username || '')
        .update(this.security.password || '')
        .digest('hex');
      ping.push(this.security.username, passwordHexDigest);
    } else {
      ping.push('', '');
    }
    return msgpack.encode(ping);
  }

  _checkPong(data) {
    // [
    //   'PONG',
    //   bool(authentication result),
    //   'reason if authentication failed',
    //   server_hostname,
    //   sha512_hex(salt + server_hostname + nonce + sharedkey)
    // ]
    this.internalLogger.info('Checking PONG...');
    const message = msgpack.decode(data);
    if (message.length !== 5) {
      return false;
    }
    if (message[0] !== 'PONG') {
      return { succeeded: false, message: 'Invalid format for PONG message' };
    }
    const _pong = message[0];
    const authResult = message[1];
    const reason = message[2];
    const hostname = message[3];
    const sharedKeyHexdigest = message[4];
    if (!authResult) {
      return { succeeded: false, message: 'Authentication failed: ' + reason };
    }
    if (hostname === this.security.clientHostname) {
      return { succeeded: false, message: 'Same hostname between input and output: invalid configuration' };
    }
    const clientsideHexdigest = crypto.createHash('sha512')
      .update(this.sharedKeySalt)
      .update(hostname)
      .update(this.sharedKeyNonce)
      .update(this.security.sharedKey)
      .digest('hex');
    if (sharedKeyHexdigest !== clientsideHexdigest) {
      return { succeeded: false, message: 'Sharedkey mismatch' };
    }
    return { succeeded: true };
  }

  toStream(options) {
    if (typeof options === 'string') {
      options = {label: options};
    } else {
      options = options || {};
    }
    const label = options.label;
    if (!label) {
      throw new Error('label is needed');
    }
    const defaultEncoding = options.encoding || 'UTF-8';
    const writable = new stream.Writable();
    let dataString = '';
    writable._write = (chunk, encoding, callback) => {
      const dataArray = chunk.toString(defaultEncoding).split(/\n/);
      const next = () => {
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
  }
}

['addListener', 'on', 'once', 'removeListener', 'removeAllListeners', 'setMaxListeners', 'getMaxListeners'].forEach((attr, i) => {
  FluentSender.prototype[attr] = function() {
    return this._eventEmitter[attr].apply(this._eventEmitter, Array.from(arguments));
  };
});

module.exports = FluentSender;
