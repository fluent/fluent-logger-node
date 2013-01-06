var expect = require('chai').expect;
var log4jsSupport = require('../lib/log4js');
var log4js = require('log4js');
var runServer = require('../lib/testHelper').runServer;

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
  });
});
