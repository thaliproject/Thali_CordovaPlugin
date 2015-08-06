#!/usr/bin/env bash
cd ../../../
cordova create ThaliTest com.test.thalitest ThaliTest
mkdir -p ThaliTest/thaliDontCheckIn/localdev
cp -r Thali_CordovaPlugin/test/www/ ThaliTest/www
cd ThaliTest/www/jxcore
cordova platform add android
jx npm install ../../../Thali_CordovaPlugin/thali --save
jx npm install
find . -name "*.gz" -delete