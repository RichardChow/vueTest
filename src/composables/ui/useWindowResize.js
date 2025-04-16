import { ref, onMounted, computed } from 'vue';
import { useEventListener } from './useEventListener';

/**
 * 提供响应式的窗口尺寸和自动处理窗口大小变化
 * @param {Function} callback 窗口大小变化时的回调函数，可选
 * @returns {Object} 包含窗口尺寸的响应式数据
 */
export function useWindowResize(callback) {
  // 窗口尺寸的响应式引用
  const windowSize = ref({
    width: window.innerWidth,
    height: window.innerHeight
  });
  
  // 单独的宽高引用，方便直接使用
  const width = computed(() => windowSize.value.width);
  const height = computed(() => windowSize.value.height);
  
  // 处理窗口大小变化
  const handleResize = () => {
    windowSize.value.width = window.innerWidth;
    windowSize.value.height = window.innerHeight;
    
    // 如果提供了回调函数，则调用
    if (typeof callback === 'function') {
      callback(windowSize.value);
    }
  };
  
  // 组件挂载时获取一次尺寸（以防组件挂载时窗口已变化）
  onMounted(() => {
    handleResize();
  });
  
  // 使用前面定义的useEventListener来管理事件
  useEventListener('resize', handleResize);
  
  return {
    windowSize,
    width,
    height
  };
} 