'use strict'

require ( 'chai' )
.should ()


const Application = require ( '../lib/Application' )
Application.rootpath = __dirname + '/fixtures'

console.log ( Application.rootpath )

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
