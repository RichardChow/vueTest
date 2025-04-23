import * as THREE from 'three';

/**
 * 颜色管理工具
 * 提供颜色转换、保存和恢复的功能
 */

// 预定义高亮颜色
export const HIGHLIGHT_COLORS = {
  DEFAULT: new THREE.Color(0x00ffff),    // 默认高亮颜色 - 青色
  HOVER: new THREE.Color(0x00ffff),      // 悬停高亮颜色 - 青色
  SELECT: new THREE.Color(0xffff00),     // 选中高亮颜色 - 黄色
  RACK: new THREE.Color(0x00ff00),       // 机架高亮颜色 - 绿色
  NETWORK: new THREE.Color(0xff00ff),    // 网络设备高亮颜色 - 粉色
  SERVER: new THREE.Color(0x0088ff),     // 服务器高亮颜色 - 蓝色
  NE: new THREE.Color(0x0088ff),    // 网络设备高亮颜色 - 蓝色
  WARNING: new THREE.Color(0xff8800),    // 警告高亮颜色 - 橙色
  ERROR: new THREE.Color(0xff0000),      // 错误高亮颜色 - 红色
};

// 存储轮廓对象的映射
const outlineObjects = new Map();

/**
 * 为对象添加轮廓描边效果
 * @param {THREE.Object3D} object - 需要添加轮廓的对象
 * @param {THREE.Color} color - 轮廓颜色
 * @param {number} thickness - 轮廓厚度，默认为1.05
 */
export function addOutlineEffect(object, color, thickness = 1.05) {
  if (!object) return;
  
  // 如果已经有轮廓，先移除
  removeOutlineEffect(object);
  
  // 处理没有几何体的情况（如Group对象）
  if (!object.geometry) {
    console.log('对象没有几何体，尝试处理其子对象:', object.name);
    
    // 检查是否有子对象
    if (object.children && object.children.length > 0) {
      // 为所有子对象添加轮廓
      let hasAddedOutline = false;
      object.children.forEach(child => {
        if (child.isMesh && child.geometry) {
          addOutlineEffect(child, color, thickness);
          hasAddedOutline = true;
        }
      });
      
      // 如果成功为任何子对象添加了轮廓，记录在父对象上
      if (hasAddedOutline) {
        if (!object.userData) object.userData = {};
        object.userData.hasChildOutlines = true;
      }
      
      return;
    } else {
      console.warn('无法为没有几何体的对象创建轮廓，且无子对象:', object.name);
      return;
    }
  }
  
  // 克隆物体几何体
  const geometry = object.geometry.clone();
  
  // 创建轮廓材质 - 使用透明度增强效果
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.8,
    side: THREE.BackSide, // 背面渲染
    depthTest: true,      // 确保深度测试开启
    depthWrite: false     // 不写入深度缓冲，避免遮挡
  });
  
  // 创建轮廓网格
  const outline = new THREE.Mesh(geometry, outlineMaterial);
  outline.name = `outline_${object.name || object.uuid}`;
  
  // 复制原物体的变换
  outline.position.copy(object.position);
  outline.rotation.copy(object.rotation);
  outline.scale.copy(object.scale);
  outline.quaternion.copy(object.quaternion);
  outline.matrix.copy(object.matrix);
  
  // 略微放大轮廓
  outline.scale.multiplyScalar(thickness);
  
  // 更新矩阵
  outline.updateMatrix();
  
  // 如果对象有父级，将轮廓添加到相同的父级
  if (object.parent) {
    object.parent.add(outline);
  }
  
  // 确保轮廓永远在原始对象后面渲染
  outline.renderOrder = -1;
  
  // 保存引用
  outlineObjects.set(object.uuid, outline);
  
  // 添加引用到对象上，方便后续访问
  if (!object.userData) object.userData = {};
  object.userData.outlineObject = outline;
  
  return outline;
}

/**
 * 移除对象的轮廓描边效果
 * @param {THREE.Object3D} object - 需要移除轮廓的对象
 */
export function removeOutlineEffect(object) {
  if (!object) return;
  
  // 处理子对象轮廓的情况
  if (object.userData && object.userData.hasChildOutlines) {
    object.children.forEach(child => {
      if (child.isMesh) {
        removeOutlineEffect(child);
      }
    });
    object.userData.hasChildOutlines = false;
    return;
  }
  
  // 从映射中获取轮廓对象
  const outline = outlineObjects.get(object.uuid);
  
  if (outline) {
    // 从场景中移除
    if (outline.parent) {
      outline.parent.remove(outline);
    }
    
    // 清理资源
    if (outline.geometry) outline.geometry.dispose();
    if (outline.material) outline.material.dispose();
    
    // 从映射中删除
    outlineObjects.delete(object.uuid);
    
    // 清除对象上的引用
    if (object.userData && object.userData.outlineObject) {
      object.userData.outlineObject = null;
      delete object.userData.outlineObject;
    }
  }
}

