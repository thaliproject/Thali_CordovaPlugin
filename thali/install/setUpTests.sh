#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Check if we are running in MinGW
runningInMinGw=false

if [ "$(uname -s | cut -c 1-5)" == "MINGW" ]; then
    echo "Running in MinGW"
    runningInMinGw=true
fi

# The first argument must be the name of the test file to make into the app.js
# The second argument is optional and specifies a string with an IP address to
# manually set the coordination server's address to.

cd `dirname $0`
cd ../..
repositoryRoot=$(pwd)
cd test/TestServer
jx npm install
jx generateServerAddress.js $2
cd $repositoryRoot/..
cordova create ThaliTest com.test.thalitest ThaliTest
mkdir -p ThaliTest/thaliDontCheckIn/localdev

if [ $runningInMinGw == true ]; then
    # The thali package might be installed as link and there will
    # be troubles later on if this link is tried to be copied so
    # remove it here.
    rm -rf $repositoryRoot/test/www/jxcore/node_modules/thali
    cp -R $repositoryRoot/test/www/ ThaliTest/
else
    cp -R $repositoryRoot/test/www/ ThaliTest/www
fi

cd ThaliTest
cordova platform add ios
cordova platform add android
cd www/jxcore
jx npm install $repositoryRoot/thali --save --autoremove "*.gz"

if [ $runningInMinGw == true ]; then
    # On Windows the package.json file will contain a local file URI for Thali,
    # which needs to be replaced with a valid value. Otherwise the build process
    # will be aborted. Restore write permission after running sed in case
    # Windows security settings removed it.
    sed -i 's/"thali": ".*"/"thali": "^2.0.2"/g' package.json
    chmod 644 package.json
fi

# SuperTest which is used by some of the BVTs include a PEM file (for private
# keys) that makes Android unhappy so we remove it below in addition to the gz
# files.
jx npm install --no-optional --autoremove "*.gz,*.pem"

# In case autoremove fails to delete the files, delete them explicitly.
find . -name "*.gz" -delete
find . -name "*.pem" -delete

cp -v $1 app.js

cordova build android --release --device

if [ $runningInMinGw == false ]; then
    cordova build ios --device
fi

echo "Remember to start the test coordination server by running jx index.js"
