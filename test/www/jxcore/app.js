var test = require('tape');
var express = require('express');
var net = require('net');

var app = express();
app.disable('x-powered-by');

var server = net.createServer(function (socket) {
  socket.pipe(socket);
});

app.listen(5000, function () {
  server.listen(5001, function () {
    var rows = [], total = 0, passed = 0, failed = 0;

    test.createStream({ objectMode: true })
      .on('data', function (row) {
        // Log for results
        console.log(JSON.stringify(row));

        if (row.type === 'assert') {
          total++;
          row.ok && passed++;
          !row.ok && failed++;
        }
        rows.push(row);
      })
      .on('end', function () {
        // Log final results
        console.log('Total: %d\tPassed: %d\tFailed: %d', total, passed, failed);
      });

    require('./thaliscenarios');
  });
});
