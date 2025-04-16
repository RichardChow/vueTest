module.exports = {
  devServer: {
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.VUE_APP_BACKEND_PORT}`,
        changeOrigin: true,
        ws: true,
        pathRewrite: {
          '^/api': '/api'
        },
        onError: (err, req, res) => {
          console.log('Proxy error:', err);
        },
        timeout: 10000
      },
      '/ws/upgrade': {
        target: `ws://localhost:${process.env.VUE_APP_BACKEND_PORT}`,
        ws: true,
        changeOrigin: true
      }
    },
    port: 8082
  }
}