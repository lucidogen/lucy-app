Lucy Loader
===========

A small library for live coding (hook trigger on file change).

## Installation

```shell
  npm install lucy-loader --save
```

## Usage

```js
  const load   = require('lucy-loader').load

  // expects foo.js library to return "obj"
  load('foo.js', function(obj) {
    console.log('foo changed: ' + obj)
  }
```

## Tests

```shell
   npm test
```

## Contributing

In lieu of a formal styleguide, take care to maintain the existing coding style.
Especialy, do not use semicolons for statements where not to required, use comma
at the beginning of lines for lists and dictionaries.

Add unit tests for any new or changed functionality. Lint and test your code.

## Release History

* 0.1.0 Initial release
