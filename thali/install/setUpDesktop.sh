#!/usr/bin/env bash

echo "start setUpDesktop.sh"

SCRIPT_PATH="$(cd "$(dirname "$0")"; pwd -P)"
source "$SCRIPT_PATH/include.sh/build-dep.sh"

set -euo pipefail

trap 'log_error $LINENO' ERR


NVM_NODEJS_ORG_MIRROR=https://jxcore.azureedge.net
export NVM_NODEJS_ORG_MIRROR
JX_NPM_JXB=jxb311
export JX_NPM_JXB

echo "start preparing TestServer"
cd `dirname $0`
cd ../../test/TestServer
npm install --no-optional
node generateServerAddress.js
echo "end preparing TestServer"

echo "start installing Thali root"
cd ../../thali
jx npm install --no-optional
npm link
echo "end installing Thali root"

echo "start installing Thali install"
cd install
npm install --no-optional
node validateBuildEnvironment.js
echo "end installing Thali install"

echo "start preparing `test/www/jxcore`"
cd ../../test/www/jxcore
npm link thali
node installCustomPouchDB.js
jx npm install --no-optional
echo "end prepating `test/www/jxcore`"

echo "end setUpDesktop.sh"
