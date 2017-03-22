'use strict';

var tape = require('../lib/thaliTape');
var proxify = require('thali/NextGeneration/utils/proxify');
var net = require('net');
var http = require('http');
var transform = require('thali/NextGeneration/utils/transform');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

if (tape.coordinated) {
  return;
}

test('basic', function (t) {
  var server = net.createServer(function (socket) {
    console.log('server got connection');
    socket.pipe(socket);
  });
  server.listen(9123, '127.0.0.1', function () {
    proxify.forward(server.address())
      .then(function (proxy) {
        var port = proxy.address().port;
        t.notEqual(port, 9123);

        console.log('Test connecting to', port);
        var client = net.connect(port, function () {
          console.log('Test connected to', port);
          var data = 'hello';
          var received = '';

          client.on('data', function (chunk) {
            received += chunk;
            if (received.length >= data.length) {
              client.end();
              server.close();
              proxy.close();
              t.equal(data, received);
              t.end();
            }
          });
          client.on('error', t.end);

          client.write(data);
        });
      })
      .catch(t.end);
  });
});

test('transform', function (t) {
  var data = 'hello';
  // var expectedServerData = 'gdkkn';
  var expectedServerData = '68656c6c6f';
  var server = net.createServer(function (socket) {
    var r = '';
    socket.on('data', function (chunk) {
      r += chunk;
      if (r.length >= expectedServerData.length) {
        t.equal(r, expectedServerData);
        socket.write(r);
      }
    });
  });
  server.listen(9124);

  proxify.forward(server.address(), {
    transform: transform
  }).then(function (proxy) {
    var port = proxy.address().port;
    t.notEqual(port, 9124);

    var client = net.connect(port);

    var received = '';
    client.on('data', function (chunk) {
      received += chunk;
      if (received.length >= data.length) {
        client.end();
        server.close();
        proxy.close();
        t.equal(data, received);
        t.end();
      }
    });
    client.on('error', t.end);

    client.write(data);
  }).catch(t.end);
});

test('double transform', function (t) {
  var data = 'hello';
  // var expectedServerData = 'gdkkn';
  var expectedServerData = 'hello';
  var server = net.createServer(function (socket) {
    var r = '';
    socket.on('data', function (chunk) {
      r += chunk;
      if (r.length >= expectedServerData.length) {
        t.equal(r, expectedServerData);
        socket.write(r);
      }
    });
  });
  server.listen(9125, '127.0.0.1');

  var serverOptions = {
    transform: {
      encode: transform.decode,
      decode: transform.encode
    }
  };

  var clientOptions = {
    transform: transform // { encode: encode, decode: decode }
  };

  var serverProxy, clientProxy, serverProxyPort, clientProxyPort;

  proxify.forward({
    address: '127.0.0.1',
    port: 9125,
  }, serverOptions)
  .then(function (proxy) {
    serverProxy = proxy;
    serverProxyPort = proxy.address().port;
    return proxify.forward(proxy.address(), clientOptions);
  }).then(function (proxy) {
    clientProxy = proxy;
    clientProxyPort = proxy.address().port;

    t.notEqual(serverProxyPort, 9125);
    t.notEqual(clientProxyPort, 9125);
    t.notEqual(serverProxyPort, clientProxyPort);

    var client = net.connect(clientProxyPort);

    var received = '';
    client.on('data', function (chunk) {
      received += chunk;
      if (received.length >= data.length) {
        client.end();
        server.close();
        serverProxy.close();
        clientProxy.close();
        t.equal(data, received);
        t.end();
      }
    });
    client.on('error', t.end);

    client.write(data);
  }).catch(t.end);
});

test('http encode', function (t) {
  var sendData = 'Hello World';

  var server = http.createServer(function (request, response) {
    request.pipe(response);
    request.on('data', function (chunk) {
      console.log('SERVER GOT:', chunk.toString());
    });
  });
  var serverProxy, clientProxy;

  var serverOptions = {
    transform: {
      encode: transform.decode,
      decode: transform.encode,
    }
  };
  var clientOptions = {
    transform: {
      encode: transform.encode,
      decode: transform.decode,
    }
  };

  server.listen(0, function () {
    var address = server.address();
    console.log('Test server:', address);
    proxify.forward({
      address: '127.0.0.1',
      port: address.port,
    }, serverOptions)
      .then(function (sp) {
        serverProxy = sp;
        var address = serverProxy.address();
        console.log('Server Proxy:', address);
        return proxify.forward(address, clientOptions);
      })
      .then(function (cp) {
        clientProxy = cp;
        var address = clientProxy.address();
        console.log('Client Proxy:', address);
        var request = http.request({
          hostname: address.address,
          port: address.port,
          method: 'POST'
        });
        request.on('response', function (response) {
          var r = '';
          response.on('data', function (c) { r+=c; });
          response.on('end', function () {
            t.equal(r, sendData);
            server.close();
            serverProxy.close();
            t.end();
          });
        });
        request.end(sendData);
      });
  });
});
