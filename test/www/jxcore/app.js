var test = require('tape');
var path = require('path');
var express = require('express');

var app = express();
app.disable('x-powered-by');
app.use( express.static( 'public' ) );
app.engine('ejs', require('ejs').__express);

app.listen(5000, function () {
  test.createStream({ objectMode: true })
    .on('data', function (row) {
      console.log(JSON.stringify(row));
    });

  require('./test/thaliscenarios');
});
