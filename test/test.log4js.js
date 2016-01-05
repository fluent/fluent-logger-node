var expect = require('chai').expect;
var log4jsSupport = require('../lib/log4js');
var log4js = require('log4js');
var runServer = require('../lib/testHelper').runServer;
var EventEmitter = require('events').EventEmitter;

log4js.restoreConsole();
describe("log4js", function(){
  describe('name', function(){
    it('should be "fluent"', function(done){
      expect(log4jsSupport.name).to.be.equal('fluent');
      done();
    });
  });

  describe('appender', function(){
    var appender = null;
    before(function(done){
      log4js.clearAppenders();
      done();
    });

    it('should send log records', function(done){
      runServer(function(server, finish){
        var appender = log4jsSupport.appender('debug', {port: server.port});
        log4js.addAppender(appender);
        var logger = log4js.getLogger('mycategory');
        logger.info('foo %s', 'bar');
        setTimeout(function(){
          finish(function(data){
            expect(data[0].tag).to.be.equal('debug.INFO');
            expect(data[0].data).exist;
            expect(data[0].data.data).to.be.equal('foo bar');
            expect(data[0].data.category).to.be.equal('mycategory');
            expect(data[0].data.timestamp).exist;
            expect(data[0].data.levelInt).exist;
            expect(data[0].data.levelStr).to.be.equal('INFO');
            done();
          });
        }, 1000);
      });
    });

    it('should not add levelTag', function(done){
      runServer(function(server, finish){
        var appender = log4jsSupport.appender('debug', {port: server.port, levelTag:false});
        log4js.addAppender(appender);
        var logger = log4js.getLogger('mycategory');
        logger.info('foo %s', 'bar');
        setTimeout(function(){
          finish(function(data){
            expect(data[0].tag).to.be.equal('debug');
            expect(data[0].data).exist;
            expect(data[0].data.data).to.be.equal('foo bar');
            expect(data[0].data.category).to.be.equal('mycategory');
            expect(data[0].data.timestamp).exist;
            expect(data[0].data.levelInt).exist;
            expect(data[0].data.levelStr).to.be.equal('INFO');
            done();
          });
        }, 1000);
      });
    });

    it('should not crash when fluentd is not running', function(done){
      runServer(function(server, finish){
        var appender = log4jsSupport.appender('debug', {port: server.port});
        log4js.addAppender(appender);
        var logger = log4js.getLogger('mycategory');
        logger.info('foo %s', 'bar');
        setTimeout(function(){
          finish(function(data){
            expect(data[0].tag).to.be.equal('debug.INFO');
            logger.info('foo %s', 'bar');
            done();
          });
        }, 1000);
      });
    });

    it('should listen error event when fluentd is down', function(done){
      runServer(function(server, finish){
        var appender = log4jsSupport.appender('debug', {port: server.port});
        appender.on('error', function(err) {
          expect(err.code).to.be.equal('ECONNREFUSED');
          done();
        });
        log4js.addAppender(appender);
        var logger = log4js.getLogger('mycategory');
        logger.info('foo %s', 'bar');
        setTimeout(function(){
          finish(function(data){
            expect(data[0].tag).to.be.equal('debug.INFO');
            logger.info('foo %s', 'bar');
          });
        }, 1000);
      });
    });

    it('should set max listeners', function(done) {
      var appender = log4jsSupport.appender('debug');
      if (EventEmitter.prototype.getMaxListeners) {
        expect(appender.getMaxListeners()).to.be.equal(10);
      }
      appender.setMaxListeners(100);
      if (EventEmitter.prototype.getMaxListeners) {
        expect(appender.getMaxListeners()).to.be.equal(100);
      } else {
        expect(appender._eventEmitter._maxListeners).to.be.equal(100);
      }
      done();
    });

    it('should set error handler', function(done) {
      var appender = log4jsSupport.appender('debug');
      expect(appender._eventEmitter.listeners('error').length).to.be.equal(0);
      appender._setupErrorHandler();
      expect(appender._eventEmitter.listeners('error').length).to.be.equal(1);
      done();
    });
  });
});
