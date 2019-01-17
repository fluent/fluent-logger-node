'use strict';

const FluentSender = require('./sender');
const EventTime = require('./event-time');
let sender = new FluentSender('debug');

module.exports = {
  configure: function(tag, options) {
    sender.end();
    sender = new FluentSender(tag, options);
    sender._setupErrorHandler();
    // Optimization -- see note at end
    module.exports.emit = sender.emit.bind(sender);
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
const methods = ['end', 'addListener', 'on', 'once', 'removeListener', 'removeAllListeners', 'setMaxListeners', 'getMaxListeners'];
methods.forEach((attr, i) => {
  module.exports[attr] = function() {
    if (sender) {
      return sender[attr].apply(sender, arguments);
    }
    return undefined;
  };
});

// Export emit() directly so that calls to it can be inlined properly.
module.exports.emit = sender.emit.bind(sender);
