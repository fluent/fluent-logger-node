'use strict';
/* globals describe, it */
/* eslint node/no-unpublished-require: ["error", {"allowModules": ["async", "chai", "winston"]}] */
const expect = require('chai').expect;
const winstonSupport = require('../lib/winston');
const winston = require('winston');
const runServer = require('../lib/testHelper').runServer;

describe('winston', () => {
  describe('name', () => {
    it('should be "fluent"', (done) => {
      expect((new winstonSupport()).name).to.be.equal('fluent');
      done();
    });
  });

  describe('transport', () => {
    it('should send log records', (done) => {
      runServer({}, {}, (server, finish) => {
        const logger = winston.createLogger({
          format: winston.format.combine(
            winston.format.splat(),
            winston.format.simple()
          ),
          transports: [
            new winstonSupport({tag: 'debug', port: server.port})
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
            expect(data[0].data.x).to.be.equal(1);
            done();
          });
        }, 1000);
      });
    });
  });
});
