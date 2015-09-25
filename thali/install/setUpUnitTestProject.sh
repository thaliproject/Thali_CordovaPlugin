#!/usr/bin/env bash
./setUpTests.sh
cp ../../test/www/jxcore/UnitTest_app.js ../../../ThaliTest/www/jxcore/app.js
cd ../../../ThaliTest
cordova build android
cordova build ios
echo "Remember to start the test coordination server by running jx index.js"
