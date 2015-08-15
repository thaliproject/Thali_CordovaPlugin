Thali Cordova Plugin
This project is a work in progress and not yet production-level quality.

The Thali Cordova Plugin is a Cordova plugin for building peer-to-peer (P2P) networking apps on Android and iOS.

The Thali Cordova Plugin is layered on the JXcore Cordova plugin, which uses JXcore to allow one to build mobile applications in JavaScript for Node.JS.

Prerequisites

Android

Download Android Studio

Make sure to set your ANDROID_HOME environment variable:

Mac OS X (put in your ~/.bash_profile file):

export ANDROID_HOME=~/Library/Android/sdk
export PATH=${PATH}:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
Linux (put in your ~/.bashrc file):

export ANDROID_HOME=/<installation location>/Android/sdk
export PATH=${PATH}:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
Windows:

set ANDROID_HOME=C:\<installation location>\Android\sdk
set PATH=%PATH%;%ANDROID_HOME%\tools;%ANDROID_HOME%\platform-tools
iOS

Download Xcode 6, or later.

Getting Started

Install latest JXCore

Follow the instructions at http://jxcore.com/downloads/. When you're done, check that the installation worked:

$ jx -jxv
v Beta-0.3.0.3
Install Cordova

(Check the Android Platform Guide and iOS Platform Guide for detailed instructions.)

$ sudo jx install -g cordova
Create a Cordova project

$ cordova create ThaliTest com.test.thalitest ThaliTest
Using the Thali Cordova Plugin

To use Thali in a Cordova project one must do the following:

Make sure to add whatever platforms you are using in Cordova using cordova platform add (android | ios)
Add a subfolder to www named jxcore (case sensitivity matters)
Inside the jxcore folder create the app.js for your application
Inside the jxcore folder create the package.json for your application
jx npm init provides an easy to use wizard that will create a basic package.json file
Inside the jxcore folder run the command jx install thali --save
In the www/jxcore directory run find . -name "*.gz" -delete
This step will go away in an upcoming release of JXCore that will support the --autoremove "*.gz" switch
Make sure to run cordova build as this is critical to moving key files into place
Yes, an exception did get thrown during the build. No, it isn't harmful. No, we haven't quite figured out why it gets thrown, the verbose debug logs aren't saying anything useful.
Now you can run your app.

Note that Thali uses a subdirectory in your project called thaliDontCheckin to manage certain downloads. Per the name of the directory, please don't check it in to your repro.

If you want to upgrade to a newer version of Thali_CordovaPlugin all you have to do is just edit your package.json with the version you want and then run 'jx install'. This will automatically update the Javascript files as well as uninstall the old plugin and install the new plugin.

Documentation

The following API documentation is available for the Thali Cordova Plugin:

Thali Cordova Connectivity API
ThaliReplicationManager class
ThaliEmitter internal class
Contributing

If you see a mistake, find a bug, or you think there is a better way to do something, feel free to contribute. Email thali-talk@thaliproject.org to connect with other contributors and get started with Thali.

License

Copyright (c) 2015 Microsoft

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.