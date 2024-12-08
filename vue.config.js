module.exports = {
  devServer: {
    proxy: {
      '/api': {
        target: 'http://192.168.0.110:8083',
        changeOrigin: true
      },
      '/ws/upgrade': {
        target: 'ws://192.168.0.110:8083',
        ws: true,
        changeOrigin: true
      }
    },
    host: '0.0.0.0',
    port: 8082,
    https: false
  },
  configureWebpack: {
    resolve: {
      alias: {
        '@': require('path').join(__dirname, 'src')
      }
    }
  }
}