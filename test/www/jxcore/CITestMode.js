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
  var locationOfAndroidBeforeCompile = '../../../scripts/androidBeforeCompile.js';

  try {
    var originalContent = fs.readFileSync(locationOfAndroidBeforeCompile);
    var newContent = originalContent.toString().replace('Test.java', 'CITest');

    fs.writeFileSync(locationOfAndroidBeforeCompile, newContent, 'utf-8');
  } catch (e) {
    console.log(e);
    console.log('Failed to update function in androidBeforeCompile.js file!');
  }
};

var createCINativeTestClass = function() {
  try {
    var path = '../../../src/android/test/io/jxcore/node/CITestClass.java';
    var content = 'package io.jxcore.node;\nimport org.junit.Test;\nimport static org.hamcrest.CoreMatchers.is;\
    \nimport static org.hamcrest.MatcherAssert.assertThat;\nimport static org.hamcrest.core.IsNull.notNullValue;\n';
    var classContent = 'public class CITestClass {\
     \n@Test\
        \npublic void test() throws Exception {\
        \nString str = "TestingString";\
        \nassertThat("String is not null", str, is(notNullValue()));\
      \n}\
    }';

    content = content + classContent;

    fs.writeFileSync(path, content);
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

var createCINodeTestClass = function() {
  try {
    var path = 'bv_tests/CITestClass.js';
    var content = '\'use strict\';\
    var tape = require(\'../lib/thaliTape\');\
    var test = tape({\
      setup: function (t) {\
        t.end();\
      },\
      teardown: function (t) {\
        t.end();\
      }\
    });\
    test(\'The test that always pass\', function (t) {\
      t.ok(true);\
      t.end();\
    });';

    fs.writeFileSync(path, content);
  } catch (e) {
    console.log(e);
    console.log('Failed to create CI node test class file!');
  }
};

updateUnitTestConfig();
createCINativeTestClass();
createCINodeTestClass();
updateThaliTestSuiteFunction();
updateRunTestsToRunOnlyOneNodeTest();
