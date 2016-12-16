'use strict';

var util   = require('util');
var format = util.format;

var findit = require('findit');
var fs     = require('fs-extra-promise');

var uuid         = require('node-uuid');
var randomString = require('randomstring');
var Promise      = require('bluebird');

// ponyfills
var endsWith = require('end-with');

require('./process');

var THALI_DIRECTORY = './thaliDontCheckIn';


// We want to find the first path that ends with 'name'.
function findFirstFile (name) {
  return new Promise(function (resolve, reject) {
    var resultPath;

    function end() {
      if (resultPath) {
        resolve(resultPath);
      } else {
        reject(new Error(
          format('file is not found, name: \'%s\'', name)
        ));
      }
    }

    var finder = findit(THALI_DIRECTORY)
    .on('file', function (path) {
      // We can receive here 'path': 'a/b/my-file', 'a/b/bad-my-file',
      //  'my-file', 'bad-my-file'.
      // Both 'a/b/my-file' and 'my-file' should be valid.
      if (path === name || endsWith(path, '/' + name)) {
        resultPath = path;
        finder.stop();
      }
    })
    .on('error', function (error) {
      reject(new Error(error));
    })
    .on('stop', end)
    .on('end', end);
  })
    .catch(function (error) {
      console.error(
        'finder failed, error: \'%s\', stack: \'%s\'',
        error.toString(), error.stack
      );
      return Promise.reject(error);
    });
}

function replaceContent(path, content, replacements) {
  // String.prototype.replace in javascript is defected by design.
  // https://stackoverflow.com/questions/5257000/how-to-know-if-javascript-string-replace-did-anything
  function replace(string, pattern, replacement) {
    var isReplaced = false;

    var result = string.replace(pattern, function () {
      isReplaced = true;

      // arguments are $0, $1, ..., offset, string
      return Array.prototype.slice.call(arguments, 1, -2)
        .reduce(function (pattern, match, index) {
          // '$1' from strings like '$11 $12' shouldn't be replaced.
          return pattern.replace(
            new RegExp('\\$' + (index + 1) + '(?=[^\\d]|$)', 'g'),
            match
          );
        }, replacement);
    });

    if (!isReplaced) {
      throw new Error(
        format(
          'we couldn\'t replace pattern: \'%s\' with value: \'%s\' ' +
          'in file: \'%s\'',
          pattern, replacement, path
        )
      );
    }
    return result;
  }

  return replacements.reduce(function (content, replacement) {
    return replace(content, replacement.pattern, replacement.value);
  }, content);
}

// We want to replace multiple 'strings' in file.
// 'replacements' will be an array:
// [{ pattern: /pattern/, value: 'replacement' }]
function replaceStringsInFile(name, replacements) {
  return findFirstFile(name)
  .then(function (path) {

    return fs.readFileAsync(path, 'utf8')
    .then(function (content) {
      return replaceContent(path, content, replacements);
    })
    .then(function (content) {
      return fs.writeFileAsync(path, content, 'utf8');
    });

  })
  .catch(function (error) {
    console.error(
      'we couldn\'t replace strings in file, error: \'%s\', stack: \'%s\'',
      error.toString(), error.stack
    );
    return Promise.reject(error);
  });
}

// Our task is to replace 'b' between 'a' and 'c' with other value.
// We couldn't use the simpliest solution:
//   'abc'.replace(/(?<=a)(b)(?=c)/, 'q')
// (?<=...) is not supported in nodejs (we don't want to require 'pcre' here).
// So we have to use:
//   'abc'.replace(/(a)(b)(c)/, '$1q$3')

function replaceThaliConfig () {
  // example: 'SSDP_NT: process.env.SSDP_NT || 'http://www.thaliproject.org/ssdp','
  // or: SSDP_NT: 'http://www.thaliproject.org/ssdp',
  // We want to replace it with random string.
  var value = randomString.generate({
    length: 'http://www.thaliproject.org/ssdp'.length
  });
  var replacement = {
    pattern: new RegExp(
      [
        '(',
        'SSDP_NT', '\\s*', ':',
        ')',
        '(',
        '\\s*', '.*?', ',',
        ')'
      ].join('')
    ),
    value: '$1 \'' + value + '\','
  };
  return replaceStringsInFile('thaliConfig.js', [replacement]);
}

function replaceConnectionHelper () {
  var replacements = [];

  // Example: 'private static final String BLE_SERVICE_UUID_AS_STRING =
  // "b6a44ad1-d319-4b3a-815d-8b805a47fb51";'
  // We want to replace 'b6a44ad1-d319-4b3a-815d-8b805a47fb51' with new uuid.v4.

  replacements.push({
    pattern: new RegExp(
      [
        '(',
          ['static', 'final', 'String', 'BLE_SERVICE_UUID_AS_STRING']
            .join('\\s+'),
        '\\s*', '=', '\\s*',
        ')',
        '(',
        '"', '.*?', '"',
        ')'
      ].join('')
    ),
    value: '$1"' + uuid.v4() + '"'
  });

  function getRandomNumber (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Example: 'private static final int MANUFACTURER_ID = 7413;'
  // We want to replace 7413 with random number, 1100 <= number <= 65534.
  replacements.push({
    pattern: new RegExp(
      [
        '(',
          ['static', 'final', 'int', 'MANUFACTURER_ID'].join('\\s+'),
        '\\s*', '=',
        ')',
        '(',
        '\\s*', '.*?', ';',
        ')'
      ].join('')
    ),
    value: '$1 ' + getRandomNumber(1100, 65534) + ';'
  });

  return replaceStringsInFile('ConnectionHelper.java', replacements);
}

function replaceJXcoreExtension() {
  // example:
  // 'appContext = [[AppContext alloc] initWithServiceType:@"thaliproject"];'
  // We want to replace 'thaliproject' here with random alphabetic string.
  var value = randomString.generate({
    length:  'thaliproject'.length,
    charset: 'alphabetic'
  });
  var replacement = {
    pattern: new RegExp(
      [
        '(',
        ['initWithServiceType', ':', '@'].join('\\s*'),
        ')',
        '(',
        '"', '.*?', '"',
        ')'
      ].join('')
    ),
    value: '$1"' + value + '"'
  };
  return replaceStringsInFile('JXcoreExtension.m', [replacement]);
}

Promise.all([
  replaceThaliConfig(),
  replaceConnectionHelper(),
  replaceJXcoreExtension()
])
.then(function () {
  console.info('We have replaced hardcoded ids with random values.');
});
