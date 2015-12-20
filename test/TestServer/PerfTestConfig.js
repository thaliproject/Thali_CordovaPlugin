var config = {

  userConfig : {
    "ios" : {
      "startTimeout": 120000
    },
    "android" : { 
      "startTimeout": 120000
    }
  },
  
  testConfig : [
    {
      "name": "testFindPeers.js",
      "serverTimeout": 1200000,
      "timeout": 1000000,
      "rounds": 1,
      "dataTimeout": 10000,
      "dataAmount": 100000,
      "conReTryTimeout": 5000,
      "conReTryCount": 5
    },
    {
      "name": "testSendData.js",
      "serverTimeout": 1200000,
      "timeout": 1000000,
      "rounds": 1,
      "dataTimeout": 20000,
      "dataAmount": 100000,
      "conReTryTimeout": 5000,
      "conReTryCount": 5
    }
  ] 
};

module.exports = config;
