'use strict';
/* globals describe, it */
/* eslint node/no-unpublished-require: ["error", {"allowModules": ["async", "chai", "winston"]}] */
var expect = require('chai').expect;
var winstonSupport = require('../lib/winston');
var winston = require('winston');
var runServer = require('../lib/testHelper').runServer;

describe('winston', () => {
  describe('name', () => {
    it('should be "fluent"', (done) => {
      expect((new (winstonSupport.Transport)()).name).to.be.equal('fluent');
      done();
    });
  });

  describe('transport', () => {

    it('should send log records', (done) => {
      runServer({}, {}, (server, finish) => {
        var logger = new (winston.Logger)({
          transports: [
            new (winstonSupport.Transport)('debug', {port: server.port})
          ]
        });


        logger.info('foo %s', 'bar', {x: 1});
        setTimeout(() => {
          finish((data) => {
            expect(data[0].tag).to.be.equal('debug');
            expect(data[0].data).exist;
            expect(data[0].time).exist;
            expect(data[0].data.message).to.be.equal('foo bar');
            expect(data[0].data.level).to.be.equal('info');
            expect(data[0].data.meta.x).to.be.equal(1);
            done();
          });
        }, 1000);
      });
    });
  });
});
