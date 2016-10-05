#!/usr/bin/env bash

NVM_NODEJS_ORG_MIRROR=https://jxcore.azureedge.net
export NVM_NODEJS_ORG_MIRROR
JX_NPM_JXB=jxb311
export JX_NPM_JXB

# Exit immediately if a command exits with a non-zero status.
set -e

cd `dirname $0`
cd ../../test/TestServer
npm install --no-optional
node generateServerAddress.js

cd ../../thali
jx npm install --no-optional
jx npm link

cd install
jx npm install --no-optional

cd ../../test/www/jxcore
jx npm link thali
jx installCustomPouchDB.js
jx npm install --no-optional
