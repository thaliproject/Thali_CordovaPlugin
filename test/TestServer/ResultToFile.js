'use strict';

var fs = require('fs-extra-promise');
var path = require('path');

function ResultToFile() {
}

ResultToFile.prototype.writeFile = function(data,name) {
    return fs.writeFileAsync(path.join(__dirname,name),JSON.stringify(data));
}

module.exports = ResultToFile;
