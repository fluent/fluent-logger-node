'use strict';

module.exports = class EventTime {
  constructor(epoch, nano) {
    this.epoch = epoch;
    this.nano = nano;
  }

  static pack(eventTime) {
    var b = Buffer.alloc(8);
    b.writeUInt32BE(eventTime.epoch, 0);
    b.writeUInt32BE(eventTime.nano, 4);
    return b;
  }

  static unpack(buffer) {
    var e = buffer.readUInt32BE(0);
    var n = buffer.readUInt32BE(4);
    return new EventTime(e, n);
  }

  static now() {
    var now = Date.now();
    return EventTime.fromTimestamp(now);
  }

  static fromDate(date) {
    var t = date.getTime();
    return EventTime.fromTimestamp(t);
  }

  static fromTimestamp(t) {
    var epoch = Math.floor(t / 1000);
    var nano = (t - epoch * 1000) * 1000000;
    return new EventTime(epoch, nano);
  }
};
