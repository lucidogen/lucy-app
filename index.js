/*
  # Lucidity main application runner

  Usage example with lucy-compose:
  
    // Singleton
    const app   = require('lucy-app')
    const comp  = require('lucy-compose').load

    const fx    = comp.load('./fx')
    const scene = comp.load('./scene')

    // Prepare a composition and when ready, run it.
    fx('blur, scene('triangle')).ready.then(function(s) {
      app.run(s)
    })

    // Listen for changes in '.' (only required for live coding)
    require('lucy-live').watch('.')
*/
'use strict'
const Application = require ( './lib/Application' )

module.exports = new Application
