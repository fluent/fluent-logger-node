# fluent-logger for Node.js

fluent-logger implementation for Node.js inspired by [fluent-logger-python].

[![NPM](https://nodei.co/npm/fluent-logger.png?downloads=true&downloadRank=true)](https://nodei.co/npm/fluent-logger/)

[![Build Status](https://secure.travis-ci.org/fluent/fluent-logger-node.png?branch=master,develop)](http://travis-ci.org/fluent/fluent-logger-node)

## Install

    $ npm install fluent-logger

## Prerequistes

Fluent daemon should listen on TCP port.

Simple configuration is following:

```aconf
<source>
  @type forward
  port 24224
</source>

<match **.*>
  @type stdout
</match>
```

## Usage

### Send an event record to Fluentd

Singleton style

```js
var logger = require('fluent-logger')
// The 2nd argument can be omitted. Here is a default value for options.
logger.configure('tag_prefix', {
   host: 'localhost',
   port: 24224,
   timeout: 3.0,
   reconnectInterval: 600000 // 10 minutes
});

// send an event record with 'tag.label'
logger.emit('label', {record: 'this is a log'});
```

Instance style

```js
var logger = require('fluent-logger').createFluentSender('tag_prefix', {
   host: 'localhost',
   port: 24224,
   timeout: 3.0,
   reconnectInterval: 600000 // 10 minutes
});
```

The emit method has following signature

```js
.emit([label string], <record object>, [timestamp number/date], [callback function])
```

Where only the `record` argument is required. If the label is set it will be
appended to the configured tag.

### Disable automatic reconnect 
Both Singleton and Instance style can disable automatic reconnect allowing the user to handle reconnect himself
```js
logger.configure('tag_prefix', {
   host: 'localhost',
   port: 24224,
   timeout: 3.0,
   enableReconnect: false // defaults to true
});
```

### Shared key authentication

Logger configuration:

```js
var logger = require('fluent-logger').createFluentSender('dummy', {
  host: 'localhost',
  port: 24224,
  timeout: 3.0,
  reconnectInterval: 600000, // 10 minutes
  security: {
    clientHostname: "client.localdomain",
    sharedKey: "secure_communication_is_awesome"
  }
});
logger.emit('debug', { message: 'This is a message' });
```

Server configuration:

```aconf
<source>
  @type forward
  port 24224
  <security>
    self_hostname input.testing.local
    shared_key secure_communication_is_awesome
  </security>
</source>

<match dummy.*>
  @type stdout
</match>
```

See also [Fluentd](https://github.com/fluent/fluentd) examples.

### TLS/SSL encryption

Logger configuration:

```js
var logger = require('fluent-logger').createFluentSender('dummy', {
  host: 'localhost',
  port: 24224,
  timeout: 3.0,
  reconnectInterval: 600000, // 10 minutes
  security: {
    clientHostname: "client.localdomain",
    sharedKey: "secure_communication_is_awesome"
  },
  tls: true,
  tlsOptions: {
    ca: fs.readFileSync('/path/to/ca_cert.pem')
  }
});
logger.emit('debug', { message: 'This is a message' });
```

Server configuration:

```aconf
<source>
  @type forward
  port 24224
  <transport tls>
    ca_cert_path /path/to/ca_cert.pem
    ca_private_key_path /path/to/ca_key.pem
    ca_private_key_passphrase very_secret_passphrase
  </transport>
  <security>
    self_hostname input.testing.local
    shared_key secure_communication_is_awesome
  </security>
</source>

<match dummy.*>
  @type stdout
</match>
```

FYI: You can generate certificates using fluent-ca-generate command since Fluentd 1.1.0.

See also [How to enable TLS/SSL encryption](https://docs.fluentd.org/input/forward#how-to-enable-tls-encryption).

### Mutual TLS Authentication

Logger configuration:

```js
var logger = require('fluent-logger').createFluentSender('dummy', {
  host: 'localhost',
  port: 24224,
  timeout: 3.0,
  reconnectInterval: 600000, // 10 minutes
  security: {
    clientHostname: "client.localdomain",
    sharedKey: "secure_communication_is_awesome"
  },
  tls: true,
  tlsOptions: {
    ca: fs.readFileSync('/path/to/ca_cert.pem'),
    cert: fs.readFileSync('/path/to/client-cert.pem'),
    key: fs.readFileSync('/path/to/client-key.pem'),
    passphrase: 'very-secret'
  }
});
logger.emit('debug', { message: 'This is a message' });
```

Server configuration:

```aconf
<source>
  @type forward
  port 24224
  <transport tls>
    ca_path /path/to/ca-cert.pem
    cert_path /path/to/server-cert.pem
    private_key_path /path/to/server-key.pem
    private_key_passphrase very_secret_passphrase
    client_cert_auth true
  </transport>
  <security>
    self_hostname input.testing.local
    shared_key secure_communication_is_awesome
  </security>
</source>

<match dummy.*>
  @type stdout
</match>
```

### EventTime support

We can also specify [EventTime](https://github.com/fluent/fluentd/wiki/Forward-Protocol-Specification-v1#eventtime-ext-format) as timestamp.

```js
var FluentLogger = require('fluent-logger');
var EventTime = FluentLogger.EventTime;
var logger = FluentLogger.createFluentSender('tag_prefix', {
var eventTime = new EventTime(1489547207, 745003500); // 2017-03-15 12:06:47 +0900
logger.emit('tag', { message: 'This is a message' }, eventTime);
```

### Events

* `connect` : Handle [net.Socket Event: connect](https://nodejs.org/api/net.html#net_event_connect)
* `error` : Handle [net.Socket Event: error](https://nodejs.org/api/net.html#net_event_error_1)

```js
var logger = require('fluent-logger').createFluentSender('tag_prefix', {
   host: 'localhost',
   port: 24224,
   timeout: 3.0,
   reconnectInterval: 600000 // 10 minutes
});
logger.on('error', (error) => {
  console.log(error);
});
logger.on('connect', () => {
  console.log('connected!');
});
```

## Logging Library Support

### log4js

Use [log4js-fluent-appender](https://www.npmjs.com/package/log4js-fluent-appender).

### winston

Before using [winston](https://github.com/winstonjs/winston) support, you should install it IN YOUR APPLICATION.

```js
var winston = require('winston');
var config = {
  host: 'localhost',
  port: 24224,
  timeout: 3.0,
  requireAckResponse: true // Add this option to wait response from Fluentd certainly
};
var fluentTransport = require('fluent-logger').support.winstonTransport();
var fluent = new fluentTransport('mytag', config);
var logger = winston.createLogger({
  transports: [fluent, new (winston.transports.Console)()]
});

logger.on('flush', () => {
  console.log("flush");
})

logger.on('finish', () => {
  console.log("finish");
  fluent.sender.end("end", {}, () => {})
});

logger.log('info', 'this log record is sent to fluent daemon');
logger.info('this log record is sent to fluent daemon');
logger.info('end of log message');
logger.end();
```

**NOTE** If you use `winston@2`, you can use `fluent-logger@2.7.0` or earlier. If you use `winston@3`, you can use `fluent-logger@2.8` or later.

### stream

Several libraries use stream as output.

```js
'use strict';
const Console = require('console').Console;
var sender = require('fluent-logger').createFluentSender('tag_prefix', {
   host: 'localhost',
   port: 24224,
   timeout: 3.0,
   reconnectInterval: 600000 // 10 minutes
});
var logger = new Console(sender.toStream('stdout'), sender.toStream('stderr'));
logger.log('this log record is sent to fluent daemon');
setTimeout(()=> sender.end(), 5000);
```


## Options

**tag_prefix**

The tag prefix string.
You can specify `null` when you use `FluentSender` directly.
In this case, you must specify `label` when you call `emit`.

**host**

The hostname. Default value = 'localhost'.

See [socket.connect][1]

**port**

The port to listen to. Default value = 24224.

See [socket.connect][1]

**path**

The path to your Unix Domain Socket.
If you set `path` then fluent-logger ignores `host` and `port`.

See [socket.connect][1]

**timeout**

Set the socket to timetout after `timeout` milliseconds of inactivity
on the socket.

See [socket.setTimeout][2]

**reconnectInterval**

Set the reconnect interval in milliseconds.
If error occurs then reconnect after this interval.

[1]: https://nodejs.org/api/net.html#net_socket_connect_path_connectlistener
[2]: https://nodejs.org/api/net.html#net_socket_settimeout_timeout_callback

**requireAckResponse**

Change the protocol to at-least-once. The logger waits the ack from destination.

**ackResponseTimeout**

This option is used when requireAckResponse is true. The default is 190. This default value is based on popular `tcp_syn_retries`.

**eventMode**

Set [Event Modes](https://github.com/fluent/fluentd/wiki/Forward-Protocol-Specification-v1#event-modes). This logger supports `Message`, `PackedForward` and `CompressedPackedForward`.
Default is `Message`.

NOTE: We will change default to `PackedForward` and drop `Message` in next major release.

**flushInterval**

Set flush interval in milliseconds. This option has no effect in `Message` mode.
The logger stores emitted events in buffer and flush events for each interval.
Default `100`.

**messageQueueSizeLimit**

Maximum number of messages that can be in queue at the same time. If a new message is received and it overflows the queue then the oldest message will be removed before adding the new item. This option has effect only in `Message` mode. No limit by default.

**security.clientHostname**

Set hostname of this logger. Use this value for hostname based authentication.

**security.sharedKey**

Shared key between client and server.

**security.username**

Set username for user based authentication. Default values is empty string.

**security.password**

Set password for user based authentication. Default values is empty string.

**sendQueueSizeLimit**

Queue size limit in bytes. This option has no effect in `Message` mode. Default is `8 MiB`.

**tls**

Enable TLS for socket.

**tlsOptions**

Options to pass to tls.connect when tls is true.

For more details, see following documents
* [tls.connect()](https://nodejs.org/api/tls.html#tls_tls_connect_options_callback)
* [tls.createSecureContext()](https://nodejs.org/api/tls.html#tls_tls_createsecurecontext_options)

**internalLogger**

Set internal logger object for FluentLogger. Use `console` by default.
This logger requires `info` and `error` method.

## Examples
### Winston Integration
An example of integrating with Winston can be found at [`./example/winston`](./example/winston).

You will need Docker Compose to run it. After navigating to `./example/winston`, run `docker-compose up` and then `node index.js`. You should see the Docker logs having an `"it works"` message being output to FluentD.

## License

Apache License, Version 2.0.

[fluent-logger-python]: https://github.com/fluent/fluent-logger-python


## About NodeJS versions

This package is compatible with NodeJS versions >= 6.
