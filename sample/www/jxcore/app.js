var test = require('tape');
var path = require('path');
var express = require('express');

var app = express();
app.disable('x-powered-by');
app.use( express.static( 'public' ) );
app.engine('ejs', require('ejs').__express);

app.get('/', function (req, res) {
  var rows = [], total = 0, passed = 0, failed = 0;

  test.createStream({ objectMode: true })
    .on('data', function (row) {
      if (row.type === 'assert') {
        total++;
        row.ok && passed++;
        !row.ok && failed++;
      }
      rows.push(row);
    })
    .on('end', function () {
      res.render('ejs/index', { rows: rows, total: total, passed: passed, failed: failed });
    });

  require('./test/thaliscenarios');
});

app.listen(5000);
