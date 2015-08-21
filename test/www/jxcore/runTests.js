"use strict";

var fs = require('fs-extra-promise');

if (!jxcore.utils.OSInfo().isMobile) {
    fs.readdirSync('.').forEach(function(fileName) {
        if ((fileName.indexOf("test") == 0) &&
            fileName.indexOf(".js", fileName.length - 3) != -1) {
            require('./' + fileName);
        }
    });
} else {
    require('./testThaliCryptoManager.js');
    require('./testThaliEmitter.js');
    require('./testThaliNativeLayer.js');
}