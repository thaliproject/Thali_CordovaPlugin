"use strict";

var fs = require('fs-extra-promise');
var path = require('path');

fs.readdirSync(path.join(__dirname, "bv_tests")).forEach(function(fileName) {
    if ((fileName.indexOf("test") == 0) &&
        fileName.indexOf(".js", fileName.length - 3) != -1) {
        require(path.join(__dirname, "bv_tests", fileName));
    }
});
