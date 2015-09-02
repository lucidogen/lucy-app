/*
  # Application

  Lucidity main application

  Properties:

    * song: song position in 1/16th of a note for the current frame
    * time: current frame time reference in seconds
    * bpm:  calculated beats per minute
*/
'use strict'
const path     = require('path')
const fs       = require('fs')
const ncp      = require('ncp').ncp
// TMP HACK: DOES NOT WORK ON WINDOWS
// const midi     = require('lucy-midi')
const osc      = require('node-osc')
const rmdir    = require('rimraf')
const remote   = function ()
{ try
  { let r = require ( 'remote' )
    return r
  }
  catch ( e )
  { return {} // FIXME: how can we test with 'remote' out of electron ?
  }
} ()

const elapsed  = require('lucy-util').elapsed
const Continuous = require('lucy-util').Continuous
const live     = require('lucy-live')

const Application = function ()
{ this.time_ref  = elapsed()
  this.time_sync = null
  this.sync_delta = 0
  this.stat_value = 0
  this.last_time  = 0
  this.osc_map = []

  this.fx =
    { lucy_time:   0
    , lucy_song:   0
    , lucy_bpm:    120
    , lucy_aspect: 0
    }
  this.setTime(0)
}

module.exports = Application
Application.prototype.type = 'lucy-app.Application'

// This can be skipped if all settings are mapped with mapOSC
// or other parameter mapping methods.
Application.prototype.setFxControls = function(ctrls) {
  for (let key in ctrls) {
    this.fx[key] = ctrls[key]
  }
}

// TODO: Can be removed
Application.prototype.configureDefaultUniforms = function(uniforms) {
  // not needed: can be done on the fly in setDefaultUniforms
  for (let key in this.fx) {
    uniforms[key] = {type: 'f', value: this.fx[key]}
  }
}

Application.prototype.setDefaultUniforms = function(uniforms, camera) {
  // FIXME: We should only need to set this once for the camera.
  for (let key in this.fx) {
    let uni = uniforms[key]
    if (!uni) {
      uniforms[key] = {type:'f', value:this.fx[key]}
    } else {
      uni.value = this.fx[key]
    }
  }
  uniforms.lucy_aspect.value = camera.aspect
}

Application.prototype.run = function(scene) {
  let data
  if (this.scene) {
    data = this.scene.offline()
    data = this.scene._offlineSub()
  }
  scene.online(data)

  this.scene = scene
  this.scene._onlineSub()
  this.scene.online()
  this.start()
}

// Copy scene to workbench and reload.
Application.prototype.edit = function(scene_path) {
  let self = this

  if (!self.work_path) {
    return alert('Missing work path (app.setWorkPath not called).')
  }

  let source = path.resolve(scene_path)
  let target = self.work_path

  console.log(`EDIT ${source} ==> ${target}`)

  if (source == target) {
    self.load(self.work_path)
    return
  } 

  rmdir(self.work_path, function(err) {
    if (err) {
      console.log(`Could not edit scene (${err}).`)
    } else {
      ncp(source, target, NCP_OPTIONS, function(err) {
        if (err) {
          alert(`Could not edit scene (${err}).`)
        } else {
          remote.getCurrentWindow().restart()
        }
      })
    }
  })
}

Application.prototype.load = function(scene_path) {
  let self = this

  if (self.scene_path == scene_path) return

  self.scene_path = scene_path
  let info_path = path.join(scene_path, 'snapshot.json')
  let info = {time: self.time}

  if (statPath(info_path)) {
    info = require(info_path)
  }

  console.log(`LOAD "${scene_path}"`)

  live.require(scene_path, function(proxy) {
    if (proxy.type == undefined) {
      console.log('PLEASE FIX ' + scene_path + ' (use module.exports = fx).')
      proxy = proxy.scene
    }
    proxy.ready.then(function(scene) {
      // This means that anytime we alter a scene, it will be run.
      // OK for me.
      // Reset time to snapshot
      self.paused = info.time || self.fx.lucy_time
      self.run(scene)
    })
  })
}

Application.prototype.togglePause = function() {
  if (this.paused) {
    this.start()
  } else {
    this.pause()
  }
}

// Reinstall the runtime loop
Application.prototype.start = function() {
  let self = this

  if (self.paused) {
    self.time_ref = elapsed() - self.paused
    self.paused = null
    return
  }

  if (self.anim) stop()

  let anim = function() {
    if (anim == self.anim) {
      requestAnimationFrame(anim)
      self.animate()
    }
  }
  self.anim = anim
  anim()
}

Application.prototype.stop = function() {
  this.time_ref = null
  this.anim = null
}

Application.prototype.pause = function() {
  this.paused = this.fx.lucy_time
}


