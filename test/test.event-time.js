'use strict';
/* globals describe, it */
/* eslint node/no-unpublished-require: ["error", {"allowModules": ["chai"]}] */
const expect = require('chai').expect;
const EventTime = require('../lib/event-time');
const msgpack = require('msgpack-lite');

const codec = msgpack.createCodec();
codec.addExtPacker(0x00, EventTime, EventTime.pack);
codec.addExtUnpacker(0x00, EventTime.unpack);

describe('EventTime', () => {
  it('should equal to decoded value', (done) => {
    const eventTime = EventTime.now();
    const encoded = msgpack.encode(eventTime, { codec: codec });
    const decoded = msgpack.decode(encoded, { codec: codec });
    expect(JSON.stringify(decoded)).to.equal(JSON.stringify(eventTime));
    done();
  });
  it('should equal fromDate and fromTimestamp', (done) => {
    const now = new Date(1489543720999); // 2017-03-15T02:08:40.999Z
    const timestamp = now.getTime();
    const eventTime = JSON.stringify(new EventTime(1489543720, 999000000));
    const eventTime1 = JSON.stringify(EventTime.fromDate(now));
    const eventTime2 = JSON.stringify(EventTime.fromTimestamp(timestamp));
    expect(eventTime1).to.equal(eventTime);
    expect(eventTime2).to.equal(eventTime);
    done();
  });
});
