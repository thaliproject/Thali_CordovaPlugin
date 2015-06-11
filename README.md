Thali p2p plug-in, requires jxcore plug-in (automatically installed with the plug-in)

<Work on progress, not near release quality !!>
### Goals
This project is intended to ;
 - create an easy to use p2p plug-in for JxCore (Android, iOS)

### pre-requirements
 1. You need to have Android SDK installed. You can get Android studio from: http://developer.android.com/sdk/index.html
 2. Follow the instructions here to install node.js, Cordova and whatever platforms you require (e.g. cordova plafrom add android).
  
### Additional requirements
1. For command line build process, you should use gradle, thus you need to set system environment variable ANDROID_BUILD to gradle

2. for android implementation you need to build the p2p library to local maven (development time only)

Get maven and install it locally: http://maven.apache.org/download.cgi

get the library from: https://github.com/thaliproject/Thali_CordovaPlugin_BtLibrary

go to root of the library project and build with "gradlew build install" and the library should be visible in <user folder>\.m2\repository\org\thaliproject\p2p\btconnectorlib\btconnectorlib2\0.0.0

### Usage

1. Create new project and add android platform
   * cordova create thaliTest com.test.thaliTest thaliTest
   * cd thaliTest
   * cordova platform add android
2. Fix manifest min-sdk issue
   * go to thaliTest\platforms\android and in AndroidManifest.xml change android:minSdkVersion="10" to android:minSdkVersion="16"
3. add the plugin
   * cordova plugin add https://github.com/thaliproject/Thali_Codovaplugin
4. Fix issue on can not replace existing file
   * from thaliTest\plugins\org.thaliproject.p2p\src\android\java\io\jxcore\node copy the JXcoreExtension.java to thaliTest\platforms\android\src\io\jxcore\node 
(replace file, or copy the plug-in code and add it to existing file)
5. Add example code into the app
   * from thaliTest\plugins\org.thaliproject.p2p\sample\www copy the content into thaliTest\www (replaces index.html and adds myScripts.js into the js folder, and also adds app.js to the jxcore folder)
6. Add nodejs modules into the app
   * go to www\jxcore\ folder and run "npm install" (there is package.json file specifying which modules are needed to be installed)
7. Remove any gz-file from the module packages (instaled by npm under the www/jxcore folder)
   * The build process fails if the gz files are present, thus search & delete them 
8. build the project 
   * cordova build android
9. run the example in device (note that for chat app, you do need at least two devices):
   * cordova run android

### Contribution
If you see a mistake / bug or you think there is a better way to do the things, feel free to contribute. This project considers the contributions under MIT license.
