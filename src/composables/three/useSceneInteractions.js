import * as THREE from 'three';
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import { useSceneObjects } from './useSceneObjects';

/**
 * 场景交互管理Hook
 * 处理鼠标交互、射线检测和事件分发
 */
export function useSceneInteractions(options = {}) {
  // 配置项默认值
  const config = reactive({
    raycasterNear: 0.1,
    raycasterFar: 100,
    clickCooldownMs: 300,  // 点击冷却时间，防止频繁触发
    hoverDebounceMs: 50,   // 悬停防抖时间
    enablePointerEvents: true,
    enableTouchEvents: true,
    ...options
  });
  
  // 内部状态
  const state = reactive({
    isInitialized: false,
    isDragging: false,
    lastClickTime: 0,
    hoveredObject: null,
    selectedObject: null,
    mousePosition: { x: 0, y: 0, clientX: 0, clientY: 0 },
    normalizedPosition: { x: 0, y: 0 }, // 标准化的[-1,1]坐标
    boundingRect: null
  });
  
  // 事件记录
  const eventListeners = reactive({
    click: [],
    hover: [],
    drag: []
  });
  
  // 公开引用
  const containerRef = ref(null);
  const raycaster = ref(new THREE.Raycaster());
  const mouseVector = ref(new THREE.Vector2());
  
  // 相关引用
  let camera = null;
  let scene = null;
  let pickableObjects = [];
  
  // 在 useSceneInteractions.js 中添加对 objectParentMap 的引用
  const objectParentMap = ref(new Map());
  
  // 设置依赖项
  const setDependencies = ({ sceneRef, cameraRef, containerReference }) => {
    scene = sceneRef;
    camera = cameraRef;
    if (containerReference) {
      containerRef.value = containerReference;
    }
    
    // 如果已经有容器引用，立即初始化
    if (containerRef.value && camera && scene) {
      initialize();
    }
  };
  
  // 初始化交互系统
  const initialize = () => {
    if (state.isInitialized || !containerRef.value) return;
    
    // 初始化射线投射器
    raycaster.value.near = config.raycasterNear;
    raycaster.value.far = config.raycasterFar;
    
    // 获取容器边界
    updateContainerBounds();
    
    // 添加事件监听器
    if (config.enablePointerEvents) {
      containerRef.value.addEventListener('mousemove', handleMouseMove);
      containerRef.value.addEventListener('click', handleClick);
      containerRef.value.addEventListener('mousedown', handleMouseDown);
      containerRef.value.addEventListener('mouseup', handleMouseUp);
    }
    
    if (config.enableTouchEvents) {
      containerRef.value.addEventListener('touchstart', handleTouchStart);
      containerRef.value.addEventListener('touchmove', handleTouchMove);
      containerRef.value.addEventListener('touchend', handleTouchEnd);
    }
    
    // 添加窗口大小变化监听
    window.addEventListener('resize', updateContainerBounds);
    
    state.isInitialized = true;
    console.log('场景交互系统初始化完成');
  };
  
  // 清理函数
  const cleanup = () => {
    if (!state.isInitialized) return;
    
    // 移除事件监听器
    if (containerRef.value) {
      if (config.enablePointerEvents) {
        containerRef.value.removeEventListener('mousemove', handleMouseMove);
        containerRef.value.removeEventListener('click', handleClick);
        containerRef.value.removeEventListener('mousedown', handleMouseDown);
        containerRef.value.removeEventListener('mouseup', handleMouseUp);
      }
      
      if (config.enableTouchEvents) {
        containerRef.value.removeEventListener('touchstart', handleTouchStart);
        containerRef.value.removeEventListener('touchmove', handleTouchMove);
        containerRef.value.removeEventListener('touchend', handleTouchEnd);
      }
    }
    
    // 移除窗口大小变化监听
    window.removeEventListener('resize', updateContainerBounds);
    
    state.isInitialized = false;
    console.log('场景交互系统已清理');
  };
  
  // 更新容器边界
  const updateContainerBounds = () => {
    if (!containerRef.value) return;
    
    state.boundingRect = containerRef.value.getBoundingClientRect();
  };
  
  // 设置可拾取对象
  const setPickableObjects = (objects) => {
    if (Array.isArray(objects)) {
      pickableObjects = objects;
    } else if (objects) {
      pickableObjects = [objects];
    }
  };
  
  // 添加可拾取对象
  const addPickableObject = (object) => {
    if (!pickableObjects.includes(object)) {
      pickableObjects.push(object);
    }
  };
  
  // 移除可拾取对象
  const removePickableObject = (object) => {
    const index = pickableObjects.indexOf(object);
    if (index !== -1) {
      pickableObjects.splice(index, 1);
    }
  };
  
  // 处理鼠标移动
  const handleMouseMove = (event) => {
    event.preventDefault();
    
    // 更新鼠标位置
    updateMousePosition(event);
    
    // 执行射线检测
    performRaycast();
    
    // 触发悬停事件
    processHoverEvents();
  };
  
  // 更新鼠标位置
  const updateMousePosition = (event) => {
    if (!state.boundingRect) {
      updateContainerBounds();
    }
    
    // 保存客户端坐标
    state.mousePosition.clientX = event.clientX;
    state.mousePosition.clientY = event.clientY;
    
    // 计算相对于容器的坐标
    state.mousePosition.x = event.clientX - state.boundingRect.left;
    state.mousePosition.y = event.clientY - state.boundingRect.top;
    
    // 标准化坐标到[-1,1]范围
    state.normalizedPosition.x = (state.mousePosition.x / state.boundingRect.width) * 2 - 1;
    state.normalizedPosition.y = -(state.mousePosition.y / state.boundingRect.height) * 2 + 1;
    
    // 更新THREE.js射线向量
    mouseVector.value.x = state.normalizedPosition.x;
    mouseVector.value.y = state.normalizedPosition.y;
  };
  
  // 执行射线检测
  const performRaycast = () => {
    if (!camera || !scene || pickableObjects.length === 0) return [];
    
    // 更新射线
    raycaster.value.setFromCamera(mouseVector.value, camera);
    
    // 执行射线检测
    return raycaster.value.intersectObjects(pickableObjects, true);
  };
  
  // 设置对象父级映射
  const setObjectParentMap = (map) => {
    if (map instanceof Map) {
      objectParentMap.value = map;
    }
  };
  
  // 优化 filterIntersections 函数
  const filterIntersections = (intersections) => {
    if (!intersections || intersections.length === 0) return null;
    
    // 获取第一个相交对象
    const intersection = intersections[0];
    const object = intersection.object;
    
    // 获取 useSceneObjects 中的方法
    const { findInteractiveParentFast } = useSceneObjects();
    
    // 使用快速查找，如果有预处理的映射
    if (objectParentMap.value.size > 0) {
      const interactiveParent = findInteractiveParentFast(
        object, 
        objectParentMap.value
      );
      
      if (interactiveParent) {
        return {
          object: interactiveParent,
          intersection: intersection
        };
      }
    }
    
    // 后备方案：使用传统的向上遍历查找
    // 使用 findInteractiveParent 函数
    const { findInteractiveParent } = useSceneObjects();
    const result = findInteractiveParent(object);
    
    if (result && result.object) {
      return {
        object: result.object,
        intersection: intersection
      };
    }
    
    return null;
  };
  
  // 处理悬停事件
  const processHoverEvents = () => {
    const intersections = performRaycast();
    const result = filterIntersections(intersections);
    
    // 如果悬停对象改变，触发相应事件
    if (result?.object !== state.hoveredObject) {
      // 处理上一个悬停对象的离开事件
      if (state.hoveredObject) {
        // 触发注册的hover事件
        eventListeners.hover.forEach(listener => {
          if (listener.onLeave) {
            listener.onLeave(state.hoveredObject);
          }
        });
      }
      
      // 更新当前悬停对象
      state.hoveredObject = result?.object || null;
      
      // 处理新悬停对象的进入事件
      if (state.hoveredObject) {
        // 触发注册的hover事件
        eventListeners.hover.forEach(listener => {
          if (listener.onEnter) {
            listener.onEnter(state.hoveredObject, {
              position: state.mousePosition,
              intersection: result.intersection
            });
          }
        });
      }
    }
    
    // 处理持续悬停
    if (state.hoveredObject) {
      eventListeners.hover.forEach(listener => {
        if (listener.onHover) {
          listener.onHover(state.hoveredObject, {
            position: state.mousePosition
          });
        }
      });
    }
    
    return state.hoveredObject;
  };
  
  // 处理点击事件
  const handleClick = (event) => {
    event.preventDefault();
    
    // 检查点击冷却期
    const now = Date.now();
    if (now - state.lastClickTime < config.clickCooldownMs) {
      return;
    }
    state.lastClickTime = now;
    
    // 更新鼠标位置
    updateMousePosition(event);
    
    // 执行射线检测
    const intersections = performRaycast();
    const result = filterIntersections(intersections);
    
    if (result) {
      // 更新选中对象
      state.selectedObject = result.object;
      
      // 触发注册的点击事件
      eventListeners.click.forEach(listener => {
        listener(state.selectedObject, {
          position: state.mousePosition,
          intersection: result.intersection,
          originalEvent: event
        });
      });
      
      return state.selectedObject;
    }
    
    // 如果点击空白处，可以清除选择
    if (state.selectedObject) {
      state.selectedObject = null;
      
      // 可以触发取消选择事件
    }
    
    return null;
  };
  
  // 鼠标按下事件处理
  const handleMouseDown = (event) => {
    // 拖拽处理逻辑
    state.isDragging = true;
    // 更新鼠标位置
    updateMousePosition(event);
  };
  
  // 鼠标抬起事件处理
  const handleMouseUp = () => {
    // 拖拽结束处理逻辑
    if (state.isDragging) {
      state.isDragging = false;
      // 触发拖拽结束事件...
    }
  };
  
  // Touch事件处理
  const handleTouchStart = (event) => {
    if (event.touches.length === 1) {
      event.preventDefault();
      const touch = event.touches[0];
      
      // 模拟鼠标事件
      const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => {}
      };
      
      handleMouseDown(mouseEvent);
    }
  };
  
  const handleTouchMove = (event) => {
    if (event.touches.length === 1) {
      event.preventDefault();
      const touch = event.touches[0];
      
      // 模拟鼠标事件
      const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => {}
      };
      
      handleMouseMove(mouseEvent);
    }
  };
  
  const handleTouchEnd = (event) => {
    event.preventDefault();
    
    // 如果没有移动太多，视为点击
    if (!state.isDragging) {
      // 使用最后一个触摸位置
      const mouseEvent = {
        clientX: state.mousePosition.clientX,
        clientY: state.mousePosition.clientY,
        preventDefault: () => {}
      };
      
      handleClick(mouseEvent);
    }
    
    // 拖拽结束
    state.isDragging = false;
  };
  
  // 注册点击事件监听器
  const onObjectClick = (callback) => {
    if (typeof callback === 'function') {
      eventListeners.click.push(callback);
    }
    return () => {
      const index = eventListeners.click.indexOf(callback);
      if (index !== -1) {
        eventListeners.click.splice(index, 1);
      }
    };
  };
  
  // 注册悬停事件监听器
  const onObjectHover = (callbacks) => {
    if (callbacks) {
      eventListeners.hover.push(callbacks);
    }
    return () => {
      const index = eventListeners.hover.indexOf(callbacks);
      if (index !== -1) {
        eventListeners.hover.splice(index, 1);
      }
    };
  };
  
  // 直接获取当前悬停对象
  const getHoveredObject = () => {
    return state.hoveredObject;
  };
  
  // 组件挂载和卸载处理
  onMounted(() => {
    if (containerRef.value && camera && scene) {
      initialize();
    }
  });
  
  onBeforeUnmount(() => {
    cleanup();
  });
  
  // 返回公开的API
  return {
    // 状态
    state,
    containerRef,
    raycaster,
    
    // 配置
    setOptions: (newOptions) => Object.assign(config, newOptions),
    
    // 初始化和设置
    setDependencies,
    initialize,
    cleanup,
    
    // 对象管理
    setPickableObjects,
    addPickableObject,
    removePickableObject,
    
    // 事件监听
    onObjectClick,
    onObjectHover,
    
    // 公共API
    getHoveredObject,
    updateContainerBounds,
    
    // 内部方法 (可能需要在特定情况下直接调用)
    performRaycast,
    updateMousePosition,
    
    // 新增方法
    setObjectParentMap,
  };
} 