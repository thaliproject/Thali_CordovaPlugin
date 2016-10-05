'use strict';

/* CI Test mode - script which purpose is to test if CI enviroment is working
 * properly by running one simple test for android and ios native layer and
 * node layer.
 */

const fs = require('fs-extra-promise');

var setUpFunctions = {

  updateUnitTestConfig: () => {
    const locationOfUnitTestConfig = '../../TestServer/UnitTestConfig.js';

    let originalContent = fs.readFileSync(locationOfUnitTestConfig);
    let newContent = originalContent.toString().replace(/numDevices: -?[0-9]/g, 'numDevices: -1');

    if (originalContent === newContent) {
      throw new Error('Replace function with regex didn\'t worked properly!');
    }

    fs.writeFileSync(locationOfUnitTestConfig, newContent);
  },

  updateThaliTestSuiteFunction: () => {
    const locationOfAndroidBeforeCompile = '../../../scripts/android/before_compile.js';

    let originalContent = fs.readFileSync(locationOfAndroidBeforeCompile);
    let newContent = originalContent.toString().replace('Test.java', 'CITest');

    fs.writeFileSync(locationOfAndroidBeforeCompile, newContent, 'utf-8');
  },

  copyCINativeTestClass: () => {
    const path = '../../../scripts/android/before_compile.js';

    let originalContent = fs.readFileSync(path);
    let oldFunc = 'var i, testClassName;';
    let newFunc = oldFunc + '\nfs.copySync(appRoot + \'/plugins/org.thaliproject.p2p/src/android/test/io/jxcore/node/CITestClass.java\', appRoot + \'/platforms/android/src/io/jxcore/node/CITestClass.java\');';
    let newContent = originalContent.toString().replace(oldFunc, newFunc);

    fs.writeFileSync(path, newContent);
  },

  updateRunTestsToRunOnlyOneNodeTest: () => {
    const locationOfRunTests = './runTests.js';

    let originalContent = fs.readFileSync(locationOfRunTests);
    let newContent = originalContent.toString().replace('fileName.indexOf(\'test\') === 0)', 'fileName.indexOf(\'CITest\') === 0)');

    fs.writeFileSync(locationOfRunTests, newContent);
  },

  copyCINodeTestClass: () => {
    fs.renameSync('bv_tests/disabled/CITestClass.js', 'bv_tests/CITestClass.js');
  },

  emptyAlliOSTestFilesButOne: (pathParam) => {
    let path;

    path = pathParam || '../../../lib/ios/ThaliCore/ThaliCoreTests';

    if (path === '../../../lib/ios/ThaliCore/ThaliCoreTests' && !fs.existsSync(path + '/SimpleTestCase.swift')) {
        throw new Error('SimpleTestCase test file was not found!');
    }

    const filesArray = fs.readdirSync(path);
    let currentFilePath, i;

    for (i = 0; i < filesArray.length; i++) {
      if (filesArray[i].indexOf('SimpleTestCase') === -1) {
        currentFilePath = path + '/' + filesArray[i].toString();
        if (!fs.lstatSync(currentFilePath).isDirectory()) {
          fs.writeFileSync(currentFilePath, 'import Foundation\n');
        } else {
          setUpFunctions.emptyAlliOSTestFilesButOne(currentFilePath);
        }
      }
    }
  },
};

function runFunctionAndCheckFailures(func, errStr) {
  try {
    func();
  } catch (e) {
    console.log(e);
    console.log(errStr);
    process.exit(-1);
  }
}

for (let name in setUpFunctions) {
  if (setUpFunctions.hasOwnProperty(name)) {
    runFunctionAndCheckFailures(setUpFunctions[name], name);
  }
}

process.exit(0);
