'use strict'

require('chai').should()
const Application = require('../lib/Application')
const elapsed = require('lucy-util').elapsed

Application.rootpath = __dirname + '/fixtures'

// mock requestAnimationFrame
if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = function(func) {
    setTimeout(func, 1000/60)
  }
}

describe('Application', function() {
  let app = new Application
  describe('#run', function() {
    it('should run scene by calling render with updated time', function(done) {
      let i = 0
      let start_t = elapsed()
      app.run(
        { render ()
          { ++i
            if (i == 2)
            { let now = elapsed ()
              i.should.equal (2)
              app.fx.lucy_time
              .should.be.above(now - start_t)
              .and.below(now - start_t + 0.34) // 0.34 = roughly 2 frames

              done ()
              app.stop ()
            }
          }
        , online () {}
        , _onlineSub () {}
        }
      )
    })
  }) // #run

  describe('dialog', function() {
    it('should respond to confirm', function() {
      app.should.respondTo('confirm')
    })

    it('should respond to prompt', function() {
      app.should.respondTo('prompt')
    })

    it('should respond to alert', function() {
      app.should.respondTo('alert')
    })

    // TODO: how to mock 'document' when testing ?
  })

  describe('.time', function() {
    it('should contain elapsed time in seconds', function() {
      app.setTime ( 0 )
      app.fx.lucy_time
      .should.equal ( 0 )
    })
  }) // .time

  describe('.bpm', function() {
    it('should contain beat per minute information from sync', function() {
      app.fx.lucy_bpm
      .should.equal ( 120 ) // default value
    })
  }) // .bpm

  describe('.song', function() {
    it('should contain song position', function() {
      app.setTime ( 0 )
      app.fx.lucy_song
      .should.equal ( 0 )

      app.setTime ( 30 )
      app.fx.lucy_song
      .should.equal ( app.fx.lucy_bpm / 2 )
    })
  }) // .song
}) // app
