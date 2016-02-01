# Instructions for members of the Thali Development team

The following document records information of use to people who are developing the Thali project. Those using the Thali project don't need
to worry about the contents of this file.

## How this all connects together

We are trying to version, as one, what are actually two different systems. One system is NPM as used in JXCore. The other is
the Cordova plugin.

We have made the decision to drive the management process from NPM in the JXCore folder. This means that to install Thali
both into JXCore and into Cordova one must go to www/jxcore in the app project and do a `jx install`. This will install Thali's
Javascript files from NPM but it will also run a post install script that will then install Thali's Cordova plugin.

Normally to update a NPM one issues `jx install` or `jx npm update` and that will update the Javascript files.
That applies here as well, however, in addition the install script run from the NPM install is also smart enough to figure out if the Cordova plugin
needs to be updated and if so it will handle that as well.

To keep things somewhat clean we have inside of Thali's NPM directory a subdirectory called install. This isolates all the install
logic that has nothing to do with actually using Thali on a device. We then use a cordova post prepare script to remove this
directory before we publish so it doesn't end up on the device.

For all of this to work we have to have files in at least four different places:

* __NPM__ - We own the thali NPM module and we use `npm publish` from the thali sub-directory to publish there.
* __Thali_CordovaPlugin__ - This is our GIT repro from which we pull down the cordova plugin bytes
* __JXCore_CordovaPlugin__ - Our plugin has a dependency in its plugin.xml on JXCore's Cordova plugin
* __BinTray__ - We have our own bintray available [here](https://bintray.com/thali/Thali) where we publish the btconnectorlib2 JAR for Android

## Managing a new release

The release preparations start from updating the dependency in the thali NPM package. This is needed
so that the NPM package installations picks up the matching version of the Thali Cordova plugin.

The file at `thali/install/install.js` has a variable `thaliBranchName` inside the function it exports.
The value must be matching to the release you are about to make, for example, `npmv2.0.4`.

There are different levels that the version can be bumped to.
Please read the [version](https://docs.npmjs.com/cli/version) docs to understand the choices and make sure
you read up on [semver](http://semver.org/).

The right version must also be updated to `thali/package.json`, for example, `2.0.4`.

After the versions are updated, the release should be tagged in git. This can be done with something like
`git tag npmv2.0.4`.

Then, the changes done should be pushed to git and in addition, the new tag needs to be pushed as well with
`git push --tags`.

Next step is to create a release in GitHub:
1. Go to the releases tab on the front page of the project on GitHub
2. Hit 'Draft a new release'
3. In 'Tag version' enter the right tag, for a NPM release this will be the NPM tag that was generated above and should already be in the tag list on GitHub. For example, `npmv2.0.4`. If you got the tag right, then GitHub will say 'Existing Tag'.
4. Enter a release title, typically this is something like "Story X - Y"
5. Enter a description that briefly specifies what functionality or bug fixes were added
6. For now make sure to check "This is a pre-release"
7. Hit publish release!

Now there is the right version of the Cordova plugin in the location from which the NPM package installation
can pick it up.

### Updating NPM

1. Navigate to the thali sub-directory
2. Run `git status` and make sure it is clean
3. Run `npm publish`

If you want to verify the release package before publishing it, you can use `npm pack` to create a tgz file.
Then, you can point `jx install` into this tgz to install the package locally and make sure the installation
works properly and the matching version of the Thali Cordova plugin got installed.

### The rest of the process
1. Write up a blog article for Thali's blog (this will be auto-reposted to Twitter)
2. Go to [stories](https://github.com/thaliproject/thali/blob/gh-pages/stories.md) and mark the story as completed. This requires both marking it completed in the table of contents and then use `~~` wrappers to strike out the entry in the body.
3. Go to internal metrics spreadsheet and add the release to both the shared code and blog tabs.

## Want to develop locally?

When writing code for Cordova one often finds oneself writing code directly inside the Cordova project one is testing with and then having
to remember to move all the content back to Thali_CordovaPlugin. It's annoying. To work around this do the following:

1. Go to your application project and create a subdirectory called `thaliDontCheckIn`
2. Then create a directory called `localdev` under `thaliDontCheckIn`
3. Now when you want to build your project with a new version of Thali_CordovaPlugin:
 1. Go to your App's www/jxcore subdirectory
 2. issue `jx install ../../../Thali_CordovaPlugin/thali --save`

Note that we do depend in other places on your Thali_CordovaPlugin directory being a sibling of your application's root.

## Windows Prerequisites

If you are using Windows to run the system with [PouchDB](pouchdb.com/), you will need to use [node-gyp](https://github.com/TooTallNate/node-gyp) to compile [leveldown](https://github.com/Level/leveldown)

The following software is required:
- Visual Studio 2013/2015
- Python 2.7.x

Follow the [node-gyp installation documentation](https://github.com/TooTallNate/node-gyp#installation) to ensure that Python is properly set.  The easiest way for Python to work is to have it set in your PATH environment variable.

To change the version of Visual Studio used, use the `--msvs_version` option during the installation, for example to use Visual Studio 2015:
```
$ jx install --msvs_version=2015
```

## Android Requirements

We use Maven to distribute an AAR we need to support Bluetooth and Wi-Fi on Android. The instructions below specify how to build the AAR and develop with it locally.

### Use Gradle

For the command line build process, you should use gradle. Set the system environment variable `ANDROID_BUILD` to `gradle`.

### Build the P2P library to local Maven

#### Install Maven locally
Follow the instructions here: http://maven.apache.org/download.cgi

#### Clone the Thali Cordova Plugin library
`$ git clone https://github.com/thaliproject/Thali_CordovaPlugin_BtLibrary.git`  

#### Build the Thali Cordova Plugin library
At the root of the Thali Cordova Plugin Library that you just git cloned:  

`$ cd BtConnectorLib`

Note: On OS X (and probably Linux) the gradlew file is cloned without execution permissions. So you have to run:

`$ chmod u+x gradlew`

before you will be able to run the next command.

`$ ./gradlew build install`  

Once built the library should be visible in:  
`<user folder>\.m2\repository\org\thaliproject\p2p\btconnectorlib\btconnectorlib2\0.0.1`

Once built the library should be visible in:  
`<user folder>\.m2\repository\org\thaliproject\p2p\btconnectorlib\btconnectorlib2\0.0.1`

## Developing node specific code and tests for the Thali Cordova Plugin
Please see the Thali_CordovaPlugin/test/README.md
