/**
 * 设备工具函数库
 * 本模块负责处理与设备识别、分类、属性设置相关的功能
 */

// 设备类型常量定义
export const DEVICE_TYPES = {
  NE: 'NE',                   // 网元设备
  LINUX: 'Linux',           // linux服务器
  WINDOWS: 'Windows',         // windows PC
  MONITOR: 'Monitor',         // 显示器
  SWITCH: 'Switch',           // 交换机
  POWER: 'Power',             // 电源设备
  DATA_TESTER: 'DataNetworkTester', // 数据仪表设备
  RACK: 'Rack',               // 机架
  TRAY: 'Tray',               // 托盘
  UNKNOWN: 'Unknown'          // 未知设备
};

// 设备类型中文映射
export const DEVICE_TYPE_LABELS = {
  [DEVICE_TYPES.NE]: '网元设备',
  [DEVICE_TYPES.LINUX]: 'Linux服务器',
  [DEVICE_TYPES.WINDOWS]: 'Windows PC',
  [DEVICE_TYPES.MONITOR]: '显示器',
  [DEVICE_TYPES.SWITCH]: '交换机',
  [DEVICE_TYPES.POWER]: '电源设备',
  [DEVICE_TYPES.DATA_TESTER]: '数据仪表设备',
  [DEVICE_TYPES.RACK]: '机架',
  [DEVICE_TYPES.TRAY]: '托盘',
  [DEVICE_TYPES.UNKNOWN]: '未知设备'
};

/**
 * 检测对象是否为设备并返回设备类型
 * @param {Object} object - Three.js对象或对象数据
 * @returns {string|boolean} - 返回设备类型或false(非设备)
 */
export const detectDevice = (object) => {
  if (!object || !object.name) return false;
  
  const name = object.name;
  const nameParts = name.split('_');
  
  // 1. 优先检查userData中已定义的类型
  if (object.userData && object.userData.type) {
    const type = object.userData.type;
    const deviceTypes = Object.values(DEVICE_TYPES);
    if (deviceTypes.includes(type)) {
      return type;
    }
    // 特殊处理 "device" 通用类型，需要继续推断
    if (type !== 'device') {
      return false; // 非设备类型
    }
  }
  
  // 2. 根据命名规则识别设备类型
  // 检查名称前缀
  if (name.startsWith('NE')) {
    return DEVICE_TYPES.NE;
  }
  
  if (name.startsWith('Rack')) {
    return DEVICE_TYPES.RACK;
  }

  if (name.startsWith('Power')) {
    return DEVICE_TYPES.POWER;
  }
  
  if (name.startsWith('Device_')) {
    // 根据最后一个部分判断具体设备类型
    const deviceType = nameParts[nameParts.length - 1].toLowerCase();
    
    if (deviceType.includes('monitor')) {
      return DEVICE_TYPES.MONITOR;
    }
    
    if (deviceType.includes('server') || deviceType.includes('linux')) {
      return DEVICE_TYPES.LINUX;
    }
    
    if (deviceType.includes('switch') || deviceType.includes('router')) {
      return DEVICE_TYPES.SWITCH;
    }
    
    if (deviceType.includes('tester') || deviceType.includes('meter')) {
      return DEVICE_TYPES.DATA_TESTER;
    }

    if (deviceType.includes('tray')) {
      return DEVICE_TYPES.TRAY;
    }
  }

  // 未找到匹配类型
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
  
  // 根据命名模式提取信息
  if (name.startsWith('NE_') && parts.length >= 5) {
    return {
      type: 'NE',
      rack: parts[1],
      location: parts[2],
      model: parts[3],
      deviceCode: parts[4],
      position: parts.length > 5 ? parts[5] : null
    };
  }
  
  if (name.startsWith('Device_') && parts.length >= 5) {
    return {
      type: 'Device',
      rack: parts[1],
      location: parts[2],
      model: parts[3],
      deviceType: parts[4]
    };
  }
  
  if (name.startsWith('Rack-') && parts.length >= 2) {
    return {
      type: 'Rack',
      rackNumber: parts[0].replace('Rack-', ''),
      location: parts[1],
      column: parts.length > 2 ? parts[2] : null
    };
  }
  
  // 兼容原有逻辑（针对不符合新命名规则的设备）
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
  
  const details = extractDeviceDetails(name);
  if (!details) return name; // 无法解析则返回原名
  
  // 网元设备
  if (details.type === 'NE') {
    return `${details.model}_${details.deviceCode}`;
  }
  
  // 普通设备
  if (details.type === 'Device') {
    return `${details.model}_${details.deviceType}`;
  }
  
  // 机架
  if (details.type === 'Rack') {
    // 根据机房代码确定机房名称
    let roomName = '';
    if (details.location === 'east') {
      roomName = '新机房-东';
    } else if (details.location === 'west') {
      roomName = '新机房-西';
    } else if (details.location === 'middle') {
      roomName = '老机房';
    } else {
      roomName = details.location;
    }
    
    return `${roomName}-- 机架${details.rackNumber}`;
  }
  
  // 默认返回原始名称
  return name;
};

