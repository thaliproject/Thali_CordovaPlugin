module.exports = {
  "env": {
    "node": true
  },
  "globals": {
    "Mobile": true
  },
  "rules": {
    "no-cond-assign": 2,
    "eqeqeq": 2,
    "no-caller": 2,
    "no-undef": 2,
    "no-unused-vars": [
      2,
      {
        "vars": "local",
        "args": "after-used"
      }
    ],
    "no-eq-null": 2,
    "strict": [
      2,
      "safe"
    ],
    "no-irregular-whitespace": 2,
    "guard-for-in": 2,
    "no-unused-expressions": [
      2,
      {
        "allowShortCircuit": true,
        "allowTernary": true
      }
    ],
    "no-new": 2,
    "no-extra-semi": 2,
    "no-use-before-define": [
      2,
      {
        "functions": false
      }
    ],
    "no-extend-native": 2,
    "max-depth": [
      2,
      3
    ],
    "valid-jsdoc": [
      2,
      {
        "requireReturn": false,
        "requireParamDescription": false,
        "requireReturnDescription": false
      }
    ],
    "max-len": [
      2,
      80,
      2,
      {
        "ignoreTrailingComments": true,
        "ignoreUrls": true,
        "ignoreStrings": true,
        "ignorePattern": getMaxLenPatterns()
      }
    ],
    "camelcase": [
      2,
      {
        "properties": "never"
      }
    ],
    "comma-style": [
      2,
      "last"
    ],
    "curly": [
      2,
      "all"
    ],
    "dot-notation": [
      2,
      {
        "allowKeywords": true
      }
    ],
    "operator-linebreak": [
      2,
      "after"
    ],
    "semi": [
      2,
      "always"
    ],
    "keyword-spacing": [
      2,
      {}
    ],
    "comma-spacing": [
      2,
      {
        "after": true
      }
    ],
    "spaced-comment": [
      2,
      "always"
    ],
    "consistent-this": [
      2,
      "self"
    ],
    "indent": [
      2,
      2,
      {
        "SwitchCase": 1
      }
    ],
    "quotes": [
      2,
      "single"
    ]
  }
};

function getMaxLenPatterns() {
  var patterns = [
    // /**
    //  * @param {type} identifier
    //  */
    /^\s+?\* @(param|arg|argument|prop|property) \{.+?\} (\[.+?\]|[\w\d_\.\[\]]+)$/,

    // /**
    //  * {@link location}
    //  */
    /^\s+?\* \{@link .+?\}$/,

    // /**
    //  * @function functionName
    //  * @function external:"Mobile('realyLongMobileMethod')".registerToNative
    //  */
    /^\s+?\* @(function|func|method) \S+$/,

    // /**
    //  * | cell1 | cell2 |
    //  */
    /^\s+?\* \|.*\|$/
  ];

  return patterns.map(re => `(${re.source})`).join('|');
}

