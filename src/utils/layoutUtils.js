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
    
    // 提取方向信息 (east, west, north, south)
    const directionMatch = markerName.match(/(east|west|north|south)/i);
    const direction = directionMatch ? directionMatch[1].toLowerCase() : null;
    
    // 提取具体朝向 (left, right)
    const orientationMatch = markerName.match(/(left|right)/i);
    const orientation = orientationMatch ? orientationMatch[1].toLowerCase() : null;
    
    // 提取是列还是排
    const typeMatch = markerName.match(/(col|row)/i);
    const layoutType = typeMatch ? typeMatch[1].toLowerCase() : null;
    
    return {
      markerId: markerNum,
      direction, // east, west, north, south
      orientation, // left, right
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
 * 查找场景中的所有布局标记
 * @param {THREE.Object3D} sceneModel - 场景模型
 * @returns {Map<string, Object>} 布局信息映射 (layoutKey -> 布局信息)
 */
export function findLayoutMarkers(sceneModel) {
  const layoutMarkers = new Map();
  
  if (!sceneModel) return layoutMarkers;
  
  sceneModel.traverse((obj) => {
    if (obj.name && obj.name.includes('Layout_Marker')) {
      const layoutInfo = parseLayoutMarker(obj.name);
      if (layoutInfo && layoutInfo.layoutKey) {
        layoutMarkers.set(layoutInfo.layoutKey, {
          ...layoutInfo,
          object: obj // 保存对象引用
        });
      }
    }
  });
  
  return layoutMarkers;
}

/**
 * 获取机架所属的布局标记信息
 * @param {string} rackName - 机架名称 (如 "Rack-01_east_col-01")
 * @param {Map<string, Object>} layoutMarkers - 布局标记映射
 * @returns {Object|null} 布局信息对象或null
 */
export function getRackLayoutInfo(rackName, layoutMarkers) {
  if (!rackName || !layoutMarkers || layoutMarkers.size === 0) return null;
  
  try {
    // 从机架名称中提取列/排信息
    const colMatch = rackName.match(/col-(\d+)/i);
    const rowMatch = rackName.match(/row-(\d+)/i);
    
    // 优先尝试列匹配
    if (colMatch) {
      const colNum = parseInt(colMatch[1]);
      const layoutKey = `col-${colNum}`;
      return layoutMarkers.get(layoutKey) || null;
    }
    
    // 其次尝试排匹配
    if (rowMatch) {
      const rowNum = parseInt(rowMatch[1]);
      const layoutKey = `row-${rowNum}`;
      return layoutMarkers.get(layoutKey) || null;
    }
    
    return null;
  } catch (error) {
    console.error('获取机架布局信息失败:', rackName, error);
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
    direction: 'east', // 默认朝东
    orientation: 'towards', // 默认朝向用户
    layoutType: 'col',
    markerId: null,
    layoutKey: null
  };
  
  if (!layoutInfo) return defaultOrientation;
  
  // 根据布局标记确定朝向
  const orientation = layoutInfo.orientation === 'right' ? 'away' : 'towards';
  
  return {
    direction: layoutInfo.direction || defaultOrientation.direction,
    orientation: orientation,
    layoutType: layoutInfo.layoutType || defaultOrientation.layoutType,
    markerId: layoutInfo.markerId,
    layoutKey: layoutInfo.layoutKey
  };
} 