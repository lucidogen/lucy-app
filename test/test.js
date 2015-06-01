'use strict'

require('chai').should()
const Application = require('../lib/Application')

describe('app', function() {
  let app = require('../index')
  it('should be an Application', function() {
    app.should.be.an.instanceof(Application)
  })
})

