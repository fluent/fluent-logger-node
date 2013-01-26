var expect = require('chai').expect;
var sender = require('../../lib/sender/http');
var runServer = require('../../lib/testHelper').runServer;
var async = require('async');

describe("HttpSender", function(){
  it('should send records', function(done){
    runServer('http', function(server, finish){
      var s1 = new sender.HttpSender('debug', { port: server.port });
      var emits = [];
      function emit(k){
        emits.push(function(done){
          s1.emit('record', k, done);
        });
      }
      for(var i=0; i<10; i++){
        emit(i);
      }
      emits.push(function(){
        finish(function(data){
          expect(data.length).to.be.equal(10);
          for(var i=0; i<10; i++){
            expect(data[i].tag).to.be.equal("debug.record");
            expect(data[i].data).to.be.equal(i);
          }
          done();
        });
      });
      async.series(emits);
    });
  });

  it('should raise error when connection fails', function(done){
    var s = new sender.HttpSender('debug', {
      host: 'localhost',
      port: 65535,
      maxRetries: 1
    });
    s.emit('test connection error', 'foobar');
    s.on('error', function(err){
      expect(err.code).to.be.equal('ECONNREFUSED');
      done();
    });
  });

  it('should resume the connection automatically and flush the queue', function(done){
    var s = new sender.HttpSender('debug');
    s.emit('1st record', '1st data', function(err){
      console.log(err);
    });
    setTimeout(function(){
      runServer('http', function(server, finish){
        s.port = server.port;
        s.emit('2nd record', '2nd data');
        s.end('last record', 'last data', function(){
          finish(function(data){
            done();
          });
        });
      });
    }, 500);
  });
});
