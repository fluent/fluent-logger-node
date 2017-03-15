'use strict';

var EventTime = function EventTime(epoch, nano) {
  this.epoch = epoch;
  this.nano = nano;
};

EventTime.pack = function eventTimePack(eventTime) {
  var b = Buffer.alloc(8);
  b.writeUInt32BE(eventTime.epoch, 0);
  b.writeUInt32BE(eventTime.nano, 4);
  return b;
};

EventTime.unpack = function eventTimeUnpack(buffer) {
  var e = buffer.readUInt32BE(0);
  var n = buffer.readUInt32BE(4);
  return new EventTime(e, n);
};

EventTime.now = function now() {
  var now = Date.now();
  return EventTime.fromTimestamp(now);
};

EventTime.fromDate = function fromDate(date) {
  var t = date.getTime();
  return EventTime.fromTimestamp(t);
};

EventTime.fromTimestamp = function fromTimestamp(t) {
  var epoch = Math.floor(t / 1000);
  var nano = (t - epoch * 1000) * 1000000;
  return new EventTime(epoch, nano);
};

module.exports = exports = {};
exports.EventTime = EventTime;
