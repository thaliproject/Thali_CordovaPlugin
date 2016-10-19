//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root
//  for full license information.
//

'use strict';

var child_process = require('child_process');
var Promise = require('./Promise');

function exec(command, options) {
  return new Promise(function (resolve, reject) {
    var childProcess = child_process.exec(command, options);

    childProcess.stdout.on('data', function (data) {
      console.log('' + data);
    });
    childProcess.stderr.on('data', function (data) {
      console.log('' + data);
    });
    childProcess.on('close', function (code) {
      if (code !== 0) {
        return reject('`' + command + '` (exited with error code' + code + ')');
      }
      return resolve();
    });
  });
}

module.exports.exec = exec;
