#!/usr/bin/env bash
cd ../../../
cordova create ThaliTest com.test.thalitest ThaliTest
mkdir -p ThaliTest/thaliDontCheckIn/localdev
cp -r Thali_CordovaPlugin/test/www/ ThaliTest/www
cd ThaliTest/www/jxcore
cordova platform add ios
cordova platform add android
jx npm install ../../../Thali_CordovaPlugin/thali --save --autoremove="*.gz"
jx npm install --autoremove="*.gz"
