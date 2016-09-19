'use strict';

/* CI Test mode - script which purpose is to test if CI enviroment is working
 * properly by running one simple test for android and ios native layer and
 * node layer.
 */

var fs = require('fs-extra-promise');

var updateUnitTestConfig = function() {
  var locationOfUnitTestConfig = '../../TestServer/UnitTestConfig.js';

  try {
    var originalContent = fs.readFileSync(locationOfUnitTestConfig);
    var newContent = originalContent.toString().replace(/-?[0-9]/g, '-1');

    fs.writeFileSync(locationOfUnitTestConfig, newContent);
  } catch (e) {
    console.log(e);
    console.log('Failed to update the UnitTestConfig.js file!');
  }
};

var updateThaliTestSuiteFunction = function() {
  var locationOfAndroidBeforeCompile = '../../../scripts/android/before_compile.js';

  try {
    var originalContent = fs.readFileSync(locationOfAndroidBeforeCompile);
    var newContent = originalContent.toString().replace('Test.java', 'CITest');

    fs.writeFileSync(locationOfAndroidBeforeCompile, newContent, 'utf-8');
  } catch (e) {
    console.log(e);
    console.log('Failed to update function in androidBeforeCompile.js file!');
  }
};

var copyCINativeTestClass = function() {
  try {
    var path = '../../../scripts/android/before_compile.js';

    var originalContent = fs.readFileSync(path);
    var oldFunc = 'var i, testClassName;';
    var newFunc = oldFunc + '\nfs.copySync(appRoot + \'/plugins/org.thaliproject.p2p/src/android/test/io/jxcore/node/CITestClass.java\', appRoot + \'/platforms/android/src/io/jxcore/node/CITestClass.java\');';
    var newContent = originalContent.toString().replace(oldFunc, newFunc);

    fs.writeFileSync(path, newContent);
  } catch (e) {
    console.log(e);
    console.log('Failed to create CITestClass.java file!');
  }
};

var updateRunTestsToRunOnlyOneNodeTest = function() {
  var locationOfRunTests = './runTests.js';

  try {
    var originalContent = fs.readFileSync(locationOfRunTests);
    var newContent = originalContent.toString().replace('fileName.indexOf(\'test\') === 0)', 'fileName.indexOf(\'CITest\') === 0)');

    fs.writeFileSync(locationOfRunTests, newContent);
  } catch (e) {
    console.log(e);
    console.log('Failed to modify runTests.js file!');
  }
};

var copyCINodeTestClass = function() {
  try {
    fs.renameSync('bv_tests/disabled/CITestClass.js', 'bv_tests/CITestClass.js');
  } catch (e) {
    console.log(e);
    console.log('Failed to copy CI node test class file!');
  }
};

var emptyAlliOSTestFilesButOne = function() {
  try {
    var i, path = '../../../lib/ios/ThaliCore/ThaliCoreTests';
    var currentFilePath;
    var filesArray = fs.readdirSync(path);

    for (i = 0; i < filesArray.length; i++) {
      if (filesArray[i].indexOf('SimpleTestCase') == -1) {
        currentFilePath = path + '/' + filesArray[i].toString();
        if (!fs.lstatSync(currentFilePath).isDirectory()) {
          fs.writeFileSync(currentFilePath, '');
        }
      }
    }
  } catch (e) {
    console.log(e);
    console.log('Failed to empty all iOS test files but one!');
  }
};

updateUnitTestConfig();
copyCINodeTestClass();
copyCINativeTestClass();
emptyAlliOSTestFilesButOne();
updateThaliTestSuiteFunction();
updateRunTestsToRunOnlyOneNodeTest();
