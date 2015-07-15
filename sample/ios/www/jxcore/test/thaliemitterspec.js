// Disable for on Android and iOS
var isMobile = true;
if (process.platform !== 'android' && process.platform !== 'ios') {
  require('../thali/mockmobile');
  isMobile = false;
}
var ThaliEmitter = require('../thali/thaliemitter');
var test = require('tape');

function noop () { }

// Only run on desktop
if (!isMobile) {

  test('#init should register the peerAvailabilityChanged event', function (t) {
    var emitter = new ThaliEmitter();

    emitter.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function (data) {
      t.equal(data[0].peerIdentifier, 12345);
      t.equal(data[0].peerName, 'foo');
      t.equal(data[0].peerAvailable, true);
      t.end();
    });

    Mobile.invokeNative(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, [{
      peerIdentifier: 12345,
      peerName: 'foo',
      peerAvailable: true
    }]);
  });

  test('#init should register the networkChanged event', function (t) {
    var emitter = new ThaliEmitter();

    emitter.on(ThaliEmitter.events.NETWORK_CHANGED, function (status) {
      t.equal(status.isAvailable, true);
      t.end();
    });

    Mobile.invokeNative(ThaliEmitter.events.NETWORK_CHANGED, {
      isAvailable: true
    });
  });
}

test('#startBroadcasting should call Mobile("StartBroadcasting") without an error', function (t) {
  var emitter = new ThaliEmitter();

  var deviceName = 'foo',
      port = 9001;

  emitter.startBroadcasting(deviceName, port, function (err) {
    !isMobile && t.equal(Mobile('StartBroadcasting').callNativeArguments[0], deviceName);
    !isMobile && t.equal(Mobile('StartBroadcasting').callNativeArguments[1], port);
    t.equal(err, undefined);
    t.end();
  });

  Mobile.invokeStartBroadcasting && Mobile.invokeStartBroadcasting();
});

if (!isMobile) {

  test('#startBroadcasting should call Mobile("StartBroadcasting") and handle an error', function (t) {
    var emitter = new ThaliEmitter();

    var deviceName = 'foo',
        port = 9001,
        errorMessage = 'fail';

    emitter.startBroadcasting(deviceName, port, function (err) {
      t.equal(Mobile('StartBroadcasting').callNativeArguments[0], deviceName);
      t.equal(Mobile('StartBroadcasting').callNativeArguments[1], port);
      t.equal(err.message, errorMessage);
      t.end();
    });

    Mobile.invokeStartBroadcasting(errorMessage);
  });
}

test('#startBroadcasting should call Mobile("StartBroadcasting") twice and throw an error', function (t) {
  var emitter = new ThaliEmitter();

  var deviceName = 'foo',
      port = 9001;

  emitter.startBroadcasting(deviceName, port, function (err) {

    t.throws(function () {
      emitter.startBroadcasting(deviceName, port, noop);
      Mobile.invokeStartBroadcasting && Mobile.invokeStartBroadcasting();
    });

    t.end();
  });

  Mobile.invokeStartBroadcasting && Mobile.invokeStartBroadcasting();
});

test('#stopBroadcasting should call Mobile("StopBroadcasting") and throw an error without Mobile("StartBroadcasting")', function (t) {
  var emitter = new ThaliEmitter();

  t.throws(function () {
    emitter.stopBroadcasting(noop);
    Mobile.invokeStopBroadcasting && Mobile.invokeStopBroadcasting();
  });

  t.end();
});

test('#stopBroadcasting should call Mobile("StopBroadcasting") without an error', function (t) {
  var emitter = new ThaliEmitter();

  var deviceName = 'foo',
      port = 9001;

  emitter.startBroadcasting(deviceName, port, function (err) {

    emitter.stopBroadcasting(function (err) {
      !isMobile && t.equal(Mobile('StopBroadcasting').callNativeArguments.length, 1);
      t.equal(err, undefined);
      t.end();
    });

    Mobile.invokeStopBroadcasting && Mobile.invokeStopBroadcasting();
  });

  Mobile.invokeStartBroadcasting && Mobile.invokeStartBroadcasting();
});

