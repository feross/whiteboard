const { BrowserWindow, app } = require('electron')
const path = require('path')

const APP_NAME = 'Whiteboard'
const INDEX = 'file://' + path.join(__dirname, 'static/main.html')

app.on('ready', appReady)

let mainWindow

function appReady () {
  const browserConfig = {
    width: 800,
    height: 600,
    title: APP_NAME
  }
  mainWindow = new BrowserWindow(browserConfig)
  mainWindow.loadURL(INDEX)

  mainWindow.on('closed', function () {
    mainWindow = null
  })
}