/**
 * 根据设备类型设置高亮轮廓
 * @param {THREE.Object3D} device - 设备对象
 * @param {string} deviceType - 设备类型
 */
export function setDeviceOutlineHighlight(device, deviceType) {
  if (!device) return;
  
  // 确保deviceType是字符串
  const type = typeof deviceType === 'string' ? deviceType : String(deviceType);
  const lowerType = type.toLowerCase();
  
  // 根据设备类型选择合适的轮廓颜色
  let outlineColor;
  
  switch (lowerType) {
    case 'ne':
      outlineColor = HIGHLIGHT_COLORS.NE;
      break;
    case 'server':
    case 'compute':
      outlineColor = HIGHLIGHT_COLORS.SERVER;
      break;
    case 'network':
    case 'switch':
    case 'router':
      outlineColor = HIGHLIGHT_COLORS.NETWORK;
      break;
    case 'storage':
    case 'disk':
      outlineColor = HIGHLIGHT_COLORS.STORAGE || HIGHLIGHT_COLORS.DEFAULT;
      break;
    case 'rack':
      outlineColor = HIGHLIGHT_COLORS.RACK;
      break;
    default:
      outlineColor = HIGHLIGHT_COLORS.DEFAULT;
  }
  
  // 添加轮廓效果
  return addOutlineEffect(device, outlineColor);
}

/**
 * 设置对象高亮（使用轮廓效果）
 * @param {THREE.Object3D} object - 目标对象
 * @param {THREE.Color} color - 高亮颜色
 */
export function setHighlightColor(object, color) {
  if (!object) return;
  
  // 保存原始状态（如果尚未保存）
  saveOriginalColor(object);
  
  // 添加轮廓效果
  addOutlineEffect(object, color);
  
  return object;
}


/**
 * 保存对象的原始颜色
 * @param {THREE.Object3D} object - Three.js对象
 * @param {Map} colorMap - 存储颜色的Map对象
 * @param {boolean} recursive - 是否递归处理子对象
 * @returns {boolean} - 是否成功保存
 */
export function saveOriginalColor(object, colorMap, recursive = false) {
  if (!object || !colorMap) return false;
  
  let saved = false;
  
  // 处理当前对象
  if (object.material) {
    const objectId = object.uuid;
    
    // 单一材质
    if (!Array.isArray(object.material)) {
      if (object.material.color && !colorMap.has(objectId)) {
        colorMap.set(objectId, {
          color: object.material.color.clone(),
          emissive: object.material.emissive ? object.material.emissive.clone() : null,
          isMesh: object instanceof THREE.Mesh
        });
        saved = true;
      }
    } 
    // 多材质数组
    else if (Array.isArray(object.material)) {
      const materials = [];
      let hasSaved = false;
      
      for (let i = 0; i < object.material.length; i++) {
        const mat = object.material[i];
        if (mat && mat.color) {
          materials.push({
            index: i,
            color: mat.color.clone(),
            emissive: mat.emissive ? mat.emissive.clone() : null
          });
          hasSaved = true;
        } else {
          materials.push(null);
        }
      }
      
      if (hasSaved && !colorMap.has(objectId)) {
        colorMap.set(objectId, {
          isMultiMaterial: true,
          materials,
          isMesh: object instanceof THREE.Mesh
        });
        saved = true;
      }
    }
  }
  
  // 递归处理子对象
  if (recursive && object.children && object.children.length > 0) {
    for (const child of object.children) {
      const childSaved = saveOriginalColor(child, colorMap, true);
      saved = saved || childSaved;
    }
  }
  
  return saved;
}

/**
 * 恢复对象的原始颜色
 * @param {THREE.Object3D} object - Three.js对象
 * @param {Map} colorMap - 存储颜色的Map对象
 * @param {boolean} recursive - 是否递归处理子对象
 * @param {boolean} removeFromMap - 恢复后是否从Map中移除
 * @returns {boolean} - 是否成功恢复
 */
