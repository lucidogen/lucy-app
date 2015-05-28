'use strict'
// to test relative require in live required file
const bar = require('./bar.js')

// test global variable leakage
var live_foo = 'Changed inside foo.js'
module.i = module.i || 0
module.i++
module.exports = {i:module.i, v:`Value: ${Math.random()}`}
