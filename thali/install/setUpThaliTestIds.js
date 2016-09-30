  // example: 'SSDP_NT: 'http://www.thaliproject.org/ssdp','
  // We want to replace 'http://www.thaliproject.org/ssdp' here with random string.
  var value = randomString.generate({
    length: 'http://www.thaliproject.org/ssdp'.length
  });
  var replacement = {
    pattern: new RegExp(
      [
        '(',
          'SSDP_NT', '\\s*', ':', '\\s*',
        ')',
        '(',
          '[\'"]', '.*?', '[\'"]',
        ')'
      ].join('')
    ),
    value: '$1\'' + value + '\''
  };
  return replaceStringsInFile('thaliConfig.js', [replacement]);
}

function replaceConnectionHelper () {
  var replacements = [];

  // Example: 'private static final String BLE_SERVICE_UUID_AS_STRING = "b6a44ad1-d319-4b3a-815d-8b805a47fb51";'
  // We want to replace 'b6a44ad1-d319-4b3a-815d-8b805a47fb51' with new uuid.v4.

  replacements.push({
    pattern: new RegExp(
      [
        '(',
          ['static', 'final', 'String', 'BLE_SERVICE_UUID_AS_STRING'].join('\\s+'),
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
