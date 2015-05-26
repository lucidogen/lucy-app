/*
  # Live coding support for nodejs

  lucy.live helps live coding with Javascript by watching files for changes and
  providing a mechanism to trigger hooks when needed.

  Usage example:
  
    const live = require('lucy-live')

    // expects foo.js library to return "obj"
    live.load('foo.js', function(obj) {
      console.log('foo changed: ' + obj)
    }

    live.path('image.jpg', function(p) {
      // do something with new image taking
      // care of Browser cache
    })

    // Start listening for changes in '.'
    live.watch('.')
*/

const lib = {}

/* Async load local code and trigger `callback` every time the file changes. The
 * `path` parameter must be local to the current file (no absolute path support).
 * 
 * If `path` points to a javascript file, the file is evaluated and the result
 * is passed as argument to the callback.
 */
lib.load = function(path, callback) {
}

/* Watch for a file change but do not read the content. The `path` parameter 
 * must be local to the calling script. When the target file changes, the
 * `callback` is called with the absolute version of path as parameter.
 */
lib.path = function(path, callback) {
}

/* Start listening for file changes in a given `directory` (relative to the
 * calling script).
 */
lib.watch = function(directory) {
}

module.exports = lib
