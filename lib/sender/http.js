var util = require('util');
var http = require('http');
var FluentSender = require('./base').FluentSender;
var querystring = require('querystring');

function HttpSender(tag, options){
  options = options    || {};
  this.host = options.host || "localhost";
  this.port = options.port || 8888;
  FluentSender.call(this, tag, options);
}
util.inherits(HttpSender, FluentSender);

HttpSender.prototype._connect = function(callback){
  callback();
};

HttpSender.prototype._writeRecord = function(record, callback){
  var self = this;
  var callbacked = false;
  var cb = function(err){
    if( !callbacked ){
      callbacked = true;
      callback(err);
    }
  };
  var req = http.request({
    host: this.host,
    port: this.port,
    path: "/" + encodeURIComponent(record.tag),
    method: "POST"
  });
  req.setTimeout(this.timeout);
  req.on('error', function(err){
    cb(err);
  });
  req.write(querystring.stringify({
    json: JSON.stringify(record.data)
  }));
  req.on('response', function(res){
    if( res.statusCode == 200 ){
      cb();
    }else{
      var error = new Error("fluentd returns non 200 code.");
      error.response = res;
      cb(err);
    }
  });
  req.end();
};

HttpSender.prototype._close = function(){

};

module.exports = exports = {};
exports.HttpSender = HttpSender;
