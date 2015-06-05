# Lucy App

## Simple runtime for Lucidity applications

lucy.app helps loading scenes and runs the animate loop.

Usage example (without live coding):

```js
  // Singleton
  const app  = require('lucy-app')
  const main = require('./scene/index')

  main.setup()

  app.run(main)
```

Usage example (live coding):

```js
  // Singleton
  const app  = require('lucy-app')
  const live = require('lucy-live')
  live.require('./scene/index', function(s) {
    s.setup()
    app.run(s)
  })
```

Usage example (live coding, scene composition):

```js
  // Singleton
  const app   = require('lucy-app')
  const comp  = require('lucy-compose').load

  const fx    = comp.load('./fx')
  const scene = comp.load('./scene')

  // setup and live reload is managed by composer
  fx('blur, scene('triangle')).ready.then(function(s) {
    app.run(s)
  })
```

## Installation

```shell
  npm install --save git+ssh://git@bitbucket.org/lucidogen/lucy-app.git
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
