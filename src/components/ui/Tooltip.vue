<!-- src/components/ui/Tooltip.vue -->
<template>
    <Transition name="tooltip-fade">
      <div
        v-if="visible"
        class="tooltip"
        :class="[`tooltip-${type}`]"
        :style="computedStyle"
        @mouseenter="onMouseEnter"
        @mouseleave="onMouseLeave"
      >
        <div v-if="title" class="tooltip-title">{{ title }}</div>
        <div v-if="content && htmlContent" class="tooltip-content" v-html="content"></div>
        <div v-else-if="content" class="tooltip-content">{{ content }}</div>
        <slot></slot>
      </div>
    </Transition>
  </template>
  
  <script>
  export default {
    name: 'ToolTip',
    props: {
      visible: {
        type: Boolean,
        default: false
      },
      title: {
        type: String,
        default: ''
      },
      content: {
        type: String,
        default: ''
      },
      type: {
        type: String,
        default: 'default'
      },
      htmlContent: {
        type: Boolean,
        default: false
      },
      x: {
        type: Number,
        default: 0
      },
      y: {
        type: Number,
        default: 0
      },
      style: {
        type: Object,
        default: () => ({})
      }
    },
    emits: ['mouse-enter', 'mouse-leave'],
    computed: {
      computedStyle() {
        return {
          left: `${this.x}px`,
          top: `${this.y}px`,
          ...this.style
        };
      }
    },
    methods: {
      onMouseEnter() {
        this.$emit('mouse-enter');
      },
      onMouseLeave() {
        this.$emit('mouse-leave');
      }
    }
  }
  </script>
  
  <style lang="scss" scoped>
  /* 引入变量（如果 Tooltip.vue 可以访问全局 SCSS 变量） */
  /* @use '@/styles/variables' as *; */ 
  /* 假设 $border-radius-md: 6px; $font-size-small: 12px; $spacing-sm: 8px; $spacing-md: 12px; $spacing-xs: 4px; */

  .tooltip {
    position: fixed; /* 使用 fixed 定位 */
    padding: 8px 12px; /* $spacing-sm $spacing-md */
    border-radius: 6px; /* $border-radius-md */
    background-color: rgba(5, 15, 30, 0.9); /* 深蓝背景 */
    backdrop-filter: blur(8px); /* 背景模糊 */
    border: 1px solid rgba(0, 191, 255, 0.6); /* 青色边框 */
    box-shadow: 0 0 15px rgba(0, 128, 200, 0.6); /* 蓝色辉光 */
    max-width: 280px;
    z-index: 9999; /* 保持高层级 */
    pointer-events: none; /* 默认不响应鼠标事件 */
    font-family: 'Roboto Mono', monospace; /* 科技字体 */
    color: #cceeff; /* 浅蓝文字 */
    line-height: 1.4;
    min-width: 150px; /* 调整最小宽度 */
    transition: opacity 0.2s, transform 0.2s; /* 保持过渡 */

    &.tooltip-sticky { /* 如果需要粘性提示，允许鼠标事件 */
        pointer-events: auto;
    }

    &-title {
      font-weight: 600;
      font-size: 13px; /* $font-size-small */
      margin-bottom: 4px; /* $spacing-xs */
      color: #ffffff; /* 白色标题 */
      text-shadow: 0 0 4px rgba(0, 191, 255, 0.8); /* 文字辉光加强 */
    }

    &-content {
      font-size: 12px; /* 稍小一点的内容字体 */
      color: inherit; /* 继承 .tooltip 的颜色 */
       word-wrap: break-word; /* 允许长单词换行 */

      /* 如果内容是 HTML，确保内部元素样式正常 */
      ::v-deep(p) {
        margin: 0 0 4px 0; 
      }
       ::v-deep(strong) {
        color: #ffffff;
      }
    }

    /* 不同类型的提示样式 (调整边框颜色) */
    &-default {
      /* 使用基础样式 */
    }

    &-info {
      border-color: rgba(0, 191, 255, 0.8); /* 默认青色边框 */
      box-shadow: 0 0 15px rgba(0, 191, 255, 0.7);
    }

    &-success {
      border-color: rgba(0, 255, 128, 0.8); /* 绿色边框 */
      box-shadow: 0 0 15px rgba(0, 255, 128, 0.7);
       .tooltip-title {
          text-shadow: 0 0 4px rgba(0, 255, 128, 0.8);
      }
    }

    &-warning {
      border-color: rgba(255, 221, 0, 0.8); /* 黄色边框 */
      box-shadow: 0 0 15px rgba(255, 221, 0, 0.7);
       color: #fff; /* 警告时文字用白色可能更清晰 */
       .tooltip-title {
          text-shadow: 0 0 4px rgba(255, 221, 0, 0.8);
      }
    }

    &-error {
      border-color: rgba(255, 68, 102, 0.8); /* 红色边框 */
      box-shadow: 0 0 15px rgba(255, 68, 102, 0.7);
      color: #ffd0d8; /* 错误用浅红色文字 */
       .tooltip-title {
          color: #ff8095; /* 标题用亮红色 */
          text-shadow: 0 0 4px rgba(255, 68, 102, 0.8);
      }
    }
  }
  
  // 出现和消失的过渡动画
  .tooltip-fade-enter-active,
  .tooltip-fade-leave-active {
    transition: opacity 0.2s, transform 0.2s;
  }
  
  .tooltip-fade-enter-from,
  .tooltip-fade-leave-to {
    opacity: 0;
    transform: translateY(5px);
  }
  </style>