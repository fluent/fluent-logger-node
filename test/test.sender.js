'use strict';
/* globals describe, it */
/* eslint brace-style: ["error", "1tbs", {"allowSingleLine": true}] */
/* eslint no-unused-vars: ["error", {"args": "none"}] */
/* eslint node/no-unpublished-require: ["error", {"allowModules": ["async", "chai"]}] */
const expect = require('chai').expect;
const FluentSender = require('../lib/sender');
const EventTime = require('../lib/event-time');
const runServer = require('../lib/testHelper').runServer;
const stream = require('stream');
const async = require('async');
const EventEmitter = require('events').EventEmitter;
const msgpack = require('msgpack-lite');

const codec = msgpack.createCodec();
codec.addExtPacker(0x00, EventTime, EventTime.pack);
codec.addExtUnpacker(0x00, EventTime.unpack);

let doTest = (tls) => {
  let serverOptions = {};
  let clientOptions = {};
  if (tls) {
    /* eslint-disable-next-line node/no-unpublished-require */
    const selfsigned = require('selfsigned');
    const attrs = [{ name: 'commonName', value: 'foo.com' }];
    const pems = selfsigned.generate(attrs, { days: 365 });
    serverOptions = { tls: true, key: pems.private, cert: pems.cert, ca: pems.cert };
    clientOptions = { tls: true, tlsOptions: { rejectUnauthorized: false } };
  }
  it('should throw error', (done) => {
    try {
      new FluentSender('debug', Object.assign({}, clientOptions, { eventMode: 'Unknown' }));
    } catch (e) {
      expect(e.message).to.be.equal('Unknown event mode: Unknown');
      done();
    }
  });

  it('should send records', (done) => {
    runServer({}, serverOptions, (server, finish) => {
      const s1 = new FluentSender('debug', Object.assign({}, clientOptions, { port: server.port }));
      const emits = [];
      function emit(k) {
        emits.push((done) => { s1.emit('record', k, done); });
      }
      for (let i = 0; i < 10; i++) {
        emit({ number: i });
      }
      emits.push(() => {
        finish((data) => {
          expect(data.length).to.be.equal(10);
          for (let i = 0; i < 10; i++) {
            expect(data[i].tag).to.be.equal('debug.record');
            expect(data[i].data.number).to.be.equal(i);
          }
          done();
        });
      });
      async.series(emits);
    });
  });

  it('should emit connect event', (done) => {
    runServer({}, serverOptions, (server, finish) => {
      const s = new FluentSender('debug', Object.assign({}, clientOptions, {port: server.port}));
      let called = false;
      s.on('connect', () => {
        called = true;
      });
      s.emit({message: '1st message'}, () => {
        finish((data) => {
          expect(called).to.equal(true);
          done();
        });
      });
    });
  });

  it('should raise error when connection fails', (done) => {
    const s = new FluentSender('debug', Object.assign({}, clientOptions, {
      host: 'localhost',
      port: 65535
    }));
    s.on('error', (err) => {
      expect(err.code).to.be.equal('ECONNREFUSED');
      done();
    });
    s.emit('test connection error', { message: 'foobar' });
  });

  it('should log error when connection fails w/ internal logger', (done) => {
    const logger = {
      buffer: {
        info: [],
        error: []
      },
      info: function(message) {
        this.buffer.info.push(message);
      },
      error: function(message) {
        this.buffer.error.push(message);
      }
    };
    const s = new FluentSender('debug', Object.assign({}, clientOptions, {
      host: 'localhost',
      port: 65535,
      internalLogger: logger
    }));
    s._setupErrorHandler((timeoutId) => {
      expect(logger.buffer.info).to.have.lengthOf(1);
      expect(logger.buffer.info[0]).to.be.equal('Fluentd will reconnect after 600 seconds');
      expect(logger.buffer.error).to.have.lengthOf(1);
      expect(logger.buffer.error[0]).to.be.equal('Fluentd error');
      clearTimeout(timeoutId);
      done();
    });
    s.emit('test connection error', { message: 'foobar' });
  });


  it('should assure the sequence.', (done) => {
    runServer({}, serverOptions, (server, finish) => {
      const s = new FluentSender('debug', Object.assign({}, clientOptions, {port: server.port}));
      s.emit('1st record', { message: '1st data' });
      s.emit('2nd record', { message: '2nd data' });
      s.end('last record', { message: 'last data' }, () => {
        finish((data) => {
          expect(data[0].tag).to.be.equal('debug.1st record');
          expect(data[0].data.message).to.be.equal('1st data');
          expect(data[1].tag).to.be.equal('debug.2nd record');
          expect(data[1].data.message).to.be.equal('2nd data');
          expect(data[2].tag).to.be.equal('debug.last record');
          expect(data[2].data.message).to.be.equal('last data');
          done();
        });
      });
    });
  });

  it('should allow to emit with a custom timestamp', (done) => {
    runServer({}, serverOptions, (server, finish) => {
      const s = new FluentSender('debug', Object.assign({}, clientOptions, {port: server.port}));
      const timestamp = new Date(2222, 12, 4);
      const timestamp_seconds_since_epoch = Math.floor(timestamp.getTime() / 1000);

      s.emit('1st record', { message: '1st data' }, timestamp, () => {
        finish((data) => {
          expect(data[0].time).to.be.equal(timestamp_seconds_since_epoch);
          done();
        });
      });
    });
  });

  it('should allow to emit with a custom numeric timestamp', (done) => {
    runServer({}, serverOptions, (server, finish) => {
      const s = new FluentSender('debug', Object.assign({}, clientOptions, {port: server.port}));
      const timestamp = Math.floor(new Date().getTime() / 1000);

      s.emit('1st record', { message: '1st data' }, timestamp, () => {
        finish((data) => {
          expect(data[0].time).to.be.equal(timestamp);
          done();
        });
      });
    });
  });

  it('should allow to emit with a EventTime', (done) => {
    runServer({}, serverOptions, (server, finish) => {
      const s = new FluentSender('debug', Object.assign({}, clientOptions, {port: server.port}));
      const eventTime = EventTime.now();

      s.emit('1st record', { message: '1st data' }, eventTime, () => {
        finish((data) => {
          const decoded = EventTime.unpack(data[0].time.buffer);
          expect(JSON.stringify(decoded)).to.equal(JSON.stringify(eventTime));
          done();
        });
      });
    });
  });

  it('should resume the connection automatically and flush the queue', (done) => {
    const s = new FluentSender('debug', clientOptions);
    s.emit('1st record', { message: '1st data' });
    s.on('error', (err) => {
      expect(err.code).to.be.equal('ECONNREFUSED');
      runServer({}, serverOptions, (server, finish) => {
        s.port = server.port;
        s.emit('2nd record', { message: '2nd data' });
        s.end('last record', { message: 'last data' }, () => {
          finish((data) => {
            expect(data[0].tag).to.be.equal('debug.1st record');
            expect(data[0].data.message).to.be.equal('1st data');
            expect(data[1].tag).to.be.equal('debug.2nd record');
            expect(data[1].data.message).to.be.equal('2nd data');
            expect(data[2].tag).to.be.equal('debug.last record');
            expect(data[2].data.message).to.be.equal('last data');
            done();
          });
        });
      });
    });
  });

  it('should reconnect when fluentd close the client socket suddenly', (done) => {
    runServer({}, serverOptions, (server, finish) => {
      const s = new FluentSender('debug', Object.assign({}, clientOptions, {port: server.port}));
      s.emit('foo', 'bar', () => {
        // connected
        server.close(() => {
          // waiting for the server closing all client socket.
          (function waitForUnwritable() {
            if (!(s._socket && s._socket.writable)) {
              runServer({}, serverOptions, (_server2, finish) => {
                s.port = _server2.port;   // in actuall case, s.port does not need to be updated.
                s.emit('bar', { message: 'hoge' }, () => {
                  finish((data) => {
                    expect(data[0].tag).to.be.equal('debug.bar');
                    expect(data[0].data.message).to.be.equal('hoge');
                    done();
                  });
                });
              });
            } else {
              setTimeout(() => {
                waitForUnwritable();
              }, 100);
            }
          })();
        });
      });
    });
  });

  it('should send records with requireAckResponse', (done) => {
    runServer({requireAckResponse: true}, serverOptions, (server, finish) => {
      const s1 = new FluentSender('debug', Object.assign({}, clientOptions, {
        port: server.port,
        requireAckResponse: true
      }));
      const emits = [];
      function emit(k) {
        emits.push((done) => { s1.emit('record', k, done); });
      }
      for (let i = 0; i < 10; i++) {
        emit({ number: i });
      }
      emits.push(() => {
        finish((data) => {
          expect(data.length).to.be.equal(10);
          for (let i = 0; i < 10; i++) {
            expect(data[i].tag).to.be.equal('debug.record');
            expect(data[i].data.number).to.be.equal(i);
            expect(data[i].options.chunk).to.be.equal(server.messages[i].options.chunk);
          }
          done();
        });
      });
      async.series(emits);
    });
  });

  it('should send records ackResponseTimeout', (done) => {
    runServer({requireAckResponse: false }, serverOptions, (server, finish) => {
      const s1 = new FluentSender('debug', Object.assign({}, clientOptions, {
        port: server.port,
        requireAckResponse: false,
        ackResponseTimeout: 1000
      }));
      s1.on('response-timeout', (error) => {
        expect(error).to.be.equal('ack response timeout');
      });
      s1.emit('record', { number: 1 });
      finish((data) => {
        expect(data.length).to.be.equal(1);
        done();
      });
    });
  });

  it('should set error handler', (done) => {
    const s = new FluentSender('debug', Object.assign({}, clientOptions, {
      reconnectInterval: 100
    }));
    expect(s._eventEmitter.listeners('error').length).to.be.equal(0);
    s._setupErrorHandler();
    expect(s._eventEmitter.listeners('error').length).to.be.equal(1);
    done();
  });

  it('should flush queue on reconnect', (done) => {
    const s = new FluentSender('debug', Object.assign({}, clientOptions, {
      port: 43210,
      reconnectInterval: 20,
      internalLogger: {
        info: () => {},
        error: () => {}
      }
    }));
    s._setupErrorHandler();
    s.emit('record', { number: 1});
    s.emit('record', { number: 2});
    setTimeout(() => {
      runServer({requireAckResponse: true, port: 43210}, serverOptions, (server, finish) => {
        setTimeout(() => {
          finish((data) => {
            expect(data.length).to.be.equal(2);
            expect(data[0].data.number).to.be.equal(1);
            expect(data[1].data.number).to.be.equal(2);
            done();
          });
        }, 20);
      });
    }, 100);
  });

  it('should send messages with different tags correctly in PackedForward', (done) => {
    runServer({}, serverOptions, (server, finish) => {
      const s1 = new FluentSender('debug', Object.assign({}, clientOptions, {
        port: server.port,
        eventMode: 'PackedForward'
      }));
      const emits = [];
      const total = 4;
      function emit(messageData) {
        emits.push((asyncDone) => {
          if (messageData.number === total) { // end
            s1.emit(`multi-${messageData.number}`, { text: messageData.text}, asyncDone); // wait for send
          } else {
            s1.emit(`multi-${messageData.number}`, { text: messageData.text});
            asyncDone(); // run immediately do not wait for ack
          }
        });
      }
      for (let i = 0; i <= total; i++) {
        emit({ number: i, text: `This is text No ${i}` });
      }
      emits.push(() => {
        finish((data) => {
          expect(data.length).to.be.equal(5);
          data.forEach((element, index) => {
            expect(element.tag).to.be.equal(`debug.multi-${index}`);
            expect(element.data.text).to.be.equal(`This is text No ${index}`);
          });
          done();
        });
      });
      async.series(emits);
    });
  });

  [
    {
      name: 'tag and record',
      args: ['foo', { bar: 1 }],
      expect: {
        tag: 'debug.foo',
        data: { bar: 1 }
      }
    },

    {
      name: 'tag, record and time',
      args: ['foo', { bar: 1 }, 12345],
      expect: {
        tag: 'debug.foo',
        data: { bar: 1 },
        time: 12345
      }
    },

    {
      name: 'tag, record and callback',
      args: ['foo', { bar: 1 }, function cb() { cb.called = true; }],
      expect: {
        tag: 'debug.foo',
        data: { bar: 1 }
      }
    },

    {
      name: 'tag, record, time and callback',
      args: ['foo', { bar: 1 }, 12345, function cb() { cb.called = true; }],
      expect: {
        tag: 'debug.foo',
        data: { bar: 1 },
        time: 12345
      }
    },

    {
      name: 'record',
      args: [{ bar: 1 }],
      expect: {
        tag: 'debug',
        data: { bar: 1 }
      }
    },

    {
      name: 'record and time',
      args: [{ bar: 1 }, 12345],
      expect: {
        tag: 'debug',
        data: { bar: 1 },
        time: 12345
      }
    },

    {
      name: 'record and callback',
      args: [{ bar: 1 }, function cb() { cb.called = true; }],
      expect: {
        tag: 'debug',
        data: { bar: 1 }
      }
    },

    {
      name: 'record, time and callback',
      args: [{ bar: 1 }, 12345, function cb() { cb.called = true; }],
      expect: {
        tag: 'debug',
        data: { bar: 1 },
        time: 12345
      }
    },

    {
      name: 'record and date object',
      args: [{ bar: 1 }, new Date(1384434467952)],
      expect: {
        tag: 'debug',
        data: { bar: 1 },
        time: 1384434467
      }
    }
  ].forEach((testCase) => {
    it('should send records with ' + testCase.name + ' arguments', (done) => {
      runServer({}, serverOptions, (server, finish) => {
        const s1 = new FluentSender('debug', Object.assign({}, clientOptions, { port: server.port }));
        s1.emit.apply(s1, testCase.args);

        finish((data) => {
          expect(data[0].tag).to.be.equal(testCase.expect.tag);
          expect(data[0].data).to.be.deep.equal(testCase.expect.data);
          if (testCase.expect.time) {
            expect(data[0].time).to.be.deep.equal(testCase.expect.time);
          }

          testCase.args.forEach((arg) => {
            if (typeof arg === 'function') {
              expect(arg.called, 'callback must be called').to.be.true;
            }
          });

          done();
        });

      });
    });
  });

  [
    {
      name: 'tag and record',
      args: ['foo', { bar: 1 }],
      expect: {
        tag: 'foo',
        data: { bar: 1 }
      }
    },

    {
      name: 'tag, record and time',
      args: ['foo', { bar: 1 }, 12345],
      expect: {
        tag: 'foo',
        data: { bar: 1 },
        time: 12345
      }
    },

    {
      name: 'tag, record and callback',
      args: ['foo', { bar: 1 }, function cb() { cb.called = true; }],
      expect: {
        tag: 'foo',
        data: { bar: 1 }
      }
    },

    {
      name: 'tag, record, time and callback',
      args: ['foo', { bar: 1 }, 12345, function cb() { cb.called = true; }],
      expect: {
        tag: 'foo',
        data: { bar: 1 },
        time: 12345
      }
    }
  ].forEach((testCase) => {
    it('should send records with ' + testCase.name + ' arguments without a default tag', (done) => {
      runServer({}, serverOptions, (server, finish) => {
        const s1 = new FluentSender(null, Object.assign({}, clientOptions, { port: server.port }));
        s1.emit.apply(s1, testCase.args);

        finish((data) => {
          expect(data[0].tag).to.be.equal(testCase.expect.tag);
          expect(data[0].data).to.be.deep.equal(testCase.expect.data);
          if (testCase.expect.time) {
            expect(data[0].time).to.be.deep.equal(testCase.expect.time);
          }

          testCase.args.forEach((arg) => {
            if (typeof arg === 'function') {
              expect(arg.called, 'callback must be called').to.be.true;
            }
          });

          done();
        });

      });
    });
  });

  [
    {
      name: 'record',
      args: [{ bar: 1 }]
    },

    {
      name: 'record and time',
      args: [{ bar: 1 }, 12345]
    },

    {
      name: 'record and callback',
      args: [{ bar: 1 }, function cb() { cb.called = true; }]
    },

    {
      name: 'record, time and callback',
      args: [{ bar: 1 }, 12345, function cb() { cb.called = true; }]
    },

    {
      name: 'record and date object',
      args: [{ bar: 1 }, new Date(1384434467952)]
    }
  ].forEach((testCase) => {
    it('should not send records with ' + testCase.name + ' arguments without a default tag', (done) => {
      runServer({}, serverOptions, (server, finish) => {
        const s1 = new FluentSender(null, Object.assign({}, clientOptions, { port: server.port }));
        s1.on('error', (error) => {
          expect(error.name).to.be.equal('MissingTagError');
        });
        s1.emit.apply(s1, testCase.args);

        finish((data) => {
          expect(data.length).to.be.equal(0);
          testCase.args.forEach((arg) => {
            if (typeof arg === 'function') {
              expect(arg.called, 'callback must be called').to.be.true;
            }
          });

          done();
        });

      });
    });
  });

  it('should not send records is not object', (done) => {
    runServer({}, serverOptions, (server, finish) => {
      const s1 = new FluentSender(null, Object.assign({}, clientOptions, { port: server.port }));
      s1.on('error', (error) => {
        expect(error.name).to.be.equal('DataTypeError');
      });
      s1.emit('label', 'string');
      finish((data) => {
        expect(data.length).to.be.equal(0);
      });
      done();
    });
  });

  it('should set max listeners', (done) => {
    const s = new FluentSender('debug', clientOptions);
    if (EventEmitter.prototype.getMaxListeners) {
      expect(s.getMaxListeners()).to.be.equal(10);
    }
    s.setMaxListeners(100);
    if (EventEmitter.prototype.getMaxListeners) {
      expect(s.getMaxListeners()).to.be.equal(100);
    } else {
      expect(s._eventEmitter._maxListeners).to.be.equal(100);
    }
    done();
  });

  it('should set sendQueueSizeLimit', (done) => {
    const s = new FluentSender('debug', Object.assign({}, clientOptions, {
      sendQueueSizeLimit: 1000,
      eventMode: 'PackedForward'
    }));

    expect(s._sendQueueSizeLimit).to.be.equal(1000);
    done();
  });

  // Internal behavior test.
  it('should not flush queue if existing connection is unavailable.', (done) => {
    runServer({}, serverOptions, (server, finish) => {
      const s = new FluentSender('debug', Object.assign({}, clientOptions, {port: server.port}));
      s.emit('1st record', { message: '1st data' }, () => {
        s._disconnect();
        s.emit('2nd record', { message: '2nd data' }, () => {
          finish((data) => {
            expect(data[0].tag).to.be.equal('debug.1st record');
            expect(data[0].data.message).to.be.equal('1st data');
            expect(data[1].tag).to.be.equal('debug.2nd record');
            expect(data[1].data.message).to.be.equal('2nd data');
            done();
          });
        });
      });
    });
  });

  it('should write stream.', (done) => {
    runServer({}, serverOptions, (server, finish) => {
      const s = new FluentSender('debug', Object.assign({}, clientOptions, { port: server.port }));
      const ss = s.toStream('record');
      const pt = new stream.PassThrough();
      pt.pipe(ss);
      pt.push('data1\n');
      pt.push('data2\ndata');
      pt.push('3\ndata4\n');
      pt.end();
      ss.on('finish', () => {
        s.end(null, null, () => {
          finish((data) => {
            expect(data[0].data.message).to.be.equal('data1');
            expect(data[1].data.message).to.be.equal('data2');
            expect(data[2].data.message).to.be.equal('data3');
            expect(data[3].data.message).to.be.equal('data4');
            done();
          });
        });
      });
    });
  });

  it('should flush queue on reconnect for stream', (done) => {
    const s = new FluentSender('debug', Object.assign({}, clientOptions, {
      port: 43210,
      reconnectInterval: 20,
      internalLogger: {
        info: () => {},
        error: () => {}
      }
    }));
    s._setupErrorHandler();
    const ss = s.toStream('record');
    const pt = new stream.PassThrough();
    pt.pipe(ss);
    pt.push('data1\n');
    pt.push('data2\ndata');
    pt.push('3\ndata4\n');
    pt.end();
    setTimeout(() => {
      runServer({port: 43210}, serverOptions, (server, finish) => {
        setTimeout(() => {
          finish((data) => {
            expect(data[0].data.message).to.be.equal('data1');
            expect(data[1].data.message).to.be.equal('data2');
            expect(data[2].data.message).to.be.equal('data3');
            expect(data[3].data.message).to.be.equal('data4');
            done();
          });
        }, 20);
      });
    }, 100);
  });

  it('should process messages step by step on requireAckResponse=true', (done) => {
    runServer({ requireAckResponse: true }, serverOptions, (server, finish) => {
      const s = new FluentSender('debug', Object.assign({}, clientOptions, {
        port: server.port,
        timeout: 3.0,
        reconnectInterval: 600000,
        requireAckResponse: true
      }));
      const errors = [];
      s.on('error', (err) => {
        errors.push(count + ': ' + err);
      });
      const maxCount = 20;
      let count = 0;
      const sendMessage = function() {
        const time = Math.round(Date.now() / 1000);
        const data = {
          count: count
        };
        s.emit('test', data, time);
        count++;
        if (count > maxCount) {
          clearInterval(timer);
          finish();
          expect(errors.join('\n')).to.be.equal('');
          done();
        }
      };
      let timer = setInterval(sendMessage, 10);
    });
  });

  it('should process entries when using PackedForward Mode', (done) => {
    runServer({}, serverOptions, (server, finish) => {
      const loggerOptions = {
        port: server.port,
        eventMode: 'PackedForward',
        internalLogger: {
          info: () => {},
          error: () => {}
        }
      };
      const s = new FluentSender('debug', Object.assign({}, clientOptions, loggerOptions));
      s.emit('test', { message: 'This is test 0' });
      s.end('test', { message: 'This is test 1' });
      setTimeout(() => {
        finish((data) => {
          expect(data.length).to.be.equal(2);
          expect(data[0].tag).to.be.equal('debug.test');
          expect(data[0].data.message).to.be.equal('This is test 0');
          expect(data[1].tag).to.be.equal('debug.test');
          expect(data[1].data.message).to.be.equal('This is test 1');
          expect(s._sendQueueSize).to.be.equal(0);
          done();
        });
      }, 200);
    });
  });

  it('should compress entries when using CompressedPackedForward Mode', (done) => {
    runServer({}, serverOptions, (server, finish) => {
      const loggerOptions = {
        port: server.port,
        eventMode: 'CompressedPackedForward',
        internalLogger: {
          info: () => {},
          error: () => {}
        }
      };
      const s = new FluentSender('debug', Object.assign({}, clientOptions, loggerOptions));
      s.emit('test', { message: 'This is test 0' });
      s.emit('test', { message: 'This is test 1' });
      setTimeout(() => {
        finish((data) => {
          expect(data.length).to.be.equal(2);
          expect(data[0].tag).to.be.equal('debug.test');
          expect(data[0].data.message).to.be.equal('This is test 0');
          expect(data[1].tag).to.be.equal('debug.test');
          expect(data[1].data.message).to.be.equal('This is test 1');
          expect(s._sendQueueSize).to.be.equal(0);
          done();
        });
      }, 200);
    });
  });

  it('should process handshake sahred key', (done) => {
    const sharedKey = 'sharedkey';
    const options = {
      security: {
        serverHostname: 'server.example.com',
        sharedKey: sharedKey
      }
    };
    runServer(options, serverOptions, (server, finish) => {
      const loggerOptions = {
        port: server.port,
        security: {
          clientHostname: 'client.example.com',
          sharedKey: sharedKey
        },
        internalLogger: {
          info: () => {},
          error: () => {}
        }
      };
      const s = new FluentSender('debug', Object.assign({}, clientOptions, loggerOptions));
      s.emit('test', { message: 'This is test 0' });
      s.emit('test', { message: 'This is test 1' });
      finish((data) => {
        expect(data.length).to.be.equal(2);
        expect(data[0].tag).to.be.equal('debug.test');
        expect(data[0].data.message).to.be.equal('This is test 0');
        expect(data[1].tag).to.be.equal('debug.test');
        expect(data[1].data.message).to.be.equal('This is test 1');
        done();
      });
    });
  });

  it('should process handshake sahred key mismatch', (done) => {
    const sharedKey = 'sharedkey';
    const options = {
      security: {
        serverHostname: 'server.example.com',
        sharedKey: sharedKey
      }
    };
    runServer(options, serverOptions, (server, finish) => {
      const loggerOptions = {
        port: server.port,
        security: {
          clientHostname: 'client.example.com',
          sharedKey: 'wrongSharedKey'
        },
        internalLogger: {
          info: () => {},
          error: () => {}
        }
      };
      const s = new FluentSender('debug', Object.assign({}, clientOptions, loggerOptions));
      s.on('error', (error) => {
        expect(error.message).to.be.equal('Authentication failed: shared key mismatch');
      });
      s.emit('test', { message: 'This is test 0' });
      finish((data) => {
        expect(data.length).to.be.equal(0);
        done();
      });
    });
  });

  it('should process handshake user based authentication', (done) => {
    const sharedKey = 'sharedkey';
    const options = {
      security: {
        serverHostname: 'server.example.com',
        sharedKey: sharedKey,
        username: 'fluentd',
        password: 'password'
      }
    };
    runServer(options, serverOptions, (server, finish) => {
      const loggerOptions = {
        port: server.port,
        security: {
          clientHostname: 'client.example.com',
          sharedKey: sharedKey,
          username: 'fluentd',
          password: 'password'
        },
        internalLogger: {
          info: () => {},
          error: () => {}
        }
      };
      const s = new FluentSender('debug', Object.assign({}, clientOptions, loggerOptions));
      s.emit('test', { message: 'This is test 0' });
      s.emit('test', { message: 'This is test 1' });
      finish((data) => {
        expect(data.length).to.be.equal(2);
        expect(data[0].tag).to.be.equal('debug.test');
        expect(data[0].data.message).to.be.equal('This is test 0');
        expect(data[1].tag).to.be.equal('debug.test');
        expect(data[1].data.message).to.be.equal('This is test 1');
        done();
      });
    });
  });

  it('should process handshake user based authentication failed', (done) => {
    const sharedKey = 'sharedkey';
    const options = {
      security: {
        serverHostname: 'server.example.com',
        sharedKey: sharedKey,
        username: 'fluentd',
        password: 'password'
      }
    };
    runServer(options, serverOptions, (server, finish) => {
      const loggerOptions = {
        port: server.port,
        security: {
          clientHostname: 'client.example.com',
          sharedKey: sharedKey,
          username: 'fluentd',
          password: 'wrongPassword'
        },
        internalLogger: {
          info: () => {},
          error: () => {}
        }
      };
      const s = new FluentSender('debug', Object.assign({}, clientOptions, loggerOptions));
      s.on('error', (error) => {
        expect(error.message).to.be.equal('Authentication failed: username/password mismatch');
      });
      s.emit('test', { message: 'This is test 0' });
      finish((data) => {
        expect(data.length).to.be.equal(0);
        done();
      });
    });
  });

  it('should process handshake failed', (done) => {
    const sharedKey = 'sharedkey';
    const options = {
      security: {
        serverHostname: 'server.example.com',
        sharedKey: sharedKey
      },
      checkPing: (data) => { return { succeeded: false, reason: 'reason', sharedKeySalt: null }; }
    };
    runServer(options, serverOptions, (server, finish) => {
      const loggerOptions = {
        port: server.port,
        security: {
          clientHostname: 'client.example.com',
          sharedKey: sharedKey
        },
        internalLogger: {
          info: () => {},
          error: () => {}
        }
      };
      const s = new FluentSender('debug', Object.assign({}, clientOptions, loggerOptions));
      s.on('error', (err) => {
        expect(err.message).to.be.equal('Authentication failed: reason');
      });
      s.emit('test', { message: 'This is test 0' });
      finish((data) => {
        expect(data.length).to.be.equal(0);
        done();
      });
    });
  });

  it('should limit messages stored in queue if server is not available', (done) => {
    runServer({}, serverOptions, (server, finish) => {
      finish(() => {
        const s = new FluentSender('debug', Object.assign({}, clientOptions, {
          port: server.port,
          messageQueueSizeLimit: 3
        }));
        s.emit('message1', {});
        s.emit('message2', {});
        s.emit('message3', {});
        s.emit('message4', {});
        expect(s._sendQueue.length).to.be.equal(3);
        expect(s._sendQueue[0].tag).to.be.equal('debug.message2');
        expect(s._sendQueue[1].tag).to.be.equal('debug.message3');
        expect(s._sendQueue[2].tag).to.be.equal('debug.message4');
        done();
      });
    });
  });
};

describe('FluentSender', () => {
  doTest();
});

describe('FluentSenderWithTLS', () => {
  doTest(true);
});
