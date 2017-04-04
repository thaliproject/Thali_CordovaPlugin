#!/usr/bin/env bash

### START - JXcore Test Server --------...............................
### Testing environment prepares separate packages for each node.
### Package builder calls this script with each node's IP address
### Make sure multiple calls to this script file compiles the application file
### END - JXcore Test Server   --------

echo ""
echo "start build.sh"

SCRIPT_PATH="$(cd "$(dirname "$0")"; pwd -P)"
source "$SCRIPT_PATH/thali/install/include.sh/build-dep.sh"

set -euo pipefail

trap 'log_error $LINENO' ERR


# The build has sometimes failed with the default value of maximum open
# files per process, which is 256. Try to boost it as workaround.
ulimit -n 1024

echo ""
echo "-- Environment:"
echo "Cordova version: $(cordova -v)"
echo "Node version: $(node -v)"
echo "JXcore version: $(jx -jxv)"
echo "JXcore engine: $(jx -jsv)"
if is_darwin_platform; then
  echo "xcodebuild version: $(xcodebuild -version | head -n1)"
fi
echo ""

WORKING_DIR=$(pwd)

# A hack to workaround an issue where the install scripts assume that the
# folder of the Thali Cordova plugin is called exactly Thali_CordovaPlugin,
# but this isn't always the case in the CI.
# https://github.com/thaliproject/Thali_CordovaPlugin/issues/218
THALI_PLUGIN_DIR="${WORKING_DIR}/../Thali_CordovaPlugin"
if [ ! -d "$THALI_PLUGIN_DIR" ]; then
  cp -R . $THALI_PLUGIN_DIR
  cd $THALI_PLUGIN_DIR
fi

# Run first the tests that can be run on desktop
thali/install/setUpDesktop.sh
cd test/www/jxcore/

# Check if build is running in CI Test Mode
CI_TEST_MODE=false;

if [ $CI_TEST_MODE == true ]
then
  echo -e "${GREEN_COLOR} Running in CI test mode ${NORMAL_COLOR}"
  node CITestMode.js
fi

echo ""
echo "run desktop tests"
jx runTests.js --networkType WIFI
jx runTests.js --networkType NATIVE
jx runTests.js --networkType BOTH
jx npm run test-meta
jx runCoordinatedTests.js --networkType NATIVE
jx runCoordinatedTests.js --networkType WIFI
jx runCoordinatedTests.js --networkType BOTH
echo "end desktop tests"
echo ""

# Verify that docs can be generated
#cd $WORKING_DIR/thali/
#jx npm run createPublicDocs
#jx npm run createInternalDocs

# Make sure we are back in the project root folder
# after the test execution
cd $WORKING_DIR

echo ""
echo "remove the previous build result (if any) to start from a clean state."
rm -rf ../ThaliTest

# Either PerfTest_app.js or UnitTest_app.js
TEST_TYPE="UnitTest_app.js"

SERVER_ADDRESS="$(get_ci_ip_address)"

# The line below is really supposed to be 'jx npm run setupUnit -- $SERVER_ADDRESS' but getting the last argument
# passed through npm run and then into sh script seems to be a step too far. Eventually we could use an
# intermediary node.js script to fix this but for now we'll just hack it.
thali/install/setUpTests.sh $TEST_TYPE $SERVER_ADDRESS

if running_on_ci; then

  echo ""
  echo "start copying builds for CI"

  # Make sure we are back in the project root folder
  # after the setting up the tests
  cd $WORKING_DIR

  # Remove the node_modules in the CI environment, because the coordination
  # server may have different OS and CPU architecture than the build server
  # so modules need to be installed there separately (this is handled by the CI).
  rm -rf test/TestServer/node_modules

  # A hack workround due to the fact that CI server doesn't allow relative paths outside
  # of the original parent folder as a path to the build output binaries.
  # https://github.com/thaliproject/Thali_CordovaPlugin/issues/232
  echo "copying Android build for CI"
  rm -rf android-release-unsigned.apk
  cp -R ../ThaliTest/platforms/android/build/outputs/apk/android-release-unsigned.apk android-release-unsigned.apk

  echo "copying iOS build for CI"
  rm -rf ThaliTest.app
  cp -R ../ThaliTest/platforms/ios/build/device/ThaliTest.app ThaliTest.app

  echo "end copying builds for CI"
  echo ""
fi

echo "end build.sh"
echo ""
