# fluent-logger for node.js

fluent-logger implementation for node.js inspired by [fluent-logger-python].

## Install

    $ npm install fluent-logger
    
## Prerequistes

Fluent daemon should listen on TCP port.

## Usage

### Send an event record to fluentd

    var logger = require('fluent-logger')
    // The 2nd argument can be omitted. Here is a defualt value for options.
    logger.configure('tag', {
       host: 'localhost',  
       port: 24224
       timeout: 3.0
    });
   
    // send an event record with 'tag.label'
    logger.emit('label', {record: 'this is a log'});

## License

Apache License, Version 2.0

[fluent-logger-python]: https://github.com/fluent/fluent-logger-python

