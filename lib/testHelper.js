var spawn = require('child_process').spawn;
var configPath = require('path').join(__dirname, '../test/fluent-config/fluent.conf');
var fluentdPath = process.env['FLUENTD_PATH'] || "fluentd";
var fluentd = null;
module.exports = {
  // TODO: not use stdout plugin, but use echoback (or mock);
  fluentd: function(done){
    var ready = false;
    var s = "";
    var fluentd = spawn(fluentdPath, ['-c', configPath]);
    fluentd.__defineGetter__('receivedData', function(){
      // console.error(s);
      var lines = s.trim().split('\n');
      lines.pop(); lines.pop(); // remove the last 2 lines (shutting down message);
      return lines.map(function(v, i){
        if( v.match(/\s(debug\..*): (.*)/) ){
          return {tag: RegExp.$1, data: JSON.parse(RegExp.$2)};
        }else{
          return {tag: null, data: null};
        }
      });
      return s.trim();
    });
    fluentd.stdout.on('data', function(data){
      s += data.toString();
      if( !ready ){
        if( s.match(/listening fluent socket/ig) ){
          ready = true;
          s = '';
          done(null, fluentd);
        }
      }
    });
    fluentd.stderr.on('data', function(data){
      console.error(data.toString());;
    });
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
    return fluentd;
  }
};
