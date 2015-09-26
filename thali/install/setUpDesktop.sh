#!/usr/bin/env bash
cd ..
jx npm install
jx npm link
cd ../test/www/jxcore
jx npm link thali
jx npm install
