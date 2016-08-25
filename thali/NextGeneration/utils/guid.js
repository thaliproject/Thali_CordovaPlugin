/**
 * A simple small utility for generating GUIDs
 * http://stackoverflow.com/a/105074
 */
 module.exports.guid = function () {
   function s4() {
     return Math.floor((1 + Math.random()) * 0x10000)
       .toString(16)
       .substring(1);
   }
   return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
     s4() + '-' + s4() + s4() + s4();
 }
