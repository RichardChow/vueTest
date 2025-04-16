import axios from 'axios'

const request = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 添加请求拦截器
request.interceptors.request.use(
  config => {
    // 确保 URL 以斜杠结尾
    if (config.url && !config.url.endsWith('/')) {
      config.url = `${config.url}/`
    }
    
    console.log('发送请求:', {
      url: config.url,
      method: config.method,
      data: config.data,
      params: config.params
    })
    
    return config
  },
  error => {
    console.error('请求配置错误:', {
      message: error.message,
      config: error.config
    })
    return Promise.reject(error)
  }
)

// 添加响应拦截器
request.interceptors.response.use(
  response => {
    console.log('收到响应:', {
      url: response.config.url,
      status: response.status,
      data: response.data
    })
    
    // 数据格式处理
    if (response.data) {
      // 处理列表数据
      if (response.config.url.includes('/devices/') || 
          response.config.url.includes('/racks/') ||
          response.config.url.includes('/build/')) {
        if (!Array.isArray(response.data)) {
          console.log('转换响应数据格式:', response.data)
          if (response.data.data && Array.isArray(response.data.data)) {
            response.data = response.data.data
          } else {
            response.data = [response.data]
          }
        }
      }
    }
    
    return response
  },
  error => {
    // 详细的错误日志
    console.error('响应错误:', {
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    })

    // 处理特定的错误状态
    if (error.response) {
      switch (error.response.status) {
        case 404:
          console.error('请求的资源不存在')
          break
        case 500:
          console.error('服务器内部错误')
          break
        case 400:
          console.error('请求参数错误')
          break
        default:
          console.error('未知错误')
      }
    }

    return Promise.reject(error)
  }
)

export default request 