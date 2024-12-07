module.exports = {
  devServer: {
    proxy: {
      '/api': {
        target: 'http://172.18.100.176:8083',
        changeOrigin: true
      },
      '/ws/upgrade': {
        target: 'ws://172.18.100.176:8083',
        ws: true,
        changeOrigin: true
      }
    },
    host: '0.0.0.0',
    port: 8082,
    https: false
  }
}