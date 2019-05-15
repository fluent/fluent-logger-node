'use strict';
/**
 * winston transport support
 */

const FluentSender = require('./sender');
/* eslint-disable-next-line node/no-extraneous-require */
const Transport = require('winston-transport');
const DEFAULT_TAG = 'winston';

module.exports = class FluentTransport extends Transport {
  constructor(_tag = DEFAULT_TAG, _options = {}) {
    // following check is to maintain compatibility with code that
    // uses the :tag parameter as the options object,
    // TODO: remove this check on major release
    const tagIsString = (typeof _tag === 'string');
    const tagIsObject = (typeof _tag === 'object');
    const tag = (
      (tagIsString)
        ? _tag
        : (
          tagIsObject
            ? (_tag.tag || DEFAULT_TAG)
            : null
          )
    );
    const options = (
      (tagIsObject)
      ? _tag
      : (_options || {})
    );
    super(options);
    this.name = 'fluent';
    this.sender = new FluentSender(tag, options);
    this.sender._setupErrorHandler();
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

  _final(callback) {
    if (!this.sender) return process.nextTick(callback);

    this.sender.end(null, null, () => {
      this.sender = null;
      callback();
    });
  }
};
