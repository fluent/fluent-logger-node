'use strict';
var expect = require('chai').expect;
var EventTime = require('../lib/event-time').EventTime;
var msgpack = require('msgpack-lite');

var codec = msgpack.createCodec();
codec.addExtPacker(0x00, EventTime, EventTime.pack);
codec.addExtUnpacker(0x00, EventTime.unpack);

describe('EventTime', function() {
  it('should equal to decoded value', function(done) {
    var eventTime = EventTime.now();
    var encoded = msgpack.encode(eventTime, { codec: codec });
    var decoded = msgpack.decode(encoded, { codec: codec });
    expect(JSON.stringify(decoded)).to.equal(JSON.stringify(eventTime));
    done();
  });
  it('should equal fromDate and fromTimestamp', function(done) {
    var now = new Date(1489543720999); // 2017-03-15T02:08:40.999Z
    var timestamp = now.getTime();
    var eventTime = JSON.stringify(new EventTime(1489543720, 999000000));
    var eventTime1 = JSON.stringify(EventTime.fromDate(now));
    var eventTime2 = JSON.stringify(EventTime.fromTimestamp(timestamp));
    expect(eventTime1).to.equal(eventTime);
    expect(eventTime2).to.equal(eventTime);
    done();
  });
});
