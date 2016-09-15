#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

ERROR_ABORT() {
  if [[ $? != 0 ]]; then
    LOG $RED_COLOR "SetUp Desktop Failed\n"
    exit -1
  fi
}

node validateBuildEnvironment.js;ERROR_ABORT

NVM_NODEJS_ORG_MIRROR=https://jxcore.azureedge.net
export NVM_NODEJS_ORG_MIRROR
JX_NPM_JXB=jxb311
export JX_NPM_JXB

cd `dirname $0`;ERROR_ABORT
cd ../../test/TestServer;ERROR_ABORT
jx npm install;ERROR_ABORT
jx generateServerAddress.js;ERROR_ABORT
cd ../../thali;ERROR_ABORT
jx npm install --no-optional;ERROR_ABORT
jx npm link;ERROR_ABORT
cd install;ERROR_ABORT
jx npm install;ERROR_ABORT
cd ../../test/www/jxcore;ERROR_ABORT
jx npm link thali;ERROR_ABORT
jx npm install --no-optional;ERROR_ABORT
