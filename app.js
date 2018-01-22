const { BrowserWindow, app } = require('electron')
var path = require('path')

var APP_NAME = 'Whiteboard'
var INDEX = 'file://' + path.join(__dirname, 'static/index.html')

app.on('ready', appReady)

var mainWindow

function appReady () {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: APP_NAME
  })
  mainWindow.loadURL(INDEX)

  mainWindow.on('closed', function () {
    mainWindow = null
  })
}
