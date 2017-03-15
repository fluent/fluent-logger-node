var expect = require('chai').expect;
var sender = require('../lib/sender');
var runServer = require('../lib/testHelper').runServer;
var stream = require('stream');
var async = require('async');
var EventEmitter = require('events').EventEmitter;

describe("FluentSender", function(){
  it('should send records', function(done){
    runServer({}, function(server, finish){
      var s1 = new sender.FluentSender('debug', { port: server.port });
      var emits = [];
      function emit(k){
        emits.push(function(done){ s1.emit('record', k, done); });
      }
      for(var i=0; i<10; i++){
        emit({ number: i });
      }
      emits.push(function(){
        finish(function(data){
          expect(data.length).to.be.equal(10);
          for(var i=0; i<10; i++){
            expect(data[i].tag).to.be.equal("debug.record");
            expect(data[i].data.number).to.be.equal(i);
          }
          done();
        });
      });
      async.series(emits);
    });
  });

  it('should raise error when connection fails', function(done){
    var s = new sender.FluentSender('debug', {
      host: 'localhost',
      port: 65535
    });
    s.on('error', function(err){
      expect(err.code).to.be.equal('ECONNREFUSED');
      done();
    });
    s.emit('test connection error', { message: 'foobar' });
  });


  it('should assure the sequence.', function(done){
    runServer({}, function(server, finish){
      var s = new sender.FluentSender('debug', {port: server.port});
      s.emit('1st record', { message: '1st data' });
      s.emit('2nd record', { message: '2nd data' });
      s.end('last record', { message: 'last data' }, function(){
        finish(function(data){
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

  it('should allow to emit with a custom timestamp', function(done){
    runServer({}, function(server, finish){
      var s = new sender.FluentSender('debug', {port: server.port});
      var timestamp = new Date(2222, 12, 04);
      var timestamp_seconds_since_epoch = Math.floor(timestamp.getTime() / 1000);

      s.emit("1st record", { message: "1st data" }, timestamp, function() {
        finish(function(data) {
          expect(data[0].time).to.be.equal(timestamp_seconds_since_epoch);
          done();
        });
      });
    });
  });

  it('should allow to emit with a custom numeric timestamp', function(done){
    runServer({}, function(server, finish){
      var s = new sender.FluentSender('debug', {port: server.port});
      var timestamp = Math.floor(new Date().getTime() / 1000);

      s.emit("1st record", { message: "1st data" }, timestamp, function() {
        finish(function(data) {
          expect(data[0].time).to.be.equal(timestamp);
          done();
        });
      });
    });
  });

  it('should allow to emit with a custom tag', function(done){
    runServer({}, function(server, finish){
      var s = new sender.FluentSender('debug', {port: server.port, tags: {custom: 'tag'}});

      s.emit("1st record", { message: "1st data" }, function() {
        finish(function(data) {
          expect(data[0].data.custom).to.be.equal('tag');
          done();
        });
      });
    });
  });

  it('should resume the connection automatically and flush the queue', function(done){
    var s = new sender.FluentSender('debug');
    s.emit('1st record', { message: '1st data' });
    s.on('error', function(err){
      expect(err.code).to.be.equal('ECONNREFUSED');
      runServer({}, function(server, finish){
        s.port = server.port;
        s.emit('2nd record', { message: '2nd data' });
        s.end('last record', { message: 'last data' }, function(){
          finish(function(data){
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

  it('should reconnect when fluentd close the client socket suddenly', function(done){
    runServer({}, function(server, finish){
      var s = new sender.FluentSender('debug', {port: server.port});
      s.emit('foo', 'bar', function(){
        // connected
        server.close(function(){
          // waiting for the server closing all client socket.
          (function waitForUnwritable(){
            if( !(s._socket && s._socket.writable) ){
              runServer({}, function(_server2, finish){
                s.port = _server2.port;   // in actuall case, s.port does not need to be updated.
                s.emit('bar', { message: 'hoge' }, function(){
                  finish(function(data){
                    expect(data[0].tag).to.be.equal('debug.bar');
                    expect(data[0].data.message).to.be.equal('hoge');
                    done();
                  });
                });
              });
            }else{
              setTimeout(function(){
                waitForUnwritable();
              }, 100);
            }
          })();
        });
      });
    });
  });

  it('should send records with requireAckResponse', function(done) {
    runServer({requireAckResponse: true}, function(server, finish) {
      var s1 = new sender.FluentSender('debug', {
        port: server.port,
        requireAckResponse: true
      });
      var emits = [];
      function emit(k){
        emits.push(function(done){ s1.emit('record', k, done); });
      }
      for (var i=0; i<10; i++) {
        emit({ number: i });
      }
      emits.push(function(){
        finish(function(data){
          expect(data.length).to.be.equal(10);
          for(var i=0; i<10; i++){
            expect(data[i].tag).to.be.equal("debug.record");
            expect(data[i].data.number).to.be.equal(i);
            expect(data[i].options.chunk).to.be.equal(server.messages[i].options.chunk);
          }
          done();
        });
      });
      async.series(emits);
    });
  });

  it('should send records ackResponseTimeout', function(done) {
    runServer({requireAckResponse: false }, function(server, finish) {
      var s1 = new sender.FluentSender('debug', {
        port: server.port,
        requireAckResponse: false,
        ackResponseTimeout: 1000
      });
      s1.on('response-timeout', function(error) {
        expect(error).to.be.equal('ack response timeout');
      });
      s1.emit('record', { number: 1 });
      finish(function(data) {
        expect(data.length).to.be.equal(1);
        done();
      });
    });
  });

  it('should set error handler', function(done){
    var s = new sender.FluentSender('debug', {
      reconnectInterval: 100
    });
    expect(s._eventEmitter.listeners('error').length).to.be.equal(0);
    s._setupErrorHandler();
    expect(s._eventEmitter.listeners('error').length).to.be.equal(1);
    done();
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
      args: [{ bar: 1 }, function cb(){ cb.called = true; }],
      expect: {
        tag: 'debug',
        data: { bar: 1 }
      }
    },

    {
      name: 'record, time and callback',
      args: [{ bar: 1 }, 12345, function cb(){ cb.called = true; }],
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
  ].forEach(function(testCase) {
    it('should send records with '+testCase.name+' arguments', function(done){
      runServer({}, function(server, finish){
        var s1 = new sender.FluentSender('debug', { port: server.port });
        s1.emit.apply(s1, testCase.args);

        finish(function(data){
          expect(data[0].tag).to.be.equal(testCase.expect.tag);
          expect(data[0].data).to.be.deep.equal(testCase.expect.data);
          if (testCase.expect.time) {
            expect(data[0].time).to.be.deep.equal(testCase.expect.time);
          }

          testCase.args.forEach(function(arg) {
            if (typeof arg === "function") {
              expect(arg.called, "callback must be called").to.be.true;
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
  ].forEach(function(testCase) {
    it('should send records with '+testCase.name+' arguments without a default tag', function(done){
      runServer({}, function(server, finish){
        var s1 = new sender.FluentSender(null, { port: server.port });
        s1.emit.apply(s1, testCase.args);

        finish(function(data){
          expect(data[0].tag).to.be.equal(testCase.expect.tag);
          expect(data[0].data).to.be.deep.equal(testCase.expect.data);
          if (testCase.expect.time) {
            expect(data[0].time).to.be.deep.equal(testCase.expect.time);
          }

          testCase.args.forEach(function(arg) {
            if (typeof arg === "function") {
              expect(arg.called, "callback must be called").to.be.true;
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
      args: [{ bar: 1 }, function cb(){ cb.called = true; }]
    },

    {
      name: 'record, time and callback',
      args: [{ bar: 1 }, 12345, function cb(){ cb.called = true; }]
    },

    {
      name: 'record and date object',
      args: [{ bar: 1 }, new Date(1384434467952)]
    }
  ].forEach(function(testCase) {
    it('should not send records with '+testCase.name+' arguments without a default tag', function(done){
      runServer({}, function(server, finish){
        var s1 = new sender.FluentSender(null, { port: server.port });
        s1.on('error', function(error) {
          expect(error.name).to.be.equal('MissingTagError');
        });
        s1.emit.apply(s1, testCase.args);

        finish(function(data){
          expect(data.length).to.be.equal(0);
          testCase.args.forEach(function(arg) {
            if (typeof arg === "function") {
              expect(arg.called, "callback must be called").to.be.true;
            }
          });

          done();
        });

      });
    });
  });

  it('should not send records is not object', function (done) {
    runServer({}, function (server, finish) {
      var s1 = new sender.FluentSender(null, { port: server.port });
      s1.on('error', function (error) {
        expect(error.name).to.be.equal('DataTypeError');
      });
      s1.emit('label', 'string');
      finish(function(data) {
        expect(data.length).to.be.equal(0);
      });
      done();
    });
  });

  it('should set max listeners', function(done){
    var s = new sender.FluentSender('debug');
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

  // Internal behavior test.
  it('should not flush queue if existing connection is unavailable.', function(done){
    runServer({}, function(server, finish){
      var s = new sender.FluentSender('debug', {port: server.port});
      s.emit('1st record', { message: '1st data' }, function(){
        s._socket.destroy();
        s.emit('2nd record', { message: '2nd data' }, function(){
          finish(function(data){
            expect(data[0].tag).to.be.equal("debug.1st record");
            expect(data[0].data.message).to.be.equal("1st data");
            expect(data[1].tag).to.be.equal("debug.2nd record");
            expect(data[1].data.message).to.be.equal("2nd data");
            done();
          });
        });
      });
    });
  });

  it('should write stream.', function(done) {
    runServer({}, function(server, finish) {
      var s = new sender.FluentSender('debug', { port: server.port });
      var ss = s.toStream('record');
      var pt = new stream.PassThrough();
      pt.pipe(ss);
      pt.push('data1\n');
      pt.push('data2\ndata');
      pt.push('3\ndata4\n');
      pt.end();
      ss.on('finish', function() {
        s.end(null, null, function() {
          finish(function(data) {
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

});
