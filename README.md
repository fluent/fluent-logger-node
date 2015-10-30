# fluent-logger for Node.js

fluent-logger implementation for Node.js inspired by [fluent-logger-python].

[![Build Status](https://secure.travis-ci.org/fluent/fluent-logger-node.png?branch=master,develop)](http://travis-ci.org/fluent/fluent-logger-node)

## Install

    $ npm install fluent-logger

## Prerequistes

Fluent daemon should listen on TCP port.

## Usage

### Send an event record to Fluentd

Singleton style

    var logger = require('fluent-logger')
    // The 2nd argument can be omitted. Here is a defualt value for options.
    logger.configure('tag', {
       host: 'localhost',
       port: 24224,
       timeout: 3.0
    });

    // send an event record with 'tag.label'
    logger.emit('label', {record: 'this is a log'});

Instance style

    var logger = require('fluent-logger').createFluentSender('tag', {
       host: 'localhost',
       port: 24224,
       timeout: 3.0
    });


The emit method has following signature

   .emit([label string], <record object>, [timestamp number/date], [callback function])

Where only the `record` argument is required. If the label is set it will be
appended to the configured tag.

## Logging Library Support

### log4js

Before using [log4js] support, you should install it IN YOUR APPLICATION.


    var log4js = require('log4js');
    log4js.addAppender(require('fluent-logger').support.log4jsAppender('mytag', {
       host: 'localhost',
       port: 24224,
       timeout: 3.0
    }));

    var logger = log4js.getLogger('foo');
    logger.info('this log record is sent to fluent daemon');

## License

Apache License, Version 2.0.

[fluent-logger-python]: https://github.com/fluent/fluent-logger-python


## Abour NodeJS versions

This package is compatible with NodeJS versions > 0.10.
