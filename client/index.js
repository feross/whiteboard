var Client = require('bittorrent-client')
var concat = require('concat-stream')
var dragDrop = require('drag-drop/buffer')
var hat = require('hat')
var Tracker = require('webtorrent-tracker')

var username = window.prompt('What is your name?')
var color = 'rgb(' + hat(8, 10) + ',' + hat(8, 10) + ',' + hat(8, 10) + ')'
var currentPathId = null
var state = {}
var imgs = {}

var peers = []
var peerId = new Buffer(hat(160), 'hex')
var client = new Client({ peerId: peerId })

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
  ctx.lineWidth = 5

  // set font options
  ctx.fillStyle = 'rgb(255,0,0)'
  ctx.font ='16px sans-serif'
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

    // draw images
    if (data.infoHash) {
      if (!imgs[data.infoHash]) {
        imgs[data.infoHash] = { complete: false, img: null }
        client.download({
          infoHash: data.infoHash,
          announce: [ 'ws://tracker.webtorrent.io:9003' ]
        }, function (torrent) {
          torrent.files[0].createReadStream().pipe(concat(function (buf) {
            bufToImage(buf, function (img) {
              imgs[data.infoHash] = { complete: true, img: img }
              redraw()
            })
          }))
        })

        ctx.fillRect(data.pos.x - 100, data.pos.y - 100, 200, 200)
        return
      }
      if (imgs[data.infoHash].complete) {
        var img = imgs[data.infoHash].img
        ctx.drawImage(img, data.pos.x - 100, data.pos.y - 100, 200, 200)
      }
    }
  })

  // draw usernames
  peers.concat({ color: color, username: username })
    .forEach(function (peer, i) {
      var username = peer.username || '<new peer>'
      ctx.fillStyle = peer.color
      ctx.fillText(username, 20, window.innerHeight - 20 - (i * 20))
    })
}

var tracker = new Tracker(peerId, {
  announce: [ 'ws://tracker.webtorrent.io:9003' ],
  infoHash: new Buffer(20)
})

tracker.start()

tracker.on('peer', function (peer) {
  peers.push(peer)
  peer.send({ username: username, color: color, state: state })
  peer.on('message', onMessage.bind(undefined, peer))
  peer.on('close', function () {
    peers.splice(peers.indexOf(peer), 1)
    redraw()
  })
})

function broadcast (obj) {
  peers.forEach(function (peer) {
    peer.send(obj)
  })
}

function onMessage (peer, data) {
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

canvas.addEventListener('mousedown', function (e) {
  currentPathId = hat(80)
  var p1 = { x: e.clientX, y: e.clientY }
  var p2 = { x: e.clientX + 0.001, y: e.clientY + 0.001 } // paint point on click

  state[currentPathId] = { color: color, pts: [ p1, p2 ] }
  broadcast({ i: currentPathId, pt: p1, color: color })
  broadcast({ i: currentPathId, pt: p2 })
  redraw()
})

document.body.addEventListener('mouseup', function () {
  currentPathId = null
})

canvas.addEventListener('mousemove', function (e) {
  if (currentPathId) {
    var pt = { x: e.clientX, y: e.clientY }
    state[currentPathId].pts.push(pt)
    broadcast({ i: currentPathId, pt: pt })
    redraw()
  }
})

dragDrop('body', function (files, pos) {
  client.seed(files, function (torrent) {
    var message = {
      infoHash: torrent.infoHash,
      pos: pos
    }
    broadcast(message)
    state[torrent.infoHash] = message

    bufToImage(files[0].buffer, function (img) {
      imgs[torrent.infoHash] = { complete: true, img: img }
      redraw()
    })
  })
})

function bufToImage (buf, cb) {
  var img = new Image()
  img.src = URL.createObjectURL(
    new Blob([ buf ])
  )
  img.onload = function () {
    cb(img)
  }
}
