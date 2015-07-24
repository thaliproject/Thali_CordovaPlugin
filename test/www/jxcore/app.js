var test = require('tape');
var express = require('express');

var app = express();
app.disable('x-powered-by');
app.use( express.static( 'public' ) );
app.engine('ejs', require('ejs').__express);

app.get('/', function (req, res) {
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

      res.render('ejs/index', { rows: rows, total: total, passed: passed, failed: failed });
    });

  require('./test/thaliscenarios');
});

app.listen(5000);
