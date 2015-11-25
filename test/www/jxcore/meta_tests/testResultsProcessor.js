'use strict';

var ResultsProcessor = require('../../../TestServer/ResultsProcessor.js');
var tape = require('../lib/thali-tape');

var test = tape({
  setup: function(t) {
    t.end();
  },
  teardown: function(t) {
    t.end();
  }
});

test('#should be able to process valid results without exceptions', function (t) {
  var testResults = [
    {
        'data': {
            'name:': 'LGE-Nexus 5_PT7062',
            'result': 'OK',
            'sendList': [
                {
                    'connections': 2,
                    'name': 'F8:95:C7:13:51:1E',
                    'result': 'OK',
                    'time': 49921,
                    'tryCount': 1
                }
            ],
            'time': 119819
        },
        'device': 'LGE-Nexus 5_PT7062',
        'test': 0,
        'time': 120073
    }
  ];
  var testDevices = {
      'LGE-Nexus 5_PT7062': {}
  };
  var processedResults = ResultsProcessor.process(testResults, testDevices);
  t.ok(processedResults, 'received processed results');
  t.end();
});
