"use strict";

var fs = require('fs-extra-promise');

console.log('copying files');

fs.copyAsync('../../../thali', 'thali')
.then(function() {
  console.log("ok");
  process.exit(0);
}).catch(function(err) {
  console.log("Error in copying files %s", err);
  process.exit(1);
});
