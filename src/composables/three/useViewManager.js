import { ref } from 'vue';
import { easeInOutCubic } from '@/utils/threeUtils';

/**
 * 视图管理器composable
 * 
 * 负责管理场景的不同视图状态和视图切换逻辑
 */
export default function useViewManager(emitViewChanged) {
  // 当前视图状态
  const currentView = ref('main');
  
  // 选中的机架和设备数据
  const selectedRack = ref(null);
  const selectedDevice = ref(null);
  
  // 是否处于过渡动画中
  const isTransitioning = ref(false);
  
  /**
   * 切换到主视图
   */
  function switchToMainView() {
    if (isTransitioning.value) return false;
    
    currentView.value = 'main';
    selectedRack.value = null;
    selectedDevice.value = null;
    
    // 通知视图变化
    if (emitViewChanged) {
      emitViewChanged({
        view: 'main',
        data: null
      });
    }
    
    return true;
  }
  
  /**
   * 切换到单机架视图
   * @param {Object} rackData - 机架数据
   */
  function switchToSingleRackView(rackData) {
    if (isTransitioning.value) return false;
    
    currentView.value = 'single-rack';
    selectedRack.value = rackData;
    selectedDevice.value = null;
    
    // 通知视图变化
    if (emitViewChanged) {
      emitViewChanged({
        view: 'single-rack',
        data: rackData
      });
    }
    
    return true;
  }
  
  /**
   * 切换到单设备视图
   * @param {Object} deviceData - 设备数据
   */
  function switchToSingleDeviceView(deviceData) {
    if (isTransitioning.value) return false;
    
    currentView.value = 'single-device';
    selectedDevice.value = deviceData;
    
    // 通知视图变化
    if (emitViewChanged) {
      emitViewChanged({
        view: 'single-device',
        data: deviceData
      });
    }
    
    return true;
  }
  
  /**
   * 执行视图过渡动画
   * @param {Function} callback - 过渡完成后的回调函数
   * @param {Number} duration - 动画持续时间(毫秒)
   */
  function executeViewTransition(callback, duration = 500) {
    if (isTransitioning.value) return false;
    
    isTransitioning.value = true;
    const startTime = performance.now();
    
    // 执行淡出动画
    function fadeOut(timestamp) {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);
      
      // 当达到100%完成度
      if (progress >= 1) {
        // 执行回调
        if (callback) callback();
        
        // 重置过渡状态
        isTransitioning.value = false;
        return;
      }
      
      // 继续动画
      requestAnimationFrame(fadeOut);
    }
    
    // 开始动画
    requestAnimationFrame(fadeOut);
    return true;
  }
  
  return {
    // 状态
    currentView,
    selectedRack,
    selectedDevice,
    isTransitioning,
    
    // 方法
    switchToMainView,
    switchToSingleRackView,
    switchToSingleDeviceView,
    executeViewTransition
  };
} 