var config = {

  userConfig : {
  },

  testConfig : {
    "testSendData.js" : {
    "serverTimeout": 1200000,
    "timeout": 1000000,
    "rounds": 1,
    "dataTimeout": 10000,
    "dataAmount": 100000,
    "conReTryTimeout": 5000,
    "conReTryCount": 5
    },

    "testFindPeers.js" : {
      "serverTimeout": 1200000,
      "timeout": 1000000,
      "rounds": 1,
      "dataTimeout": 10000,
      "dataAmount": 100000,
      "conReTryTimeout": 5000,
      "conReTryCount": 5
    },

    "testReConnect.js" : {
      "serverTimeout": 1200000,
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
