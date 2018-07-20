module.exports = {
  "env": {
    "es6": true,
    "node": true
  },
  "plugins": ["node"],
  "extends": ["eslint:recommended", "plugin:node/recommended"],
  "parserOptions": {
    "sourceType": "module"
  },
  "rules": {
    "indent": [
      "error",
      2, {
        "MemberExpression": 1
      }
    ],
    "linebreak-style": [
      "error",
      "unix"
    ],
    "quotes": [
      "error",
      "single"
    ],
    "semi": [
      "error",
      "always"
    ],
    "brace-style": [
      "error"
    ],
    "block-spacing": [
      "error"
    ],
    "space-before-blocks": [
      "error"
    ],
    "keyword-spacing": [
      "error"
    ],
    "space-in-parens": [
      "error"
    ],
    "space-infix-ops": [
      "error"
    ],
    "space-unary-ops": [
      "error"
    ],
    "prefer-arrow-callback": [
      "warn"
    ],
    "no-unused-vars": [
      "error", {
        "varsIgnorePattern": "^_",
        "args": "none"
      }
    ],
    "no-var": [
      "error"
    ],
    "node/exports-style": [
      "error",
      "module.exports"
    ]
  }
};
