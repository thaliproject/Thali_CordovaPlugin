'use strict';

var winston = require('winston');

module.exports = function(tag){
    if (!tag || typeof tag !== 'string' || tag.length < 3) {
        throw new Error("All logging must have a tag that is at least 3 characters long!");
    }
    var logger = new (winston.Logger)({
        transports: [
            new (winston.transports.Console)({
                formatter: function(options) {
                    return options.level.toUpperCase() +' '+ options.meta.tag  +
                        ' ' +  (undefined !== options.message ? options.message : '') ;
                }
            })
        ]
    });
    logger.addRewriter(function(level, msg, meta) {
        if (!meta.tag) {
            meta.tag = tag;
        }
        return meta;
    });
    return logger;
}