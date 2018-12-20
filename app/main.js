const { app, BrowserWindow } = require('electron')

const shared = require('./shared')

app.on('ready', () => {
  let mainWindow = new BrowserWindow({
    height: 728,
    width: 1024,
    show: false
  })

  mainWindow.loadURL(`file://${__dirname}/index.html`)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', function () {
    shared.tmpDir.removeCallback()
    mainWindow = null
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
