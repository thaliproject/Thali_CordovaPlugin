//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root
//  for full license information.
//

'use strict';

/* jshint esnext: true */

const exec = require('child-process-promise').exec;
const versions = require('./validateBuildEnvironment').versions;
const checkVersion = require('./validateBuildEnvironment').checkVersion;

// we assume that Node, npm, Homebrew already installed
const dependencies = [
  {
    name: `node`,
    commandKey: `node`,
    checkVersion: true,
    scripts: {
      preinstall: `npm install -g n`,
      install: `n ${versions.node}`,
    }
  },
  {
    name: `npm`,
    commandKey: `npm`,
    checkVersion: true,
    scripts: {
      install: `npm install -g npm@${versions.npm}`,
    }
  },
  {
    name: `cordova`,
    commandKey: `cordova`,
    checkVersion: true,
    scripts: {
      install: `npm install -g cordova@${versions.cordova}`,
    }
  },
  {
    name: `HomeBrew`,
    commandKey: `brew`,
    checkCommand: true,
    scripts: {
      install: `/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"`,
    }
  },
  {
    name: `Wget`,
    commandKey: `wget`,
    checkCommand: true,
    scripts: {
      install: `brew install wget`,
    }
  },
  {
    name: `Jxcore`,
    commandKey: `jxcore`,
    checkCommand: true,
    scripts: {
      install: `brew install homebrew-formula/jxcore.rb`,
    }
  },
  {
    name: `Java`,
    commandKey: `java`,
    checkCommand: true,
    scripts: {
      install: `brew cask install java`,
    }
  },
  {
    name: `Android SDK Manager`,
    commandKey: `android`,
    checkCommand: true,
    scripts: {
      install: `brew install android-sdk`,
      postinstall: `echo "$(brew --prefix)/opt/android-sdk" >> ~/.bashrc`
    }
  },
  {
    name: `Android SDK`,
    scripts: {
      install:
        `echo "y" | android update sdk --no-ui --all --filter \
          tools,\
          platform-tools,\
          extra-android-m2repository,\
          extra-google-m2repository,\
          build-tools-${versions.androidBuildTools},\
          android-${versions.androidPlatform}`
      }
  },
];

function logExecResult(result) {
  const { stdout, stderr } = result;

  if (stdout)  {
    console.log(stdout);
  }

  if (stderr)  {
    console.log(stderr);
  }
}

function installDependency(dependency) {
  if (!dependency.scripts.install) {
    return Promise.reject(`${dependency.name} scripts.install required`);
  }

  console.log(`Analyzing ${dependency.name}`);

  // please note that order is important
  const commands = [
    dependency.scripts.preinstall,
    dependency.scripts.install,
    dependency.scripts.postinstall
  ]
  .filter((command) => command);

  return commands
    .reduce((queue, command) => {
      return queue
        .then(() => exec(command))
        .then(logExecResult)
        .catch((error) => {
          throw new Error(`'${command}' script failed with ${error}`);
        });
    }, Promise.resolve());
}

function installDependencyIfNeeded(dependency) {
  console.log(`Installing ${dependency.name} if needed`);

  if (dependency.checkCommand) {
    return checkVersion(dependency.commandKey, ` `)
      .catch((error) => {
        console.log(error);

        return installDependency(dependency);
      });
  }

  if (dependency.checkVersion) {
    return checkVersion(dependency.commandKey)
      .catch((error) => {
        console.log(error);

        return installDependency(dependency);
      });
  }

  return installDependency(dependency);
}

function installDependencies(dependencies) {
  return dependencies
    .reduce((queue, dependency) => {
      return installDependencyIfNeeded(dependency)
        .catch((error) => {
          throw new Error(`${dependency.name} install failed\n\t
            ${error}`);
        });
    }, Promise.resolve());
}

// Detects if we were called from the command line
if (require.main === module) {
  installDependencies(dependencies)
    .then(() => {
      console.log(`Environment installed`);
      process.exit(0);
  })
  .catch((error) => {
    console.log(`Environment was not installed: ` + error);
    process.exit(-1);
  });
}
