#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

cd `dirname $0`
cd ../../test/TestServer
jx npm install
jx generateServerAddress.js
cd ../../thali
jx npm install
jx npm link
cd install
jx npm install
cd ../../test/www/jxcore
jx npm link thali
jx npm install
