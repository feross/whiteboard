var catNames = require('cat-names')
var dragDrop = require('drag-drop')
var hat = require('hat')
var path = require('path')
var Tracker = require('bittorrent-tracker/client')
var videostream = require('videostream')
var WebTorrent = require('webtorrent')

var TRACKER_URL = 'wss://tracker.webtorrent.io'
// var TRACKER_URL = 'ws://localhost:9000'

var username = catNames.random()

// pick random stroke color
var color = 'rgb(' + hat(8, 10) + ',' + hat(8, 10) + ',' + hat(8, 10) + ')'

var currentPathId = null
var state = {}
var peers = []
var peerId = new Buffer(hat(160), 'hex')

var torrentData = {}
var client = new WebTorrent({ peerId: peerId })
client.on('error', function (err) {
  console.error(err.stack || err.message || err)
})
client.on('warning', function (err) {
  console.error(err.stack || err.message || err)
})

// create canvas
var canvas = document.createElement('canvas')
var ctx = canvas.getContext('2d')
document.body.appendChild(canvas)

// set canvas settings and size
setupCanvas()
window.addEventListener('resize', setupCanvas)

function setupCanvas () {
  // calculate scale factor for retina displays
  var devicePixelRatio = window.devicePixelRatio || 1
  var backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
    ctx.mozBackingStorePixelRatio ||
    ctx.msBackingStorePixelRatio ||
    ctx.oBackingStorePixelRatio ||
    ctx.backingStorePixelRatio || 1
  var ratio = devicePixelRatio / backingStoreRatio

  // set canvas width and scale factor
  canvas.width = window.innerWidth * ratio
  canvas.height = window.innerHeight * ratio
  canvas.style.width = window.innerWidth + 'px'
  canvas.style.height = window.innerHeight + 'px'
  ctx.scale(ratio, ratio)

  // set stroke options
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 4

  // set font options
  ctx.fillStyle = 'rgb(255,0,0)'
  ctx.font = '16px sans-serif'
  redraw()
}

function redraw () {
  // clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // draw the current state
  Object.keys(state).forEach(function (id) {
    var data = state[id]

    // draw paths
    if (data.pts) {
      ctx.beginPath()
      ctx.strokeStyle = data.color
      data.pts.forEach(function (point, i) {
        if (i === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })
      ctx.stroke()
    }

    // draw images/video/audio
    if (data.infoHash) {
      if (!torrentData[data.infoHash]) {
        torrentData[data.infoHash] = { complete: false }
        client.download({
          infoHash: data.infoHash,
          announce: [ TRACKER_URL ]
        }, function (torrent) {
          var file = torrent.files[0]
          if (!file) return
          if (data.img) {
            file.getBuffer(function (err, buf) {
              if (err) return console.error(err)
              toImage(buf, function (err, img) {
                if (err) return console.error(err)
                torrentData[data.infoHash] = { complete: true, img: img }
                redraw()
              })
            })
          } else if (data.stream) {
            torrentData[data.infoHash] = {
              complete: true,
              stream: true,
              file: file
            }
            redraw()
          }
        })
      }
      if (torrentData[data.infoHash].complete) {
        if (torrentData[data.infoHash].img) {
          ctx.drawImage(
            torrentData[data.infoHash].img,
            data.pos.x - (data.width / 4), data.pos.y - (data.height / 4),
            data.width / 2, data.height / 2
          )
        } else if (torrentData[data.infoHash].stream) {
          console.log(torrentData[data.infoHash])
          var extname = path.extname(torrentData[data.infoHash].file.name)
          if (document.querySelector('#' + 'infoHash_' + data.infoHash)) return
          var media
          if (extname === '.mp4' || extname === '.m4v' || extname === '.webm') {
            media = document.createElement('video')
          } else if (extname === '.mp3') {
            media = document.createElement('audio')
          }

          media.style.left = (data.pos.x - 150) + 'px'
          media.style.top = (data.pos.y - 100) + 'px'
          media.id = 'infoHash_' + data.infoHash
          media.controls = true
          media.autoplay = true
          media.loop = true
          document.body.appendChild(media)

          var file = torrentData[data.infoHash].file
          if (extname === '.mp4' || extname === '.m4v') {
            videostream(file, media)
          } else {
            file.createReadStream().pipe(media)
          }
        }
      } else {
        ctx.fillStyle = 'rgb(210,210,210)'
        var width = data.width
        var height = data.height
        console.log(width, height)
        if (torrentData[data.infoHash].stream) {
          width = 240
          height = 135
        }
        ctx.fillRect(
          data.pos.x - (width / 4), data.pos.y - (height / 4),
          width / 2, height / 2
        )
      }
    }
  })

  // draw usernames
  peers.concat({ color: color, username: username })
    .filter(function (peer) {
      return !!peer.username
    })
    .forEach(function (peer, i) {
      ctx.fillStyle = peer.color
      ctx.fillText(peer.username, 20, window.innerHeight - 20 - (i * 20))
    })
}

function broadcast (obj) {
  peers.forEach(function (peer) {
    if (peer.connected) peer.send(obj)
  })
}

canvas.addEventListener('mousedown', onDown)
canvas.addEventListener('touchstart', onDown)

function onDown (e) {
  e.preventDefault()
  currentPathId = hat(80)
  var x = e.clientX || (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].pageX) || 0
  var y = e.clientY || (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].pageY) || 0
  var p1 = { x: x, y: y }
  var p2 = {
    x: x + 0.001,
    y: y + 0.001
  } // paint point on click

  state[currentPathId] = { color: color, pts: [ p1, p2 ] }
  broadcast({ i: currentPathId, pt: p1, color: color })
  broadcast({ i: currentPathId, pt: p2 })
  redraw()
}