/**
 * 处理模型父对象，设置设备属性并存储原始状态
 * @param {Object} model - 模型对象
 * @param {Object} globalState - 全局状态对象，用于存储设备信息
 * @param {Object} options - 配置选项
 * @returns {Array} - 处理的设备数组
 */
export const processModelParents = (model, globalState, options = {}) => {
  if (!model) return [];
  
  const {
    // 是否只处理父对象，默认为true
    parentsOnly = true,
    // 设备类型检测回调
    deviceTypeDetector = detectDevice,
    // 额外的设备设置回调
    setupExtraProperties = null
  } = options;
  
  const processedObjects = [];
  
  // 处理函数
  const processObject = (object) => {
    // 设置设备属性
    const deviceType = deviceTypeDetector(object);
    if (!deviceType) return; // 不是设备，跳过
    
    // 设置交互属性
    if (!object.userData) object.userData = {};
    object.userData.isInteractive = true;
    object.userData.type = deviceType;
    
    // 获取设备详情
    const deviceDetails = extractDeviceDetails(object.name);
    if (deviceDetails) {
      object.userData.details = deviceDetails;
      
      if (deviceDetails.model) {
        object.userData.model = deviceDetails.model;
      }
      
      if (deviceDetails.location) {
        object.userData.location = deviceDetails.location;
      }
      
      if (deviceDetails.position || deviceDetails.rackNumber) {
        object.userData.position = deviceDetails.position || `Rack-${deviceDetails.rackNumber}`;
      }
    }
    
    // 保存原始材质
    if (object.material && globalState.originalMaterials) {
      if (Array.isArray(object.material)) {
        object.material.forEach((mat, index) => {
          if (mat.color) {
            globalState.originalMaterials.set(
              `${object.id}_${index}`, 
              mat.color.clone()
            );
          }
        });
      } else if (object.material.color) {
        globalState.originalMaterials.set(
          object.id, 
          object.material.color.clone()
        );
      }
    }
    
    // 保存原始位置
    if (globalState.originalPositions) {
      globalState.originalPositions.set(
        object.id, 
        object.position.clone()
      );
    }
    
    // 应用额外设置
    if (setupExtraProperties && typeof setupExtraProperties === 'function') {
      setupExtraProperties(object, deviceType, globalState);
    }
    
    // 根据设备类型分类存储
    if (globalState) {
      if (deviceType === DEVICE_TYPES.RACK) {
        if (!globalState.racks) globalState.racks = [];
        globalState.racks.push(object);
      } else {
        if (!globalState.devices) globalState.devices = [];
        globalState.devices.push(object);
      }
    }
    
    processedObjects.push(object);
  };
  
  // 处理模型对象
  if (parentsOnly) {
    // 只处理父对象
    model.children.forEach(child => {
      // 检查是否为父对象(有子对象)
      if (child.children && child.children.length > 0) {
        processObject(child);
      }
    });
  } else {
    // 处理所有对象
    model.traverse((object) => {
      if (object !== model) { // 跳过模型根对象
        processObject(object);
      }
    });
  }
  
  return processedObjects;
};