if (!isMobile) {
  test('#stopBroadcasting should call Mobile("StopBroadcasting") and handle an error', function (t) {
    var emitter = new ThaliEmitter();

    var deviceName = 'foo',
        port = 9001,
        errorMessage = 'fail';

    emitter.startBroadcasting(deviceName, port, function (err) {

      emitter.stopBroadcasting(function (err) {
        t.equal(Mobile('StopBroadcasting').callNativeArguments.length, 1);
        t.equal(err.message, errorMessage);
        t.end();
      });

      Mobile.invokeStopBroadcasting && Mobile.invokeStopBroadcasting(errorMessage);
    });

    Mobile.invokeStartBroadcasting && Mobile.invokeStartBroadcasting();
  });
}

test('#connect should call Mobile("Connect") with a port and without an error', function (t) {
  var emitter = new ThaliEmitter();

  var peerIdentifier = 123,
      errorMessage = null,
      port = 9001;

  emitter.connect(peerIdentifier, function (err, localPort) {
    !isMobile && t.equal(Mobile('Connect').callNativeArguments[0], peerIdentifier);
    !isMobile && t.equal(port, localPort);
    isMobile && t.ok(port >= 0);
    t.equal(err, null);
    t.end();
  });

  Mobile.invokeConnect && Mobile.invokeConnect(errorMessage, port);
});

if (!isMobile) {
  test('#connect should call Mobile("Connect") and handle an error', function (t) {
    var emitter = new ThaliEmitter();

    var peerIdentifier = 123,
        errorMessage = 'fail',
        port = 9001;

    emitter.connect(peerIdentifier, function (err) {
      t.equal(Mobile('Connect').callNativeArguments[0], peerIdentifier);
      t.equal(err.message, errorMessage);
      t.end();
    });

    Mobile.invokeConnect && Mobile.invokeConnect(errorMessage, port);
  });
}

test('#connect should call Mobile("Connect") twice with same peer identifier and throw an error', function (t) {
  var emitter = new ThaliEmitter();

  var peerIdentifier = 123,
      errorMessage = null,
      port = 9001;

  emitter.connect(peerIdentifier, function (err) {

    t.throws(function () {
      emitter.connect(peerIdentifier, noop);
      Mobile.invokeConnect && Mobile.invokeConnect(errorMessage, port);
    });

    t.end();

  });

  Mobile.invokeConnect && Mobile.invokeConnect(errorMessage, port);
});

test('#connect should call Mobile("Connect") twice with different peer identifier and not throw an error', function (t) {
  var emitter = new ThaliEmitter();

  var peerIdentifier1 = 123,
      peerIdentifier2 = 456,
      errorMessage = null,
      port = 9001;

  emitter.connect(peerIdentifier1, function (err) {

    t.doesNotThrow(function () {
      emitter.connect(peerIdentifier2, noop);
      Mobile.invokeConnect && Mobile.invokeConnect(errorMessage, port);
    });

    t.end();

  });

  Mobile.invokeConnect && Mobile.invokeConnect(errorMessage, port);
});

test('should call throw an error if Mobile("Disconnect") called before Mobile("Connects")', function (t) {
  var emitter = new ThaliEmitter();

  var peerIdentifier = 123;

  t.throws(function () {
    emitter.disconnect(peerIdentifier, noop);
    Mobile.invokeDisconnect && Mobile.invokeDisconnect();
  });

  t.end();

});

if (!isMobile) {

  test('should call Mobile("Disconnect") without an error', function (t) {
    var emitter = new ThaliEmitter();

    var peerIdentifier = 123,
        port = 9001;

    emitter.connect(peerIdentifier, function () {

      emitter.disconnect(peerIdentifier, function (err) {
        t.equal(Mobile('Disconnect').callNativeArguments[0], peerIdentifier);
        t.equal(err, undefined);
        t.end();
      });

      Mobile.invokeDisconnect && Mobile.invokeDisconnect();
    });

    Mobile.invokeConnect && Mobile.invokeConnect(null, port);
  });


  test('should call Mobile("Disconnect") and handle an error', function (t) {
    var emitter = new ThaliEmitter();

    var peerIdentifier = 123,
        port = 9001,
        errorMessage = 'fail';

    emitter.connect(peerIdentifier, function () {

      emitter.disconnect(peerIdentifier, function (err) {
        t.equal(Mobile('Disconnect').callNativeArguments[0], peerIdentifier);
        t.equal(err.message, errorMessage);
        t.end();
      });

      Mobile.invokeDisconnect(errorMessage);
    });

    Mobile.invokeConnect(null, port);
  });

}
