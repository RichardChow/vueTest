import { ref, reactive } from 'vue';

/**
 * 为元素提供拖拽功能
 * @param {Object} options 配置项
 * @param {number} options.initialX 初始X位置
 * @param {number} options.initialY 初始Y位置
 * @param {Function} options.onDragStart 拖拽开始回调
 * @param {Function} options.onDragEnd 拖拽结束回调
 * @param {Object} options.boundaries 拖拽边界限制
 * @returns {Object} 拖拽相关的状态和方法
 */
export function useDraggable(options = {}) {
  // 元素位置
  const position = ref({
    x: options.initialX || 0,
    y: options.initialY || 0
  });
  
  // 拖拽状态
  const isDragging = ref(false);
  
  // 拖拽初始位置
  const dragStart = ref({ x: 0, y: 0 });
  const elementStart = ref({ x: 0, y: 0 });
  
  // 边界限制
  const boundaries = reactive(options.boundaries || {
    minX: 0,
    maxX: Infinity,
    minY: 0,
    maxY: Infinity
  });
  
  // 应用边界限制
  const applyBoundaries = (pos) => {
    const { minX, maxX, minY, maxY } = boundaries;
    return {
      x: Math.min(Math.max(pos.x, minX), maxX),
      y: Math.min(Math.max(pos.y, minY), maxY)
    };
  };
  
  // 开始拖拽
  const startDrag = (event) => {
    // 阻止默认行为和冒泡
    event.preventDefault();
    event.stopPropagation();
    
    // 获取起始位置
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    
    // 记录起始状态
    dragStart.value = { x: clientX, y: clientY };
    elementStart.value = { x: position.value.x, y: position.value.y };
    isDragging.value = true;
    
    // 调用开始回调
    if (typeof options.onDragStart === 'function') {
      options.onDragStart(position.value);
    }
    
    // 添加移动和结束事件监听
    if (event.touches) {
      document.addEventListener('touchmove', onDrag, { passive: false });
      document.addEventListener('touchend', stopDrag);
    } else {
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', stopDrag);
    }
  };
  
  // 拖拽过程
  const onDrag = (event) => {
    if (!isDragging.value) return;
    
    // 阻止默认行为和冒泡
    event.preventDefault();
    event.stopPropagation();
    
    // 获取当前位置
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    
    // 计算位移
    const deltaX = clientX - dragStart.value.x;
    const deltaY = clientY - dragStart.value.y;
    
    // 计算新位置并应用边界限制
    const newPosition = applyBoundaries({
      x: elementStart.value.x + deltaX,
      y: elementStart.value.y + deltaY
    });
    
    // 更新位置
    position.value = newPosition;
  };
  
  // 结束拖拽
  const stopDrag = () => {
    if (!isDragging.value) return;
    
    isDragging.value = false;
    
    // 移除事件监听
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', stopDrag);
    
    // 调用结束回调
    if (typeof options.onDragEnd === 'function') {
      options.onDragEnd(position.value);
    }
  };
  
  // 更新位置
  const updatePosition = (newPos) => {
    if (!newPos) return;
    
    // 应用边界限制
    const boundedPosition = applyBoundaries({
      x: newPos.x ?? position.value.x,
      y: newPos.y ?? position.value.y
    });
    
    // 更新位置
    position.value = boundedPosition;
    
    return boundedPosition;
  };
  
  // 更新边界
  const updateBoundaries = (newBoundaries) => {
    if (!newBoundaries) return;
    
    // 更新边界值
    Object.assign(boundaries, newBoundaries);
    
    // 确保当前位置在新边界内
    updatePosition(position.value);
  };
  
  return {
    position,
    isDragging,
    startDrag,
    stopDrag,
    updatePosition,
    updateBoundaries,
    // 为了向后兼容，保留setPosition但使用updatePosition实现
    setPosition: updatePosition
  };
}
