/*
  # Application

  Lucidity main application

  Properties:

    * song: song position in 1/16th of a note for the current frame
    * time: current frame time reference in seconds
    * bpm:  calculated beats per minute
*/
'use strict'
const path    = require('path')
const fs      = require('fs')
const ncp     = require('ncp').ncp
const elapsed = require('lucy-util').elapsed

const Application = function() {
  this.setTime(elapsed())
  this.time_sync = null
  this.bpm       = 120
}

module.exports = Application

Application.prototype.run = function(scene) {
  this.scene = scene
  this.start()
}

Application.prototype.now = function() {
  return Date.now() / 1000 - this.start_time
}

// Reinstall the runtime loop
Application.prototype.start = function() {
  let self = this
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
  this.anim = null
}


Application.prototype.animate = function() {
  this.setTime(elapsed())
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
  if (!this.work_path) {
    return alert('Missing work path (app.setWorkPath not called).')
  }

  if (!this.scene_path) {
    return alert('Missing scene path (app.setScenePath not called).')
  }

  let name = prompt("Please enter scene name.")
  if (!name) return;
  // FIXME: Create folder name s001, s002, s003 and set name in s001/info.json ?
  //        Or ensure valid path for all platforms ?
  //        Or just try creating folder and see if it fails ?
  let source = this.work_path
  let target = path.resolve(this.scene_path, name)

  if (statPath(target)) {
    if (confirm(`A scene with name '${name}' already exists. Overwrite ?`)) {
      // continue
    } else {
      return;
    }
  }
  ncp(source, target, function(err) {
    if (err) {
      alert(`Could not create scene (${err}).`)
    }
  })

  // Take snapshot
  this.grabImage(path.join(target, 'snapshot.png'))
}

Application.prototype.grabImage = function(imagepath) {
  let renderer
  if (this.scene) {
    renderer = this.scene.renderer
  }
  if (!renderer) {
    // FIXME: Use complete page ?
    // $(canvas).toDataURL() ?
    return console.log("Cannot grab image. scene.renderer not found.")
  }

  let data = renderer.domElement.toDataURL()
  // remove data type header used by image
  data = data.substr(data.indexOf(',') + 1)
  let buffer = new Buffer(data, 'base64')
  fs.writeFile(imagepath, buffer.toString('binary'), 'binary')
}

Application.prototype.webGLRenderer = function() {
  if (this.renderer) return this.renderer
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
