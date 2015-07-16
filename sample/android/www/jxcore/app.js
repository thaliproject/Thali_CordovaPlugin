var test = require('tape');
var path = require('path');

test.createStream({ objectMode: true }).on('data', function (row) {
  console.log(JSON.stringify(row));
});

require('./test/thaliemitterspec');
