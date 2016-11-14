# Thali Cordova Plugin

This project is a work in progress and not yet production-level quality.

The Thali Cordova Plugin is a [Cordova](http://cordova.apache.org/) plugin for building peer-to-peer (P2P) networking apps on Android and iOS.

The Thali Cordova Plugin is layered on the [JXcore Cordova plugin](https://github.com/jxcore/jxcore-cordova), which uses [JXcore](http://jxcore.com/home/) to allow one to build mobile applications in JavaScript for Node.js.  

# The hacky work around instructions for using Thali in a Cordova project

One day the instructions in the rest of this document will be true. But right
now we are really focused on just getting the code to behave itself and not on
making it easy to use. We hope to fix that. But until then here are the
instructions we use to build Cordova projects that use the Thali Cordova Plugin.

First off we aren't publishing to NPM right now. So that means you have to build
the Thali Cordova plugin yourself. To get the instructions on how to do that
please head over to test/README.md and follow the directions in the sections
entitled 'Installing software' and 'Running your own NPM registry'.

From there you need to create your cordova project and install Thali into it.
To do that I assume you are at the command line and are starting at the
directory which contains the clone of Thali_CordovaPlugin.

```
cordova create FooBar com.example.foobar FooBar
```

The previous command will create a new Cordova project called FooBar in a
directory of the same name in the namespace com.example.foobar. If you already
have an existing Cordova project you want to add Thali to then you can skip
the previous command. But you have to make sure that Thali_CordovaPlugin is a
sibling directory to the one that contains your Cordova project. Note that for
this and all other commands, if you have your own existing Cordova project,
then please substitute 'FooBar' with the directory name of your Cordova project.

```
mkdir -p FooBar/thaliDontCheckIn/localdev
```

The previous command creates a directory inside of the Cordova project. This
directory is a flag to Thali's install logic that tells us to pull the Thali code
from a local clone of Thali_CordovaPlugin (that MUST be a sibling directory to
the Cordova project) rather than trying to get it from NPM.

```
cd FooBar
cordova platform add android
mkdir www/jxcore
cd www/jxcore
vi app.js
```

The commands above take us into the Cordova project, add android (iOS isn't
working yet so isn't in these instructions) and then create the www/jxcore
directory. That directory is where all of your node code will live. In that
directory you will create your app.js file that will launch your node code when
your Cordova project is run. I used vi just to show that I created, edited and
saved that file.

```
jx npm init
```

We are still inside of FooBar/www/jxcore and now we are running the script
that MUST be run before installing thali since a bug in our installer.
In other case install will fail. This script will go away as soon as
installed fixed.

```
../../../Thali_CordovaPlugin/thali/install/setUpDesktop.sh
```

We are still inside of FooBar/www/jxcore and now we are dealing with creating a
package.json. If you don't already have a package.json, this will create one for
you. If you already have a package.json then you can skip the previous command.

```
jx npm install ../../../Thali_CordovaPlugin/thali/ --save --no-optional --autoremove "*.gz"
```

This is the command, still in FooBar/www/jxcore, that actually installs
Thali_CordovaPlugin. This command does a dizzying variety of things including
setting up the Cordova environment with Thali's specific extensions as well as
setting up the www/jxcore node app with all of Thali's dependencies.

```
jx npm install --no-optional --autoremove "*.gz"
```

Once you have Thali installed this next command will install anything else you
have hanging out in your package.json.

```
find . -name "*.gz" -delete
```

You may have noticed above we have commands '--autoremove "*.gz"'. These are a
special command in JXcore that does exactly what the line above does. However
we have noticed that the command doesn't always seem to work so we just use the
line above to be sure. The point of this command is that Android gets very unhappy
if one tries to build an APK with gz files in it so we nuke 'em' before build.

```
cordova build android --release --device
```

And now we are ready to build! This assumes that you already have whatever
content you want in your /www directory and in your /www/jxcore directory.

Now you are probably wondering - what now? The next step is to actually put in
some code into that app.js and related files that uses Thali. Doing that is
tricky and we will need to write an intro guide. But for now I would head over to
test/www/jxcore/bv_tests/testThaliManagerCoordinated.js. This is the file that
we use to test Thali all up. It shows how to use the only class you have to
interact with to use Thali, thaliManager. Look for 'new ThaliManager(' and
also look at the thaliManager.js file which contains JSDOC.

The basic idea is that you have to give us the version of ExpressPouchDB you
want us to use as well as the version of PouchDB. In the case of ExpressPouchDB
head over to test/www/jxcore/package.json and see what version of ExpressPouchDB
and Pouchdb we are using. Put those *exact* versions into your package.json.
Don't worry if they look funky, we sometimes build our custom versions and stick
them in Sinopia when we are building so everything should work if you followed
the instructions above.

In addition we assume the PouchDB object you give us is configured with the
right directory for us to open databases and that you have set the default
adapter to LeveldownMobile.

The command to do this yourself looks like:

```Javascript
PouchDB = PouchDBGenerator(PouchDB, defaultDirectory, {
  defaultAdapter: LeveldownMobile
});
```

Where PouchDB is the PouchDB object your required. defaultDirectory is the
place you want to stick the DB and the last argument sets the adapter for
leveldownMobile. So you can just pass the above into thaliManager for the PouchDB
argument.

In Thali's model we use local radios to sync exactly one database (it's a silly
restriction but we are trying to do less for the moment). The name of that
database is submitted in the next argument. The name is submitted because for
a variety of reasons having to do with how remote synching is handled we have to
create our own instance of PouchDB pointing at the named DB. This doesn't however
restrict use of the same DB by code running in Node outside of Thali. PouchDB
is 'multi-access' safe within a single running instance of Node. So you can
party on the DB at the same time we are and it should all be fine.

After that is the device's own public key. This is used to identify the device
 to other devices.

```Javascript
var ecdhForLocalDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
var publicKeyForLocalDevice = ecdhForLocalDevice.generateKeys();
```

Again, see testThaliManagerCoordinated.js for the relevant includes. The code
above creates a new public key object with a specific curve, then generates a
public/private key pair matching that curve. We have to use this specific curve
so don't change it.

Note that the private key can be retrieved via getPrivateKey() and stored
somewhere secure on the device. This key will be needed the next time the device
runs to create a new ECDH object in the future using setPrivateKey(). Note that
JXcore runs an old version of node so to get accurate docs on how it handles
crypto please refer
[here](https://github.com/jxcore/jxcore/blob/master/doc/api/crypto.markdown).

The point is that once a device generates a public/private key pair for itself
it is expected that the device will continue to use the same key pair in the
future. Otherwise we can't reliably discover other devices.

After the public key comes a particularly tricky piece of code, the Thali Peer
Pool Manager. See the thaliPeerPoolInterface for details. For now you can start
with the thaliPeerPoolDefault.js whose behavior is incredibly inefficient and
will burn down your batteries and kill your bandwidth, but it's a start. We'll
need to write a fairly length article to explain all the things that the peer
pool manager has to do.

Finally, the last argument specifies what kind of networking you want Thali to
support. The enum for this value is defined in thaliMobile.networkTypes. For
now just set it to WIFI but you can also play with NATIVE. Right now we have
show stopper bugs on both so expect some rough going. Eventually the right
solution for everyone will be BOTH (which tells us to use both local WiFi access
points and the native radios). But we aren't there yet.

Once you have created the ThaliManager object then the next step is to actually
start it. Unsurprisingly this is done with a method called (wait for it) start.
However it's argument is extremely important. It is an array of buffers that
contain ECDH public keys. This is the list of public keys for other devices
that this device should both advertise information for and seek information
from. The public keys that go into this array are the value returned above
for publicKeyForLocalDevice. Now, the obvious question is, how did device A
get the public keys for devices B, C, D, etc.? The answer is - we don't know. :)

Eventually we'll bring back the identity exchange infrastructure that lets one
exchange public keys securely between devices but our current primary customer,
Rockwell Automation, doesn't need that functionality. They will actually sync the
public keys via the Rockwell cloud. So their app depends on devices having, at
some point, connected to the cloud in order to download a list of public keys.
If you don't happen to have a handy cloud then you need to figure out your own
solution for how to distribute the keys. Anyone wanting to resurrect the identity
exchange code can contact us via any of the mechanisms listed [here](http://thaliproject.org/WaysToContribute/).
Alternatively you can just cheat. Set up an open PouchDB/CouchDB server some
place and have devices sync their keys there and then sync down from that server
all the other device's keys. It's a hack to get you going.

Any time the list of keys change the start method needs to be called again. Also
note that we currently limit the number of keys we'll handle to 15. But this
value can be set in thaliConfig.js.

When you are ready for Thali to stop using up the device's batteries via radios
you can call 'stop'.

That is about it. If it works then anything you stick into the database you
gave us the name for should be sync'd to the other devices you told us about
if they are around and vice versa.

## Useful commands to run Android apps via command line

### Build

```
cordova build android --release --device
```

### Sign unsigned

`cordova build` creates unsigned _apk_. So in order to install the _apk_ into device
you need to sign the _apk_.

Please note that `build-tools` should be at least `24.0.3`.
Because this guide uses tool `apksigner` that is available starting
from `build-tools` `24.0.3`.

You should have keystore file before running the command below.

```
/usr/local/opt/android-sdk/build-tools/24.0.3/apksigner sign --ks path/to/keystore/file path/to/unsigned.apk
```

### Get devices list

You need to know device serial number or qualifier to install build into device
via command line. The command below lists all connected devices with their
qualifiers (first value in each line).

```
adb devices -l
```

### Install onto device and debug

```
adb -s DEVICE_QUALIFIER install -r path/to/signed.apk
```

Please note using `logcat` if you need providing the team with the logs from devices.

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

The installation guide for JXCore 3.1.6 on Mac OS and Windows can be found [here](https://github.com/thaliproject/jxbuild/blob/master/distribute.md).

The latest version of JXCore 3.1.6 only for Mac OS can be downloaded from [here](https://jxcore.blob.core.windows.net/jxcore-release/jxcore/0316/release/jx_osx64v8.zip)

To check the version of the current JXCore installation run:
```
$ jx -jxv
v 0.3.1.6
```

### Install Cordova

(Check the [Android Platform Guide](https://cordova.apache.org/docs/en/4.0.0/guide_platforms_android_index.md.html#Android%20Platform%20Guide)
and [iOS Platform Guide](https://cordova.apache.org/docs/en/4.0.0/guide_platforms_ios_index.md.html#iOS%20Platform%20Guide) for detailed instructions.)

```
$ npm install -g cordova@6.3.1
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

### Troubleshooting

In case of Thali failures do the following first.

1. Go into cloned Thali folder and execute the following command `find . -name "node_modules" -type d -exec rm -r "{}" \;`. __WARNING: Use `rm -r` with caution it deletes the folder and all its contents__.
2. `rm -r ~/.jx`
3. `rm -r ~/.jxc`
4. `rm -r ~/.node-gyp`

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
