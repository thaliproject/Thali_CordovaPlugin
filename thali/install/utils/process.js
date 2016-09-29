'use strict';


process
.on('SIGINT', function () {
  console.error('got \'SIGINT\', terminating');
  process.exit(130); // Ctrl-C std exit code
})
.on('uncaughtException', function (error) {
  console.error(
    'uncaught exception, error: \'%s\', stack: \'%s\'',
    error.toString(), error.stack
  );
  process.exit(1);
})
.on('unhandledRejection', function (error, p) {
  console.error(
    'uncaught promise rejection, error: \'%s\', stack: \'%s\'',
    error.toString(), error.stack
  );
  process.exit(2);
});
