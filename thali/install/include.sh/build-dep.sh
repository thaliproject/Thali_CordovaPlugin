#!/usr/bin/env bash

log_error() {
  local filename=$(basename "$0")
  local linenumber=${1}
  local code="${2:-1}"

  NORMAL_COLOR='\033[0m'
  RED_COLOR='\033[0;31m'

  echo ""
  echo -e "${RED_COLOR}error: command '${BASH_COMMAND}' failed with code ${code}, file '${filename}' on line ${linenumber}${NORMAL_COLOR}"
}

running_on_ci() {
  # Check the existence of the script that in CI gives the right test server
  # IP address.
  if [ -x "$(command -v CIGIVEMEMYIP.sh)" ]; then
    return 0
  else
    return 1
  fi
}

get_ci_ip_address() {
  if running_on_ci; then
    echo "$(CIGIVEMEMYIP.sh)"
  fi
}

is_darwin_platform() {
  if test x"`uname`" = xDarwin ; then
    return 0
  else
    return 1
  fi
}

is_minigw_platform() {
  if test x"$(uname -s | cut -c 1-5)" == xMINGW ; then
    return 0
  else
    return 1
  fi
}
