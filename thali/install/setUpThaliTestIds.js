'use strict';

var util   = require('util');
var format = util.format;

var assert = require('assert');
var findit = require('findit');
var fs     = require('fs');

var uuid         = require('node-uuid');
var randomString = require('randomstring');

var Promise = require('./utils/Promise');
require('./utils/process');
require('./utils/polyfills.js');


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

    var finder = findit('.')
    .on('file', function (path) {
      // We can receive here 'path': 'a/b/my-file', 'a/b/bad-my-file', 'my-file', 'bad-my-file'.
      // Both 'a/b/my-file' and 'my-file' should be valid.
      if (path === name || path.endsWith('/' + name)) {
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

function readFile(path) {
  return new Promise(function (resolve, reject) {
    fs.readFile(path, 'utf8', function (error, content) {
      if (error) {
        reject(new Error(
          format('we couldn\'t read file, reason: \'%s\'', error)
        ));
      }
      resolve(content);
    });
  });
}

function writeFile(path, content) {
  return new Promise(function (resolve, reject) {
    fs.writeFile(path, content, 'utf8', function (error) {
      if (error) {
        reject(new Error(
          format('we couldn\'t write file, reason: \'%s\'', error)
        ));
      }
      resolve();
    });
  });
}

function replaceContent(content, replacements) {
  // String.prototype.replace in javascript is defected by design.
  // https://stackoverflow.com/questions/5257000/how-to-know-if-javascript-string-replace-did-anything
  function replace(string, pattern, replacement) {
    var isReplaced = false;

    var result = string.replace(pattern, function () {
      isReplaced = true;

      // arguments are $0, $1, ..., offset, string
      return Array.from(arguments).slice(1, -2)
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
          'we couldn\'t replace pattern: \'%s\' with value: \'%s\'',
          pattern, replacement
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
// 'replacements' will be an array: [{ pattern: /pattern/, value: 'replacement' }]
function replaceStringsInFile(name, replacements) {
  return new Promise(function (resolve, reject) {
    return findFirstFile(name)
    .then(function (path) {
      return readFile(path)
      .then(function (content) {
        return replaceContent(content, replacements);
      })
      .then(function (content) {
        return writeFile(path, content);
      })
      .then(resolve);
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
// (?<=...) is not supported in nodejs. (we don't want to require 'pcre' here)
// So we have to use:
//   'abc'.replace(/(a)(b)(c)/, '$1q$3')

function replaceThaliConfig () {
  // example: 'SSDP_NT: 'http://www.thaliproject.org/ssdp','
  // We want to replace 'http://www.thaliproject.org/ssdp' here with random string.
  var value = randomString.generate({
    length: 'http://www.thaliproject.org/ssdp'.length
  });
  var replacement = {
    pattern: new RegExp(
      [
        '(',
          ['SSDP_NT', ':', '[\'"]'].join('\\s*'),
        ')',
        '(.*?)',
        '([\'"])'
      ].join('')
    ),
    value: '$1' + value + '$3'
  };
  return replaceStringsInFile('thaliConfig.js', [replacement]);
}

function replaceConnectionHelper () {
  var replacements = [];

  // Example: 'private static final String SERVICE_UUID_AS_STRING = "fa87c0d0-afac-11de-8a39-0800200c9a66";'
  // We want to replace 'fa87c0d0-afac-11de-8a39-0800200c9a66' with new uuid.v4.
  replacements.push({
    pattern: new RegExp(
      [
        '(',
          ['static', 'final', 'String', 'SERVICE_UUID_AS_STRING'].join('\\s+'),
          '\\s*', '=', '\\s*', '"',
        ')',
        '(.*?)',
        '(")'
      ].join('')
    ),
    value: '$1' + uuid.v4() + '$3'
  });

  // Example: 'private static final String BLE_SERVICE_UUID_AS_STRING = "b6a44ad1-d319-4b3a-815d-8b805a47fb51";'
  // We want to replace 'b6a44ad1-d319-4b3a-815d-8b805a47fb51' with new uuid.v4.

  replacements.push({
    pattern: new RegExp(
      [
        '(',
          ['static', 'final', 'String', 'BLE_SERVICE_UUID_AS_STRING'].join('\\s+'),
          '\\s*', '=', '\\s*', '"',
        ')',
        '(.*?)',
        '(")'
      ].join('')
    ),
    value: '$1' + uuid.v4() + '$3'
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
          '\\s*', '=', '\\s*',
        ')',
        '(.*?)',
        '(;)'
      ].join('')
    ),
    value: '$1' + getRandomNumber(1100, 65534) + '$3'
  });

  return replaceStringsInFile('ConnectionHelper.java', replacements);
}

function replaceJXcoreExtension() {
  // example: 'appContext = [[AppContext alloc] initWithServiceType:@"thaliproject"];'
  // We want to replace 'thaliproject' here with random alphabetic string.
  var value = randomString.generate({
    length:  'thaliproject'.length,
    charset: 'alphabetic'
  });
  var replacement = {
    pattern: new RegExp(
      [
        '(',
          ['initWithServiceType', ':', '@"'].join('\\s*'),
        ')',
        '(.*?)',
        '(")'
      ].join('')
    ),
    value: '$1' + value + '$3'
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
