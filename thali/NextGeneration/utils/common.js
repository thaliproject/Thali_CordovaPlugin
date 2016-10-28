'use strict';

module.exports.serializePouchError = function (err) {
  if (err) {
    return (err.status || '') + ' ' + (err.message || '');
  } else {
    return '';
  }
};
