# Thali Cordova Plugin

This project is a work in progress and not yet production-level quality.

The Thali Cordova Plugin is a [Cordova](http://cordova.apache.org/) plugin for building peer-to-peer (P2P) networking apps on Android and iOS.

The Thali Cordova Plugin is layered on the [JXcore Cordova plugin](https://github.com/jxcore/jxcore-cordova), which uses [JXcore](http://jxcore.com/home/) to allow one to build mobile applications in JavaScript for Node.js.  

## Prerequisites

### Android

Download [Android Studio](http://developer.android.com/sdk/index.html) or the latest `android-sdk`

On Mac OS `android-sdk` can be installed from [brew](http://brew.sh/):
```
brew install android-sdk
```

Make sure to set your `ANDROID_HOME` environment variable:

If you have already installed `android-sdk` the correct `ANDROID_HOME` environment variable was set automatically.

Otherwise set `ANDROID_HOME` environment variable manually:

Mac OS X (put in your `~/.bash_profile` file):
```
export ANDROID_HOME=/<installation location>/android-sdk
export PATH=${PATH}:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

Linux (put in your `~/.bashrc` file):
```
export ANDROID_HOME=/<installation location>/android-sdk
export PATH=${PATH}:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

Windows:
```
set ANDROID_HOME=C:\<installation location>\Android\sdk
set PATH=%PATH%;%ANDROID_HOME%\tools;%ANDROID_HOME%\platform-tools
```


`<installation location>` can vary on different platforms but it's something that containes `android` in path and with folders inside like `etc`, `platforms`,`samples`,`tools` and so on.

Real life Mac OS `~/.bash_profile` example:
```
export ANDROID_HOME=/usr/local/Cellar/android-sdk/24.4.1_1/
export PATH=${PATH}:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```
Above `<installation location>` is `/usr/local/Cellar/android-sdk/24.4.1_1/`

Current API target level is `android-21`

### iOS

Download [Xcode 6](https://developer.apple.com/xcode/), or later.

## Getting Started

### Install latest JXCore

The installation guide for JXCore 3.1.2 on Mac OS and Windows can be found [here](https://github.com/thaliproject/jxbuild/blob/master/distribute.md).

The latest version of JXCore 3.1.2b only for Mac OS can be downloaded from [here](https://jxcore.blob.core.windows.net/jxcore-release/jxcore/0312b/release/jx_osx64v8.zip)

To check the version of the current JXCore installation run:
```
$ jx -jxv
v 0.3.1.2b
```

### Install Cordova

(Check the [Android Platform Guide](https://cordova.apache.org/docs/en/4.0.0/guide_platforms_android_index.md.html#Android%20Platform%20Guide)
and [iOS Platform Guide](https://cordova.apache.org/docs/en/4.0.0/guide_platforms_ios_index.md.html#iOS%20Platform%20Guide) for detailed instructions.)

```
$ sudo jx npm install -g cordova
```

### Create a Cordova project

```
$ cordova create ThaliTest com.test.thalitest ThaliTest
```

### Using the Thali Cordova Plugin

To use Thali in a Cordova project one must do the following:

1. Make sure to add whatever platforms you are using in Cordova using `cordova platform add` (android | ios)
2. Add a subfolder to www named jxcore (case sensitivity matters)
3. Inside the jxcore folder create the app.js for your application
4. Inside the jxcore folder create the package.json for your application
 * `jx npm init` provides an easy to use wizard that will create a basic package.json file
5. Inside the jxcore folder run the command `jx npm install thali --autoremove "*.gz" --save`
6. Make sure to run `cordova build` as this is critical to moving key files into place

Now you can run your app. The Android devices need to have OS version Lollipop or later for things to work properly
(Thali uses class `BluetoothLeAdvertiser`, which was added in API level 21). Android 6.0 "Marshmallow" introduced
a new permissions model where the user has to approve use of dangerous permission while the app is running.
Thali Cordova Plugin requires ACCESS_COARSE_LOCATION which needs user approval. This approval can be requested calling
window.ThaliPermissions.requestLocationPermission() function. ThaliPermissions API locates at www/android/thaliPermissions.js.

Note that Thali uses a subdirectory in your project called thaliDontCheckin to manage certain downloads. Per the name of the directory, please don't check it in to your repro.

If you want to upgrade to a newer version of Thali_CordovaPlugin all you have to do is just edit your package.json
with the version you want and then run 'jx npm install'. This will automatically update the Javascript files as well
as uninstall the old plugin and install the new plugin.

### Documentation

The following API documentation is available for the Thali Cordova Plugin:
- [Thali Cordova Connectivity API](doc/api/connectivity.md)
- [`ThaliReplicationManager` class](doc/api/thalireplicationmanager.md)
- [`ThaliEmitter` internal class](doc/api/thaliemitter.md)

### Contributing

If you see a mistake, find a bug, or you think there is a better way to do something, feel free to contribute.
Email [thali-talk@thaliproject.org](mailto:thali-talk@thaliproject.org) to connect with other contributors and
get started with Thali.

### Code of Conduct
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

### License

Copyright (c) 2015 Microsoft

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
