const express = require('express')
const app = express()
const { createProxyMiddleware } = require('http-proxy-middleware')

app.use(express.static('static'))
// pathFilter, not app.use('/searcher-api', ...): v3 proxies req.url, which a
// mount path strips, and the searcher expects the full /searcher-api/... path.
app.use(createProxyMiddleware({ target: 'http://localhost:8001', changeOrigin: true, pathFilter: '/searcher-api' }))

app.listen(8000, '127.0.0.1', () => {
    console.log('DreamLand development website is ready on port 8000');
});
