/**
 * 机房布局工具函数
 * 用于解析和处理机房布局相关信息
 */

/**
 * 解析布局标记信息
 * @param {string} markerName - 标记对象名称 (如 "Layout_Marker_2_rrrrrrr_east_col_right")
 * @returns {Object|null} 布局信息对象或null
 */
export function parseLayoutMarker(markerName) {
  if (!markerName || typeof markerName !== 'string') return null;
  
  try {
    // 提取标记序号
    const markerNumMatch = markerName.match(/Layout_Marker_(\d+)/i);
    const markerNum = markerNumMatch ? parseInt(markerNumMatch[1]) : null;
    
    // 提取机房位置信息 (east, west, north, south)
    const roomLocationMatch = markerName.match(/(east|west|north|south|middle)/i);
    const roomLocation = roomLocationMatch ? roomLocationMatch[1].toLowerCase() : null;
    
    // 提取具体朝向 (left, right, front, back)
    const facingMatch = markerName.match(/(left|right|front|back)/i);
    const facing = facingMatch ? facingMatch[1].toLowerCase() : null;
    
    // 提取是列还是排
    const typeMatch = markerName.match(/(col|row)/i);
    const layoutType = typeMatch ? typeMatch[1].toLowerCase() : null;
    
    return {
      markerId: markerNum,
      roomLocation, // east, west, north, south, middle - 表示机房位置/区域
      facing, // left, right, front, back - 表示实际朝向
      layoutType, // col, row
      original: markerName,
      // 合成列/排标识，如 "col-2"
      layoutKey: layoutType && markerNum ? `${layoutType}-${markerNum}` : null
    };
  } catch (error) {
    console.error('解析布局标记失败:', markerName, error);
    return null;
  }
}

/**
 * 在模型中查找所有布局标记
 * @param {THREE.Object3D} sceneModel - 场景模型
 * @returns {Map<string, Object>} 布局标记映射表（键：layoutKey, 值：标记对象）
 */
export function findLayoutMarkers(sceneModel) {
  const markers = new Map();
  
  if (!sceneModel) return markers;
  
  // 遍历模型查找所有布局标记
  sceneModel.traverse((object) => {
    if (object.name && object.name.includes('Layout_Marker')) {
      const layoutInfo = parseLayoutMarker(object.name);
      if (layoutInfo && layoutInfo.layoutKey) {
        markers.set(layoutInfo.layoutKey, {
          ...layoutInfo,
          object
        });
      }
    }
  });
  
  console.log(`找到 ${markers.size} 个布局标记`);
  return markers;
}

/**
 * 获取机架布局信息
 * @param {string} rackName - 机架名称
 * @param {Map<string, Object>} layoutMarkers - 布局标记映射
 * @returns {Object|null} 布局信息对象
 */
export function getRackLayoutInfo(rackName, layoutMarkers) {
  console.log('rackName', rackName);
  console.log('layoutMarkers', layoutMarkers);
  try {
    if (!rackName || !layoutMarkers || layoutMarkers.size === 0) return null;
    
    // 从机架名称提取列和排信息
    const colMatch = rackName.match(/col-(\d+)/i);
    const rowMatch = rackName.match(/row-(\d+)/i);
    
    // 优先尝试列匹配
    if (colMatch) {
      const colNum = parseInt(colMatch[1]);
      const layoutKey = `col-${colNum}`;
      
      // 查找对应的布局标记
      const marker = layoutMarkers.get(layoutKey);
      
      if (marker) {
        return marker;
      }
    }
    
    // 如果没有列匹配，尝试排匹配
    if (rowMatch) {
      const rowNum = parseInt(rowMatch[1]);
      const layoutKey = `row-${rowNum}`;
      
      // 查找对应的布局标记
      const marker = layoutMarkers.get(layoutKey);
      
      if (marker) {
        return marker;
      }
    }
    
    // 没有找到匹配的布局标记，返回默认值
    return {
      roomLocation: 'east', // 默认机房位置
      facing: 'right',      // 默认朝向
      layoutType: 'col'     // 默认布局类型
    };
  } catch (error) {
    console.error('获取机架布局信息失败:', error);
    return null;
  }
}

/**
 * 获取机架朝向信息
 * @param {string} rackName - 机架名称
 * @param {Map<string, Object>} layoutMarkers - 布局标记映射
 * @returns {Object} 朝向信息
 */
export function getRackOrientation(rackName, layoutMarkers) {
  // 获取布局信息
  const layoutInfo = getRackLayoutInfo(rackName, layoutMarkers);
  
  // 默认朝向信息
  const defaultOrientation = {
    facing: 'right',      // 默认朝向右侧
    roomLocation: 'east', // 默认位于东区
    layoutType: 'col',    // 默认为列布局
    rotation: 0           // 默认旋转角度
  };
  
  // 如果没有找到布局信息，使用默认值
  if (!layoutInfo) return defaultOrientation;
  
  // 根据朝向(facing)计算旋转角度
  let rotation = 0;
  
  switch (layoutInfo.facing) {
    case 'right':
      rotation = -Math.PI / 2; // 朝右 = -90度
      break;
    case 'left':
      rotation = Math.PI / 2; // 朝左 = 90度
      break;
    case 'back':
      rotation = Math.PI; // 朝后 = 180度
      break;
    case 'front':
    default:
      rotation = 0; // 朝前 = 0度
      break;
  }
  
  // 返回完整的朝向信息
  return {
    facing: layoutInfo.facing || defaultOrientation.facing,
    roomLocation: layoutInfo.roomLocation || defaultOrientation.roomLocation,
    layoutType: layoutInfo.layoutType || defaultOrientation.layoutType,
    rotation: rotation
  };
}