import { onMounted, onBeforeUnmount } from 'vue';

/**
 * 帮助管理事件监听器的注册与自动清理
 * @param {string} event 事件名称
 * @param {Function} handler 事件处理函数
 * @param {Element|Window|Document} target 事件目标，默认为window
 * @param {Object} options 事件选项，如capture, passive等
 */
export function useEventListener(event, handler, target = window, options = {}) {
  // 挂载时添加事件监听
  onMounted(() => {
    target.addEventListener(event, handler, options);
  });

  // 组件卸载前清理事件监听
  onBeforeUnmount(() => {
    target.removeEventListener(event, handler, options);
  });
} 