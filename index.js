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
const Module = require('module')

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
const onChangedPath = function(h) {
  getData(h, true).then(function(data) {
    if (h.readValue == data) {
      // same. ignore
    } else {
      // console.log(`onChangedPath("${h.path}")`)
      h.evalValue = null
      h.readValue = data
      // reload
      let callbacks = h.callbacks
      for(let i = callbacks.length-1; i >= 0 ; --i) {
        let clbk = callbacks[i]
        clbk.handler(h, clbk.callback)
      }
    }
  })
}

const triggerCallback = function(clbk, error, value) {
  try {
    if (error) {
      if (clbk.length > 1) {
        clbk(error)
      } else {
        console.log(error.toString())
        // console.log(h.error.toString(), `(in '${h.path}')`)
      }
    } else {
      if (clbk.length == 1) {
        clbk(value)
      } else {
        clbk(null, value)
      }
    }
  } catch(e) {
    console.log(e.stack)
  }
}

// Reloading code
const HANDLERS =
  { read: function(h, clbk) { triggerCallback(clbk, h.error, h.readValue) }
  , path: function(h, clbk) { triggerCallback(clbk, h.error, h.path) }
  , eval:
    { js: function(h, clbk) {
        if (h.evalValue || h.error) {
          triggerCallback(clbk, h.error, h.evalValue)
        } else {
          if (h.readValue) {
            evalCode(h)
            triggerCallback(clbk, h.error, h.evalValue)
          } else {
            // This is just in case we have a race condition where
            // LOAD_PATHS[h.path] exists but we have not yet finished running
            // getData (and thus h.readValue is null).
            getData(h).then(function(data) {
              h.readValue = data
              evalCode(h)
              triggerCallback(clbk, h.error, h.evalValue)
            })
          }
        }
      }
    } 
  }

const emptyClbk = function() {}

// This is set to the currently evaled (reloaded) path to clear callbacks
// accordingly on evalCode
let CALLBACK_ORIGIN

const evalCode = function(h) {
  let code = h.readValue

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

  let self = h.self
  if (!self) {
    // Setup 'module' used inside evaluated code.
    self = new Module(h.path, h.caller_p ? Module._cache[h.caller_p] : null)
    self.filename = h.path
    h.self = self
    h.dirname = lpath.dirname(h.path)
    h.require = function(path) {
      // Require inside the module to load 'children' code
      return Module._load(path, self)
    }
  }
  let sandbox =
    { require:h.require
    , global:global
    , __filename: h.path
    , __dirname:  h.dirname
    , console:console
    , module:self
    , exports:self.exports
    }

  CALLBACK_ORIGIN = h.path
    let rval
    try {
      h.error = null
      rval = vm.runInNewContext(code, sandbox, {filename: h.path})
      if (!self.loaded) {
        self.loaded = true
        Module._cache[h.path] = self
      }
      rval = self.exports
      h.evalValue = rval
    } catch(err) {
      h.error = err
    }
  CALLBACK_ORIGIN = null
}

const getType = function(p) {
  return lpath.extname(p).substr(1)
}  

const setupCallback = function(path, callback, handler, caller_p) {
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
        , caller_p: caller_p
        }

    LOAD_PATHS[path] = h
    onChangedPath(h)
  } else {
    h.callbacks.push(clbk)
    clbk.handler(h, clbk.callback)
  }
}

const statPath = function(path) {
  try {
    return fs.statSync(path)
  } catch (e) {}
  return false
}

const pathCache = {}

const tryFile = function(path) {
  var stats = statPath(path)
  if (stats && !stats.isDirectory()) {
    return fs.realpathSync(path, pathCache)
  }
  return false
}

const tryExtensions = function(path, exts) {
  for(let i = 0, len = exts.length; i < len; ++i) {
    let filename = tryFile(path + '.' + exts[i])
    if (filename) return filename
  }
  return false
}

const findPath = function(request, paths) {
  let exts = Object.keys(HANDLERS.eval)

  if (request.charAt(0) === '/') {
    paths = ['']
  }

  let trailingSlash = (request.slice(-1) === '/')

  for (let i = 0, len = paths.length; i < len; ++i) {
    let basePath = lpath.resolve(paths[i], request)
    let filename

    if (!trailingSlash) {
      // simplest case: path + filename
      filename = tryFile(basePath)

      if (!filename && !trailingSlash) {
        // try all extensions for which we have a handler
        filename = tryExtensions(basePath, exts);
      }
    }

    // We do not support loading packages (yet)
    // if (!filename) {
    //   filename = tryPackage(basePath, exts);
    // }

    if (!filename) {
      // try to load 'index' file
      filename = tryExtensions(lpath.resolve(basePath, 'index'), exts)
    }

    if (filename) return filename
  }
  return false
}

