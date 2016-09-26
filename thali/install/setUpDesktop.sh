#!/usr/bin/env bash

set -euo pipefail

NORMAL_COLOR='\033[0m'
RED_COLOR='\033[0;31m'

OUTPUT() {
  echo -e "${RED_COLOR}$BASH_COMMAND FAILED - setUpDesktop failure${NORMAL_COLOR}"
}

trap OUTPUT ERR

NVM_NODEJS_ORG_MIRROR=https://jxcore.azureedge.net
export NVM_NODEJS_ORG_MIRROR
JX_NPM_JXB=jxb311
export JX_NPM_JXB

cd `dirname $0`
cd ../../test/TestServer
jx npm install --no-optional
jx generateServerAddress.js
cd ../../thali
jx npm install --no-optional
jx npm link
cd install
jx npm install
node validateBuildEnvironment.js
cd ../../test/www/jxcore
jx npm link thali
jx npm install --no-optional
