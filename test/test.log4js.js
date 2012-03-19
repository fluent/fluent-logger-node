var expect = require('chai').expect;
var log4jsSupport = require('../lib/log4js');
var log4js = require('log4js');
var fluentd = require('../lib/testHelper').fluentd;

log4js.restoreConsole();
describe("log4js", function(){
  before(function(done){
    fluentd(function(err, fluentd){
      done();
    });
  });

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
      appender = log4jsSupport.appender('test-log4js');
      log4js.addAppender(appender);
      done();
    });

    after(function(done){
      appender.sender.end();
      done();
    });

    it('should', function(done){
      var logger = log4js.getLogger();
      logger.info('foobar');
      // FIXME
      setTimeout(function(){
        done();
      }, 1000);
    });
  });

});
