//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root
//  for full license information.
//

'use strict';

var fs = require('fs');
var path = require('path');

// We don't want to checkin the readme.md in the local directory
// since it is just a copy of the one in the parent directory
// so we clean it up after publishing so we don't accidentally
// check it in.

var readMeFileName = 'readme.md';
var localReadMe = path.join(__dirname, '..', readMeFileName);
fs.unlinkSync(localReadMe);
process.exit(0);
