'use strict';

module.exports = class EventTime {
  constructor(epoch, nano) {
    this.epoch = epoch;
    this.nano = nano;
  }

  static pack(eventTime) {
    const b = Buffer.allocUnsafe(8);
    b.writeUInt32BE(eventTime.epoch, 0);
    b.writeUInt32BE(eventTime.nano, 4);
    return b;
  }

  static unpack(buffer) {
    const e = buffer.readUInt32BE(0);
    const n = buffer.readUInt32BE(4);
    return new EventTime(e, n);
  }

  static now() {
    const now = Date.now();
    return EventTime.fromTimestamp(now);
  }

  static fromDate(date) {
    const t = date.getTime();
    return EventTime.fromTimestamp(t);
  }

  static fromTimestamp(t) {
    const epoch = Math.floor(t / 1000);
    const nano = t % 1000 * 1000000;
    return new EventTime(epoch, nano);
  }
};
