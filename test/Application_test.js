'use strict'

require('chai').should()
const Application = require('../lib/Application')
const elapsed = require('lucy-util').elapsed

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
        { render: function() {
            ++i
            if (i == 2) {
              let now = elapsed()
              i.should.equal(2)
              app.time.should.be.above(now - start_t)
                            .and.below(now - start_t + 0.34) // 0.34 = roughly 2 frames
              done()
              app.stop()
            }
          }
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
      app.setTime(0)
      app.time.should.equal(0)
    })
  }) // .time

  describe('.bpm', function() {
    it('should contain beat per minute information from sync', function() {
      app.bpm.should.equal(120) // default value
    })
  }) // .bpm

  describe('.song', function() {
    it('should contain song position', function() {
      app.setTime(0)
      app.song.should.equal(0)
      app.setTime(60)
      app.song.should.equal(app.bpm * 4) // song counted in 1/16th of a note, beat is 1/4th
    })
  }) // .song
}) // app
