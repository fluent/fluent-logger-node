'use strict';
/**
 * winston transport support
 */

/* eslint node/no-unpublished-require: ["error", {"allowModules": ["winston"]}] */
const sender = require('./sender');
const Transport = require('winston-transport');
const DEFAULT_TAG = 'winston';

module.exports = class FluentTransport extends Transport {
  constructor(options = {}) {
    super(options);
    this.name = 'fluent';
    let tag;

    if (options.tag) {
      tag = options.tag;
    } else {
      tag = DEFAULT_TAG;
    }

    this.sender = new sender.FluentSender(tag, options);
  }

  log(info, callback) {
    setImmediate(() => {
      this.sender.emit(info, (error) => {
        if (error) {
          this.emit('error', info);
          callback && callback(error, false);
        } else {
          this.emit('logged', info);
          callback && callback(null, true);
        }
      });
    });
  }
}
