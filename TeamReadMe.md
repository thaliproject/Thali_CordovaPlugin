# Instructions for members of the Thali Development team

The following document records information of use to people who are developing the Thali project. Those using the Thali project don't need
to worry about the contents of this file.

## How this all connects together

We are trying to version, as one, what are actually two different systems. One system is NPM as used in JXCore. The other is
the Cordova plugin.

We have made the decision to drive the management process from NPM in the JXCore folder. This means that to install Thali
both into JXCore and into Cordova one must go to www/jxcore in the app project and do a `jx install`. This will install Thali's
Javascript files from NPM but it will also run a post install script that will then install Thali's Cordova plugin.

Normally to update a NPM one issues `jx npm install` or `jx npm update` and that will update the Javascript files. That applies here
as well. However in addition the install script run from the NPM install is also smart enough to figure out if the Cordova plugin
needs to be updated and if so it will handle that as well.

To keep things somewhat clean we have inside of Thali's NPM directory a subdirectory called install. This isolates all the install
logic that has nothing to do with actually using Thali on a device. We then use a cordova post prepare script to remove this
directory before we publish so it doesn't end up on the device.

A final note is that for all of this to work we have to have files in at least four different places:
__NPM__ - We own the thali NPM module and we use `npm publish` from the thali sub-directory to publish there.
__Thali_CordovaPlugin__ - This is our GIT repro from which we pull down the cordova plugin bytes
__JXCore_CordovaPlugin__ - Our plugin has a dependency in its plugin.xml on JXCore's Cordova plugin
__BinTray__ - We have our own bintray available [here](https://bintray.com/thali/Thali) where we publish the btconnectorlib2 JAR for Android

## Want to develop locally?

When writing code for Cordova one often finds oneself writing code directly inside the Cordova project one is testing with and then having
to remember to move all the content back to Thali_CordovaPlugin. It's annoying. To work around this do the following:

1. Go to your application project and create a subdirectory called thaliDontCheckIn
2. Then create a directory called localdev under thaliDontCheckIn
3. Now when you want to build your project with a new version of Thali_CordovaPlugin:
 1. Go to your App's www/jxcore subdirectory
 2. issue `jx npm install ../../../Thali_CordovaPlugin/thali --save`

Note that we do depend in other places on your Thali_CordovaPlugin directory being a sibling of your application's root.

## Android Requirements

We use Maven to distribute an AAR we need to support Bluetooth and Wi-Fi on Android. The instructions below specify how to build the
AAR and develop with it locally.

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
`<user folder>\.m2\repository\org\thaliproject\p2p\btconnectorlib\btconnectorlib2\0.0.0`

Once built the library should be visible in:  
`<user folder>\.m2\repository\org\thaliproject\p2p\btconnectorlib\btconnectorlib2\0.0.0`


## Unit Testing the Thali Cordova Plugin

The Thali Cordova plugin uses the [Tape](https://www.npmjs.com/package/tape) tap-producing test harness for node and browsers.

### Desktop Testing

Testing is available on the desktop for the Thali Cordova Plugin which uses a mock object to simulate the native Cordova `Mobile` calls.

To ensure the test files are up to date, run the following in the project root which copies the files to the test proper test directory.
```
$ jx npm test
```

To run the tests navigate to Thali_CordovaPlugin/sample/www/jxcore/test and run
```
$ jx install
$ jx thaliemitterspec.js
```

### Mobile Testing

Testing is also available on the mobile devices as well.  This will use the regular `Mobile` calls directly through Cordova to talk to the 
underlying system.

To ensure the test files are up to date, run the following in the project root which copies the files to the test proper test directory.
```
$ jx npm test
```

To get started, copy the files from `plugins/org.thaliproject.p2p/sample/www` to the `www` folder of your Cordova project.

Next, inside the `www/jxcore` root folder of your Cordova project, install the requirements for testing:
```
$ jx install
```

Finally, build the application using `cordova build` and run it on your device. The test results should be shown in your developer console.