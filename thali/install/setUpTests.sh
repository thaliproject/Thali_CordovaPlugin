#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Check if we are running in MinGW
runningInMinGw=false

if [ "$(expr substr $(uname -s) 1 5)" == "MINGW" ]; then
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
jx npm install --autoremove "*.gz,*.pem"

# In case autoremove fails to delete the files, delete them explicitly.
# However, 'find' command on MinGW is likely to consider the predicate '-delete'
# invalid. In addition, in Windows file system the ThaliTest paths are usually
# too long and if rm fails, it will abort the script. Thus, on Windows we have
# to rely on autoremove to work. 
if [ $runningInMinGw == false ]; then
    find . -name "*.gz" -delete
    find . -name "*.pem" -delete
fi

cp -v $1 app.js
cordova build android --release --device

if [ $runningInMinGw == false ]; then
    cordova build ios --device
fi

echo "Remember to start the test coordination server by running jx index.js"
