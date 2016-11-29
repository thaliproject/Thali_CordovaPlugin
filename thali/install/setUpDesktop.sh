#!/usr/bin/env bash

echo "Start setUpDesktop.sh"

NVM_NODEJS_ORG_MIRROR=https://jxcore.azureedge.net
export NVM_NODEJS_ORG_MIRROR
JX_NPM_JXB=jxb311
export JX_NPM_JXB

# Exit immediately if a command exits with a non-zero status.
set -e

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

echo "Final Desktop Step"
cd ../../test/www/jxcore
npm link thali
node installCustomPouchDB.js
jx npm install --no-optional

echo "End setUpDesktop.sh"
