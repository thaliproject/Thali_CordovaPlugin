'use strict';

var IPAddressToFile = require("./IPAddressToFile");

/**
 * A quick little command line utility to allow us to generate the server config before creating
 * a Cordova test project
 */
IPAddressToFile().then(function() {
    process.exit(0);
}).catch(function(err) {
    console.log(err);
    process.exit(1);
});