'use strict';
var exec = require('child_process').exec;
var fs = require('fs-extra');
var Promise = require('lie');
var https = require('https');

exports.readFilePromise = function(filename) {
    return new Promise(function(resolve, reject) {
       fs.readFile(filename, "utf8", function(err, data) {
          if (err) {
              reject(err);
          } else {       
              resolve(data);
          } 
       });
    });
};

exports.writeFilePromise =function(filename, data) {
    return new Promise(function(resolve, reject) {
        fs.writeFile(filename, data, "utf8", function(err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        })
    });
};

exports.execPromise = function(command, cwd) {
    return new Promise(function(resolve, reject) {
        exec(command,
            {cwd: cwd},
            function (error, stdout, stderr) {
                if (error) {
                    reject("command " + command + " failed with - " + error);
                    return;
                }          
                resolve(true);      
            });
    });                    
};

exports.overwriteFilePromise = function(source, destination) {
    return new Promise(function(resolve, reject) {
        fs.copy(source, destination, { clobber: true}, function(err) {
            if (err) {
                reject("overwrite copy from " + source + " to " + destination + " failed.");
                return;
            }
            resolve(true);
        })
    });
};

exports.httpRequestPromise =function(method, urlObject) {
    if (method != "GET" && method != "HEAD") {
        return Promise.reject("We only support GET or HEAD requests");
    }
    
    return new Promise(function(resolve, reject) {
       var httpsRequestOptions = {
                    host: urlObject.host,
                    method: method,
                    path: urlObject.path,
                    keepAlive: true
                };
                
        var req = https.request(httpsRequestOptions, function(res) {
            if (res.statusCode != 200) {
                reject("Did not get 200 for " + urlObject.href + ", instead got " + res.statusCode);
                return;
            }
            
            resolve(res);
        }).on('error', function(e) {
            reject("Got error on " + urlObject.href + " - " + e);
        });      
        
        req.end();        
    });
};
