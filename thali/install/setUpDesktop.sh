#!/usr/bin/env bash

NODEJS_ORG_MIRROR=https://jxcore.azureedge.net
export NODEJS_ORG_MIRROR
JX_NPM_JXB=jxb311
export JX_NPM_JXB

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
npm install --no-optional
