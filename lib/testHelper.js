var fs = require('fs');
var util = require('util');
var net = require('net');
var http = require('http');
var querystring = require('querystring');
var msgpack = require('msgpack');

function MockServer(){
  this._port = null;
  this._received = [];
}

MockServer.prototype.__defineGetter__('port', function(){
  return this._port;
});

MockServer.prototype.__defineGetter__('messages', function(){
  return this._received;
});

MockServer.prototype._createServer = function(){
  throw new Error("Not implemented");
};

MockServer.prototype.listen = function(callback){
  var self = this;
  this._server = this._createServer();
  this._server.listen(function(){
    self._port = self._server.address().port;
    callback();
  });
};

MockServer.prototype.close = function(){
  this._server.close();
  this._port = null;
  this._received = [];
};

var MockTcpServer = function(){
  MockServer.call(this);
};
util.inherits(MockTcpServer, MockServer);

MockTcpServer.prototype._createServer = function(){
  var self = this;
  return net.createServer(function(socket){
    var ms = new msgpack.Stream(socket);
    ms.on('msg', function(m){
      self._received.push({
        tag: m[0],
        time: m[1],
        data: m[2]
      });
    });
  });
};

var MockHttpServer = function(){
  MockServer.call(this);
}
util.inherits(MockHttpServer, MockServer);

MockHttpServer.prototype._createServer = function(){
  var self = this;
  return http.createServer(function(req, res){
    function error(msg){
      res.writeHead(400);
      res.end(msg);
    }

    var buffer = '';
    if( req.method !== "POST" ) {
      return error("Invalid HTTP method: " + req.method);
    }
    req.on('data', function(chunk){
      buffer += chunk;
    });
    req.on('end', function(){
      var body;
      var msg;
      try{
        body = querystring.parse(buffer);
      }catch(e){
        return error("Cannot parse body: " + e);
      }
      if( body.msgpack ){
          // TODO
        }else if( body.json ){
          try{
            msg = JSON.parse(body.json);
          }catch(e){
            return error("Cannot parse json parameter: " + e);
          }
          res.end("OK");
        }else{
          return error("Invalid message: neither msgpack nor json parameter is found.");
        }
        if( msg !== undefined ){
          self._received.push({
            tag: decodeURIComponent(req.url.substr(1)), // remote /
            data: msg
          });
        }
      });
  });
};

var servers = {
  "tcp" : MockTcpServer,
  "http": MockHttpServer
};

module.exports = {
  runServer: function(type, callback){
    if( typeof(type) === 'function' ){
      callback = type;
      type = "tcp";
    }
    var server = new (servers[type])();
    server.listen(function(){
      callback(server, function(_callback){
        // wait 100 ms and then close
        setTimeout(function(){
          var messages = server.messages;
          _callback(messages);
          server.close();
        }, 100);
      });
    });
  }
};
