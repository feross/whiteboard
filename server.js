var compression = require('compression')
var express = require('express')
var path = require('path')

var port = process.argv[2] || 3000
var app = express()
app.use(compression())
app.use(express.static(path.join(__dirname, 'static')))
app.listen(port, function () {
  console.log('listening on port ' + port)
})
