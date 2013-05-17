var fs = require('fs')
  , child_process = require('child_process')
  , spawn = child_process.spawn
  , exec = child_process.exec
  , Measurement = require('./measure_base')
  , timeline = require('./measure_timeline')
  , tcpdump = require('./measure_tcpdump')
  , network = require('./measure_network')
  , log = require('./measure_log')
  , preload = require('./measure_preload')
  , _ = require('underscore')

function MeasurementConfiguration(options) {
  this.options = options
}

var id = 0
MeasurementConfiguration.prototype.measure = function(success, failure) {
//  var measurement = new Measurement(this.options.chrome.concat(this.options.url))
  exec('pkill chrom', function() {
  var measurement = new Measurement(this.options.chrome)
    , result = {}
    , remaining = 0
    , output
    //, id = Math.round(Math.random() * 10000)

  id += 1

  if (this.options.timeline) {
    remaining += 1
    output = timeline(measurement)
    output.pipe(fs.createWriteStream(result.timeline = '/tmp/' + id + '.timeline'))
    output.on('end', ready)
  }

  if (this.options.capture) {
    remaining += 1
    output = tcpdump(measurement, this.options.capture)
    output.pipe(fs.createWriteStream(result.capture = '/tmp/' + id + '.pcap'))
    output.on('end', ready)
  }

  if (this.options.network) {
    remaining += 1
    output = network(measurement)
    output.pipe(fs.createWriteStream(result.network = '/tmp/' + id + '.network'))
    output.on('end', ready)
  }

  if (this.options.log) {
    var logs = (this.options.log instanceof Array) ? this.options.log : [this.options.log]
    remaining += logs.length
    result.log = []
    logs.forEach(function(command, index) {
      var output_file = '/tmp/' + id + '.log' + index
      result.log.push(output_file)
      output = log(measurement, command)
      output.pipe(fs.createWriteStream(output_file))
      output.on('end', ready)
    })
  }

  if (this.options.preload) {
    preload(measurement, this.options.preload)
  }

  remaining += 1
  measurement.open(this.options.url)
  measurement.on('result', function(performance) {
    result.performance = performance
    ready()
    //success(result)
  })
  measurement.on('failed', failure)

  function ready() {
    remaining -= 1
    //console.log('ready. remaining:', remaining)
    if (!remaining) {
      success(result)
    }
  }
  }.bind(this))
}

MeasurementConfiguration.prototype.start = function(callback) {
  var self = this
    , first = true
    , serverInstance

  function bootstrap(ready) {
    if (self.options.server) {
      if (serverInstance) serverInstance.kill()

      serverInstance = spawn('bash', ['-c', server])
      serverInstance.stdout.pipe(process.stderr)
      serverInstance.stderr.pipe(process.stderr)

      ready()

    } else if (self.options.reset) {
      if (first) {
        first = false
        return ready()
      }

      exec(self.options.reset, setTimeout.bind(null, ready, 3000))

    } else {
      ready()
    }
  }

  var results = []
  function run() {
    bootstrap(function() {
      self.measure(function success(result) {
        results.push(result)

        if (results.length < self.options.times) {
          setTimeout(run, 2000)
        } else {
          var evaluated = self.evaluate(results)
          callback(evaluated.summary, evaluated.results)
        }

      }, function failure() {
        console.log('error')
        process.exit()
        setTimeout(run, 2000)
      })
    })
  }

  run()
}

MeasurementConfiguration.prototype.evaluate = function(results) {
  var evaluated = {}

  results.forEach(function(result) {
    result.performance.duration = result.performance.loadEventEnd - result.performance.navigationStart
  })

  results = results.filter(function(result) {
    return result.performance.duration > 1500
  })

  results = _.sortBy(results, function(result) {
    return result.performance.duration
  })

  evaluated.performances = results.map(function(result) { return result.performance })

  var sum = results.reduce(function(sum, result) {
    return sum + result.performance.duration
  }, 0)

  evaluated.average = sum / results.length
  var distance_sorted = _.sortBy(results, function(result) {
    return Math.abs(result.performance.duration - evaluated.average)
  })
  evaluated.average_result = results.indexOf(distance_sorted[0])

  if (results.length > 1) {
    evaluated.standard_deviation = Math.sqrt((1/(results.length - 1)) * results.reduce(function(sum, result) {
      return sum + Math.pow(result.performance.duration - evaluated.average, 2)
    }, 0))
  } else {
    evaluated.standard_deviation = -1
  }

  evaluated.median_result = Math.ceil(results.length/2) - 1
  var median_record = results[evaluated.median_result]
  evaluated.median = median_record && median_record.performance.duration

  return {
    summary: evaluated,
    results: results
  }
}




function parseArg(args, name, bool) {
  var index
  if (bool) {
    index = args.indexOf('--' + name)
    if (index === -1) {
      return false
    } else {
      args.splice(index, 1)
      return true
    }
  }

  var hits = []

  while ((index = args.indexOf('--' + name)) !== -1) {
    hits.push(args.splice(index, 2)[1])
  }

  return (hits.length <= 1) ? hits[0] : hits
}

var args = process.argv.slice(2)

var options = { times: Number(parseArg(args, 'times')) || 1
              , reset: parseArg(args, 'reset')
              , server: parseArg(args, 'server')
              , path: parseArg(args, 'path') || './results'
              , capture: parseArg(args, 'capture')
              , log: parseArg(args, 'log')
              , timeline: parseArg(args, 'timeline', true)
              , network: parseArg(args, 'network', true)
              , print: parseArg(args, 'print')
              , save: (parseArg(args, 'save') || '').split(',')
              , preload: (parseArg(args, 'preload') || '').split(',')
              }

options.url = args.pop()
options.chrome = args

var config = new MeasurementConfiguration(options)

_.templateSettings = {
  interpolate : /\{(.+?)\}/g,
  evaluate : /\{\[(.+?)\]\}/g
}

config.start(function(summary, results) {
  if (options.save.indexOf('summary') !== -1) {
    fs.writeFileSync(options.path + '.summary', JSON.stringify(summary, null, 2))
  }

  var toSave = {}
  if (options.save.indexOf('all')     !== -1) toSave = _.clone(results)
  if (options.save.indexOf('median')  !== -1) toSave.median = results[summary.median_result]
  if (options.save.indexOf('average') !== -1) toSave.average = results[summary.average_result]
  if (options.save.indexOf('best')    !== -1) toSave.best = results[0]
  if (options.save.indexOf('worst')   !== -1) toSave.worst = results[results.length - 1]
  Object.keys(toSave).forEach(function(key) {
    var path = options.path + '.' + key
    fs.writeFileSync(path + '.performance', JSON.stringify(toSave[key].performance, null, 2))
    if (options.timeline) exec('cp ' + toSave[key].timeline + ' ' + path + '.timeline')
    if (options.capture ) exec('cp ' + toSave[key].capture  + ' ' + path + '.pcap')
    if (options.network ) exec('cp ' + toSave[key].network  + ' ' + path + '.network')
    if (options.log     ) toSave[key].log.forEach(function(logfile, index) {
      exec('cp ' + logfile + ' ' + path + '.log' + index)
    })
  })

  if (options.print) {
    console.log(_.template(options.print, summary))
  }

  process.exit()
})
