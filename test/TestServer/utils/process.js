'use strict';

var logger = require('./ThaliLogger')('TestServerProcess');


process
.on('SIGINT', function () {
  logger.error('got \'SIGINT\', terminating');
  process.exit(130); // Ctrl-C std exit code
})
.on('uncaughtException', function (error) {
  logger.error(
    'uncaught exception, error: \'%s\', stack: \'%s\'',
    error.toString(), error.stack
  );
  process.exit(1);
})
.on('unhandledRejection', function (error, p) {
  logger.error(
    'uncaught promise rejection, error: \'%s\', stack: \'%s\'',
    error.toString(), error.stack
  );
  process.exit(2);
});
