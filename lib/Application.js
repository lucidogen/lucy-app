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
const elapsed  = require('lucy-util').elapsed
const remote   = require('remote')
const live = require('lucy-live')

const Application = function() {
  this.time_ref  = elapsed()
  this.setTime(0)
  this.time_sync = null
  this.bpm       = 120
}

module.exports = Application

Application.prototype.run = function(scene) {
  this.scene = scene
  this.start()
}

Application.prototype.load = function(scene_path) {
  let self = this
  live.require(scene_path, function(mod) {
    mod.scene.ready.then(function(scene) {
      // This means that anytime we alter a scene, it will be run.
      // OK for me.
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
  setTimeout(function() {
    if (self.anim) stop()

    if (self.paused) {
      self.time_ref = elapsed() - self.paused
      self.paused = null
    }

    let anim = function() {
      if (anim == self.anim) {
        requestAnimationFrame(anim)
        self.animate()
      }
    }
    self.anim = anim
    anim()
  },100)
}

Application.prototype.stop = function() {
  this.time_ref = null
  this.anim = null
}

Application.prototype.pause = function() {
  this.paused = this.time
  this.anim   = null
}

Application.prototype.animate = function() {
  this.setTime(elapsed() - this.time_ref)
  this.scene.render(this)
  if (this.stats) {
    let el = (elapsed() - this.time) * 1000
    this.stats.innerHTML = el.toPrecision(3)
  }
}

Application.prototype.setTime = function(s) {
  if (this.time_sync) {
    let last_song = this.song
    // update song position from sync (value in 1/16th)
    let song = this.time_sync.position.value(s)

    // compute BPM
    if (song > this.song) {
      // beats/minute = 60 * beats/second = 60/4 * (delta song)/second
      this.bpm = 60 * (song - this.song) / (s - this.time) / 4
    }
    this.song = song
    this.time = s
  } else {
    this.song = this.bpm * 4 / 60 * (s - this.time)
    this.time = s
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
    this.scene_path = path.resolve(spath)
  } else {
    alert(`Scene path '${spath}' does not exist.`)
  }
}

Application.prototype.saveWorkAs = function(src, trg) {
  let self = this
  if (!self.work_path) {
    return alert('Missing work path (app.setWorkPath not called).')
  }

  if (!self.scene_path) {
    return alert('Missing scene path (app.setScenePath not called).')
  }

  let playing = !self.paused

  if (playing) self.pause()

  self.prompt("Save Work As", "Please enter scene name.", function(name) {
    // Take/update snapshot in working directory 
    let target = path.resolve(self.scene_path, name)
    let copy_op = function() {
      setTimeout(function() {
        // Execute after page refresh to avoid having prompt in center of images
        self.grabImage(function() {
          // Run Async

          // FIXME: Create folder name s001, s002, s003 and set name in s001/info.json ?
          //        Or ensure valid path for all platforms ?
          //        Or just try creating folder and see if it fails ?
          let source = self.work_path
          let target = path.resolve(self.scene_path, name)

            ncp(source, target, function(err) {
              if (err) {
                alert(`Could not create scene (${err}).`)
              }
            })
        })
        if (playing) self.start()
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
  if (!this.work_path) {
    return alert('Missing work path (app.setWorkPath not called).')
  }
  let imagepath = path.join(this.work_path, 'snapshot.png')
  remote.getCurrentWindow().capturePage(function(image) {
    let buffer = image.toPng()
    // The image is a remote object, write in main process to avoid corruption
    // in remote call.
    remote.require('fs').writeFile(imagepath, buffer, function(err) {
      if (err) {
        console.log(err)
      } else {
        clbk(imagepath)
      }
    })
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
