'use strict';

var ResultsProcessor = require('../../../TestServer/ResultsProcessor.js');
var tape = require('../lib/thaliTape');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

test('should be able to process valid results without exceptions', function (t) {
  var testResults = [
    {
      'data': {
        'name:': 'LGE-Nexus 5_PT7062',
        'result': 'OK',
        'sendList': [
          {
            'connections': 3,
            'dataAmount': 100000,
            'dataReceived': 100000,
            'doneRounds': 1,
            'name': '90:E7:C4:FC:13:3C',
            'result': 'OK',
            'time': 57792,
            'tryCount': 1
          }
        ],
        'time': 119819
      },
      'device': 'LGE-Nexus 5_PT7062',
      'test': 0,
      'time': 120073
    },
    {
      'data': {
        'name:': 'HTC-HTC6535LVW_PT3841',
        'result': 'OK',
        'sendList': [
          {
            'connections': 2,
            'dataAmount': 100000,
            'dataReceived': 100000,
            'doneRounds': 5,
            'name': 'F8:95:C7:13:51:1E',
            'result': 'OK',
            'time': 30550,
            'tryCount': 1
          }
        ],
        'time': 115137
      },
      'device': 'HTC-HTC6535LVW_PT3841',
      'test': 0,
      'time': 115231
    },
    {
      'data': {
        'name:': 'A5-1',
        'time': 10005,
        'result': 'TIMEOUT',
        'sendList': []
      },
      'device': 'A5-1',
      'test': 0,
      'time': 100051
    }
  ];
  var testDevices = {
    'LGE-Nexus 5_PT7062': {},
    'HTC-HTC6535LVW_PT3841': {},
    'A5-1': {}
  };
  var processedResults = ResultsProcessor.process(testResults, testDevices);
  t.ok(processedResults, 'received processed results');
  t.end();
});
