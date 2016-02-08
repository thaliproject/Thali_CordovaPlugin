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
//  Permissions Cordova Plugin
//  ThaliPermissions.js
//

"use strict";
/*
 * Beginning in Android 6.0, users grant permissions to apps while the app is running.
 * Permissions class can be used to check whether the user has granted permission for the application.   
 */
var ThaliPermissions = (function(){

var ThaliPermissions = {};

  /*
  * Response codes for the permission request
  * PERMISSION_GRANTED: Success: User has authorized requested permission. 
  * PERMISSION_DENIED: Error: User has denied access to requested permission
  * RESPONSE_CONCURRENT_PERMISSION_REQUESTS_NOT_SUPPORTED: Error: Concurrent request are not supported
  */
  ThaliPermissions.responseCodes = {
		"PERMISSION_GRANTED": "PERMISSION_GRANTED", 
		"PERMISSION_DENIED": "PERMISSION_DENIED", 
    "RESPONSE_CONCURRENT_PERMISSION_REQUESTS_NOT_SUPPORTED": "RESPONSE_CONCURRENT_PERMISSION_REQUESTS_NOT_SUPPORTED" 
	};
 
 /**
 * Checks if the user has granted the location permission for the application.
 * If the location permission is not granted, and the user hasn't checked "Never ask again" for a permission query dialog
 * system will display the permission query dialog for the user. 
 * @param {function} successCallback - This function is called if the location permission is granted
 * @param {function} errorCallback - This function is called when the location permission is not granted. 
 */
  ThaliPermissions.requestLocationPermission = function (successCallback, errorCallback) {
    cordova.exec(successCallback, errorCallback, "ThaliPermissions", "REQUEST_ACCESS_COARSE_LOCATION",[]);
  };
  
  return ThaliPermissions;
});

module.exports = new ThaliPermissions();