Application.prototype.animate = function() {
  let now  = elapsed()

  if (this.stats) {
    let el = (now - this.last_time) * 1000
    let dt = el - this.stat_value
    if (Math.abs(dt) > 1) {
      this.stat_value += dt/5.
    } else {
      this.stat_value += dt/30.
    }
    if (this.stat_value > 17) {
      this.stats.style.color = 'red'
    } else {
      this.stats.style.color = 'black'
    }
    this.stats.innerHTML = this.stat_value.toPrecision(3)
  }

  if (!this.paused) {
    this.setTime(now - this.time_ref)
  }

  this.scene.render(this)

  this.last_time = now
}

Application.prototype.toggleStats = function() {
  if (this.stats) {
    this.stats.style.display = 'none'
    this.stats_dom = this.stats
    this.stats = null
  } else {
    this.stats = this.stats_dom
    this.stats.style.display = 'block'
    this.stats_dom = null
  }
}

// Application.prototype.midiSync = function(port, mode) {
//   if (this.time_sync) {
//     // Remove ? Alert ?
//     throw new Error(`Already using sync with ${this.time_sync.type}.`)
//   }
//   this.time_sync = new midi.Sync(port, mode)
// }

// FIXME Use a mapping table for effects...
const SONG_POS_RE = new RegExp("/sync/song/(\\d+)")

// If callback is omitted we use fx setting from key.
Application.prototype.mapOSC = function(map, callback) {
  let self = this
  let using_fx

  if (!callback) {
    using_fx = true
    let fx = self.fx
    callback = function(value, url, key) {
      fx[key] = value
    }
  }
  if (typeof map == 'string') {
    self.osc_map.push({url:map, callback})
  } else if (map instanceof RegExp) {
    self.osc_map.push({re:map, callback})
  } else {
    map.forEach(function(elem) {
      elem.callback = elem.callback || callback
      if (using_fx && elem.key) {
        self.fx[elem.key] = elem.default || 0
      }
      self.osc_map.push(elem)
    })
  }
}

Application.prototype.oscSync = function(port) {
  let self = this

  if (self.time_sync) {
    // Remove ? Alert ?
    throw new Error(`Already using sync with ${self.time_sync.type}.`)
  }
  let time_sync = self.time_sync = { type: 'oscSync' }
  let oscServer = new osc.Server(port || 7031, '0.0.0.0');
  let position  = time_sync.position = new Continuous ( 0.8 )

  oscServer.on("message", function (msg, rinfo) {
    let url = msg[0]
    let re  = SONG_POS_RE.exec(url)
    // FIXME: Replace this with calls to mapOSC
    if (re) {
      if (msg[1] > 0) { // ignore note off
        position.setValue(parseInt(re[1]), elapsed()) //  + self.sync_delta)
      }
    } else if (url === '/sync/clip') {
      if (msg[1] != '-none-') {
        let p = path.join(self.scene_basepath, msg[1])
        if (statPath(p)) {
          self.load(p)
        } else {
          console.log(`Could not find scene '${p}'.`)
        }
      }
    } else if (url === '/sync/song') {
      position.setValue(msg[1], elapsed() + self.sync_delta)
    } else if (url === '/sync/pause') {
      if (msg[1] === 1) {
        position.stop()
      } else {
        position.start()
      }
    } else {
      let not_done = self.osc_map.every(function(map) {
        if (map.url) {
          if (url === map.url) {
            map.callback(msg[1], url, map.key)
            return false // stop
          }
        } else if (map.re) {
          let re = map.re.exec(url)
          if (re) {
            re.unshift(msg[1])
            map.callback.apply(re, re)
            return false // stop
          }
        }
        return true
      })
      if (not_done) {
        console.log("OSC message:");
        console.log(msg);
      }
    }
  })                    
  time_sync.oscServer = oscServer
}

Application.prototype.setTime = function(s) {
  let time_sync = this.time_sync
  let fx = this.fx
  if (time_sync) {
    fx.lucy_bpm  = time_sync.bpm
    fx.lucy_song = time_sync.position.value(s)
    fx.lucy_time = s
  } else {
    fx.lucy_song = fx.lucy_bpm / 60 * s
    fx.lucy_time = s
  }
}


const statPath = function(path) {
  try {
    return fs.statSync(path)
  } catch (e) {}
  return false
}        

Application.prototype.setWorkPath = function(wpath) {
  wpath = path.resolve(wpath)
  if (statPath(wpath)) {
    this.work_path = path.resolve(wpath)
  } else {
    alert(`Work path '${wpath}' does not exist.`)
  }
}

Application.prototype.setScenePath = function(spath) {
  spath = path.resolve(spath)
  if (statPath(spath)) {
    this.scene_basepath = path.resolve(spath)
  } else {
    alert(`Scene path '${spath}' does not exist.`)
  }
}