export function restoreOriginalColor(object, colorMap, recursive = false, removeFromMap = false) {
  if (!object || !colorMap) return false;
  
  let restored = false;
  
  // 处理当前对象
  if (object.material) {
    const objectId = object.uuid;
    const savedData = colorMap.get(objectId);
    
    if (savedData) {
      // 多材质数组
      if (savedData.isMultiMaterial && Array.isArray(object.material)) {
        for (const matData of savedData.materials) {
          if (matData && object.material[matData.index]) {
            object.material[matData.index].color.copy(matData.color);
            
            if (matData.emissive && object.material[matData.index].emissive) {
              object.material[matData.index].emissive.copy(matData.emissive);
            }
          }
        }
        restored = true;
      } 
      // 单一材质
      else if (!savedData.isMultiMaterial) {
        object.material.color.copy(savedData.color);
        
        if (savedData.emissive && object.material.emissive) {
          object.material.emissive.copy(savedData.emissive);
        }
        restored = true;
      }
      
      // 从Map中移除
      if (removeFromMap) {
        colorMap.delete(objectId);
      }
    }
  }
  
  // 递归处理子对象
  if (recursive && object.children && object.children.length > 0) {
    for (const child of object.children) {
      const childRestored = restoreOriginalColor(child, colorMap, true, removeFromMap);
      restored = restored || childRestored;
    }
  }
  
  return restored;
}

/**
 * 设置设备特有的高亮效果
 * @param {THREE.Object3D} object - Three.js对象
 * @param {string} deviceType - 设备类型 (server, switch, router 等)
 * @param {boolean} recursive - 是否递归处理子对象
 * @param {Map} colorMap - 存储颜色的Map对象
 * @returns {boolean} - 是否成功设置
 */
export function setDeviceHighlight(object, deviceType, recursive = false, colorMap = null) {
  const type = typeof deviceType === 'string' ? deviceType : String(deviceType);
  console.log('setDeviceHighlight', object, deviceType);
  const lowerCaseType = type.toLowerCase();
  console.log('lowerCaseType', lowerCaseType);
  console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')

  if (!object) return false;
  
  let color;
  
  // 根据设备类型选择高亮颜色
  switch (lowerCaseType) {
    case 'server':
      color = HIGHLIGHT_COLORS.SERVER;
      break;
    case 'switch':
    case 'router':
      color = HIGHLIGHT_COLORS.NETWORK;
      break;
    case 'storage':
      color = HIGHLIGHT_COLORS.SELECT;
      break;
    case 'warning':
      color = HIGHLIGHT_COLORS.WARNING;
      break;
    case 'error':
      color = HIGHLIGHT_COLORS.ERROR;
      break;
    default:
      color = HIGHLIGHT_COLORS.HOVER;
  }
  
  return setHighlightColor(object, color, recursive, colorMap);
}

/**
 * 创建一个新的颜色Map
 * @returns {Map} - 新创建的颜色Map
 */
export function createColorMap() {
  return new Map();
}

/**
 * 从十六进制颜色字符串创建THREE.Color对象
 * @param {string} hexColor - 十六进制颜色字符串 (例如: '#ff0000' 或 '0xff0000')
 * @returns {THREE.Color} - 创建的颜色对象
 */
export function createColorFromHex(hexColor) {
  return new THREE.Color(hexColor);
}

/**
 * 根据数值创建渐变颜色
 * @param {number} value - 0到1之间的值
 * @param {THREE.Color} startColor - 起始颜色
 * @param {THREE.Color} endColor - 结束颜色
 * @returns {THREE.Color} - 插值计算的颜色
 */
export function createGradientColor(value, startColor, endColor) {
  // 确保值在0-1范围内
  const t = Math.max(0, Math.min(1, value));
  
  // 创建一个新的颜色对象
  const color = new THREE.Color();
  
  // 在两个颜色之间进行线性插值
  color.r = startColor.r + (endColor.r - startColor.r) * t;
  color.g = startColor.g + (endColor.g - startColor.g) * t;
  color.b = startColor.b + (endColor.b - startColor.b) * t;
  
  return color;
}

/**
 * 创建热力图渐变颜色
 * @param {number} value - 0到1之间的值
 * @returns {THREE.Color} - 热力图颜色
 */
export function createHeatmapColor(value) {
  // 确保值在0-1范围内
  const t = Math.max(0, Math.min(1, value));
  
  // 热力图颜色渐变: 蓝 -> 青 -> 绿 -> 黄 -> 红
  let r, g, b;
  
  if (t < 0.25) {
    // 蓝到青
    r = 0;
    g = t * 4;
    b = 1;
  } else if (t < 0.5) {
    // 青到绿
    r = 0;
    g = 1;
    b = 1 - (t - 0.25) * 4;
  } else if (t < 0.75) {
    // 绿到黄
    r = (t - 0.5) * 4;
    g = 1;
    b = 0;
  } else {
    // 黄到红
    r = 1;
    g = 1 - (t - 0.75) * 4;
    b = 0;
  }
  
  return new THREE.Color(r, g, b);
}

