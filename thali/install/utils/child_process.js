//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root
//  for full license information.
//

'use strict';

var child_process = require('child_process');
var Promise = require('./Promise');

function exec(command, options) {
  return new Promise(function (resolve, reject) {
    child_process.exec(command, options,
      function (error, stdout, stderr) {
        if (error) {
          reject(error);
          return;
        }

        // Log output even if command doesn't exit with an error,
        // because otherwise useful debugging information might get lost.
        if (stdout) { console.log(stdout); }
        if (stderr) { console.log(stderr); }

        resolve();
      });
  });
}

module.exports.exec = exec;
