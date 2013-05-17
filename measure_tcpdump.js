var child_process = require('child_process')
  , spawn = child_process.spawn
  , Stream = require('stream').Stream

module.exports = function(measurement, interface) {
  if (measurement.state && measurement.state !== 'init') throw new Error('Too late to start tcpdump.')

  var output = new Stream()
  output.readable = true

  measurement.on('started', function() {
    var args = ['-w', '-']
    if (interface && interface !== 'all') args = args.concat(['-i', interface])
    var tcpdump_instance = spawn('tcpdump', args)

    tcpdump_instance.stdout.on('data', output.emit.bind(output, 'data'))
    tcpdump_instance.stdout.on('end',  output.emit.bind(output, 'end'))

    measurement.on('completed', tcpdump_instance.kill.bind(tcpdump_instance))
    measurement.on('failed', tcpdump_instance.kill.bind(tcpdump_instance))
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
