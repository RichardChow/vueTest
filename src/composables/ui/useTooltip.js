// src/composables/ui/useTooltip.js

import { reactive, ref, computed, watch } from 'vue';

/**
 * 提供通用的工具提示功能
 * 支持不同类型的提示、自动隐藏、位置调整等
 */
export function useTooltip(options = {}) {
  // 默认配置
  const config = reactive({
    delayShow: 100,      // 显示延迟(毫秒)
    delayHide: 300,      // 隐藏延迟(毫秒)
    defaultDuration: 3000, // 自动隐藏时间(毫秒)
    defaultType: 'default', // 默认提示类型
    offsetX: 10,         // X轴偏移
    offsetY: 10,         // Y轴偏移
    zIndex: 9999,        // z-index
    ...options
  });

  // 提示状态
  const tooltip = reactive({
    visible: false,
    x: 0,
    y: 0,
    title: '',
    content: '',
    type: config.defaultType, // 'default', 'info', 'warning', 'error', 'success'
    targetId: null,
    sticky: false,       // 是否保持显示
    autoAdjust: true,    // 是否自动调整位置避免超出屏幕
    htmlContent: false,  // 内容是否包含HTML
    data: null,          // 自定义数据对象
    maxWidth: null,      // 最大宽度
    placement: 'auto'    // 'auto', 'top', 'right', 'bottom', 'left'
  });

  // 内部状态
  const state = reactive({
    showTimer: null,
    hideTimer: null,
    autoHideTimer: null,
    mouseOver: false
  });

  // 计算样式
  const tooltipStyle = computed(() => {
    return {
      position: 'fixed',
      left: `${tooltip.x}px`,
      top: `${tooltip.y}px`,
      zIndex: config.zIndex,
      maxWidth: tooltip.maxWidth ? `${tooltip.maxWidth}px` : 'auto',
      pointerEvents: tooltip.sticky ? 'auto' : 'none'
    };
  });

  // 显示提示
  const showTooltip = (options) => {
    // 清除现有计时器
    clearAllTimers();
    
    // 设置延迟显示
    state.showTimer = setTimeout(() => {
      // 更新提示数据
      Object.assign(tooltip, {
        visible: true,
        ...options
      });
      
      // 调整位置避免超出屏幕
      if (tooltip.autoAdjust) {
        adjustPosition();
      }
      
      // 如果不是粘性模式且需要自动隐藏
      if (!tooltip.sticky && options.duration !== false) {
        const duration = options.duration || config.defaultDuration;
        state.autoHideTimer = setTimeout(() => {
          hideTooltip();
        }, duration);
      }
    }, config.delayShow);
  };

  // 隐藏提示
  const hideTooltip = () => {
    // 如果鼠标在提示上且为粘性模式，则不隐藏
    if (state.mouseOver && tooltip.sticky) return;
    
    // 设置延迟隐藏
    clearAllTimers();
    state.hideTimer = setTimeout(() => {
      tooltip.visible = false;
    }, config.delayHide);
  };

  // 立即隐藏提示（无延迟）
  const hideTooltipImmediately = () => {
    clearAllTimers();
    tooltip.visible = false;
  };

  // 更新提示位置
  const updatePosition = (x, y) => {
    tooltip.x = x + config.offsetX;
    tooltip.y = y + config.offsetY;
    
    if (tooltip.autoAdjust) {
      adjustPosition();
    }
  };

  // 调整位置避免超出屏幕
  const adjustPosition = () => {
    if (typeof window === 'undefined') return;
    
    // 获取窗口尺寸
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // 假设工具提示宽高（实际使用时可以获取DOM元素的实际尺寸）
    const tooltipWidth = tooltip.maxWidth || 200;
    const tooltipHeight = 100;
    
    // 调整X坐标
    if (tooltip.x + tooltipWidth > windowWidth - 20) {
      tooltip.x = windowWidth - tooltipWidth - 20;
    }
    
    // 调整Y坐标
    if (tooltip.y + tooltipHeight > windowHeight - 20) {
      tooltip.y = tooltip.y - tooltipHeight - config.offsetY * 2;
    }
  };

  // 清除所有计时器
  const clearAllTimers = () => {
    if (state.showTimer) clearTimeout(state.showTimer);
    if (state.hideTimer) clearTimeout(state.hideTimer);
    if (state.autoHideTimer) clearTimeout(state.autoHideTimer);
    state.showTimer = null;
    state.hideTimer = null;
    state.autoHideTimer = null;
  };

  // 鼠标移入工具提示
  const onTooltipMouseEnter = () => {
    if (!tooltip.sticky) return;
    state.mouseOver = true;
    clearTimeout(state.hideTimer);
    clearTimeout(state.autoHideTimer);
  };

  // 鼠标移出工具提示
  const onTooltipMouseLeave = () => {
    if (!tooltip.sticky) return;
    state.mouseOver = false;
    hideTooltip();
  };

  // 提供事件处理器供绑定
  const eventHandlers = {
    onMouseEnter: onTooltipMouseEnter,
    onMouseLeave: onTooltipMouseLeave
  };

  // 在组件卸载时清理
  const cleanup = () => {
    clearAllTimers();
    tooltip.visible = false;
  };

  return {
    tooltip,
    tooltipStyle,
    showTooltip,
    hideTooltip,
    hideTooltipImmediately,
    updatePosition,
    eventHandlers,
    cleanup
  };
}