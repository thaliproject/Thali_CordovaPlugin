'use strict';

var net = require('net');
var Promise = require('bluebird');

function pip(i, o) {
  // return i.pipe(o);
  // var log = console.log.bind(console, tag);
  i.on('data', function (d) {
    // log('data:', d.toString());
    o.write(d);
  });
  i.on('error', function () {
    // log('err:', err.message);
    if (o.destroy) {
      o.destroy();
    } else {
      o.end();
    }
  });
  i.on('finish', function () {
    // log('finish');
    o.end();
  });
  i.on('end', function () {
    // log('end');
    o.end();
  });
  i.on('close', function () {
    // log('close');
    o.end();
  });
  return o;
}

function defaultPipe (incoming, outgoing) {
  pip(incoming, outgoing, 'send');
  pip(outgoing, incoming, 'recv');
  // incoming.pipe(outgoing);
  // outgoing.pipe(incoming);
}

function transformPipe(transform, incoming, outgoing) {
  var inc = pip(incoming, transform.encode(), 'raw send');
  var out = pip(outgoing, transform.decode(), 'enc recv');
  pip(inc, outgoing, 'enc send');
  pip(out, incoming, 'raw recv');
  // inc.pipe(outgoing);
  // out.pipe(incoming);
}

function pipe(server, address, options) {
  if (!options) {
    options = {};
  }
  if (!address) {
    throw new Error('address required');
  }
  var pipeFn =
    options.pipe ? options.pipe :
    options.transform ? transformPipe.bind(null, options.transform) :
    defaultPipe;

  server.on('connection', function (incoming) {
    var o = {
      host: address.address,
      port: address.port,
    };
    // console.log('proxy got connection');
    // console.log('proxy connecting to:', o);
    var outgoing = net.connect(o, function () {
      // console.log('proxy connected to:', o);
    });
    pipeFn(incoming, outgoing, options);
  });
}

function forward (address, options) {
  var proxy = net.createServer();
  // console.log('set up proxy for', address);
  pipe(proxy, address, options);
  var promise = startListen(proxy);
  promise.proxy = proxy;
  return promise;
}

function startListen (proxy) {
  return new Promise(function (resolve, reject) {
    proxy.once('error', reject);
    proxy.listen(0, '127.0.0.1', function () {
      proxy.removeListener('error', reject);
      resolve(proxy);
    });
  });
}

exports.forward = forward;
