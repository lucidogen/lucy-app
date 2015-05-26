# Lucy Live

## Live coding support for nodejs

lucy.live helps live coding with Javascript by watching files for changes and
providing a mechanism to trigger hooks when needed.

Usage example:

```js
  const live = require('lucy-live')

  // expects foo.js library to return "obj"
  live.load('foo.js', function(obj) {
    console.log('foo changed: ' + obj)
  }

  live.path('image.jpg', function(p) {
    // do something with new image taking
    // care of Browser cache
  })

  // Start listening for changes in '.'
  live.watch('.')
```

## Installation

```shell
  npm install lucy-live --save
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
