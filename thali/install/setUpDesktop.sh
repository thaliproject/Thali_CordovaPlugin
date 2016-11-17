#!/usr/bin/env bash

echo "start setUpDesktop.sh"

pushd "$(dirname $0)" > /dev/null
SCRIPT_PATH="$(pwd -P)"
popd > /dev/null

source "$SCRIPT_PATH/include.sh/build-dep.sh"

set -euo pipefail

trap 'log_error $LINENO' ERR


NVM_NODEJS_ORG_MIRROR=https://jxcore.azureedge.net
export NVM_NODEJS_ORG_MIRROR
JX_NPM_JXB=jxb311
export JX_NPM_JXB

if running_on_ci; then
  node thali/install/updateEnvironmentSettings.js
fi

echo "Setup TestServer"
cd `dirname $0`
cd ../../test/TestServer
npm install --no-optional
node generateServerAddress.js

echo "Install Thali Root"
cd ../../thali
jx npm install --no-optional
npm link

echo "Install Thali Install Directory"
cd install
npm install --no-optional
node validateBuildEnvironment.js

echo "Final Desktop Step"
cd ../../test/www/jxcore
npm link thali
node installCustomPouchDB.js
jx npm install --no-optional

echo "end setUpDesktop.sh"
