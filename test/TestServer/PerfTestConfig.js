var config = {

  userConfig : {
    ios : { 
      numDevices : 2
    },
    android : {
      numDevices : 2
    }
  },

  testConfig : {
    "testSendData.js" : {
    "servertimeout": 1200000,
    "timeout": 1000000,
    "rounds": 1,
    "dataTimeout": 10000,
    "dataAmount": 100000,
    "conReTryTimeout": 5000,
    "conReTryCount": 5
    },

    "testFindPeers.js" : {
      "servertimeout": 1200000,
      "timeout": 1000000,
      "rounds": 1,
      "dataTimeout": 10000,
      "dataAmount": 100000,
      "conReTryTimeout": 5000,
      "conReTryCount": 5
    },

    "testReConnect.js" : {
      "servertimeout": 1200000,
      "timeout": 1000000,
      "rounds": 1,
      "dataTimeout": 10000,
      "dataAmount": 100000,
      "conReTryTimeout": 5000,
      "conReTryCount": 5
    }
  } 
};

module.exports = config;
