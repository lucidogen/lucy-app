'use strict'

require ( 'chai' )
.should ()


const Application = require ( '../lib/Application' )
Application.rootpath = __dirname + '/fixtures'

describe
( 'app'
, function ()
  { let app = require ( '../lib/index' )
    it
    ( 'should be an Application'
    , function ()
      { app
        .should.be.an.instanceof ( Application )
      }
    )
  }
)
