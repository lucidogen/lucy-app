'use strict'
const vm = require('vm')
const path = require('path')
const fs   = require('fs')

const expect = require('chai').expect
const live   = require('../index')

describe('live', function() {

  describe('#read', function() {
    it('should #read file from local path', function(done) {
      live.read('./fixtures/foo.txt', function(txt) {
        expect(txt).to.equal('Hello Lucy !\n')
        done()
      })
    })

    it('should #read file from absolute path', function(done) {
      let p = require.resolve('./fixtures/foo.txt')
      expect(path.isAbsolute(p)).to.be.true
      live.read(p, function(txt) {
        expect(txt).to.equal('Hello Lucy !\n')
        done()
      })
    })
  }) // #read

  describe('#eval', function() {
    let evalValue = null
    it('should evaluate code from local path', function(done) {
      live.require('./fixtures/foo', function(value) {
        expect(value).to.match(/^Value: \d/)
        evalValue = value
        done()
      })
    })

    it('should #eval from absolute path', function(done) {
      let p = require.resolve('./fixtures/foo.js')
      expect(path.isAbsolute(p)).to.be.true
      live.require(p, function(value) {
        expect(value).to.match(/^Value: \d/)
        done()
      })
    })

    it('should only evaluate code once', function() {
      live.require('./fixtures/foo', function(value) {
        expect(value).to.equal(evalValue)
      })
    })

    it('should not export global values', function(done) {
      var live_foo = 'Set in live_test.js'
      live.require('./fixtures/foo.js', function(value) {
        expect(live_foo).to.equal('Set in live_test.js')
        done()
      })
    })

    it('should reload with same module', function(done) {
      live.require('./fixtures/foo.js', function(value) {
        expect(value).to.match(/^Value: \d/)
        evalValue = value
        done()
      })
    })
  }) // #eval

  describe('#watch', function() {
    let p  = require.resolve('./fixtures/bar.js')
    let rp = require.resolve('./fixtures/reload.js')
    let p_orig, rp_orig

    before(function(done) {
      // TODO: Why do we have such problems using 'require' inside the loaded
      // code ?
      live.clear()
      global.live_lib = live
      fs.readFile(p, function(err, buf) {
        p_orig = buf
        fs.readFile(rp, function(err, buf) {
          rp_orig = buf
          done()
        })
      })
    })

    afterEach(function(done) {
      live.clear()
      fs.writeFile(p, p_orig, function() {
        fs.writeFile(rp, rp_orig, function() {
          done()
        })
      })
    })

    after(function() {
      delete global.live_lib
      delete global.live_reload_1
      delete global.live_reload_gen
      delete global.live_reload_2
      delete global.live_reload_3
    })

    it('should re-evaluate code on file change', function(done) {
      let values = []
      let op = function*() {
        // after first read, we write new content
        fs.writeFile(p, 'module.exports = "This is barman."')
        yield
        // after second reload, write something else
        fs.writeFile(p, 'module.exports = "This is barmaid."')
        yield
        // last reload, just end test
        expect(values).to.deep.equal(
          [ 'This is bar.'
          , 'This is barman.'
          , 'This is barmaid.'
          ]
        )
        done()
      }()

      live.require('./fixtures/bar.js', function(v) {
        values.push(v)
        op.next()
      })
      live.watch('./fixtures')
    })

    it('should invalidate created callbacks on code reload', function(done) {
      let values = []
      global.live_reload_prefix = 'live_reload_1'

      // The generator is called inside 'bar.js' hook defined in 'reload.js'
      global.live_reload_gen = function*() {
        values.push(yield) // reload:live_reload_1
        values.push(yield) // bar:live_reload_1

        // after first read, we write new content on bar.js to
        // trigger hook created in reload.js
        global.live_reload_prefix = 'live_reload_2'
        fs.writeFile(p, '"This is barman."')

        // wait for second bar (live_reload_prefix captured and should not change)
        values.push(yield) // bar:live_reload_1

        // hook triggered with saved global in reload.js
        // should not change anymore
        global.live_reload_1 = 'FIXED:live_reload_1'

        // Now we change 'reload.js' to install new hooks
        // saved global is now live_reload_2
        fs.appendFile(rp, '/* foo */')

        values.push(yield) // bar:live_reload_2

        values.push(yield) // reload:live_reload_2

        // reload.js has been evaluated, we can now test
        // what happens if we touch bar.js
        global.live_reload_prefix = 'live_reload_3'
        fs.writeFile(p, '"This is barmaid."')
        values.push(yield)
        
        // last reload, just end test
        expect(values).to.deep.equal(
          [ 'reload:live_reload_1'
          , 'bar:live_reload_1'
          , 'bar:live_reload_1'
          , 'bar:live_reload_2'
          , 'reload:live_reload_2'
          , 'bar:live_reload_2'
          ]
        )
        done()
      }()

      global.live_reload_gen.next()

      live.require('./fixtures/reload', function(v) {
        // first trigger on 'reload.js' evaluation
        global.live_reload_gen.next('reload:'+v)
      })

      live.watch('./fixtures')

    })
  }) // #watch


  describe('#path', function() {
    it('should return full path from local path', function() {
      live.path('./fixtures/foo.txt', function(p) {
        expect(p).to.equal(require.resolve('./fixtures/foo.txt'))
      })
    })

    it('should return full path from absolute path', function() {
      let path_p = require.resolve('./fixtures/foo.txt')
      expect(path.isAbsolute(path_p)).to.be.true
      live.path(path_p, function(p) {
        expect(p).to.equal(path_p)
      })
    })
  }) // #path

  describe('#once', function() {
    it('should run callback only once', function() {
      let code = `live.once(function() {
        return Math.random()
      })`

      global.live = live
      let rval1 = vm.runInThisContext(code, {filename: 'foobar.js'})
      let rval2 = vm.runInThisContext(code, {filename: 'foobar.js'})
      global.live = null
      
      expect(rval2).to.equal(rval1)
    })
  }) // #once

}) // lucy-live
