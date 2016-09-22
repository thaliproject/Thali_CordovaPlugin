#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

cd `dirname $0`
cd ../../test/TestServer
npm install --no-optional
node generateServerAddress.js

cd ../../thali
npm install --no-optional
npm link

cd install
npm install --no-optional

cd ../../test/www/jxcore
npm link thali
# we need jx here. In other case it tries to download node (not jx) from NVM_NODEJS_ORG_MIRROR
NVM_NODEJS_ORG_MIRROR=https://jxcore.azureedge.net JX_NPM_JXB=jxb311 jx npm install --no-optional
