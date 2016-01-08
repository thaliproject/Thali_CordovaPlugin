var printFailedLine = function(what, failedPeers, notTriedPeers, successCount) {

  if (!notTriedPeers || !failedPeers || (failedPeers.length + successCount) <= 0) {
    return;
  }

  console.log(
    what + " failed peers count : " + failedPeers.length + " [" + 
    ((failedPeers.length * 100) / (successCount + failedPeers.length)) + " %]"
  );

  failedPeers.forEach(function(peer) {
    console.log("- Peer ID : " + peer.name + ", Tried : " + peer.connections);
  });

  console.log(
    what + " never tried peers count : " + notTriedPeers.length + 
    " [" + ((notTriedPeers.length * 100) / (successCount + failedPeers.length + 
    notTriedPeers.length)) + " %]"
  );

  notTriedPeers.forEach(function(peer) {
    console.log("- Peer ID : " + peer.name);
  });
}

var printMinMaxLine  = function(list) {
  if (!list || list.length <= 0){
    console.log('Results list does not contain any items');
    return;
  }

  console.log(
    'Result count ' + list.length + ', range ' + list[0].time + ' ms to  '  + 
    list[(list.length - 1)].time + " ms."
  );
}

var printResultLine = function(what, list) {
  console.log(
    what + " : 100% : " + getValueOf(list,1.00) + " ms, 99% : " + 
    getValueOf(list,0.99)  + " ms, 95 : " + getValueOf(list,0.95)  + " ms, 90% : " + 
    getValueOf(list,0.90) + " ms."
  );
}

var printAverageDataRate = function (list) {

  var amountOfResults = list.length;
  var cumulativeTime = 0;
  var cumulativeData = 0;

  for (var i = 0; i < amountOfResults; i++) {
    var listItem = list[i];
    if (listItem.result === 'OK') {
      cumulativeTime += listItem.time * listItem.doneRounds;
      cumulativeData += listItem.dataAmount * listItem.doneRounds;
    }
  }

  // The average rate is calculated by first getting the rate in KB per second
  // and then rounding it. The final print is done in MB per second.
  console.log(
    'Average data rate: ' + 
    (Math.round((cumulativeData / 1000) / (cumulativeTime / 1000)) / 1000) + ' MB/s'
  );
};

var preProcessResults = function(source, target, errorTarget){

  if (!target) {
    target = [];
  }

  if (!errorTarget.failedPeer) {
    errorTarget.failedPeer = [];
  }

  if (!errorTarget.notTriedList) {
    errorTarget.notTriedList = [];
  }

  source.forEach(function(roundResult) {

    if (!roundResult || roundResult == null){
      return;
    }

    if (roundResult.result == "OK") {
      target.push(roundResult);
    } else if(roundResult.connections){
      errorTarget.failedPeer.push(roundResult);
    } else { // if connections is zero, then we never got to try to connect before we got timeout
      errorTarget.notTriedList.push(roundResult);
    }
  });
}

var getValueOf = function(array, presentage) {

  if (array.length <= 0) {
    return;
  }

  var index = Math.round(array.length * presentage);
  if (index > 0) {
    index = index - 1;
  }

  if (index < array.length) {
    return array[index].time;
  }
}

var extendArray = function(source, target) {
  if (!target)
    return source;
  return target.concat(source);
}

var compare = function (a,b) {
  if (a.time < b.time)
    return -1;
  if (a.time > b.time)
    return 1;
  return 0;
}

module.exports.process = function (testResults, testDevices) {

  var results = {};
  var combined ={};

  for (var i = 0; i < testResults.length; i++) {

    var result = testResults[i];

    if (result.data) {

      console.log(result.data);

      if (!results[result.device]) {
        results[result.device] = {};
      }

      if (result.data.peersList) {

        results[result.device].peersList = 
          extendArray(result.data.peersList, results[result.device].peersList);

      } else if (result.data.connectList) {

        if (!results[result.device].connectList) {
          results[result.device].connectList = [];
        }

        if(!results[result.device].connectError) {
          results[result.device].connectError = {};
        }

        preProcessResults(
          result.data.connectList,
          results[result.device].connectList,
          results[result.device].connectError
        );

      } else if (result.data.sendList) {

        if (!results[result.device].sendList) {
          results[result.device].sendList = [];
        }

        if (!results[result.device].sendError) {
          results[result.device].sendError = {};
        }

        preProcessResults(
          result.data.sendList,
          results[result.device].sendList,
          results[result.device].sendError
        );
      } else {
        console.log(
          'Test[' + result.test + '] for ' + result.device + ' has unknown data : ' + 
          JSON.stringify(result.data)
        );
      }
    }
  }

  console.log('--------------- test report ---------------------');

  var counter = 0;
  for (var devName in results) {

    counter++;
    console.log('--------------- ' + devName + ' --------------------- : ' + counter);

    if (results[devName].peersList) {
      if (results[devName].peersList.length === 0) {
        console.log('No find peers results!');
      } else {
        results[devName].peersList.sort(compare);

        printResultLine('Find peers', results[devName].peersList);
        printMinMaxLine(results[devName].peersList);
        combined.peersList = extendArray(results[devName].peersList,combined.peersList);
      }
    }

    if (results[devName].connectList) {
      if (results[devName].connectList.length === 0) {
        console.log('No connect results!');
      } else {
        results[devName].connectList.sort(compare);

        printResultLine('Connect', results[devName].connectList);
        printMinMaxLine(results[devName].connectList);

        if (results[devName].connectError) {

          printFailedLine(
            'Connect',
            results[devName].connectError.failedPeer, 
            results[devName].connectError.notTriedList, 
            results[devName].connectList.length
          );
        }
        combined.connectList = extendArray(results[devName].connectList,combined.connectList);
      }
    }

    if (results[devName].sendList) {
      if (results[devName].sendList.length === 0) {
        console.log('No send data results!');
      } else {
        results[devName].sendList.sort(compare);

        printResultLine('Send data', results[devName].sendList);
        printAverageDataRate(results[devName].sendList);
        printMinMaxLine(results[devName].sendList);

        if (results[devName].sendError) {
          printFailedLine(
            'Send data',
            results[devName].sendError.failedPeer, 
            results[devName].sendError.notTriedList, 
            results[devName].sendList.length
          );
        }

        combined.sendList = extendArray(results[devName].sendList,combined.sendList);
      }
    }
  }

  console.log('--------------- Combined ---------------------');

  if (combined.peersList) {
    combined.peersList.sort(compare);
    printResultLine('Find peers', combined.peersList);
  }

  if (combined.connectList) {
    combined.connectList.sort(compare);
    printResultLine('Connect', combined.connectList);
  }

  if (combined.sendList) {
    combined.sendList.sort(compare);
    printResultLine('Send data', combined.sendList);
    printAverageDataRate(combined.sendList);
 }

  console.log('--------------- end of test report ---------------------');

  return results;
};
