/**
 * 设备工具函数库
 * 本模块负责处理与设备识别、分类、属性设置相关的功能
 */

// 设备类型常量定义
export const DEVICE_TYPES = {
  NE: 'NE',                   // 网元设备
  LINUX: 'Linux',           // linux服务器
  WINDOWS: 'Windows',         // windows PC
  SWITCH: 'Switch',           // 交换机
  POWER: 'Power',             // 电源设备
  DATA_TESTER: 'DataNetworkTester', // 数据仪表设备
  RACK: 'Rack',               // 机架（严格来说不是设备）
  UNKNOWN: 'Unknown'          // 未知设备
};

// 设备类型中文映射
export const DEVICE_TYPE_LABELS = {
  [DEVICE_TYPES.NE]: '网元设备',
  [DEVICE_TYPES.LINUX]: 'Linux服务器',
  [DEVICE_TYPES.WINDOWS]: 'Windows PC',
  [DEVICE_TYPES.SWITCH]: '交换机',
  [DEVICE_TYPES.POWER]: '电源设备',
  [DEVICE_TYPES.DATA_TESTER]: '数据仪表设备',
  [DEVICE_TYPES.RACK]: '机架',
  [DEVICE_TYPES.UNKNOWN]: '未知设备'
};

/**
 * 检测对象是否为设备并返回设备类型
 * @param {Object} object - Three.js对象或对象数据
 * @returns {string|boolean} - 返回设备类型或false(非设备)
 */
export const detectDevice = (object) => {
  if (!object || !object.name) return false;
  
  // 1. 优先检查userData中已定义的类型
  if (object.userData && object.userData.type) {
    const type = object.userData.type;
    // 已知设备类型列表
    const deviceTypes = Object.values(DEVICE_TYPES);
    if (deviceTypes.includes(type)) {
      return type;
    }
    // 特殊处理 "device" 通用类型，需要进一步推断
    if (type === 'device') {
      // 继续执行名称推断逻辑
    } else {
      return false; // 非设备类型
    }
  }
  
  // 2. 根据名称推断设备类型
  const name = object.name;
  const lowerName = name.toLowerCase();
  
  // 网元设备(最高优先级)
  if (name.startsWith('NE_')) {
    return DEVICE_TYPES.NE;
  }
  
  // 服务器检测
  if (lowerName.includes('linux')) {
    return DEVICE_TYPES.LINUX;
  }
  
  // 网络设备检测
  if (lowerName.includes('switch')) {
    return DEVICE_TYPES.SWITCH;
  }
  
  // 电源设备检测
  if (lowerName.includes('power') || lowerName.includes('ups') || lowerName.includes('pdu')) {
    return DEVICE_TYPES.POWER;
  }
  
  // 测试设备检测
  if (lowerName.includes('tester') || lowerName.includes('meter')) {
    return DEVICE_TYPES.DATA_TESTER;
  }
  
  // 计算机检测
  if (lowerName.includes('windows')) {
    return DEVICE_TYPES.WINDOWS;
  }
  
  if (lowerName.includes('rack')) {
    return DEVICE_TYPES.RACK;
  }
  
  // 3. 找不到匹配的设备类型
  return false;
};

/**
 * 获取设备类型的显示标签
 * @param {string} type - 设备类型
 * @returns {string} - 中文显示标签
 */
export const getDeviceTypeLabel = (type) => {
  return DEVICE_TYPE_LABELS[type] || DEVICE_TYPE_LABELS[DEVICE_TYPES.UNKNOWN];
};

/**
 * 检查对象是否为设备(兼容原isDevice函数)
 * @param {Object} object - Three.js对象或对象数据
 * @returns {boolean} - 是否为设备
 */
export const isDevice = (object) => {
  const deviceType = detectDevice(object);
  // Rack通常不被视为设备，而是容器
  return deviceType && deviceType !== DEVICE_TYPES.RACK;
};

/**
 * 从名称中提取设备详情
 * @param {string} name - 设备名称
 * @returns {Object|null} - 设备详情对象或null
 */
export const extractDeviceDetails = (name) => {
  if (!name || !name.includes('_')) return null;
  
  const parts = name.split('_');
  // 检查是否包含常见设备型号前缀
  const modelPrefixes = ['AT-', 'NPT', 'SW-', 'RT-', 'SRV'];
  const model = parts.find(part => modelPrefixes.some(prefix => part.startsWith(prefix)));
  
  if (model) {
    const position = parts.find(part => part.includes('-'));
    if (position) {
      return {
        model: model,
        position: position
      };
    }
  }
  return null;
};

/**
 * 设置对象的设备类型和交互属性
 * @param {Object} object - Three.js对象
 * @returns {Object} - 相同的对象（便于链式调用）
 */
export const setupDeviceProperties = (object) => {
  if (!object) return object;
  
  // 确保userData存在
  if (!object.userData) {
    object.userData = {};
  }
  
  const deviceType = detectDevice(object);
  
  // 如果是设备或机架，设置为可交互
  if (deviceType) {
    object.userData.isInteractive = true;
    object.userData.type = deviceType;
    
    // 从名称中提取设备详情
    const deviceDetails = extractDeviceDetails(object.name);
    if (deviceDetails) {
      object.userData.model = deviceDetails.model;
      object.userData.position = deviceDetails.position;
    }
  }
  
  return object;
};

/**
 * 判断名称是否属于网元设备
 * @param {string} name - 设备名称
 * @returns {boolean} - 是否为网元设备
 */
export const isNetworkElement = (name) => {
  return name && name.startsWith('NE_');
};

/**
 * 格式化设备名称以便显示
 * @param {string} name - 原始设备名称
 * @returns {string} - 格式化后的设备名称
 */
export const formatDeviceName = (name) => {
  if (!name) return '未命名设备';
  
  // 网元设备特殊处理
  if (isNetworkElement(name)) {
    const parts = name.split('_');
    if (parts.length >= 6) {
      // 只保留设备标签和类型，忽略机架信息和位置
      return `${parts[3]}_${parts[4]}`;
    }
  }
  
  // 机架命名处理
  if (name.includes('Rack-')) {
    const parts = name.split('_');
    if (parts.length >= 2) {
      const rackNumber = parseInt(parts[0].replace('Rack-', ''), 10);
      
      // 根据机房代码确定机房名称
      let roomName = '';
      if (parts[1] === 'east') {
        roomName = '新机房-东';
      } else if (parts[1] === 'west') {
        roomName = '新机房-西';
      } else if (parts[1] === 'middle') {
        roomName = '老机房';
      } else {
        roomName = parts[1]; // 未知代码时使用原值
      }
      
      return `${roomName}-- 机架${rackNumber}`;
    }
  }
  
  // 默认返回原始名称
  return name;
};