'use strict';

module.exports = {};

class BaseError extends Error {
  constructor(message, options) {
    super();
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = message;
    this.options = options;
  }
}

class ConfigError extends BaseError {
  constructor(message, options) {
    super(message, options);
  }
}

class MissingTagError extends BaseError {
  constructor(message, options) {
    super(message, options);
  }
}

class ResponseError extends BaseError {
  constructor(message, options) {
    super(message, options);
  }
}

class ResponseTimeoutError extends BaseError {
  constructor(message, options) {
    super(message, options);
  }
}

class DataTypeError extends BaseError {
  constructor(message, options) {
    super(message, options);
  }
}

class HandshakeError extends BaseError {
  constructor(message, options) {
    super(message, options);
  }
}

module.exports = {
  ConfigError: ConfigError,
  MissingTag: MissingTagError,
  ResponseError: ResponseError,
  DataTypeError: DataTypeError,
  ResponseTimeout: ResponseTimeoutError,
  HandshakeError: HandshakeError
};
