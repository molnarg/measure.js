var child_process = require('child_process')
  , exec = child_process.exec
  , spawn = child_process.spawn
  , Stream = require('stream').Stream

function preload(measurement, url) {
  console.error('preloading', url)
  measurement.chrome.send({method: 'Page.navigate', params: {url: url}})
}

function preload_all(measurement, urls, callback) {
  if (urls.length === 0) return callback()
  urls.push('about:blank')

  var ready = false
  measurement.chrome.on('message', function(message) {
    if (JSON.parse(message).method !== 'Page.loadEventFired' || ready) return
    if (urls.length !== 0) return preload(measurement, urls.shift())
    // the end
    ready = true
    callback()
  })

  preload(measurement, urls.shift())
}

module.exports = function(measurement, urls) {
  measurement.prepare = function(callback) {
    setTimeout(function() {
      preload_all(measurement, urls.slice().filter(function(url){ return url.length }), callback)
    }, 500)
  }
}
