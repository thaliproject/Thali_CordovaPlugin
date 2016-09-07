'use strict';

if (!Array.prototype.shuffle) {
  // the Fisher-Yates (aka Knuth) Shuffle.
  // http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
  Array.prototype.shuffle = function () {
    var currentIndex = this.length;
    var temporaryValue, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex !== 0) {
      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = this[currentIndex];
      this[currentIndex] = this[randomIndex];
      this[randomIndex] = temporaryValue;
    }
  };
}

if (!Array.prototype.find) {
  // https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Array/find
  Array.prototype.find = function(predicate) {
    if (this == null) {
      throw new TypeError('Array.prototype.find called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    var list = Object(this);
    var length = list.length >>> 0;
    var thisArg = arguments[1];
    var value;

    for (var i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return value;
      }
    }
    return undefined;
  };
}
