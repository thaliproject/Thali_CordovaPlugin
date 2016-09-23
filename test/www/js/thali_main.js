'use strict';

//
//  The MIT License (MIT)
//
//  Copyright (c) 2015-2016 Microsoft
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
//
//  Thali Cordova Plugin
//  thali_main.js
//

(function () {
  var inter = setInterval(function () {
    if (typeof jxcore == 'undefined') { return; }

    clearInterval(inter);

    jxcore.isReady(function () {
      if (window.ThaliPermissions) {
        // requestLocationPermission ensures that the application has
        // the required ACCESS_COARSE_LOCATION permission in Android.
        window.ThaliPermissions.requestLocationPermission(function () {
          console.log('Application has the required permission.');
          loadMainFile();
        }, function (error) {
          console.log('Location permission not granted. Error: ' + error);
          exitWithFailureLog();
        });
      } else {
        loadMainFile();
      }
    });
  }, 5);

  function loadMainFile() {
    jxcore('app.js').loadMainFile(function (ret, err) {
      if (err) {
        console.log('app.js file failed to load : ' + JSON.stringify(err));
        exitWithFailureLog();
      } else {
        jxcore_ready();
      }
    });
  }

  function jxcore_ready() {
    jxcore('setMyNameCallback').call(nameCallback);
    jxcore('setLogCallback').call(logCallback);
    document.getElementById('ClearLogButton').addEventListener('click', ClearLog);
    console.log('UIApp is all set and ready!');
  }

  function exitWithFailureLog() {
    console.log('****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****');
    navigator.app.exitApp();
  }

  function nameCallback(name) {
    document.getElementById('nameTag').innerHTML = name;
  }

  function ClearLog() {
    document.getElementById('LogBox').value = '';
  }

  function logCallback(data) {
    var logBox = document.getElementById('LogBox');
    logBox.value = data + '\n' + logBox.value;
  }
}());
