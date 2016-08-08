'use strict';
var exec = require('child_process').exec;
var Promise = require('lie');

// I tried child-process-promise but it failed without errors and I just don't
// have time to fight with it right now.
module.exports.childProcessExecPromise = function(command, options) {
  return new Promise(function (resolve, reject) {
    exec(command, options,
      function (error, stdout, stderr) {
        // TODO: remove the lines below. Only for CI debugging.
        if (stdout) { console.log(stdout); }
        if (stderr) { console.log(stderr); }

        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;

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
};
