/*
  # Application

  Lucidity main application

*/
'use strict'

const Application = function() {
  this.start_time = Date.now() / 1000
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
  let time = this.now()
  this.scene.render(time)
  // If stats...
  // stats.update()
}
