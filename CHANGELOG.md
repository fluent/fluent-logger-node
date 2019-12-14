# v3.x

## v3.4.1 - 2019-12-14

### Fixes

* Fix type definition for winston support #163

## v3.4.0 - 2019-11-20

### Improvements

* Gracefully free resources on `.end()` #144
* Update type definitions for TypeScript #145, #147
* Add new option messageQueueSizeLimit #152

### Fixes

* Fix packets on multiple tags get corrput and multiple calls of callbacks on error #155

## v3.3.1 - 2019-02-19

### Fixes

* Set up default error handler for winston #136
* Flush sendQueue after reconnect #136

## v3.3.0 - 2019-01-31

### Improvements

* Improve performance #131

## v3.2.3 - 2019-01-10

### Improvements

* Update type definition according to documentation for security #127

### Fixes

* Fix user based authentication #128 #129

## v3.2.2 - 2018-12-13

### Improvements

* Improve TypeScript definitions #118 #125

## v3.2.1 - 2018-10-19

### Fixes

* Update TypeScript declaration file #114

## v3.2.0 - 2018-09-10

### Improvements

* Allow using a flag to disable automatic reconnect #111

## v3.1.0 - 2018-09-10

### Improvements

* Add sendQueueSizeLimit option #102
* Add TypeScrip declaration file #110

### Fixes

* Fix winston support #108

## v3.0.0 - 2018-07-24

### Improvements

* Drop Node.js 4 support
* Support winston 3

# v2.x

## v2.8.1 - 2018-09-10

### Fixes

* Fix supported winston version

## v2.8.0 - 2018-07-19

### Fixes

* Reset send queue size #99

## v2.7.0 - 2018-05-11

### Improvements

* Support TLS #92

## v2.6.2 - 2018-02-27

### Improvements

* Introduce ESLint #88

### Fixes

* Avoid writing to closed socket #90

## v2.6.1 - 2017-11-16

### Improvements

* Support log level configuration #85

## v2.6.0 - 2017-10-23

### Improvements

* Replace built-in log4js appender to log4js-fluent-appender #82

## v2.5.0 - 2017-10-11

### Improvements

* Support Fluentd v1 protocol handshake #80

## v2.4.4 - 2017-10-10

### Fixes

* Invoke callback function asynchronously in winston transport #81

## v2.4.3 - 2017-09-28

### Fixes

* Fix bugs in v2.4.2 #77

## v2.4.2 - 2017-09-26

This release has bugs.

### Improvements

* Use arrow functions #76

## v2.4.1 - 2017-07-26

### Fixes

* Clear setTimeout when ack is received #68, #69
* Mark log4js 2.0 and later as unsupported #71
* Flush queue step by step #72

## v2.4.0 - 2017-05-30

### Improvements

* Add internal logger #63

### Fixes

* Update supported engines #64

## v2.3.0 - 2017-03-16

### Improvements

* Support EventTime #61
* Support connect event #62

## v2.2.0 - 2016-10-18

### Fixes

* Wrap dataString to record object #54

## v2.1.0 - 2016-09-28

### Improvements

* Support stream #53

## v2.0.1 - 2016-07-27

### Fixes

* Fix CI settings

## v2.0.0 - 2016-07-27

### Improvements

* Support requireAckResponse
* Support setting tag_prefix to `null`
* Improve error handling
* Add winston transport

# v1.x

## v1.2.1 - 2016-07-15
## v1.2.0 - 2016-07-15
## v1.1.1 - 2016-05-09
## v1.1.0 - 2016-02-01
## v1.0.0 - 2016-01-12

# v0.x

Ancient releases.

## v0.5.0 - 2015-12-14
## v0.4.2 - 2015-11-09
## v0.4.1 - 2015-10-30
## v0.4.0 - 2015-10-30
## v0.3.0 - 2015-09-25
## v0.2.5 - 2013-11-24
## v0.2.4 - 2013-06-02
## v0.2.3 - 2013-06-02
## v0.2.2 - 2013-06-02
## v0.2.1 - 2013-01-10
## v0.2.0 - 2013-01-07
## v0.1.0 - 2012-04-20

## v0.0.2 - 2012-02-17

Initial release
