'use strict';

var iPAddressToFile = require('./IPAddressToFile');

require('../utils/process');


// A quick little command line utility to allow us to generate
// the server config before creating a Cordova test project.

iPAddressToFile(process.argv[2])
.then(function () {
  process.exit(0);
})
.catch(function (err) {
  console.log(err);
  process.exit(1);
});
