# Test Server

When running tests across multiple devices we have to make sure that the devices all start, run and stop at the same
time. This is necessary because devices run tests against each other. In other words Devices A and B will make requests
against each other over the network in order to test if things are working. If Device B should finish its tests
before Device A and shut itself down then Device A's tests will fail because B is no longer available.

To solve this we use the Test Server. The Test Server runs as a stand alone node.js program on some network location
that is accessible to all the test devices via local WiFi. We use the Test Server both for running device based
tests locally as well as for coordinating tests in the continuous integration environment.

The Test Server is a singleton Node.js process. It's IP address is written in a file called server-address.js that
is passed to all of the devices. When the devices run their tests they will use the IP address in that file to
find and communicate with the Test Server.

## Counting Devices
For tests to run properly the Test Server must wait for all devices to contact it and when it has the required number
of devices then the Test Server must tell them to run the test. But this begs an obvious question, how many devices
should the Test Server wait for?

This question seems simple but in practice it turns out to be quite complex. In the simplest case we actually pass to
the Test Server on the command line a JSON object of the form:

```Javascript
{ devices:
  {
    ios: 2,
    android: 2
  }
}
```

This tells the Test Server that it should expect 2 iOS devices and 2 android devices. And for simple local testing
this is sufficient.

But when testing in our continuous integration environment matters become much more complex. We have anywhere from 20
to 40 devices available during a test run and unfortunately deploying software to phones and having the phones run
properly is not a 100% reliable process. This creates real headaches since it means we may have say, 20 devices, but
for any particular test run only a portion of those devices might actually get installed and run properly. To make
matters worse we genuinely can't tell in the typical case if the reason that a device didn't run is because it had
one of the inexplicable errors that seem endemic to the phone platforms or if our code caused the device to break.

Our current proposed solution to this problem is that the Test Server will completely ignore the number of devices
that the CI system thinks are available. Instead the Test Server will start a timer. While that timer is running
the Test Server will accept connections from candidate devices who will report their name as part of the welcome ping.
Any devices that try to register with the Test Server after the timer has expired will be rejected.

![Test Server Message Flow](http://www.gravizo.com/g?
@startuml;
participant TestServer;
participant Device1;
participant Device2;
participant Device3;
TestServer -> TestServer : Start timer;
Device1 -> TestServer : send 'present' + { "os": "android" };
Device2 -> TestServer : send 'present' + { "os": "iOS" };
TestServer -> TestServer : Timer Expires;
TestServer -> Device1 : send 'start tests' + { "android": 1, "ios": 1 };
TestServer -> Device2 : send 'start tests' + { "android": 1, "ios": 1 };
Device3 -> TestServer : send 'present' + { "os": "iOS" };
TestServer -> Device3 : send 'too late';
@enduml;)

### Test Server Logic

The Test Server MUST read the JSON object passed to it on the command line when it is started. If that JSON object
contains the field `honorCount` set to "true" the Test Server MUST wait until exactly the specified number of
devices have sent `present` messages and only then send a `start tests` message.

```Javascript
{ devices:
  {
    ios: 3,
    android: 2
  },
  honorCount: true
}
```

In this case the Test Server MUST wait until exactly 3 iOS devices and 2 Android devices have sent `present` messages
and then the Test Server MUST send `start tests` messages. Both `present` and `start tests` are defined below.

If, in the example above, honorCount was set to something other than true or if it is completely absent then the
functionality described below MUST be used.

The purpose of honorCount is to enable local desktop testing to work without requiring the time outs or indeterminate
device count functionality specified below. The functionality described below is intended for use with the 
continuous integration framework.

If honorCount is not included on the command line or is not set to true then when the Test Server begins operation it 
MUST begin a timer. The timer MUST be started before the Test Server opens a port to accept incoming connections, this
will prevent race conditions. The Test Server MUST open a Web Socket listener on port 3000. Any messages other than 
`present` received on port 3000 while the timer is running MUST be rejected by sending a `error` message with a JSON 
object containing a field `errorDescription` and the value "message not acceptable in current Test Server state" and 
terminating the TCP/IP connection. 
 
If a `present` message is received by the Test Server on port 3000 while the timer is running then the Test Server MUST 
validate that the received message contains a JSON object with the field `os`. 
If the `os` field is missing then the Test Server MUST send an `error` message to the device with a JSON object
containing a field `errorDescription` and the value "malformed message", the Test Server MUST then terminate the TCP/IP
connection.

Once the timer has expired then any `present` messages received for the remaining life time of the Test Server instance's
existence MUST be rejected with a `too late` message and the contents of the `present` message MUST be ignored by the
Test Server.

Once the timer has expired the Test Server MUST send to all the devices for which it received a successful
`present` message a `start tests` message. The `start tests` message MUST contain a JSON object containing a field
for each of the received os types along with the total number of devices discovered with that os type.

Once the Test Server has completed the time out period and determined how many devices it will run subsequent tests
with it MUST wait for all of those devices to start and stop all tests. That is, there are no subsequent time out
periods for the remaining life of the Test Server instance. From that point on it will expect all tests to involve
the number of devices it discovered.

### Device Logic

When a device first starts running the test framework it MUST read its `server-address.js` file to find the IP address
of its designated Test Server and then it MUST connect to that Test Server over port 3000. If a connection cannot be
successfully established the device MUST retry establishing the connection until it either succeeds or the test code
is terminated on the device.

When establishing its first connection to the Test Server the device MUST send a `present` message along with a JSON
object containing the field `os`. The `os` field MUST be set to the device's os, supported values are "android" and
"ios".

Once the `present` message is sent to the Test Server the device MUST wait until it receives one of two possible
messages, either `start tests` or `too late`. 

If the device receives a `too late` message then the device MUST NOT
run any tests and MUST immediately call the end() method defined [here](https://github.com/thaliproject/TestDummy#basics-of-using-ci)
with 'false'.

If the device receives a `start tests` message then it MUST record the JSON object and make the value available to
the tests the device is running. The device MUST then start running tests.

### Future Work - Failing if we don't have enough devices
Currently the Test Server will run regardless of how many devices it finds. This is clearly sub-optimal. If too many
devices have failed then we shouldn't bother to run the test on that platform. But right now we need to get the
basics right so we can add this optimization later.
