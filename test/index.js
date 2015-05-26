'use strict'
const vm = require('vm')

const should = require('chai').should(),
      live   = require('../live')

describe('#reloading', function() {
  it('should load local code', function(done) {
    live.load('fixtures/foo.txt', function(txt) {
      txt.should.equal('Hello Lucy !\n')
      done()
    })
  })
})

describe('#once', function() {
  it('should run callback only once', function() {
    let code = `live.once(function() {
      return Math.random()
    })`

    global.live = live
    let rval1 = vm.runInThisContext(code, {filename: 'foobar.js'})
    let rval2 = vm.runInThisContext(code, {filename: 'foobar.js'})
    global.live = null
    
    rval2.should.equal(rval1)
  })
})
