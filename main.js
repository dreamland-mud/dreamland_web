const express = require('express')
const app = express()
const proxy = require('http-proxy-middleware')

app.use(express.static('static'))
app.use('/searcher-api', proxy({target: 'http://localhost:8001', changeOrigin: true}))

app.listen(8000, '127.0.0.1', () => {
    console.log('DreamLand development website is ready on port 8000');
});

