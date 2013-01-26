var TcpSender  = require('./sender/tcp').TcpSender;
var HttpSender = require('./sender/http').HttpSender;

function createFluentSender(tag, options){
  var constructor = TcpSender;
  if( options && options.useHttp ){
    constructor = HttpSender;
  }
  return new constructor(tag, options);
}

module.exports = {
  createFluentSender: createFluentSender
}