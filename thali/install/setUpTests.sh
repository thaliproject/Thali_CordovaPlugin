#!/usr/bin/env bash

echo ""
echo "start setUpTests.sh"

SCRIPT_PATH="$(cd "$(dirname "$0")"; pwd -P)"
source "$SCRIPT_PATH/include.sh/build-dep.sh"

set -euo pipefail

trap 'log_error $LINENO' ERR

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
  echo ""
  echo "start preparing ${TEST_PROJECT_NAME} Cordova project"

  IPADDRESS=${1:-}
  npm install --no-optional --production --prefix $REPO_ROOT_DIR/thali/install
  node $REPO_ROOT_DIR/thali/install/validateBuildEnvironment.js

  cd $REPO_ROOT_DIR/test/TestServer
  npm install --no-optional
  node generateServerAddress.js $IPADDRESS
  cd $REPO_ROOT_DIR/..
  cordova create $TEST_PROJECT_NAME com.test.thalitest $TEST_PROJECT_NAME
  mkdir -p $TEST_PROJECT_NAME/thaliDontCheckIn/localdev

  if is_minigw_platform; then
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

  echo "end preparing ${TEST_PROJECT_NAME} Cordova project"
  echo ""
}

install_thali()
{
  echo ""
  echo "start installing Thali into ${TEST_PROJECT_NAME}"

  cd $TEST_PROJECT_ROOT_DIR/www/jxcore
  node installCustomPouchDB.js
  jx install $REPO_ROOT_DIR/thali --save --no-optional
  find . -name "*.gz" -delete

  if is_minigw_platform; then
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
  echo ""
  echo "run supertest for Android"
  jx install --no-optional --production

  # In case autoremove fails to delete the files, delete them explicitly.
  find . -name "*.gz" -delete
  find . -name "*.pem" -delete

  echo "copying app.js"
  cp -v $1 app.js

  echo "end installing Thali"
  echo ""
}

add_android_platform()
{
  echo ""
  echo "start adding Android platform into ${TEST_PROJECT_NAME}"

  cd $TEST_PROJECT_ROOT_DIR

  cordova platform add android

  # A file that identifies the current build as a UT build
  touch platforms/android/unittests

  echo "end adding Android platform"
  echo ""
}

build_android()
{
  echo ""
  echo "start building ${TEST_PROJECT_NAME} Android app"

  cd $TEST_PROJECT_ROOT_DIR

  cordova build android --release --device

  echo "end building ${TEST_PROJECT_NAME} Android app"
  echo ""
}

# Adds iOS platform when we're running on macOS
add_ios_platform_if_possible()
{
  if is_darwin_platform; then
    echo ""
    echo "start adding iOS platform into ${TEST_PROJECT_NAME}"

    cd $TEST_PROJECT_ROOT_DIR

    cordova platform add ios

    # A file that identifies the current build as a UT build
    touch platforms/ios/unittests

    echo "end adding iOS platform"
    echo ""
  else
    echo "skip adding iOS platform"
    echo ""
  fi
}

# Builds iOS platform when we're running on macOS
build_ios_if_possible()
{
  if is_darwin_platform; then
    echo ""
    echo "start building ${TEST_PROJECT_NAME} iOS app"

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

    echo ""
    echo "building project: ${TEST_PROJECT_PATH}"

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

    echo "end building ${TEST_PROJECT_NAME} iOS app"
    echo ""
  fi
}

# Please note that functions order is important
IPADDRESS=${2:-}
prepare_project ${IPADDRESS}
add_android_platform
#add_ios_platform_if_possible
install_thali $1 ${IPADDRESS}
build_android
#build_ios_if_possible

echo "Remember to start the test coordination server by running jx index.js"
echo "end setUpTests.sh"
echo ""
