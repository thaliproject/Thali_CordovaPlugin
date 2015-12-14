var test = require('tape');
var spawn = require('child_process').spawn;

test("test server starts and stops", function(t) {
  var server = spawn('node', ['./index.js', '{"devices":{"ios":4}}']); 
  server.stderr.on('data', function(data) {
    t.fail("Should be no error output");
  });
  server.stdout.on('data', function(data) {
    console.log(new Buffer(data, 'utf8').toString()); 
    server.kill('SIGINT');
  });
  server.on('exit', function(code, signal) {
    t.equal(code, 130);
    t.end();
  });
});
