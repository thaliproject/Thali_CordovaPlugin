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
      "name": "testSendData2.js",
      "serverTimeout": 120000,
      "dataAmount" : 10000
    }
  ] 
};

module.exports = config;
