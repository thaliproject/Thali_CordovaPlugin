#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

ERROR_ABORT()
{
  if [[ $? != 0 ]]; then
    exit -1
  fi
}

# Check the platform we are running
IS_MINIGW_PLATFORM=false
IS_DARWIN_PLATFORM=false

if test x"$(uname -s | cut -c 1-5)" == xMINGW ; then
  echo "Running in MinGW Platform"

  IS_MINIGW_PLATFORM=true
elif test x"`uname`" = xDarwin ; then
  echo "Running in Darwin Platform"

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
  echo "Preparing ${TEST_PROJECT_NAME} Cordova project"

  cd $REPO_ROOT_DIR/test/TestServer
  npm install --no-optional
  node generateServerAddress.js $2

  cd $REPO_ROOT_DIR/..
  cordova create $TEST_PROJECT_NAME com.test.thalitest $TEST_PROJECT_NAME;ERROR_ABORT
  mkdir -p $TEST_PROJECT_NAME/thaliDontCheckIn/localdev;ERROR_ABORT

  if [ $IS_MINIGW_PLATFORM == true ]; then
      # The thali package might be installed as link and there will
      # be troubles later on if this link is tried to be copied so
      # remove it here.
      rm -rf $REPO_ROOT_DIR/test/www/jxcore/node_modules/thali;ERROR_ABORT
      cp -R $REPO_ROOT_DIR/test/www/ $TEST_PROJECT_NAME/;ERROR_ABORT
  else
      rsync -a --no-links $REPO_ROOT_DIR/test/www/ $TEST_PROJECT_NAME/www;ERROR_ABORT
  fi

  cd $REPO_ROOT_DIR/thali/install/SSDPReplacer
  npm install --no-optional
  cd $REPO_ROOT_DIR/../$TEST_PROJECT_NAME
  cordova plugin add $REPO_ROOT_DIR/thali/install/SSDPReplacer
}

install_thali()
{
  echo "Installing Thali into ${TEST_PROJECT_NAME}"

  cd $TEST_PROJECT_ROOT_DIR/www/jxcore;ERROR_ABORT
  node installCustomPouchDB.js;ERROR_ABORT
  jx npm install $REPO_ROOT_DIR/thali --save --no-optional --production;ERROR_ABORT
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
  npm install --no-optionall --production;ERROR_ABORT

  # In case autoremove fails to delete the files, delete them explicitly.
  find . -name "*.gz" -delete
  find . -name "*.pem" -delete

  cp -v $1 app.js;ERROR_ABORT
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

  cordova build android --release --device;ERROR_ABORT
}

# Adds iOS platform when we're running on macOS
add_ios_platform_if_possible()
{
  if [ $IS_DARWIN_PLATFORM == true ]; then
    echo "Adding iOS platform into ${TEST_PROJECT_NAME}"

    cd $TEST_PROJECT_ROOT_DIR

    cordova platform add ios;ERROR_ABORT

    # A file that identifies the current build as a UT build
    touch platforms/ios/unittests;ERROR_ABORT
  fi
}

# Builds iOS platform when we're running on macOS
build_ios_if_possible()
{
  if [ $IS_DARWIN_PLATFORM == true ]; then
    echo "Building iOS app"

    cd $TEST_PROJECT_ROOT_DIR

    cordova build ios --device;ERROR_ABORT

  fi
}

# Please note that functions order is important
prepare_project $1 $2
add_android_platform
# add_ios_platform_if_possible
install_thali $1 $2
build_android
# build_ios_if_possible
# TODO: iOS builds are disabled temporarily

echo "Remember to start the test coordination server by running jx index.js"
