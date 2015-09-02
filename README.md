# Lucy App

## Simple runtime for Lucidity applications

lucy.app helps loading scenes and runs the animate loop.

Usage example (without live coding):

  ```Javascript
  // Singleton
  const app  = require ( 'lucy-app' )
  const main = require ( './scene/index' )

  main.setup ()

  app.run ( main )
  ```

Usage example (live coding):

  ```Javascript
  // Singleton
  const app  = require ( 'lucy-app' )
  const live = require ( 'lucy-live' )
  live.require
  ( './scene/index'
  , function ( s )
    { s.setup ()
      app.run ( s )
    }
  )
  ```

Usage example (live coding, scene composition):

  ```Javascript
  // Singleton
  const app   = require ( 'lucy-app' )
  const comp  = require ( 'lucy-compose' ).load

  const fx    = comp.load ( './fx' )
  const scene = comp.load ( './scene' )

  // setup and live reload is managed by composer
  fx
  ( 'blur'
  , scene ( 'triangle' )
  )
  .ready.then
  ( function (s)
    { app.run (s)
    }
  )
  ```

## Installation

  ```Shell
  npm install lucy-app --save
  ```

## Tests

  ```Shell
  npm test
  ```

## Contributing

Please use ['jessy style'](http://github.com/lucidogen/jessy).

Add unit tests for any new or changed functionality.

## Release History

  * 0.1.0 () Initial release.
