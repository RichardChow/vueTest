module.exports = {
  devServer: {
    proxy: {
      '/api': {
        target: 'http://localhost:8083',
        changeOrigin: true,
        pathRewrite: {
          '^/api': '/api'
        }
      },
      '/ws/upgrade': {
        target: 'ws://localhost:8083',
        ws: true,
        changeOrigin: true
      }
    },
    port: 8082
  }
}