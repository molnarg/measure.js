var child_process = require('child_process')
  , exec = child_process.exec
  , spawn = child_process.spawn
  , Stream = require('stream').Stream

module.exports = function(measurement, command) {
  var output = new Stream()
  output.readable = true
  output.writable = true
  output.write = function(data) { this.emit('data', data) }
  output.end = function(data) { this.emit('end', data) }

  var child
  measurement.on('result', function() {
    child = spawn('bash', ['-c', command])
    child.stdout.pipe(output)
  })

  measurement.on('failed', function() {
    //console.log('log end')
    if (child) child.kill()
    output.end()
  })

  return output
}

/*
var Measurement = require('./measure_base')
var m = new Measurement(['--incognito', '--disable-plugins', 'http://www.hvg.hu'])
var fs = require('fs')
module.exports(m, 'wlan0').pipe(fs.createWriteStream('./x.pcap'))
m.start()
m.on('result', function(result) {
  console.log('RESULT', result)
})
*/
