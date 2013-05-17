var EventEmitter = require('events').EventEmitter
  , util = require('util')
  , create_chrome = require('./create_chrome')

function Measurement() {
  var self = this

  self.args = Array.prototype.slice.call(arguments)

  self.transition = function(state) {
    //console.error('STATE CHANGE:', state)
    //console.trace()
    self.state = state
    self.emit(state)
    if (state in self) self[state]()
  }

  self.transition('init')
}

util.inherits(Measurement, EventEmitter)

Measurement.prototype.init = function() {
  var self = this
    , chrome_args = this.args[0]

  setTimeout(function() {
    if (this.state !== 'end') this.transition('failed')
  }.bind(this), 50000)

  create_chrome(chrome_args, function(chrome) {
    self.chrome = chrome

    self.chrome.send({method: 'Page.enable'}, function(response) {
      if (response.error) return self.transition('failed')

      // Waiting for the initial CPU burst to pass
      var start = setTimeout.bind(null, self.transition.bind(self, 'ready'), 500)

      if (self.prepare) {
        self.prepare(start)
      } else {
        start()
      }
    })

  })
}

Measurement.prototype.open = function(url) {
  if (this.state !== 'ready') return this.on('ready', this.open.bind(this, url))

  this.transition('started')

  this.chrome.send({method: 'Page.navigate', params: {url: url}})
}

Measurement.prototype.started = function() {
  var self = this

  self.chrome.on('message', function(message) {
    message = JSON.parse(message)
    if (message.method === 'Page.loadEventFired') self.transition('completed')
  })
}

Measurement.prototype.completed = function() {
  var self = this

  setTimeout(function() {
  self.chrome.send({
    method: 'Runtime.evaluate',
    params: {
      expression: 'window.performance.timing',
      returnByValue: true
    }
  }, function(response) {
    self.result = response.result.result.value
    setTimeout(self.emit.bind(self, 'result', self.result), 0)
    self.transition('end')
  })
  }, 5000)
}

Measurement.prototype.failed = function() {
  this.transition('end')
}

Measurement.prototype.end = function() {
  if (this.chrome) this.chrome.kill()
}


module.exports = Measurement
