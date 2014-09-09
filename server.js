var compression = require('compression')
var express = require('express')

var port = process.argv[2] || 3000
var app = express()
app.use(compression())
app.use(express.static(__dirname + '/static'))
app.listen(port)
