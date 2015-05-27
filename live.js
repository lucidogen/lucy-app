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
let ONCE_CACHE = {}

// Contains the callbacks to trigger on path change.
let LOAD_PATHS = {}

// Hooks by callpath
let ORIGIN_HAS_CALLBACKS = {}

// Watched paths
let WATCHED_PATHS = {}

const getData = function(h, force) {
  let data = h.data
  if (!data || force) {
    h.error = null
    data = new Promise(function(resolve, reject) {
      fs.readFile(h.path, {encoding:'utf8'}, function(err, buf) {
        if (err) {
          console.log(err.toString())
          h.error = err
          reject(err)
        } else {
          // console.log(`Reading '${h.path}'...`)
          resolve(buf)
        }
      })
    })
    h.data = data
  }
  return data
}

// If we change 'onChangedPath' to not read file content to detect file changes,
// we need to change the HANDLERS to use getData and adapt cache code
// accordingly.
const onChangedPath = function(h, callback) {
  getData(h, true).then(function(data) {
    if (h.readValue == data) {
      // same. ignore
    } else {
      h.evalValue = null
      h.readValue = data
      callback(h)
    }
  })
}

// Reloading code
const HANDLERS =
  { read: function(h, clbk) { clbk(h.readValue) }
  , path: function(h, clbk) { clbk(h.path) }
  , eval:
    { js: function(h, clbk) {
        if (h.evalValue) {
          clbk(h.evalValue)
        } else {
          let v = evalCode(h, h.readValue)
          if (h.error) {
            console.log(h.error.toString())
          } else {
            h.evalValue = v
            clbk(v)
          }
        }
      }
    } 
  }

const emptyClbk = function() {}

// This is set to the currently evaled (reloaded) path to clear callbacks
// accordingly on reload (see below)
let CALLBACK_ORIGIN

const evalCode = function(h, code) {

  // Clear callbakcs previously defined through eval (we do not want to
  // trigger callbacks in dead code).
  if (ORIGIN_HAS_CALLBACKS[h.path]) {
    for(let p in LOAD_PATHS) {
      let callbacks = LOAD_PATHS[p].callbacks
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
  
  h.error = null

  CALLBACK_ORIGIN = h.path
    let rval
    try {
      // TODO: Why can't we just create a new blank state keeping global scope
      // AS-IS ?
      rval = vm.runInNewContext("'use strict';\n"+code,
        { require:require
        , global:global
        , console:console
        }, {filename: h.path})
    } catch(err) {
      h.error = err
    }
  CALLBACK_ORIGIN = null

  return rval
}

const makePath = function(caller_p) {
  return caller_p.substr(caller_p.indexOf(':') + 1)
}

const getType = function(p) {
  return lpath.extname(p).substr(1)
}  

const reload = function(h) {
  let callbacks = h.callbacks
  for(let i = callbacks.length-1; i >= 0 ; --i) {
    let clbk = callbacks[i]
    clbk.handler(h, clbk.callback)
  }
}

const setupCallback = function(path, callback, handler) {
  let clbk =
    { origin:   CALLBACK_ORIGIN
    , callback: callback
    , handler:  handler
    }

  if (CALLBACK_ORIGIN) {
    ORIGIN_HAS_CALLBACKS[CALLBACK_ORIGIN] = true
  }

  let h = LOAD_PATHS[path]
  if (!h) {
    h = { callbacks: [clbk]
        , path: path
        }

    LOAD_PATHS[path] = h
    onChangedPath(h, reload)
  } else {
    h.callbacks.push(clbk)
    clbk.handler(h, clbk.callback)
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

/* Async read file content at local `path` and trigger `callback` every time the
 * file changes.
 */
lib.read = function(path, callback) {
  let base = lpath.dirname(makePath(caller()))
  path = lpath.resolve(lpath.join(base, path))
  setupCallback(path, callback, HANDLERS.read)
}

/* Async eval code file located at local `path` and trigger `callback` every
 * time the file changes.
 * 
 * The result of the code execution is passed as argument to the callback.
 */
lib.eval = function(path, callback) {
  let base = lpath.dirname(makePath(caller()))
  path = lpath.resolve(lpath.join(base, path))
  let type = getType(path)
  let h = HANDLERS.eval[type]
  console.assert(h, `Missing handler to evaluate ${type} code`)
  setupCallback(path, callback, h)
}

/* Watch for changes to local `path` and trigger `callback` every time the file
 * changes.
 *
 * The fullpath of the file is passed as callback parameter.
 */
lib.path = function(path, callback) {
  let base = lpath.dirname(makePath(caller()))
  path = lpath.resolve(lpath.join(base, path))
  setupCallback(path, callback, HANDLERS.path)
}

/* Clear all previously defined watches and callbacks.
 */
lib.clear = function() {
  for(let k in WATCHED_PATHS) {
    let watcher = WATCHED_PATHS[k]
    watcher.close()
  }
  ONCE_CACHE           = {}
  LOAD_PATHS           = {}
  ORIGIN_HAS_CALLBACKS = {}
  WATCHED_PATHS        = {}
}

/* Start listening for file changes in a given `path` (relative to the
 * calling script).
 */
lib.watch = function(path) {
  let base = lpath.dirname(makePath(caller()))
  path = lpath.resolve(lpath.join(base, path))

  if (WATCHED_PATHS[path]) {
    // nothing to do
  } else {
    let watcher = fs.watch(path, {persistent:true, recursive:true}, function (event, filename) {
      let p = lpath.resolve(lpath.join(path, filename))
      let h = LOAD_PATHS[p]
      if (!h) {
        // console.log('unknown changed file "'+p+'"')
      } else {
        onChangedPath(h, reload)
      }
    })
    WATCHED_PATHS[path] = watcher
  }
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
