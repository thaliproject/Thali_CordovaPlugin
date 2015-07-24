# Thali Cordova Plugin

This project is a work in progress and not yet production-level quality.

The Thali Cordova Plugin is a [Cordova](http://cordova.apache.org/) plugin for building peer-to-peer (P2P) networking apps on Android and iOS.

The Thali Cordova Plugin is layered on the [JXcore Cordova plugin](https://github.com/jxcore/jxcore-cordova), which uses [JXcore](http://jxcore.com/home/) to allow one to build mobile applications in JavaScript for Node.JS.  

## Prerequisites

### Android

Download [Android Studio](http://developer.android.com/sdk/index.html)

Make sure to set your `ANDROID_HOME` environment variable:

Mac OS X (put in your `~/.bash_profile` file):
```
export ANDROID_HOME=~/Library/Android/sdk
export PATH=${PATH}:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

Linux (put in your `~/.bashrc` file):
```
export ANDROID_HOME=/<installation location>/Android/sdk
export PATH=${PATH}:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

Windows:
```
set ANDROID_HOME=C:\<installation location>\Android\sdk
set PATH=%PATH%;%ANDROID_HOME%\tools;%ANDROID_HOME%\platform-tools
```

### iOS

Download [Xcode 6](https://developer.apple.com/xcode/), or later.

## Getting Started

### Install latest JXCore

Follow the instructions at [http://jxcore.com/downloads/](http://jxcore.com/downloads/). When you're done, check that the
installation worked:
```
$ jx -jxv
v Beta-0.3.0.3
```

### Install Cordova

(Check the [Android Platform Guide](https://cordova.apache.org/docs/en/4.0.0/guide_platforms_android_index.md.html#Android%20Platform%20Guide)
and [iOS Platform Guide](https://cordova.apache.org/docs/en/4.0.0/guide_platforms_ios_index.md.html#iOS%20Platform%20Guide) for detailed instructions.)

```
$ sudo jx install -g cordova
```

### Create a Cordova project

```
$ cordova create ThaliTest com.test.thalitest ThaliTest
```

### Android Requirements

#### Use Gradle

For the command line build process, you should use gradle. Set the system environment variable `ANDROID_BUILD` to `gradle`.

#### Build the P2P library to local Maven

##### Install Maven locally
Follow the instructions here: http://maven.apache.org/download.cgi

##### Clone the Thali Cordova Plugin library
`$ git clone https://github.com/thaliproject/Thali_CordovaPlugin_BtLibrary.git`  

##### Build the Thali Cordova Plugin library
At the root of the Thali Cordova Plugin Library that you just git cloned:  

`$ cd BtConnectorLib`

Note: On OS X (and probably Linux) the gradlew file is cloned without execution permissions. So you have to run:

`$ chmod u+x gradlew`

before you will be able to run the next command.

`$ ./gradlew build install`  

Once built the library should be visible in:  
`<user folder>\.m2\repository\org\thaliproject\p2p\btconnectorlib\btconnectorlib2\0.0.0`


Once built the library should be visible in:  
`<user folder>\.m2\repository\org\thaliproject\p2p\btconnectorlib\btconnectorlib2\0.0.0`

### Using the Thali Cordova Plugin

Follow the instructions below to use the Thali Cordova Plugin on Android and iOS.

#### Android

1. Add the Android platform
   * `$ cd ThaliTest`
   * `cordova platform add android`
2. Add the plugin
   * `cordova plugin add https://github.com/thaliproject/Thali_Cordovaplugin`
4. Fix issue on can not replace existing file
   * from `ThaliTest\plugins\org.thaliproject.p2p\src\android\java\io\jxcore\node` copy
   the `JXcoreExtension.java` to `ThaliTest\platforms\android\src\io\jxcore\node`
(replace file, or copy the plug-in code and add it to existing file)
5. Build the project
   * `cordova build android`

#### iOS

All commands are issued from the the root of the project folder.

1. Add the Thali Cordova Plugin to the Cordova project:
 * `~/Code/ThaliTest> cordova plugin add https://github.com/thaliproject/Thali_CordovaPlugin.git`
2. Add the iOS platform:
 * `~/Code/ThaliTest> cordova platform add ios`
3. Copy Thali Cordova Plugin sample to the Cordova project:
 * `~/Code/ThaliTest> cp -a -R -v plugins/org.thaliproject.p2p/sample/ios/www ./`
4. Build Cordova:
 * `~/Code/ThaliTest> cordova build`
3. Open the iOS Cordova project in Xcode
 * (e.g. `<project_root>/platforms/ios/ThaliTest.xcodeproj`)
 * `~/Code/ThaliTest> open platforms/ios/ThaliTest.xcodeproj`

### Unit Testing the Thali Cordova Plugin

The Thali Cordova plugin uses the [Tape](https://www.npmjs.com/package/tape) tap-producing test harness for node and browsers.

#### Desktop Testing

Testing is available on the desktop for the Thali Cordova Plugin which uses a mock object to simulate the native Cordova `Mobile` calls.

To ensure the test files are up to date, run the following in the project root which copies the files to the test proper test directory.
```
$ npm test
```

To run the tests navigate to Thali_CordovaPlugin/test/www/jxcore/test and run
```
$ jx install
$ jx thaliemitterspec.js
```

### Mobile Testing

Testing is also available on the mobile devices as well.  This will use the regular `Mobile` calls directly through Cordova to talk to the underlying system.

To ensure the test files are up to date, run the following in the project root which copies the files to the test proper test directory.
```
$ npm test
```

To get started, copy the files from `plugins/org.thaliproject.p2p/test/www` to the `www` folder of your Cordova project.

Next, inside the `www/jxcore` root folder of your Cordova project, install the requirements for testing:
```
$ jx install
```

Finally, build the application using `cordova build` and run it on your device. The test results should be shown in your developer console.

### Documentation

The following API documentation is available for the Thali Cordova Plugin:
- [Thali Cordova Connectivity API](doc/api/connectivity.md)
- [`ThaliReplicationManager` class](doc/api/thalireplicationmanager.md)
- [`ThaliEmitter` internal class](doc/api/thaliemitter.md)

### Contributing

If you see a mistake, find a bug, or you think there is a better way to do something, feel free to contribute.
Email [thali-talk@thaliproject.org](mailto:thali-talk@thaliproject.org) to connect with other contributors and
get started with Thali.

### License

Copyright (c) 2015 Microsoft

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
