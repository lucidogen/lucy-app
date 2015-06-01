'use strict'

require('chai').should()
const Application = require('../app/Application')

describe('app', function() {
  let app = require('../index')
  it('should be an Application', function() {
    app.should.be.an.instanceof(Application)
  })
})

