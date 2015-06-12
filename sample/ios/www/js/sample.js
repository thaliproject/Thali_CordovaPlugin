//
//  The MIT License (MIT)
//
//  Copyright (c) 2015 Microsoft
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
//  ThaliMobile
//  thali_mobile.js
//

(function () {
  // Logs in Cordova.
  function logInCordova(logEntry) {
    var logEntriesDiv = document.getElementById('logEntries');
    if (logEntriesDiv) {
      var logEntryDiv = document.createElement('div');
      logEntryDiv.className = 'logEntry';
      logEntry = logEntry.replace('\n', '<br/>');
      logEntry = logEntry.replace(' ', '&nbsp;');
      logEntryDiv.innerHTML = logEntry;
      logEntriesDiv.appendChild(logEntryDiv);
    }
  }

  // Find out when JXcore is loaded.
  var jxcoreLoadedInterval = setInterval(function () {
    // HACK Repeat until jxcore is defined. When it is, it's loaded.
    if (typeof jxcore == 'undefined') {
      return;
    }

    // JXcore is loaded. Stop interval.
    clearInterval(jxcoreLoadedInterval);

    // Set the ready function.
    jxcore.isReady(function () {
      // Log that JXcore is ready.
      logInCordova('JXcore ready');

      // Register logging function.
      jxcore('logInCordova').register(logInCordova);

      // Load app.js.
      jxcore('app.js').loadMainFile(function (ret, err) {
        if (err) {
          alert('Error loading ThaliMobile app.js');
          alert(err);
        }
      });
    });
  }, 10);
})();
