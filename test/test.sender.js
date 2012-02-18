var expect = require('chai').expect;
var sender = require('../lib/sender');
var fluentd = require('../lib/testHelper').fluentd;

describe("sender", function(){
  describe("FluentSernder", function(){
    before(function(done){
      fluentd(function(err, fluentd){
        done();
      });
    });

    it('should send an object and close connection.', function(done){
      var s = new sender.FluentSender('debug');
      var record = {
        string: 'a',
        number: 1,
        object: {
          a: 'b'
        },
        array: [1,2,3],
        bool: true,
        null: null,
        undefined: undefined
      };
      s.end('test send object', record, function(){
        // FIXME make sure the connection is closed.
        done();
      });
    }); // should send an object;

    it('should use a queue and flush it after it ends.', function(done){
      var s = new sender.FluentSender('debug');
      var called = 0;
      s.emit('1st record', '1st record', function(){
        called++;
        expect(called).to.be.equal(1); // confirm callbacks are called.
      });
      s.emit('2nd record', '2nd record', function(){
        called++;
        expect(called).to.be.equal(2); // confirm callbacks are called.
      });
      s.end('last record', 'last record', function(){
        called++;
        expect(called).to.be.equal(3); // confirm callbacks are called.
        expect(s._sendQueue.length).to.be.equal(0);
        done();
      });
      expect(s._sendQueue.length).to.be.equal(3);
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
      s.emit('test connection error', 'foobar');
    });

    it('should resume the connection automatically and flush the queue', function(done){
      var s = new sender.FluentSender('queuing', {
        host: 'localhost',
        port: 65535
      });
      s.on('error', function(err){
        expect(err.code).to.be.equal('ECONNREFUSED');
        expect(s._sendQueue.length, 1); // buffered queue
        // set the correct port.
        s.port = 24224;
        s.end('test queueing', 'done', function(){
          expect(s._sendQueue.length).to.be.equal(0);
          done();
        });
        expect(s._sendQueue.length).to.be.equal(2);
      });
      s.emit('test queueing', 'pended');
      expect(s._sendQueue.length).to.be.equal(1);
    });
  });
});
