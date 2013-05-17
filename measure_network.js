var Stream = require('stream').Stream

module.exports = function(measurement) {
  if (measurement.state && measurement.state !== 'init') throw new Error('Too late to start timeline recording.')

  var running = true
    , first = true

  var output = new Stream()
  output.readable = true

  measurement.on('started', function() {
    measurement.chrome.send({
      method: 'Network.enable',
    }, function(response) {
      if (response.error) throw new Error('Couldn\'t enable network tracking.')
    })

    output.emit('data', '[\n')

    measurement.chrome.on('message', function(message) {
      if (!running) return

      message = JSON.parse(message)

      if (!message.method || message.method.indexOf('Network.') !== 0) return

      if (first) {
        first = false
      } else {
        output.emit('data', ',\n')
      }

      output.emit('data', JSON.stringify(message))
    })
  })

  measurement.on('completed', function() {
    output.emit('data', '\n]')
    output.emit('end')
    running = false
  })

  return output
}

/*
 var Measurement = require('./measure_base')
 var m = new Measurement(['http://www.hvg.hu'])
 var fs = require('fs')
 module.exports(m).pipe(fs.createWriteStream('./x.timeline'))
 m.start()
 */
