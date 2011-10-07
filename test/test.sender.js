var assert = require('assert');
var sender = require('../lib/sender');

module.exports = {
  "test send object": function(){
    var s = new sender.FluentSender('debug');
    s.end('test send object', {
      string: 'a',
      number: 1,
      object: {
        a: 'b'
      },
      array: [1,2,3],
      bool: true,
      null: null,
      undefined: undefined
    }, function(err){
      assert.isNull(err);
    });
  },

  "test once": function(){
    var s = new sender.FluentSender('debug');
    s.end('test once', 'test once', function(){
      assert.eql(s._queueTail.length, 0);
    });
    assert.eql(s._queue.length, 1);
  },

  "test many": function(){
    var s = new sender.FluentSender('debug');
    s.emit('test many', 'test many1', function(){
      s.emit('test many', 'test many2', function(){
        s.end();
      });
    });
  },

  "test many async": function(){
    var s = new sender.FluentSender('debug');
    var order = -1;
    s.emit('test many async', 'test many' + (++order), function(){
      assert.eql(order, 2);
      order--;
    });

    s.emit('test many async', 'test many' + (++order), function(){
      assert.eql(order, 1);
      order--;
    });;

    s.emit('test many async', 'test many' + (++order), function(){
      assert.eql(order, 0);
      order--;
      s.end();
    });;
    assert.eql(s._queue.length, 3);
  },


  "test connection error": function(){
    var s = new sender.FluentSender('debug', {
      host: 'localhost',
      port: 65535
    });
    s.on('error', function(err){
      assert.eql(err.code, 'ECONNREFUSED');
      assert.eql(s._queue.length, 1);
    });
    s.emit('test connection error', 'foobar');
    assert.eql(s._queue.length, 1);
  },

  "test queueing": function(){
    var s = new sender.FluentSender('queuing', {
      host: 'localhost',
      port: 65535
    });
    s.on('error', function(err){
      assert.eql(err.code, 'ECONNREFUSED');
      assert.eql(s._queue.length, 1);
      s.port = 24224;
      s.end('test queueing', 'done', function(){
        assert.eql(s._queue.length, 0);
      });
      assert.eql(s._queue.length, 2);
    });
    s.emit('test queueing', 'pended');
  }

};