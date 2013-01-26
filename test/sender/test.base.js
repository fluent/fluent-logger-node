var util   = require('util');
var expect = require('chai').expect;
var FluentSender = require('../../lib/sender/base').FluentSender;

var MockSender = function(tag, options){
  FluentSender.call(this, tag, options);
};
util.inherits(MockSender, FluentSender);
MockSender.prototype._connect = function(callback){
  callback();
};
MockSender.prototype._writeRecord = function(record, callback){
  callback();
};
MockSender.prototype._close = function(){
};

describe("FluentSender", function(){
  it('should send record.', function(done){
    var sender = new MockSender('debug');
    sender.emit('label', 1, function(err){
      expect(err).to.be.equal(undefined);
      done();
    });
  });

  it('should retry to send record.', function(done){
    var retries = 0;
    var sender = new MockSender('debug', {
      retryAfter: 1,
      maxRetries: 3
    });
    sender._writeRecord = function(record, callback){
      retries += 1;
      if( retries == 3 ){
        callback();
      }else{
        callback(new Error("Error"));
      }
    };
    sender.emit('label', 1, function(err){
      expect(err).to.be.equal(undefined);
      expect(retries).to.be.equal(3);
      done();
    });
  });

  it('should raise error when retrying more than maxRetries', function(done){
    var retries = 0;
    var sender = new MockSender('debug', {
      retryAfter: 1,
      maxRetries: 3
    });
    sender._writeRecord = function(record, callback){
      retries += 1;
      callback(new Error("Error"));
    };
    sender.emit('label', 1);
    sender.on('error', function(err){
      expect(err).not.to.be.equal(undefined);
      expect(retries).to.be.equal(4);
      done();
    });
  });
});