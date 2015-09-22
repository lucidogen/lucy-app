# Lucy App [![Build Status](https://travis-ci.org/lucidogen/lucy-app.svg)](https://travis-ci.org/lucidogen/lucy-app)

Part of [lucidity](http://lucidity.io) project.

## Simple runtime for Lucidity applications

lucy.app helps loading scenes and runs the animate loop.

Usage example (without live coding):

  ```js
  // Singleton
  const app  = require ( 'lucy-app' )
  const main = require ( './scene/index' )

  main.setup ()

  app.run ( main )
  ```

Usage example (live coding):

  ```js
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

  ```js
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

  * 0.2.0 (2015-09-22) Using dirsum to check for changes in work directory.
  * 0.1.0 (2015-09-02) Initial release.
