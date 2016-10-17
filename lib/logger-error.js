'use strict';

var util = require('util');

module.exports = {};

var BaseError = function BaseError(message, options) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.options = options;
};
util.inherits(BaseError, Error);

var MissingTagError = function MissingTagError(message, options) {
  MissingTagError.super_.call(this, message, options);
};
util.inherits(MissingTagError, BaseError);

var ResponseError = function ResponseError(message, options) {
  MissingTagError.super_.call(this, message, options);
};
util.inherits(ResponseError, BaseError);

var ResponseTimeoutError = function ResponseTimeoutError(message, options) {
  ResponseTimeoutError.super_.call(this, message, options);
};
util.inherits(ResponseTimeoutError, BaseError);

var DataTypeError = function DataTypeError(message, options) {
  DataTypeError.super_.call(this, message, options);
};
util.inherits(DataTypeError, BaseError);

module.exports = {
  MissingTag: MissingTagError,
  ResponseError: ResponseError,
  DataTypeError: DataTypeError,
  ResponseTimeout: ResponseTimeoutError
};
