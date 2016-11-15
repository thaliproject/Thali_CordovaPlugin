#!/usr/bin/env bash

set -euo pipefail

NORMAL_COLOR='\033[0m'
RED_COLOR='\033[0;31m'

OUTPUT() {
  echo -e "${RED_COLOR}$BASH_COMMAND FAILED - setUpTests failure${NORMAL_COLOR}"
}

trap OUTPUT ERR

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
REPO_ROOT_DIR=$(pwd)
TEST_PROJECT_ROOT_DIR=${REPO_ROOT_DIR}/../${TEST_PROJECT_NAME}

# Prepares test project
prepare_project()
{
  IPADDRESS=${1:-}
  npm install --no-optional --production --prefix $REPO_ROOT_DIR/thali/install
  node $REPO_ROOT_DIR/thali/install/validateBuildEnvironment.js

  echo "Preparing ${TEST_PROJECT_NAME} Cordova project"

  cd $REPO_ROOT_DIR/test/TestServer
  npm install --no-optional
  node generateServerAddress.js $IPADDRESS
  cd $REPO_ROOT_DIR/..
  cordova create $TEST_PROJECT_NAME com.test.thalitest $TEST_PROJECT_NAME
  mkdir -p $TEST_PROJECT_NAME/thaliDontCheckIn/localdev

  if [ $IS_MINIGW_PLATFORM == true ]; then
      # The thali package might be installed as link and there will
      # be troubles later on if this link is tried to be copied so
      # remove it here.
      rm -rf $REPO_ROOT_DIR/test/www/jxcore/node_modules/thali
      cp -R $REPO_ROOT_DIR/test/www/ $TEST_PROJECT_NAME/
  else
      rsync -a --no-links $REPO_ROOT_DIR/test/www/ $TEST_PROJECT_NAME/www
  fi

  cd $REPO_ROOT_DIR/thali/install/SSDPReplacer
  npm install --no-optional
  cd $REPO_ROOT_DIR/../$TEST_PROJECT_NAME
  cordova plugin add $REPO_ROOT_DIR/thali/install/SSDPReplacer
}

install_thali()
{
  echo "Installing Thali into ${TEST_PROJECT_NAME}"

  cd $TEST_PROJECT_ROOT_DIR/www/jxcore
  node installCustomPouchDB.js
  jx npm install $REPO_ROOT_DIR/thali --save --no-optional
  find . -name "*.gz" -delete

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
  npm install --no-optional --production

  # In case autoremove fails to delete the files, delete them explicitly.
  find . -name "*.gz" -delete
  find . -name "*.pem" -delete

  cp -v $1 app.js
}

add_android_platform()
{
  echo "Adding Android platform into ${TEST_PROJECT_NAME}"

  cd $TEST_PROJECT_ROOT_DIR

  cordova platform add android

  # A file that identifies the current build as a UT build
  touch platforms/android/unittests
}

build_android()
{
  echo "Building Android app"

  cd $TEST_PROJECT_ROOT_DIR

  cordova build android --release --device
}

# Adds iOS platform when we're running on macOS
add_ios_platform_if_possible()
{
  if [ $IS_DARWIN_PLATFORM == true ]; then
    echo "Adding iOS platform into ${TEST_PROJECT_NAME}"

    cd $TEST_PROJECT_ROOT_DIR

    cordova platform add ios

    # A file that identifies the current build as a UT build
    touch platforms/ios/unittests
  fi
}

# Builds iOS platform when we're running on macOS
build_ios_if_possible()
{
  if [ $IS_DARWIN_PLATFORM == true ]; then
    echo "Building iOS app"

    cd $TEST_PROJECT_ROOT_DIR

    # cordova really doesn't have any flexibility in making builds via CLAIM
    # they're using their xcconfig that doesn't work in our case
    # in ideal case we just run the command below
    # `cordova build ios --device`
    #
    # in our case we have to build directly using xcode cli
    # since we have some required project settings
    # we've analyzed `cordova build` source code
    # and emulated it's behaviour
    #
    # according to cordova build documentation
    # it's a shortcut for `cordova prepare` + `cordova compile`
    # so we have to run cordova prepare and xcodebuild then

    cordova prepare ios --device

    TEST_PROJECT_DIR=$TEST_PROJECT_ROOT_DIR/platforms/ios
    TEST_PROJECT_PATH=$TEST_PROJECT_DIR/$TEST_PROJECT_NAME.xcodeproj

    echo "Building project: ${TEST_PROJECT_PATH}"

    (\
    cd $TEST_PROJECT_DIR && \
    xcodebuild \
      -xcconfig $REPO_ROOT_DIR/thali/install/ios/build-ci.xcconfig \
      -project $TEST_PROJECT_NAME.xcodeproj \
      -target $TEST_PROJECT_NAME \
      -configuration Debug \
      -destination 'platform=iOS' \
      build \
      CONFIGURATION_BUILD_DIR="${TEST_PROJECT_DIR}/build/device" \
      SHARED_PRECOMPS_DIR="${TEST_PROJECT_DIR}/build/sharedpch" \
    )
  fi
}

# Please note that functions order is important
IPADDRESS=${2:-}
prepare_project ${IPADDRESS}
add_android_platform
add_ios_platform_if_possible
install_thali $1 ${IPADDRESS}
build_android
build_ios_if_possible

echo "Remember to start the test coordination server by running jx index.js"
