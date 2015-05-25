var should = require('chai').should(),
    load   = require('../index').load

describe('#reloading', function() {
  it('should load local code', function(done) {
    load('fixtures/foo.txt', function(txt) {
      txt.should.equal('Hello Lucy !')
      done()
    })
  })
})
