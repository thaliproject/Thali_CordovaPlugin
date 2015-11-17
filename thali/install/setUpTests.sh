#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

# The first argument must be the name of the test file to make into the app.js
# The second argument is optional and specifies a string with an IP address to manually set the coordination server's
# address to.

cd `dirname $0`
cd ../..
repositoryRoot=$(pwd)
cd test/TestServer
jx npm install
jx generateServerAddress.js $2
cd $repositoryRoot/..
cordova create ThaliTest com.test.thalitest ThaliTest
mkdir -p ThaliTest/thaliDontCheckIn/localdev
cp -R $repositoryRoot/test/www/ ThaliTest/www
cd ThaliTest
cordova platform add ios
cordova platform add android
cd www/jxcore
jx npm install $repositoryRoot/thali --save --autoremove "*.gz"
# SuperTest which is used by some of the BVTs include a PEM file (for private keys) that makes Android unhappy
# so we remove it below in addition to the gz files.
jx npm install --autoremove "*.gz,*.pem"
# In theory we don't need the line below because we use autoremove but for some reason autoremove doesn't
# seem to work in this case.
find . -name "*.gz" -delete
find . -name "*.pem" -delete
cp -v $1 app.js
cordova build android --device
cordova build ios --device
echo "Remember to start the test coordination server by running jx index.js"
