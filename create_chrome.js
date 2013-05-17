var child_process = require('child_process')
  , spawn = child_process.spawn
  , exec = child_process.exec
  , http = require('http')
  , WebSocket = require('ws')

function getTab(port, callback) {
  function tryConnecting() {
    //console.log('trying to get tab address');
    var request = http.request({
      host: 'localhost',
      port: port,
      method: 'GET',
      path: '/json'
    })
    request.end()

    request.on('response', function(res) {
      res.on('data', function(tabs) {
        tabs = JSON.parse(tabs.toString())
        callback(tabs[0].webSocketDebuggerUrl)
      })
    })

    request.on('error', setTimeout.bind(null, tryConnecting, 100))
  }

  tryConnecting()
}

function create_chrome(args, callback) {
  var browser = create_chrome.browser

    exec('pkill ' + (browser === 'google-chrome' ? 'chrome' : 'chromium'), function() {
    var debug_port = Math.round(1024 + Math.random()*10000)
      , chrome = spawn(browser, args.concat('--remote-debugging-port=' + debug_port))

    getTab(debug_port, function(url) {
      var socket = new WebSocket(url)

      socket.kill = chrome.kill.bind(chrome)

      // More convenient send
      var send = socket.send, callbacks = {}

      socket.send = function(message, callback) {
        if (message.id === undefined) message.id = Math.round(1000 + Math.random()*10000)
        //console.log('outgoing message', JSON.stringify(message))
        if (callback) callbacks[message.id] = callback;
        send.call(socket, JSON.stringify(message))
      }

      socket.on('message', function(message) {
        //console.log('incoming message', message)
        message = JSON.parse(message)
        if (message.id in callbacks) callbacks[message.id](message)
      })

      // Ready
      socket.on('open', callback.bind(null, socket))
    })
  })
}

create_chrome.browser = 'google-chrome'

module.exports = create_chrome
