'use strict'

require('chai').should()
const Application = require('../app/Application')

// mock requestAnimationFrame
if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = function(func) {
    setTimeout(func, 1000/60)
  }
}

describe('app', function() {
  let app = require('../index')
  it('should be an Application', function() {
    app.should.be.an.instanceof(Application)
  })
})

describe('Application', function() {
  let app = new Application
  describe('#run', function() {
    it('should run scene by calling render with time', function(done) {
      let i = 0
      let start_t = Date.now() / 1000
      app.run(
        { render: function(time) {
            ++i
            if (i == 2) {
              let now = Date.now() / 1000
              i.should.equal(2)
              time.should.be.above(now - start_t)
                         .and.below(now - start_t + 0.34)
              done()
              app.stop()
            }
          }
        }
      )
    })
  }) // #run

  describe('#now', function() {
    it('should return elapsed time in seconds', function(done) {
      let start_t = app.now()
      setTimeout(function() {
        let now = app.now() - start_t
        now.should.be.above(19.995/1000)
                 .and.below(21.005/1000)
        done()
      }, 20)
    })
  }) // #now
}) // app