const NCP_OPTIONS =
  { filter: function(name) {
       return name.split('/').pop()[0] != '.'
     }
  }

Application.prototype.saveAs = function() {
  let self = this

  let source = self.scene_path || self.work_path
  
  if (!source) {
    return alert('Missing work path (app.setWorkPath not called).')
  }

  if (!self.scene_basepath) {
    return alert('Missing scene path (app.setScenePath not called).')
  }

  let st = statPath(source)
  if (!st || !st.isDirectory()) {
    // use parent directory
    source = path.dirname(source)
  }

  st = statPath(source)
  if (!st) {
    return alert(`Could not find source '${source}'.`)
  }

  let playing = !self.paused

  if (playing) self.pause()

  self.prompt("Save As", "Please enter scene name.", function(name) {
    name = encodeURIComponent(name.replace(' ', '-'))
    // Take/update snapshot in working directory 
    let target = path.resolve(self.scene_basepath, name)
    let copy_op = function() {
      setTimeout(function() {
        // Execute after page refresh to avoid having prompt in center of images
        self.grabImage(function() {
          // Run Async
          ncp(source, target, NCP_OPTIONS, function(err) {
            if (err) {
              alert(`Could not create scene (${err}).`)
            }
          })
        })
        if (playing) {
          setTimeout(function() {
            // avoid flicker
            self.start()
          }, 80)
        }
      }, 50)
    }
    if (statPath(target)) {
      self.confirm('Folder exists', `A scene with name '${name}' already exists. Overwrite ?`, copy_op, function() {
        if (playing) self.start()
      })
    } else {
      copy_op()
    }
  }, function() {
    if (playing) self.start()
  })
}

Application.prototype.grabImage = function(clbk) {
  let self = this
  if (!self.work_path) {
    return alert('Missing work path (app.setWorkPath not called).')
  }
  let imagepath = path.join(self.work_path, 'snapshot.png')

  let write_clbk = function(err) {
    if (err) {
      console.log(err)
    } else {
      // snapshot created, update info.json file
      // TODO: could add other uniforms/params.
      let info = JSON.stringify(
        { time: self.fx.lucy_time
        }
      )
      fs.writeFile(path.join(self.work_path, 'snapshot.json'), info, function(err) {
        if (!err) {
          clbk(imagepath)
        } else {
          console.log(err)
        }
      })
    }
  }

  let scene = self.scene

  if (scene) {
    // Try to use canvas element
    let domElement = self.scene.domElement
    if (!domElement && self.scene.renderer) {
      domElement = 
        // THREE WebGLRenderer
        self.scene.renderer.domElement ||
        // compose.WebGLRenderer
        self.scene.renderer.renderer.domElement
    }

    if (domElement) {
      let data = domElement.toDataURL()
      // remove data type header used by image
      data = data.substr(data.indexOf(',') + 1)
      let buffer = new Buffer(data, 'base64')
      
      fs.writeFile(imagepath, data, 'base64', write_clbk)
      return
    }
  }

  remote.getCurrentWindow().capturePage(function(image) {
    // The image is a remote object, write in main process to avoid corruption
    // in remote call.
    // Problem with capturePage and remote buffers is size limit for IPC comm.
    let buffer = image.toPng()
    remote.require('fs').writeFile(imagepath, buffer, write_clbk)
  })
}

Application.prototype.webGLRenderer = function() {
  if (this.renderer) return this.renderer
}

Application.prototype.openDialog = function(title, message, onOK, onCancel, showCancel, showField) {
  this.dialog =
    { title:      title
    , message:    message
    , onOK:       onOK
    , onCancel:   onCancel
    , showCancel: showCancel
    , showField:  showField
    }
  if (showCancel) {
    document.getElementById('dialog-btn-cancel').style.display = 'block'
  } else {
    document.getElementById('dialog-btn-cancel').style.display = 'none'
  }
  document.getElementById('dialog').style.display = 'block';
  document.getElementById('dialog-title').innerHTML   = title
  document.getElementById('dialog-message').innerHTML = message
  let form = document.getElementById('dialog-form')
  if (showField) {
    form.style.display = 'block'
    let fld = document.getElementById('dialog-fld')
    fld.value = ''
    fld.focus()
  } else {
    form.style.display = 'none'
    let btn = document.getElementById('dialog-btn-ok')
    btn.focus()
  }
}

Application.prototype.closeDialog = function(clbk, value) {
  this.dialog = null
  document.getElementById('dialog').style.display = 'none'
  if (clbk) clbk(value)
}

Application.prototype.btnCancel = function() {
  if (this.dialog) {
    this.closeDialog(this.dialog.onCancel)
  }
}

