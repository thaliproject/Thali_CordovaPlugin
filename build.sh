#!/bin/sh

### START - JXcore Test Server --------.............................
### Testing environment prepares separate packages for each node.
### Package builder calls this script with each node's IP address
### Make sure multiple calls to this script file compiles the application file

NORMAL_COLOR='\033[0m'
RED_COLOR='\033[0;31m'
GREEN_COLOR='\033[0;32m'
GRAY_COLOR='\033[0;37m'

LOG() {
  COLOR="$1"
  TEXT="$2"
  echo -e "${COLOR}$TEXT ${NORMAL_COLOR}"
}


ERROR_ABORT() {
  if [[ $? != 0 ]]
  then
    LOG $RED_COLOR "compilation aborted\n"
    exit -1
  fi
}
### END - JXcore Test Server   --------

# The build has sometimes failed with the default value of maximum open
# files per process, which is 256. Doubling it here to 512 to workaround
# that issue.
ulimit -n 512;ERROR_ABORT

PROJECT_ROOT=$(pwd)

# A hack to workaround an issue where the install scripts assume that the
# folder of the Thali Cordova plugin is called exactly Thali_CordovaPlugin,
# but this isn't always the case in the CI.
# https://github.com/thaliproject/Thali_CordovaPlugin/issues/218
THALI_DIRECTORY="../Thali_CordovaPlugin"
if [ ! -d "$THALI_DIRECTORY" ]
then
  cp -R . $THALI_DIRECTORY;ERROR_ABORT
  cd $THALI_DIRECTORY;ERROR_ABORT
fi

# Check the existence of the script that in CI gives the right test server
# IP address.
hash CIGIVEMEMYIP.sh 2>/dev/null
RUN_IN_CI=$?

if [ $RUN_IN_CI == 0 ]
then
  # Make sure build works with the latest cordova release
  jx npm update -g cordova;ERROR_ABORT
fi
# Print the Cordova version for debugging purposes
echo "Cordova version: $(cordova -v)";ERROR_ABORT

# Run first the tests that can be run on desktop
thali/install/setUpDesktop.sh;ERROR_ABORT
cd test/www/jxcore/;ERROR_ABORT
jx npm test;ERROR_ABORT
jx npm run test-meta;ERROR_ABORT
jx npm run test-coordinated;ERROR_ABORT

# Verify that docs can be generated
cd $PROJECT_ROOT/thali/;ERROR_ABORT
jx npm run createPublicDocs
jx npm run createInternalDocs

# Make sure we are back in the project root folder
# after the test execution
cd $PROJECT_ROOT;ERROR_ABORT

if [ $RUN_IN_CI == 0 ]
then
  SERVER_ADDRESS=$(CIGIVEMEMYIP.sh)
else
  # Passing an empty value as the server address means that the address
  # will be generated later in the build process based on the current host.
  SERVER_ADDRESS=""
fi

# Remove the previous build result (if any) to start from a clean state.
rm -rf ../ThaliTest;ERROR_ABORT

# Either PerfTest_app.js or UnitTest_app.js
TEST_TYPE="UnitTest_app.js"

# The line below is really supposed to be 'jx npm run setupUnit -- $SERVER_ADDRESS' but getting the last argument
# passed through npm run and then into sh script seems to be a step too far. Eventually we could use an
# intermediary node.js script to fix this but for now we'll just hack it.
thali/install/setUpTests.sh $TEST_TYPE $SERVER_ADDRESS;ERROR_ABORT

if [ $RUN_IN_CI == 0 ]
then
  # Remove the node_modules in the CI environment, because the coordination
  # server may have different OS and CPU architecture than the build server
  # so modules need to be installed there separately (this is handled by the CI).
  rm -rf test/TestServer/node_modules;ERROR_ABORT
  
  # A hack workround due to the fact that CI server doesn't allow relative paths outside
  # of the original parent folder as a path to the build output binaries.
  # https://github.com/thaliproject/Thali_CordovaPlugin/issues/232
  rm -rf android-release-unsigned.apk;ERROR_ABORT
  cp -R ../ThaliTest/platforms/android/build/outputs/apk/android-release-unsigned.apk android-release-unsigned.apk;ERROR_ABORT
  rm -rf ThaliTest.app;ERROR_ABORT
  cp -R ../ThaliTest/platforms/ios/build/device/ThaliTest.app ThaliTest.app;ERROR_ABORT
fi

FAIL_ON_PURPOSE;ERROR_ABORT