// test global variable leakage
live_foo = 'Changed inside foo.js'
if (!module.i) {
  module.i = 0
} else {
  module.i += 1
}
module.exports = `Value: ${Math.random()}`
