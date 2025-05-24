/**
 * 设备数据管理 Composable
 * 处理设备静态信息和动态监控数据的获取与更新
 * 
 * 当前版本: 开发阶段使用模拟数据
 * 后续可无缝切换到实际API
 */
import { ref, reactive, computed } from 'vue';
import axios from 'axios';

export function useDeviceData() {
  // 设备数据状态
  const deviceData = reactive({
    // 静态信息（相对固定）
    static: {
      name: '',
      displayName: '',
      type: '',
      model: '',
      manufacturer: '',
      serialNumber: '',
      location: '',
      ipAddress: '',
      macAddress: '',
      installDate: '',
      warrantyExpiry: '',
      description: '',
      sshConfig: null
    },
    // 动态信息（实时变化）
    dynamic: {
      status: 'offline',
      temperature: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      networkIn: 0,
      networkOut: 0,
      uptime: 0,
      lastMaintenance: '',
      lastUpdated: null,
      powerConsumption: 0,
      fanSpeed: 0,
      alerts: []
    }
  });

  // 加载状态
  const loading = reactive({
    static: false,
    dynamic: false,
    updating: false
  });

  // 错误状态
  const error = ref(null);

  // API 基础配置
  const API_BASE = process.env.VUE_APP_API_BASE || 'http://localhost:3000/api';
  
  // 开发环境标志 - 控制是否使用模拟数据
  const USE_MOCK_DATA = process.env.NODE_ENV === 'development' || true;

  /**
   * 获取设备静态信息
   * @param {string} deviceName - 设备名称
   */
  const fetchStaticInfo = async (deviceName) => {
    loading.static = true;
    error.value = null;
    
    try {
      if (USE_MOCK_DATA) {
        // 使用模拟数据
        await new Promise(resolve => setTimeout(resolve, 500)); // 模拟网络延迟
        const mockData = generateMockStaticData(deviceName);
        Object.assign(deviceData.static, mockData);
        return mockData;
      } else {
        // 使用实际API
        const response = await axios.get(`${API_BASE}/devices/${deviceName}/static`);
        Object.assign(deviceData.static, response.data);
        return response.data;
      }
    } catch (err) {
      error.value = `获取设备静态信息失败: ${err.message}`;
      console.error('获取设备静态信息失败:', err);
      throw err;
    } finally {
      loading.static = false;
    }
  };

  /**
   * 获取设备动态信息
   * @param {string} deviceName - 设备名称
   */
  const fetchDynamicInfo = async (deviceName) => {
    loading.dynamic = true;
    error.value = null;
    
    try {
      if (USE_MOCK_DATA) {
        // 使用模拟数据
        await new Promise(resolve => setTimeout(resolve, 300)); // 模拟网络延迟
        const mockData = generateMockDynamicData();
        Object.assign(deviceData.dynamic, mockData);
        deviceData.dynamic.lastUpdated = Date.now();
        return mockData;
      } else {
        // 使用实际API
        const response = await axios.get(`${API_BASE}/devices/${deviceName}/dynamic`);
        Object.assign(deviceData.dynamic, response.data);
        return response.data;
      }
    } catch (err) {
      error.value = `获取设备动态信息失败: ${err.message}`;
      console.error('获取设备动态信息失败:', err);
      throw err;
    } finally {
      loading.dynamic = false;
    }
  };

  /**
   * 实时更新设备动态信息
   * @param {string} deviceName - 设备名称
   */
  const updateDynamicInfo = async (deviceName) => {
    loading.updating = true;
    error.value = null;
    
    try {
      if (USE_MOCK_DATA) {
        // 使用模拟数据，但保持状态一致性
        await new Promise(resolve => setTimeout(resolve, 500)); // 模拟网络延迟
        
        // 保留当前状态，但更新其他指标
        const currentStatus = deviceData.dynamic.status;
        const mockData = generateMockDynamicData();
        
        // 如果设备当前是离线状态，保持离线
        if (currentStatus === 'offline') {
          mockData.status = 'offline';
          mockData.cpuUsage = 0;
          mockData.memoryUsage = 0;
          mockData.diskUsage = 0;
          mockData.networkIn = 0;
          mockData.networkOut = 0;
          mockData.temperature = 0;
        }
        
        Object.assign(deviceData.dynamic, mockData);
        deviceData.dynamic.lastUpdated = Date.now();
        return mockData;
      } else {
        // 使用实际API
        const response = await axios.post(`${API_BASE}/devices/${deviceName}/refresh`, {
          metrics: ['status', 'temperature', 'cpu', 'memory', 'disk', 'network', 'uptime']
        });
        
        Object.assign(deviceData.dynamic, response.data);
        deviceData.dynamic.lastUpdated = Date.now();
        return response.data;
      }
    } catch (err) {
      error.value = `更新设备信息失败: ${err.message}`;
      console.error('更新设备信息失败:', err);
      throw err;
    } finally {
      loading.updating = false;
    }
  };

  /**
   * 获取设备完整信息
   * @param {string} deviceName - 设备名称
   */
  const fetchDeviceInfo = async (deviceName) => {
    try {
      await Promise.all([
        fetchStaticInfo(deviceName),
        fetchDynamicInfo(deviceName)
      ]);
      return deviceData;
    } catch (err) {
      console.error('获取设备完整信息失败:', err);
      throw err;
    }
  };

  /**
   * 获取设备历史监控数据
   * @param {string} deviceName - 设备名称
   * @param {Object} timeRange - 时间范围
   */
  const fetchHistoryData = async (deviceName, timeRange = { hours: 24 }) => {
    try {
      if (USE_MOCK_DATA) {
        // 生成模拟的历史数据点
        await new Promise(resolve => setTimeout(resolve, 800)); // 模拟网络延迟
        
        const dataPoints = [];
        const now = Date.now();
        const intervalMs = (timeRange.hours * 3600 * 1000) / 50; // 生成约50个数据点
        
        for (let i = 50; i >= 0; i--) {
          const timestamp = new Date(now - i * intervalMs);
          dataPoints.push({
            timestamp,
            cpuUsage: Math.random() * 100,
            memoryUsage: Math.random() * 100,
            temperature: 20 + Math.random() * 25,
            networkIn: Math.random() * 1000000,
            networkOut: Math.random() * 500000
          });
        }
        
        return dataPoints;
      } else {
        const response = await axios.get(`${API_BASE}/devices/${deviceName}/history`, {
          params: timeRange
        });
        return response.data;
      }
    } catch (err) {
      console.error('获取历史数据失败:', err);
      throw err;
    }
  };

  // 工具函数：生成模拟静态数据
  const generateMockStaticData = (deviceName) => {
    const deviceTypes = ['服务器', '交换机', '路由器', '存储设备', '防火墙'];
    const manufacturers = ['华为', '思科', '戴尔', '惠普', '联想'];
    
    return {
      name: deviceName,
      displayName: formatDeviceName(deviceName),
      type: deviceTypes[Math.floor(Math.random() * deviceTypes.length)],
      model: `Model-${Math.floor(Math.random() * 9000) + 1000}`,
      manufacturer: manufacturers[Math.floor(Math.random() * manufacturers.length)],
      serialNumber: `SN${Date.now().toString().slice(-8)}`,
      location: '机房A-机架01',
      ipAddress: generateRandomIP(),
      macAddress: generateRandomMAC(),
      installDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      warrantyExpiry: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      description: `${deviceName} - 网络设备`
    };
  };

  // 工具函数：生成模拟动态数据
  const generateMockDynamicData = () => {
    const statuses = ['online', 'warning', 'error', 'offline'];
    const weights = [70, 15, 10, 5];
    
    const status = getWeightedRandomStatus(statuses, weights);
    const isOnlineStatus = status === 'online';
    
    return {
      status,
      temperature: isOnlineStatus ? 20 + Math.random() * 25 : 0,
      cpuUsage: isOnlineStatus ? Math.random() * 100 : 0,
      memoryUsage: isOnlineStatus ? Math.random() * 100 : 0,
      diskUsage: isOnlineStatus ? Math.random() * 100 : 0,
      networkIn: isOnlineStatus ? Math.random() * 1000 : 0,
      networkOut: isOnlineStatus ? Math.random() * 800 : 0,
      uptime: isOnlineStatus ? Math.floor(Math.random() * 30 * 24 * 60) : 0, // 分钟
      lastMaintenance: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      powerConsumption: isOnlineStatus ? 50 + Math.random() * 200 : 0,
      fanSpeed: isOnlineStatus ? 1000 + Math.random() * 2000 : 0,
      alerts: generateRandomAlerts(status)
    };
  };

  // 辅助工具函数
  const formatDeviceName = (name) => {
    if (!name) return '';
    return name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const generateRandomIP = () => {
    return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  };

  const generateRandomMAC = () => {
    const chars = '0123456789ABCDEF';
    let mac = '';
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 2 === 0) mac += ':';
      mac += chars[Math.floor(Math.random() * chars.length)];
    }
    return mac;
  };

  const getWeightedRandomStatus = (statuses, weights) => {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < statuses.length; i++) {
      if (random < weights[i]) {
        return statuses[i];
      }
      random -= weights[i];
    }
    
    return statuses[0];
  };

  const generateRandomAlerts = (status) => {
    const alerts = [];
    
    if (status === 'warning') {
      alerts.push({
        level: 'warning',
        message: '温度偏高',
        timestamp: Date.now() - Math.random() * 60 * 60 * 1000
      });
    } else if (status === 'error') {
      alerts.push({
        level: 'error',
        message: '系统故障',
        timestamp: Date.now() - Math.random() * 30 * 60 * 1000
      });
    }
    
    return alerts;
  };

  // 计算属性
  const isOnline = computed(() => deviceData.dynamic.status === 'online');
  
  const lastUpdateTime = computed(() => {
    if (!deviceData.dynamic.lastUpdated) return '未知';
    return new Date(deviceData.dynamic.lastUpdated).toLocaleString();
  });

  const temperatureStatus = computed(() => {
    const temp = deviceData.dynamic.temperature;
    if (temp < 25) return 'normal';
    if (temp < 35) return 'warning';
    return 'error';
  });

  const systemLoadStatus = computed(() => {
    const cpu = deviceData.dynamic.cpuUsage;
    const memory = deviceData.dynamic.memoryUsage;
    const maxLoad = Math.max(cpu, memory);
    
    if (maxLoad < 70) return 'normal';
    if (maxLoad < 90) return 'warning';
    return 'error';
  });

  // 格式化函数
  const formatUptime = (minutes) => {
    if (minutes < 60) return `${Math.floor(minutes)}分钟`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}小时`;
    return `${Math.floor(minutes / 1440)}天`;
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatPercentage = (value) => {
    return `${Math.round(value)}%`;
  };

  const formatTemperature = (temp) => {
    return `${Math.round(temp)}°C`;
  };

  // 清理数据
  const clearData = () => {
    // 重置静态数据
    Object.keys(deviceData.static).forEach(key => {
      deviceData.static[key] = '';
    });
    
    // 重置动态数据
    Object.assign(deviceData.dynamic, {
      status: 'offline',
      temperature: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      networkIn: 0,
      networkOut: 0,
      uptime: 0,
      lastMaintenance: '',
      lastUpdated: null,
      powerConsumption: 0,
      fanSpeed: 0,
      alerts: []
    });
    
    error.value = null;
  };

  return {
    // 数据状态
    deviceData,
    loading,
    error,
    
    // 计算属性
    isOnline,
    lastUpdateTime,
    temperatureStatus,
    systemLoadStatus,
    
    // API方法
    fetchStaticInfo,
    fetchDynamicInfo,
    updateDynamicInfo,
    fetchDeviceInfo,
    fetchHistoryData,
    clearData,
    
    // 格式化方法
    formatUptime,
    formatBytes,
    formatPercentage,
    formatTemperature
  };
} 