Application.prototype.btnOK = function() {
  if (this.dialog && this.dialog.onOK) {
    if (this.dialog.showField) {
      let v = document.getElementById('dialog-fld').value
      this.closeDialog(this.dialog.onOK, v)
    } else {
      this.closeDialog(this.dialog.onOK)
    }
  }
}

Application.prototype.alert = function(a, b) {
  let title, msg
  if (typeof(b) == 'string') {
    title = a
    msg   = b
  } else {
    title = 'Alert'
    msg   = a
  }
  this.openDialog(title, msg)
}

Application.prototype.prompt = function(a, b, c, d) {
  let title, msg, onOK, onCancel
  if (typeof(b) == 'string') {
    title    = a
    msg      = b
    onOK     = c
    onCancel = d
  } else {
    title = 'Prompt'
    msg      = a
    onOK     = b
    onCancel = c
  }
  this.openDialog(title, msg, onOK, onCancel, true, true)
}

Application.prototype.confirm = function(a, b, c, d) {
  let title, msg, onOK, onCancel
  if (typeof(b) == 'string') {
    title    = a
    msg      = b
    onOK     = c
    onCancel = d
  } else {
    title = 'Confirm'
    msg      = a
    onOK     = b
    onCancel = c
  }
  this.openDialog(title, msg, onOK, onCancel, true)
}


Application.prototype.init = function(url) {
  //
  //
  const app  = require('app')
  const Menu = require('menu')
  const MenuItem      = require('menu-item')
  const BrowserWindow = require('browser-window')

  require('crash-reporter').start()

  // main Window
  var mainWindow = null

  // Quit on all windows close
  app.on('window-all-closed', function() { app.quit() })

  app.on('ready', function() {
    mainWindow = new BrowserWindow({width:800, height:600})
    mainWindow.loadUrl(url)

    mainWindow.on('closed', function() {
      // Dereference window object. Not really needed since we quit in this app.
      mainWindow = null
    })

    var template = [{
        label: 'Seven',
        submenu: [{
          label: 'About Seven',
          selector: 'orderFrontStandardAboutPanel:'
        }, {
          type: 'separator'
        }, {
          label: 'Services',
          submenu: []
        }, {
          type: 'separator'
        }, {
          label: 'Hide Electron',
          accelerator: 'Command+H',
          selector: 'hide:'
        }, {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:'
        }, {
          label: 'Show All',
          selector: 'unhideAllApplications:'
        }, {
          type: 'separator'
        }, {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: function() {
            app.quit();
          }
        }, ]
      // }, {
      // 	label: 'Edit',
      // 	submenu: [{
      // 		label: 'Undo',
      // 		accelerator: 'Command+Z',
      // 		selector: 'undo:'
      // 	}, {
      // 		label: 'Redo',
      // 		accelerator: 'Shift+Command+Z',
      // 		selector: 'redo:'
      // 	}, {
      // 		type: 'separator'
      // 	}, {
      // 		label: 'Cut',
      // 		accelerator: 'Command+X',
      // 		selector: 'cut:'
      // 	}, {
      // 		label: 'Copy',
      // 		accelerator: 'Command+C',
      // 		selector: 'copy:'
      // 	}, {
      // 		label: 'Paste',
      // 		accelerator: 'Command+V',
      // 		selector: 'paste:'
      // 	}, {
      // 		label: 'Select All',
      // 		accelerator: 'Command+A',
      // 		selector: 'selectAll:'
      // 	}, ]
      }, {
        label: 'View',
        submenu: [{
          label: 'Reload',
          accelerator: 'Command+R',
          click: function() {
            mainWindow.restart();
          }
        }, {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: function() {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          }
        }, {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: function() {
            mainWindow.toggleDevTools();
          }
        }, ]
      }, {
        label: 'Window',
        submenu: [{
          label: 'Minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:'
        }, {
          label: 'Close',
          accelerator: 'Command+W',
          selector: 'performClose:'
        }, {
          type: 'separator'
        }, {
          label: 'Bring All to Front',
          selector: 'arrangeInFront:'
        }, ]
      }, {
        label: 'Help',
        submenu: [{
          label: 'Learn More',
          click: function() {
            require('shell').openExternal('http://electron.atom.io')
          }
        }, {
          label: 'Documentation',
          click: function() {
            require('shell').openExternal('https://github.com/atom/electron/tree/master/docs#readme')
          }
        }, {
          label: 'Community Discussions',
          click: function() {
            require('shell').openExternal('https://discuss.atom.io/c/electron')
          }
        }, {
          label: 'Search Issues',
          click: function() {
            require('shell').openExternal('https://github.com/atom/electron/issues')
          }
        }]
      }];

      let menu = Menu.buildFromTemplate(template);
      Menu.setApplicationMenu(menu);

  })
  
}