/**
 * 批量高亮一组对象
 * @param {Array} objects - Three.js对象数组
 * @param {THREE.Color} color - 高亮颜色
 * @param {Map} colorMap - 存储颜色的Map对象
 * @returns {number} - 成功高亮的对象数量
 */
export function batchHighlight(objects, color, colorMap) {
  if (!Array.isArray(objects) || !color) return 0;
  
  let count = 0;
  
  for (const obj of objects) {
    if (setHighlightColor(obj, color, false, colorMap)) {
      count++;
    }
  }
  
  return count;
}

/**
 * 批量恢复一组对象的原始颜色
 * @param {Array} objects - Three.js对象数组
 * @param {Map} colorMap - 存储颜色的Map对象
 * @param {boolean} removeFromMap - 恢复后是否从Map中移除
 * @returns {number} - 成功恢复的对象数量
 */
export function batchRestoreColor(objects, colorMap, removeFromMap = false) {
  if (!Array.isArray(objects) || !colorMap) return 0;
  
  let count = 0;
  
  for (const obj of objects) {
    if (restoreOriginalColor(obj, colorMap, false, removeFromMap)) {
      count++;
    }
  }
  
  return count;
}

/**
 * 闪烁高亮效果
 * @param {THREE.Object3D} object - Three.js对象
 * @param {THREE.Color} color - 高亮颜色
 * @param {Map} colorMap - 存储颜色的Map对象
 * @param {number} duration - 闪烁持续时间(毫秒)
 * @param {number} frequency - 闪烁频率(毫秒)
 * @returns {Promise} - Promise在闪烁完成后解析
 */
export function flashHighlight(object, color, colorMap, duration = 2000, frequency = 200) {
  if (!object || !color || !colorMap) {
    return Promise.reject('参数无效');
  }
  
  // 保存原始颜色
  saveOriginalColor(object, colorMap);
  
  let isHighlighted = false;
  const startTime = Date.now();
  
  // 创建闪烁间隔
  return new Promise((resolve) => {
    const intervalId = setInterval(() => {
      const currentTime = Date.now();
      
      // 检查是否超过持续时间
      if (currentTime - startTime >= duration) {
        clearInterval(intervalId);
        // 确保以原始颜色结束
        restoreOriginalColor(object, colorMap);
        resolve();
        return;
      }
      
      // 切换颜色
      if (isHighlighted) {
        restoreOriginalColor(object, colorMap, false, false);
      } else {
        setHighlightColor(object, color, false, null);
      }
      
      isHighlighted = !isHighlighted;
    }, frequency);
  });
}

/**
 * 脉冲高亮效果（亮度逐渐变化）
 * @param {THREE.Object3D} object - Three.js对象
 * @param {THREE.Color} color - 高亮颜色
 * @param {Map} colorMap - 存储颜色的Map对象
 * @param {number} duration - 脉冲持续时间(毫秒)
 * @param {number} speed - 脉冲速度(毫秒)
 * @returns {Promise} - Promise在脉冲完成后解析
 */
export function pulseHighlight(object, color, colorMap, duration = 2000, speed = 30) {
  if (!object || !color || !colorMap) {
    return Promise.reject('参数无效');
  }
  
  // 保存原始颜色
  saveOriginalColor(object, colorMap);
  
  const startTime = Date.now();
  const pulseColor = color.clone();
  
  // 创建脉冲间隔
  return new Promise((resolve) => {
    const intervalId = setInterval(() => {
      const currentTime = Date.now();
      
      // 检查是否超过持续时间
      if (currentTime - startTime >= duration) {
        clearInterval(intervalId);
        // 确保以原始颜色结束
        restoreOriginalColor(object, colorMap);
        resolve();
        return;
      }
      
      // 计算脉冲强度 (0 到 1)
      const elapsed = currentTime - startTime;
      const t = Math.sin((elapsed / speed) * Math.PI) * 0.5 + 0.5;
      
      // 应用脉冲颜色
      pulseColor.copy(color).multiplyScalar(0.6 + t * 0.4);
      setHighlightColor(object, pulseColor, false, null);
      
    }, 16); // 约60FPS
  });
} 