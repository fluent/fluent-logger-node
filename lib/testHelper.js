var spawn = require('child_process').spawn;
var configPath = require('path').join(__dirname, '../test/fluent-config/fluent.conf');
var fluentdPath = process.env['FLUENTD_PATH'] || "fluentd";
var fluentd = null;
module.exports = {
  fluentd: function(done){
    if( fluentd ){
      done(null, fluentd);
    }else{
      var callbacked = false;
      var s = "";
      fluentd = spawn(fluentdPath, ['-c', configPath]);
      fluentd.stdout.on('data', function(data){
        // console.log(data.toString());
        if( !callbacked ){
          s += data.toString();
          if( s.match(/listening fluent socket/ig) ){
            callbacked = true;
            done(null, fluentd);
          }
        }
      });
      fluentd.stderr.on('data', function(data){
        console.error(data.toString());;
      });
    }
  }
};

process.on('exit', function(){
   if( fluentd ){
     fluentd.kill();
     process.exit(0);
   }
});