const pathFromCaller = function(caller_id) {
  return lpath.resolve(caller_id.substr(caller_id.indexOf(':') + 1))
}

// Used by watch. Not full resolution.
const resolvePath = function(path, base) {
  let filename
  let start = path.substr(0, 2)
  if (path.charAt(0) === '/') {
    // absolute path
    filename = path
  } else if (start == './' || start == '..') {
    filename = lpath.resolve(base, path)
  } else {
    // funky node_modules path not supported
    throw new Error(`Cannot watch path '${path}' (not a relative or absolute path)`)
  }    
  return filename
}

// Used by require
const resolveFilename = function(path, base) {
  let start = path.substr(0, 2)
  let paths
  if (start != './' && start != '..') {
    // absolute or funky node_modules require
    paths = module.paths
  } else {
    paths = [base]
  }
  let filename = findPath(path, paths)
  if (!filename) {
    throw new Error(`Cannot find path '${path}'`)
  }
  return filename
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
 *
 * If the callback has two arguments, the first one is `error` and the second is
 * the `fullpath`. If the callback does not have two arguments, the error is
 * simply printed.
 */
lib.read = function(path, callback) {
  let caller_p = pathFromCaller(caller())
  let filename = resolveFilename(path, lpath.dirname(caller_p))
  setupCallback(filename, callback, HANDLERS.read, caller_p)
}

/* Async require file at `path` and trigger `callback` every time the file
 * changes. File/module location implementation follows standard `require`
 * [rules](https://nodejs.org/api/modules.html#modules_all_together). The
 * function can take an optional second argument: `base_path`, the starting
 * point from where to start searching for the path.
 * 
 * The `module.exports` is passed as argument to the callback. During each code
 * reload operation, the `module.exports` object is maintained and can be used to store
 * stable state information.
 *
 *   if (!exports.state) {
 *     // initialize state
 *   }
 *   const state = exports.state
 *
 * Compared to Module.require, the 'global' field is not copied as real globals
 * inside the module's sandbox for performance reasons (with the exception of
 * `require` and `console`). Therefore, accessing globals must be done through
 * `global.foo` instead of simply calling `foo`.
 *
 * Finally, live.require does not load packages by parsing package.json (yet)
 * and does not try to find modules in global paths (it makes no sense to live
 * code module stored globally).
 *
 * If the callback has two arguments, the first one is `error` and the second is
 * the `exports`. If an error is raised during code loading/evaluation, the
 * error is passed. If the callback does not have two arguments, the error is
 * simply printed.
 *
 * TODO: return an object on which we can add an error handler with 
 *       'catch(e) { done(e) }' ?
 */
lib.require = function(path, callback) {
  let base, caller_p
  if (arguments.length > 2) {
    base     = callback
    callback = arguments[2]
  } else {
    caller_p = pathFromCaller(caller())
    base = lpath.dirname(caller_p)
  }
  let filename = resolveFilename(path, base)
  let type = getType(filename)
  let handler = HANDLERS.eval[type]
  if (!handler) {
    throw new Error(`Missing handler to evaluate ${type} code.`)
  }
  setupCallback(filename, callback, handler, caller_p)
}

/* Watch for changes to local `path` and trigger `callback` every time the file
 * changes.
 *
 * The fullpath of the file is passed as callback parameter.
 *
 * If the callback has two arguments, the first one is `error` and the second is
 * the `fullpath`. If the callback does not have two arguments, the error is
 * simply printed.
 */
lib.path = function(path, callback) {
  let caller_p = pathFromCaller(caller())
  let filename = resolveFilename(path, lpath.dirname(caller_p))
  // Module._cache[filename]
  setupCallback(filename, callback, HANDLERS.path, caller_p)
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
  let filename = resolvePath(path, lpath.dirname(pathFromCaller(caller())))
  
  if (WATCHED_PATHS[filename]) {
    // nothing to do
  } else {
    let watcher = fs.watch(filename, {persistent:true, recursive:true}, function (event, fname) {
      let p = lpath.resolve(filename, fname)
      let h = LOAD_PATHS[p]
      if (!h) {
        // console.log('unknown changed file "'+p+'"')
      } else {
        // console.log('Changed file "'+p+'"')
        onChangedPath(h)
      }
    })
    WATCHED_PATHS[filename] = watcher
  }
}

/* Execute the code in the callback only once and return the same value on any
 * subsequent call.
 *
 * NOT A GOOD IDEA. LOOKS LIKE IT CAN BE CALLED IN MULTIPLE PLACES IN THE CODE.
 * USE module.x INSTEAD.
 *
lib.once = function(callback) {
  let caller_p = pathFromCaller(caller())

  let value = ONCE_CACHE[caller_p]
  if (value == undefined) {
    value = callback()
    ONCE_CACHE[path] = value
  }
  return value
}
 */

module.exports = lib
