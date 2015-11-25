var printFailedLine = function(what,failedPeers, notTriedPeers,successCount) {

    if(!notTriedPeers || !failedPeers ||  (failedPeers.length + successCount) <=0){
        return;
    }
    console.log(what + " failed peers count : " + failedPeers.length + " [" + ((failedPeers.length * 100) / (successCount + failedPeers.length)) + " %]");

    failedPeers.forEach(function(peer) {
        console.log("- Peer ID : " + peer.name + ", Tried : " + peer.connections);
    });

    console.log(what + " never tried peers count : " + notTriedPeers.length + " [" + ((notTriedPeers.length * 100) / (successCount + failedPeers.length + notTriedPeers.length)) + " %]");

    notTriedPeers.forEach(function(peer) {
        console.log("- Peer ID : " + peer.name);
    });
}

var printMinMaxLine  = function(list) {
    if(!list || list.length <= 0){
        console.log('Results list does not contain any items');
        return;
    }
    console.log('Result count ' + list.length + ', range ' + list[0].time + ' ms to  '  + list[(list.length - 1)].time + " ms.");
}

var printResultLine  = function(what, list) {
    console.log(what + " : 100% : " + getValueOf(list,1.00) + " ms, 99% : " + getValueOf(list,0.99)  + " ms, 95 : " + getValueOf(list,0.95)  + " ms, 90% : " + getValueOf(list,0.90) + " ms.");
}

var preProcessResults  = function(source, target,errorTarget){

    if(!target) {
        target = [];
    }
    if(!errorTarget.failedPeer) {
        errorTarget.failedPeer = [];
    }
    if(!errorTarget.notTriedList) {
        errorTarget.notTriedList = [];
    }

    source.forEach(function(roundResult) {

        if(!roundResult || roundResult == null){
            return;
        }

        if (roundResult.result == "OK") {
            target.push(roundResult);
        } else if(roundResult.connections){
            errorTarget.failedPeer.push(roundResult);
        }else{ // if connections is zero, then we never got to try to connect before we got timeout
            errorTarget.notTriedList.push(roundResult);
        }
    });
}



var getValueOf  = function(array, presentage) {

    if(array.length <= 0){
        return;
    }

    var index = Math.round(array.length * presentage);
    if(index > 0){
        index = index - 1;
    }
    if(index < array.length) {
        return array[index].time;
    }
}

var extendArray  = function(source, target) {
    if(!target)
        return source;
    return target.concat(source);
}
var compare  = function (a,b) {
    if (a.time < b.time)
        return -1;
    if (a.time > b.time)
        return 1;
    return 0;
}

module.exports.process = function (testResults, testDevices) {
    var results = {};
    var combined ={};

    for (var i=0; i < testResults.length; i++) {

        if(testResults[i].data) {
            if (!results[testResults[i].device]) {
                results[testResults[i].device] = {};
            }

            if (testResults[i].data.peersList) {
                results[testResults[i].device].peersList = extendArray(testResults[i].data.peersList, results[testResults[i].device].peersList);
            } else if (testResults[i].data.connectList) {
                if(!results[testResults[i].device].connectList) {
                    results[testResults[i].device].connectList = [];
                }

                if(!results[testResults[i].device].connectError) {
                    results[testResults[i].device].connectError = {};
                }

                preProcessResults(testResults[i].data.connectList,results[testResults[i].device].connectList,results[testResults[i].device].connectError);
            } else if (testResults[i].data.sendList) {
                if(!results[testResults[i].device].sendList) {
                    results[testResults[i].device].sendList = [];
                }

                if(!results[testResults[i].device].sendError) {
                    results[testResults[i].device].sendError = {};
                }

                preProcessResults(testResults[i].data.sendList,results[testResults[i].device].sendList,results[testResults[i].device].sendError);
            } else {
                console.log('Test[' + testResults[i].test + '] for ' + testResults[i].device + ' has unknown data : ' + JSON.stringify(testResults[i].data));
            }
        }
    }

    console.log('--------------- test report ---------------------');

    var counter = 0;
    for( var devName in results){

        counter++;
        console.log('--------------- ' + devName + ' --------------------- : ' + counter);

        if(results[devName].peersList){// && (results[devName].peersList.length > 0)) {
            results[devName].peersList.sort(compare);

            printResultLine('peersList',results[devName].peersList);
            printMinMaxLine(results[devName].peersList);
            combined.peersList = extendArray(results[devName].peersList,combined.peersList);
        }

        if(results[devName].connectList){// && (results[devName].connectList.length > 0)) {
            results[devName].connectList.sort(compare);

            printResultLine('connectList',results[devName].connectList);
            printMinMaxLine(results[devName].connectList);

            if(results[devName].connectError) {
                printFailedLine('connectList',results[devName].connectError.failedPeer, results[devName].connectError.notTriedList, results[devName].connectList.length);
            }
            combined.connectList = extendArray(results[devName].connectList,combined.connectList);
        }else if (results[devName].connectError && results[devName].connectError.failedPeer > 0){
            console.log("All (" + results[devName].connectError.failedPeer + ") Re-Connect test connections failed");
        }

        if(results[devName].sendList){// && (results[devName].sendList.length > 0)) {
            results[devName].sendList.sort(compare);

            printResultLine('sendList',results[devName].sendList);
            printMinMaxLine(results[devName].sendList);

            if(results[devName].sendError) {
                printFailedLine('sendList',results[devName].sendError.failedPeer, results[devName].sendError.notTriedList, results[devName].sendList.length);
            }
            combined.sendList = extendArray(results[devName].sendList,combined.sendList);
        }else if (results[devName].sendError && results[devName].sendError.failedPeer > 0){
            console.log("All (" + results[devName].sendError.failedPeer + ") SendData test connections failed");
        }
    }

    console.log('--------------- Combined ---------------------');

    if(combined.peersList){
        combined.peersList.sort(compare);
        printResultLine('peersList',combined.peersList);
    }

    if(combined.connectList){
        combined.connectList.sort(compare);
        printResultLine('connectList',combined.connectList);
    }

    if(combined.sendList){
        combined.sendList.sort(compare);
        printResultLine('sendList',combined.sendList);
   }

    console.log('--------------- end of test report ---------------------');
    
    return results;
};
