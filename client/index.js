var hat = require('hat')
var Tracker = require('webtorrent-tracker')

var canvas, ctx

function createCanvas () {
  canvas = window.canvas = document.createElement('canvas')
  ctx = window.ctx = canvas.getContext('2d')

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
  ctx.fillStyle = 'rgb(200,0,0)'
  ctx.lineWidth = 6

  document.body.appendChild(canvas)
}

var paths = {}
var currentPathId = null

function redraw () {
  // clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // loop all paths
  Object.keys(paths).forEach(function (pathId) {

    // draw each path
    var path = paths[pathId]
    ctx.beginPath()
    path.forEach(function (point, i) {
      if (i === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    })
    ctx.stroke()
  })
}

var id = new Buffer(hat(160), 'hex')
var username = window.prompt('What is your name?')
var peers = []

function startTracker () {
  var tracker = new Tracker(id, {
    announce: [ 'wss://tracker.webtorrent.io' ],
    infoHash: new Buffer(20)
  })

  tracker.start()

  tracker.on('peer', function (peer) {
    window.peer = peer
    peers.push(peer)
    peer.send({ id: id.toString('hex'), username: username })
    peer.send({ paths: paths })
    peer.on('message', onMessage)
  })
}

function broadcast (obj) {
  peers.forEach(function (peer) {
    peer.send(obj)
  })
}

function onMessage (data) {
  console.log(data)

  if (data.username && data.id)
    console.log('got new peer', data.username, data.id)

  if (data.paths) {
    console.log('got paths' + data.paths)
    Object.keys(data.paths)
      .filter(function (pathId) {
        return !paths[pathId]
      })
      .forEach(function (pathId) {
        paths[pathId] = data.paths[pathId]
      })
    redraw()
  }

  if (data.i && data.p) {
    if (!paths[data.i]) paths[data.i] = []
    paths[data.i].push(data.p)
    redraw()
  }

}

startTracker()
createCanvas()

canvas.addEventListener('mousedown', function (e) {
  currentPathId = hat(80)
  var p1 = { x: e.clientX, y: e.clientY }
  var p2 = { x: e.clientX + 0.001, y: e.clientY + 0.001 } // paint point on click

  paths[currentPathId] = [ p1, p2 ]
  redraw()

  broadcast({ i: currentPathId, p: p1 })
  broadcast({ i: currentPathId, p: p2 })
})

document.body.addEventListener('mouseup', function (e) {
  currentPathId = null
})

canvas.addEventListener('mousemove', function (e) {
  if (currentPathId) {
    var p = { x: e.clientX, y: e.clientY }
    paths[currentPathId].push(p)
    broadcast({ i: currentPathId, p: p })
    redraw()
  }
})
