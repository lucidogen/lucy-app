'use strict'
// to test relative require in live required file
const bar = require('./bar.js')

// test global variable leakage
var live_foo = 'Changed inside foo.js'

exports.i = exports.i || 0
exports.i++
exports.v = `Value: ${Math.random()}`
