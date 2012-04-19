var net = require('net');
var fs = require('fs');
var spawn = require('child_process').spawn;
var configPath = require('path').join(__dirname, '../test/fluent-config/fluent.conf');
var fluentdPath = process.env['FLUENTD_PATH'] || "fluentd";
var fluentd = null;

function spawnFluentDaemon(callback){
  var s = net.createServer();
  // grab a random port
  s.listen(function(){
    var port = s.address().port;
    var configPath = '/tmp/fluent-logger-node-test.' + port + '.conf';
    s.on('close', function(){
      var data = ["<source>",
                  "type forward",
                  "port " + port,
                  "</source>",
                  "<match debug.**>",
                  "type stdout",
                  "</match>"].join('\n');
      fs.writeFileSync(configPath, data);
      var fluentd = spawn(fluentdPath, ['-c', configPath]);
      process.on('exit', function(){
        if( fluentd && fluentd.exitCode === null ){
          console.error('fluentd process remains. force to kill.');
          try{
            fluentd.kill();
          }catch(e){
            console.error(e);
          }
        }
      });
      callback(port, fluentd);
    });
    s.close();
  });
}

module.exports = {
  /**
   * fluentd process utility
   *
   * fluentd(function(port, end){
   *   // send contents to port
   *   // ...
   *
   *   end(function(receivedData){
   *      // check receivedData array
   *      receivedData[i].tag    // -> tag
   *      receivedData[i].record // -> tag
   *   });
   *
   * });
   *
   */

  fluentd: function(ready){
    spawnFluentDaemon(function(port, fluentd){
      var lines = [];
      var s = "";
      function finish(callback){
        fluentd.kill();
        fluentd.on('exit', function(){
          callback(lines);
        });
      };


      fluentd.stdout.on('data', function(data){
        // process.stdout.write(data.toString());
        s += data.toString();
        if( s.indexOf('\n') > 0 ){
          var l = s.split('\n'); // line0, line1, ..., chunk
          var line = '';
          for(var i=0; i < l.length - 1; i++){
            line = l[i];
            if( line.match(/listening fluent socket/ig) ){
              process.nextTick(function(){
                ready(port, finish);
              });
            }
            if( line.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \+\d{4} (.+): (.+)$/) ){
              try{
                lines.push({
                  tag: RegExp.$1, data: JSON.parse(RegExp.$2)
                });
              }catch(e){
                console.error(e + ' ' + RegExp.$2);
              }
            }
          }
          s = l[l.length-1];
        }
      });
      fluentd.stderr.on('data', function(data){
        console.error(data.toString());;
      });
    });
  }
};
