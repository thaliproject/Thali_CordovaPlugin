'use strict';

var objectAssign = require('object-assign');
var http = require('http');
var https = require('https');

var net = require('net');
var tls = require('tls');

// used by forever-agent to create SSL connections
tls.connect = net.connect;

[
  'Server',
  'globalAgent',
  'Agent',
].forEach(function (prop) {
  https[prop] = http[prop];
});

function equalBuffers(b1, b2) {
  if (b1.length !== b2.length) {
    return false;
  }
  for (var i = 0; i < b1.length; i++) {
    if (b1[i] !== b2[i]) {
      return false;
    }
  }
  return true;
}

https.createServer = function (options) {
  var args = Array.prototype.slice.call(arguments, 1);
  var requestListener = null;
  if (options.pskCallback) {
    if (typeof options.pskCallback !== 'function') {
      throw new Error('pskCallback must be a function');
    }
    console.log('Created https with pskCallback');
    requestListener = function (request) {
      var valid = false;
      var pskId = request.headers.pskidentity;
      var rawPskKey = request.headers.pskkey;
      console.log('SERV psk id:', pskId);
      console.log('SERV raw key:', rawPskKey);
      if (pskId && rawPskKey) {
        var pskKey = new Buffer(rawPskKey, 'base64');
        console.log('SERV key:', pskKey.toString());
        var realPskKey = options.pskCallback(pskId);
        if (realPskKey && equalBuffers(pskKey, realPskKey)) {
          valid = true;
        }
      }
      if (!valid) {
        request.connection.authorized = false;
        request.connection.destroy();
      } else {
        request.connection.authorized = true;
        request.connection.pskIdentity = pskId;
      }
    };
  }
  var server =  http.createServer.apply(http, args);
  if (requestListener) {
    var subscribers = server._events && server._events.request;
    if (subscribers) {
      if (!Array.isArray(subscribers)) {
        subscribers = [subscribers];
      }
      subscribers.unshift(requestListener);
      server._events.request = subscribers;
    } else {
      server.on('request', requestListener);
    }
  }
  return server;
};

https.request = function (options, callback) {
  // options = objectAssign({}, options);
  // console.log('REQ ←', options);
  var agent = options.agent || { options: {} };
  var pskKey = options.pskKey || agent.options.pskKey;
  var pskIdentity = options.pskIdentity || agent.options.pskIdentity;
  if (pskKey || pskIdentity) {
    options = objectAssign({}, options);
    options.headers = objectAssign({
      pskkey: Buffer.isBuffer(pskKey) ? pskKey.toString('base64') : pskKey,
      pskidentity: pskIdentity,
    }, options.headers);
  }
  // console.log('REQ →', options);
  return http.request(options, callback);
};
