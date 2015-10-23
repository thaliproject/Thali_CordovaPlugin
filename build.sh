#!/bin/sh

### START - JXcore Test Server --------
### Testing environment prepares separate packages for each node.
### Package builder calls this script with each node's IP address
### Make sure multiple calls to this script file compiles the application file

NORMAL_COLOR='\033[0m'
RED_COLOR='\033[0;31m'
GREEN_COLOR='\033[0;32m'
GRAY_COLOR='\033[0;37m'

LOG() {
  COLOR="$1"
  TEXT="$2"
  echo -e "${COLOR}$TEXT ${NORMAL_COLOR}"
}


ERROR_ABORT() {
  if [[ $? != 0 ]]
  then
    LOG $RED_COLOR "compilation aborted\n"
    exit -1 
  fi
}
### END - JXcore Test Server   --------

# The build has sometimes failed with the default value of maximum open
# files per process, which is 256. Doubling it here to 512 to workaround
# that issue.
ulimit -n 512

# Remove the previous build result (if any) to start from a clean state.
rm -rf ../ThaliTest;ERROR_ABORT

# The line below is really supposed to be 'jx npm run setupUnit -- <the.right.ip.address>' but getting the last argument
# passed through npm run and then into sh script seems to be a step too far. Eventually we could use an
# intermediary node.js script to fix this but for now we'll just hack it.
thali/install/setUpTests.sh UnitTest_app.js $(CIGIVEMEMYIP.sh);ERROR_ABORT

# Remove the node_modules in the CI environment, because the coordination
# server may have different OS and CPU architecture than the build server
# so modules need to be installed there separately (this is handled by the CI).
rm -rf test/TestServer/node_modules;ERROR_ABORT
