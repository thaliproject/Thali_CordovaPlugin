//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root
//  for full license information.
//

'use strict';

/* jshint esversion: 6 */

const exec = require('child_process').execSync;
const fs = require('fs');
const os = require('os');
const path = require('path');

function updateCommonGypies() {
  const nodeGypSettingsPath = path.join(os.homedir(), `.node-gyp`);

  if (!fs.exists(nodeGypSettingsPath)) {
    console.log(`${nodeGypSettingsPath} doesn't exist`);
  }

  const nodeGypSettingsFiles = fs.readdirSync(nodeGypSettingsPath);
  if (nodeGypSettingsFiles.length === 0) {
    console.log(`.node-gyp folder is empty`);
  }

  nodeGypSettingsFiles
    .reduce((files, name) => {
      return files.concat([
        path.join(nodeGypSettingsPath, name, `include`, `node`, `common.gypi`),
        path.join(nodeGypSettingsPath, name, `common.gypi`)
      ]);
    }, [])
    .forEach((filePath) => {
      if (!fs.exists(filePath)) {
        return;
      }

      const contents = fs.readFileSync(path, `utf8`);

      if (contents.indexOf('node_win_onecore') !== -1) {
        return;
      }

      const updatedContents = contents.replace(
        `'variables': {`,
        `'variables': {\n    'node_win_onecore': 'false', # see https://github.com/thaliproject/Thali_CordovaPlugin/issues/1509`
      );

      fs.writeFileSync(path, updatedContents);
    });
}

function cleanupSettings() {
  const homeDir = os.homedir();

  [
    path.join(homeDir, '.jx'),
    path.join(homeDir, '.jxc'),
    path.join(homeDir, '.node-gyp')
  ]
  .filter(filePath => fs.exists(filePath))
  .forEach((filePath) => {
    console.log(`Removing ${filePath}`);

    fs.removeSync(filePath);
  });
}

function prepareSettings() {
  exec(`jx install leveldown-mobile`);
  exec(`jx uninstall leveldown-mobile`);

  exec(`npm install leveldown-mobile`);
  exec(`npm uninstall leveldown-mobile`);
}

function updateSettings() {
  updateCommonGypies();
}

// run if we were called from the command line
if (require.main === module) {
  try {
    console.log(`Settings update started`);

    cleanupSettings();
    prepareSettings();
    updateSettings();

    console.log(`Settings update completed`);
  } catch (error) {
    console.log(`Settings update failed: ${error}`);
  }
}
