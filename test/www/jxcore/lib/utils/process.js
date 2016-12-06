'use strict';

var logger = require('thali/ThaliLogger')('TestsProcess');


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
  logger.error('****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****');
  process.exit(1);
})
.on('unhandledRejection', function (error) {
  logger.error(
    'uncaught promise rejection, error: \'%s\', stack: \'%s\'',
    error.toString(), error.stack
  );
  logger.error('****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****');
  process.exit(2);
});
