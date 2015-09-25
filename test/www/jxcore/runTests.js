"use strict";

var fs = require('fs-extra-promise');

fs.readdirSync(__dirname + "/bv_tests/").forEach(function(fileName) {
    if ((fileName.indexOf("test") == 0) &&
        fileName.indexOf(".js", fileName.length - 3) != -1) {
        require(__dirname + "/bv_tests/" + fileName);
    }
});
