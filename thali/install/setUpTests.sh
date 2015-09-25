#!/usr/bin/env bash
cd ../../test/TestServer
jx npm install
jx generateServerAddress.js
cd ../../..
cordova create ThaliTest com.test.thalitest ThaliTest
mkdir -p ThaliTest/thaliDontCheckIn/localdev
cp -r Thali_CordovaPlugin/test/www/ ThaliTest/www
cd ThaliTest/www/jxcore
cordova platform add ios
cordova platform add android
jx npm install ../../../Thali_CordovaPlugin/thali --save --autoremove "*.gz"
jx npm install --autoremove "*.gz"
# In theory we don't need the line below because we use autoremove but for some reason autoremove doesn't
# seem to work in this case.
find . -name "*.gz" -delete
