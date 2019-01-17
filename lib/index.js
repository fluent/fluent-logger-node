'use strict';

const FluentSender = require('./sender');
const EventTime = require('./event-time');
let sender = new FluentSender('debug');

module.exports = {
  configure: function(tag, options) {
    sender.end();
    sender = new FluentSender(tag, options);
    sender._setupErrorHandler();
  },

  createFluentSender: function(tag, options) {
    const _sender = new FluentSender(tag, options);
    _sender._setupErrorHandler();
    return _sender;
  },

  support: {
    winstonTransport: function() {
      const transport = require('../lib/winston');
      return transport;
    }
  },

  EventTime: EventTime
};

// delegate logger interfaces to default sender object
const methods = ['emit', 'end', 'addListener', 'on', 'once', 'removeListener', 'removeAllListeners', 'setMaxListeners', 'getMaxListeners'];
methods.forEach((attr, i) => {
  module.exports[attr] = function() {
    if (sender) {
      return sender[attr].apply(sender, arguments);
    }
    return undefined;
  };
});
