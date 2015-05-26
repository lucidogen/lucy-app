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
'use strict'
const caller = require('caller')
const lpath  = require('path')
const fs     = require('fs')
const vm     = require('vm')

const lib = {}

/////////////////////////////// Private
const ONCE_CACHE = {}

// Contains the callbacks to trigger on path change.
const LOAD_PATHS = {}

// Hooks by callpath
const ORIGIN_HAS_CALLBACKS = {}


// Reloading code
// FIXME: Only use these handlers for eval. Set in the callback, what to do.
//   * live.load: read file content
//   * live.eval: evaluate file content (handlers used here: babel, ocaml, etc)
//   * live.path: just return full path
let HANDLERS =
 { js: function(data, h) {
    // Transform ES6 to ES5 (not yet)
    // data = babel.transform(data)
    return evalCode(data, h)
   }
 , frag: function(data, h) { return data }
 , vert: function(data, h) { return data }
 , txt:  function(data, h) { return data }
} 

// This is set to the currently evaled (reloaded) path to clear callbacks
// accordingly on reload (see below)
let CALLBACK_ORIGIN

const evalCode = function(code, h) {

  // Clear all previously defined callbacks
  if (ORIGIN_HAS_CALLBACKS[h.path]) {
    for(let p in LOAD_PATHS) {
      let callbacks = p.callbacks
      for(let i = callbacks.length-1; i >= 0 ; --i) {
        let callback = callbacks[i]
        if (callback.origin == h.path) {
          // remove entry to avoid memory leak
          callbacks.splice(i, 1)
        }
      }
    }
  }

  // No more callbacks linked to this origin
  ORIGIN_HAS_CALLBACKS[h.path] = null
  
  CALLBACK_ORIGIN = h.path
    let rval = vm.runInThisContext(data, {filename: h.path})
  CALLBACK_ORIGIN = null

  return rval
}

const makePath = function(caller_p) {
  return caller_p.substr(caller_p.indexOf(':') + 1)
}

const getType = function(p) {
  return lpath.extname(p).substr(1)
}  

const emptyClbk = function() {}

const reload = function(h) {
  let p = h.path
  // async load...
  // console.log("Reloading path = '"+h.path+"'")
  if (h.handler) {
    fs.readFile(h.path, {encoding:'utf8'}, function(err, data) {
      if (err) throw err
      // do nothing on same content
      // TODO: use hash value to avoid storing full source/data.
      if (data == h.data) {
        //console.log('=== SAME DATA ===')
      } else {
        //console.log('=== LOADING CODE ===')
        h.data = data
        data = h.handler(data, h)
        let callbacks = h.callbacks
        for (let i = 0; i < callbacks.length; ++i) { 
          callbacks[i].callback(data)
        }
      }

    })
  } else {
    let callbacks = h.callbacks
    for (let i = 0; i < callbacks.length; ++i) { 
      callbacks[i].callback(h.path)
    }
  }
}

// FIXME: How do we avoid triggering callbacks for old versions of the script ?
//
//  1. load script a.js
//  2. setup hook in a.js: load('foo.frag', ...)
//  3. reload script a.js
//  4. setup hook in a.js: load('foo.frag', ...)
//  5. 'foo.frag' changes and triggers two hooks
//  6. memory leak for a.js content due to callback not cleared
//
//  Solution: clear callbacks created on file evaluation (step 2 and 4). This
//  is a partial solution but it is better then nothing.
//
//  Clearing all callbacks from the calling script does not work as this can be
//  a distant script (THREE.Cache for example). Our only guess is the "eval" run
//  that is supposed to reinstall the same callbacks if rerun, so we can remove
//  them all.
//
//  Maybe we could use the callback's script origin, not the caller ?

/////////////////////////////// Public

/* Async load local code and trigger `callback` every time the file changes. The
 * `path` parameter must be local to the current file (no absolute path support).
 * 
 * If `path` points to a javascript file, the file is evaluated and the result
 * is passed as argument to the callback.
 */
lib.load = function(path, callback) {
  let base = lpath.dirname(makePath(caller()))
  path = lpath.resolve(lpath.join(base, path))

  callback = callback || emptyClbk

  callback =
    { origin:   CALLBACK_ORIGIN
    , callback: callback
      // value to send in the callback
    , type:     'load'
    }

  if (CALLBACK_ORIGIN) {
    ORIGIN_HAS_CALLBACKS[CALLBACK_ORIGIN] = true
  }

  let h = LOAD_PATHS[path]
  if (!h) {
    let t = getType(path)
    // FIXME: handler does not belong here. It should be linked to individual
    // callbacks because of live.eval, live.path and live.load.
    let handler = HANDLERS[t]

    h = { callbacks: [callback]
        , type: t
        , path: path
        , handler: handler
        }

    LOAD_PATHS[path] = h
    reload(h)
  } else {
    h.callbacks.push(callback)
    callback.callback(h.value)
  }
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

  // If
}

/* Execute the code in the callback only once and return the same value on any
 * subsequent call.
 */
lib.once = function(callback) {
  let path = makePath(caller())
  // const path = lpath.resolve(caller())
  let value = ONCE_CACHE[path]
  if (value == undefined) {
    value = callback()
    ONCE_CACHE[path] = value
  }
  return value
}

module.exports = lib
