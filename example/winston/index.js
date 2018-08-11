const winston = require('winston');
const fluentNodeLogger = require('../../lib');

const logger = winston.createLogger({
  transports: [
    new (fluentNodeLogger.support.winstonTransport())(
      '___specialcustomtesttag',
      {
        host: 'localhost',
        port: 24224,
        timeout: 3.0,
        requireAckResponse: true,
      }
    ),
  ],
});

(function repeatLog() {
  setTimeout(() => {
    logger.info('it works');
    repeatLog();
  }, 1000)
})();
