const live = global.live_lib

let p = global.live_reload_prefix

live.path('bar.js', function() {
  // If this callback stays alive, the value should change
  // even though we reloaded this script and changed the
  // prefix.

  // Callback executed, continue tests
  global.live_reload_gen.next('bar:'+p)
})

// Return p to ensure file was properly run
p
