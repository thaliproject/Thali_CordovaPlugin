/**
 * Created by juksilve on 1.9.2015.
 */

'use strict';

var fs = require('fs');
var os = require('os');

var ifaces = os.networkInterfaces();

//get Wi-Fi IP address and write it to a file
// file should be copied to the jxcore folder of the client app
Object.keys(ifaces).forEach(function (ifname) {
    var alias = 0;

    ifaces[ifname].forEach(function (iface) {
        if ('IPv4' !== iface.family || iface.internal !== false) {
            // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
            return;
        }

        if(ifname.indexOf("Wi-Fi") > -1){
            // this interface has only one ipv4 adress
            console.log(ifname, iface.address);

            fs.writeFile("./ipaddress.json", JSON.stringify([{name: ifname, address: iface.address}]), function (err) {
                if (err) {
                    return console.log(err);
                }
                console.log("The file was saved!");

            });
        }
    });
});