document.body.addEventListener('mouseup', onUp)
document.body.addEventListener('touchend', onUp)

function onUp () {
  currentPathId = null
}

canvas.addEventListener('mousemove', onMove)
canvas.addEventListener('touchmove', onMove)

function onMove (e) {
  var x = e.clientX || (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].pageX) || 0
  var y = e.clientY || (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].pageY) || 0
  if (currentPathId) {
    var pt = { x: x, y: y }
    state[currentPathId].pts.push(pt)
    broadcast({ i: currentPathId, pt: pt })
    redraw()
  }
}

var tracker = new Tracker(peerId, 0, {
  announce: [ TRACKER_URL ],
  infoHash: new Buffer(20).fill('webrtc-whiteboard')
})

tracker.start()

tracker.on('peer', function (peer) {
  peers.push(peer)

  if (peer.connected) onConnect()
  else peer.once('connect', onConnect)

  function onConnect () {
    peer.on('data', onMessage)
    peer.on('close', onClose)
    peer.on('error', onClose)
    peer.on('end', onClose)
    peer.send({ username: username, color: color, state: state })

    function onClose () {
      peer.removeListener('data', onMessage)
      peer.removeListener('close', onClose)
      peer.removeListener('error', onClose)
      peer.removeListener('end', onClose)
      peers.splice(peers.indexOf(peer), 1)
      redraw()
    }

    function onMessage (data) {
      if (data.username) {
        peer.username = data.username
        peer.color = data.color
        redraw()
      }

      if (data.state) {
        Object.keys(data.state)
          .filter(function (id) {
            return !state[id]
          })
          .forEach(function (id) {
            state[id] = data.state[id]
          })
        redraw()
      }

      if (data.pt) {
        if (!state[data.i]) state[data.i] = { pts: [], color: data.color }
        state[data.i].pts.push(data.pt)
        redraw()
      }

      if (data.infoHash) {
        state[data.infoHash] = data
        redraw()
      }
    }
  }
})


dragDrop('body', function (files, pos) {
  client.seed(files[0], {
    announce: [ TRACKER_URL ]
  }, function (torrent) {
    if (/.webm|.mp4|.m4v|.mp3$/.test(files[0].name)) {
      var message = {
        stream: true,
        infoHash: torrent.infoHash,
        pos: pos
      }
      console.log(message)
      broadcast(message)
      state[torrent.infoHash] = message
      torrentData[torrent.infoHash] = {
        complete: true,
        stream: true,
        file: torrent.files[0]
      }
      redraw()
    } else if (/.jpg|.png|.gif$/.test(files[0].name)) {
      toImage(files[0], function (err, img) {
        if (err) return console.error(err)
        var message = {
          img: true,
          infoHash: torrent.infoHash,
          pos: pos,
          width: img.width,
          height: img.height
        }
        broadcast(message)
        state[torrent.infoHash] = message
        torrentData[torrent.infoHash] = {
          complete: true,
          img: img
        }
        redraw()
      })
    }
  })
})

function toImage (buf, cb) {
  var blob = Buffer.isBuffer(buf)
    ? new window.Blob([ buf ])
    : buf
  var img = new window.Image()
  img.src = window.URL.createObjectURL(blob)
  img.onload = function () { cb(null, img) }
  img.onerror = function (err) { cb(err) }
}

var ua = navigator.userAgent.toLowerCase()
if (ua.indexOf('android') > -1) {
  document.body.className = 'android'
}
