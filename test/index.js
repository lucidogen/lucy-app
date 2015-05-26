var should = require('chai').should(),
    live   = require('../index')

describe('#reloading', function() {
  it('should load local code', function(done) {
    load('fixtures/foo.txt', function(txt) {
      txt.should.equal('Hello Lucy !')
      done()
    })
  })
})

describe('#once', function() {
  it('should run callback only once', function() {
    let value = live.once(function() {
      return Math.random()
      txt.should.equal('Hello Lucy !')
    })

  })
})
