// The MIT License (MIT)
//
// Copyright (c) 2015-2016 Microsoft
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
//
// Permissions Cordova Plugin
// ThaliPermissions.js

'use strict';

/** @module thaliPermissions */

/**
 * Response codes for the permission request.
 * @readonly
 * @enum {string}
 */
module.exports.responseCodes = {
  /** User has denied access to requested permission */
  'PERMISSION_DENIED': 'PERMISSION_DENIED',
  /** Concurrent request are not supported*/ 
  'RESPONSE_CONCURRENT_PERMISSION_REQUESTS_NOT_SUPPORTED':
    'RESPONSE_CONCURRENT_PERMISSION_REQUESTS_NOT_SUPPORTED'
};

/**
 * This callback function is called if the location permission is granted.
 * @public
 * @callback successCallbackFn
 */

/**
 * This callback function is called if the location permission is not granted.
 * @public
 * @callback errorCallbackFn
 * @param {module:thaliPermissions~responseCodes}
 */

/**
* Beginning in Android 6.0, users grant permissions to apps while the app is 
* running. This function can be used to check whether the user has 
* granted the location permission for the application.
* If the location permission is not granted, and the user hasn't checked 
* "Never ask again" for a permission query dialog system will display 
* the permission query dialog for the user.
* @param {module:thaliPermissions~successCallbackFn} successFn 
* @param {module:thaliPermissions~errorCallbackFn} errorFn   
*/
module.exports.requestLocationPermission = function (successFn, errorFn) {
  cordova.exec(successFn, errorFn, 'ThaliPermissions', 
                'REQUEST_ACCESS_COARSE_LOCATION', []);
};
