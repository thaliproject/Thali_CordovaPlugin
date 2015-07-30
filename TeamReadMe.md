# Instructions for members of the Thali Development team

The following document records information of use to people who are developing the Thali project. Those using the Thali project don't need
to worry about the contents of this file.

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