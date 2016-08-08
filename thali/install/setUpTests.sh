#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Check the platform we are running
IS_MINIGW_PLATFORM=false
IS_DARWIN_PLATFORM=false

if test x"$(uname -s | cut -c 1-5)" == xMINGW ; then
  echo "Running in MinGW"

  IS_MINIGW_PLATFORM=true
elif test x"`uname`" = xDarwin ; then
  echo "Running in macOS"

  IS_DARWIN_PLATFORM=true
fi

TEST_PROJECT_NAME=ThaliTest

# The first argument must be the name of the test file to make into the app.js
# The second argument is optional and specifies a string with an IP address to
# manually set the coordination server's address to.
# The third argument is optional and if set causes copying of the android unit tests
# to platforms/android

cd `dirname $0`
cd ../..
REPO_ROOT_PATH=$(pwd)


# Begin setting up the project
#
cd test/TestServer
jx npm install
jx generateServerAddress.js $2
cd $REPO_ROOT_PATH/..
cordova create $TEST_PROJECT_NAME com.test.thalitest $TEST_PROJECT_NAME
mkdir -p $TEST_PROJECT_NAME/thaliDontCheckIn/localdev

if [ $IS_MINIGW_PLATFORM == true ]; then
    # The thali package might be installed as link and there will
    # be troubles later on if this link is tried to be copied so
    # remove it here.
    rm -rf $REPO_ROOT_PATH/test/www/jxcore/node_modules/thali
    cp -R $REPO_ROOT_PATH/test/www/ $TEST_PROJECT_NAME/
else
    rsync -a --no-links $REPO_ROOT_PATH/test/www/ $TEST_PROJECT_NAME/www
fi

# Begin adding platforms
#
cd $TEST_PROJECT_NAME

# add Android platform
cordova platform add android

# add iOS platform
if [ $IS_DARWIN_PLATFORM == true ]; then
  cordova platform add ios
fi

# run Thali install
#
cd www/jxcore
jx npm install $REPO_ROOT_PATH/thali --save --no-optional --autoremove "*.gz"

if [ $IS_MINIGW_PLATFORM == true ]; then
    # On Windows the package.json file will contain an invalid local file URI for Thali,
    # which needs to be replaced with a valid value. Otherwise the build process
    # will be aborted. Restore write permission after running sed in case
    # Windows security settings removed it.
    sed -i 's/"thali": ".*"/"thali": "*"/g' package.json
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

# In case of UT create a file
if [[ $2 == "UT" ]] || [[ $3 == "UT" ]] ; then
  echo "UT files will be copied to the platform directory"
  touch ../../platforms/android/unittests
fi

# update Xcode project for CI stuff
if [ $IS_DARWIN_PLATFORM == true ]; then
  echo "Integrating ThaliCore.framework into Xcode project for testing"

  SETUP_XCODE_TESTS_SCRIPT_PATH=$REPO_ROOT_PATH/thali/install/setupXcodeProjectTests.js
  TEST_PROJECT_PATH=$REPO_ROOT_PATH/../$TEST_PROJECT_NAME/platforms/ios/$TEST_PROJECT_NAME.xcodeproj
  FRAMEWORK_PROJECT_FOLDER_PATH=$REPO_ROOT_PATH/../$TEST_PROJECT_NAME/plugins/org.thaliproject.p2p/lib/ios/ThaliCore

  # actually update Xcode project for CI stuff
  jx $SETUP_XCODE_TESTS_SCRIPT_PATH "${TEST_PROJECT_PATH}" "${FRAMEWORK_PROJECT_FOLDER_PATH}"
fi

# build Android
cordova build android --release --device

# build iOS
if [ $IS_DARWIN_PLATFORM == true ]; then
  cordova build ios --device
fi

echo "Remember to start the test coordination server by running jx index.js"
