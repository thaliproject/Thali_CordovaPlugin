console.log('in app.js');

var test = require('tape');
var path = require('path');

test.createStream({ objectMode: true }).on('data', function (row) {
  console.log(JSON.stringify(row));
});

console.log('created test stream');

require('./test/thaliscenarios');
