var config = {

  userConfig : {
    "ios" : {
      "startTimeout": 3000,
    },
    "android" : {
      "startTimeout": 3000
    }
  },

  testConfig : [
    {
      "name": "testSendData.js",
      "serverTimeout": 15000,
      "timeout": 1000000,
      "rounds": 1,
      "dataTimeout": 10000,
      "dataAmount": 100000,
      "conReTryTimeout": 5000,
      "conReTryCount": 5
    }
  ]
};

module.exports = config;
