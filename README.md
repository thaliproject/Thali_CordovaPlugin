# Thali Cordova Plugin

<Work on progress, not near release quality !!>
## Goals
The Thali Cordova Plugin is an easy-to-use Cordova plugin for building peer-to-peer (P2P) networking
apps on Android and iOS.

The Thali Cordova Plugin is layered on the JXcore Cordova plugin, which uses JXcore to allow one to build
mobile applicatons in JavaScript for Node.JS.  

## Prerequisites

* For Android, [Android Studio](http://developer.android.com/sdk/index.html)
* For iOS, [Xcode 6](https://developer.apple.com/xcode/), or later

## Getting Started

### Install latest Node.JS
Follow the instructions at [https://nodejs.org/](https://nodejs.org/). When you're done, check that the
installation worked:
```
~>   node -v
v0.12.2
~>   npm -v
2.7.4
```

### Install Cordova
(Check the [Android Platform Guide](https://cordova.apache.org/docs/en/4.0.0/guide_platforms_android_index.md.html#Android%20Platform%20Guide)
and [iOS Platform Guide](https://cordova.apache.org/docs/en/4.0.0/guide_platforms_ios_index.md.html#iOS%20Platform%20Guide) for detailed instructions.)
```
~> sudo npm install -g cordova
```

### Create a Cordova project
```
~/Code> cordova create ThaliTest com.test.thalitest ThaliTest
```

### Android Requirements

### Use Gradle
For the command line build process, you should use gradle. Set the system environment variable `ANDROID_BUILD` to `gradle`.

### Build the P2P library to local Maven

#### Install Maven locally
Follow the instructions here: http://maven.apache.org/download.cgi

#### Clone the Thali Cordova Plugin library
`git clone https://github.com/thaliproject/Thali_CordovaPlugin_BtLibrary.git`  

#### Build the Thali Cordova Plugin library
At the root of the Thali Cordova Plugin:  

`gradlew build install`  

Once built the library should be visible in:  
`<user folder>\.m2\repository\org\thaliproject\p2p\btconnectorlib\btconnectorlib2\0.0.0`

### Using the Thali Cordova Plugin

Follow the instructions below to use the Thali Cordova Plugin on Android and iOS.

#### Android

1. Add the Android platform
   * cd ThaliTest
   * cordova platform add android
2. Fix manifest min-sdk issue
   * go to ThaliTest\platforms\android and in AndroidManifest.xml change android:minSdkVersion="10" to
    android:minSdkVersion="16"
3. Add the plugin
   * cordova plugin add https://github.com/thaliproject/Thali_Codovaplugin
4. Fix issue on can not replace existing file
   * from ThaliTest\plugins\org.thaliproject.p2p\src\android\java\io\jxcore\node copy
   the JXcoreExtension.java to ThaliTest\platforms\android\src\io\jxcore\node
(replace file, or copy the plug-in code and add it to existing file)
5. Add example code into the app
   * from ThaliTest\plugins\org.thaliproject.p2p\sample\android\www copy the content
   into ThaliTest\www (replaces index.html with index.html adds sample.js into the js folder,
   and also adds app.js to the jxcore folder)
   NOTE: If you are trying to run the story -1 test then you need to copy 
   ThaliTest/plugins/org.thaliproject.p2p/test/sockettest.js to ThaliTest/www/jxcore. You also need
   to add a call to the test you want into ThaliTest/www/jxcore/app.js.
6. Add Node.js modules into the app
   * go to www\jxcore\ folder and run "npm install" (there is package.json file
   specifying which modules are needed to be installed)
7. Remove any gz-file from the module packages (instaled by npm under the www/jxcore folder)
   * The build process fails if the gz files are present, thus search & delete them
8. Build the project
   * cordova build android
9. Tun the example in device (note that for chat app, you do need at least two devices):
   * cordova run android

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

### Documentation

The following API documentation is available for the Thali Cordova Plugin:
- [Thali Cordova Connectivity API](doc/api/replication.md)
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
