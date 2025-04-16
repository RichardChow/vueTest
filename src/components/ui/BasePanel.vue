<template>
  <div
    v-if="visible"
    class="base-panel"
    :class="{ 'is-dragging': isDragging }"
    :style="panelStyle"
  >
    <div
      class="panel-header"
      @mousedown="startDrag"
      @touchstart="startDrag"
    >
      <slot name="header">Panel</slot>
    </div>
    <div class="panel-content">
      <slot></slot>
    </div>
    <div v-if="$slots.footer" class="panel-footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script>
import { computed, onBeforeUnmount } from 'vue';
import { useDraggable } from '../../composables/ui/useDraggable';

export default {
  name: 'BasePanel',
  
  props: {
    visible: {
      type: Boolean,
      default: true
    },
    initialX: {
      type: Number,
      default: 20
    },
    initialY: {
      type: Number,
      default: 20
    },
    width: {
      type: [Number, String],
      default: 'auto'
    },
    height: {
      type: [Number, String],
      default: 'auto'
    },
    draggable: {
      type: Boolean,
      default: true
    }
  },
  
  setup(props, { emit }) {
    // 使用拖拽功能
    const {
      position,
      isDragging,
      startDrag,
      stopDrag,
      updatePosition
    } = useDraggable({
      initialX: props.initialX,
      initialY: props.initialY,
      onDragEnd: (pos) => {
        emit('position-change', pos);
      },
      boundaries: {
        minX: 0,
        minY: 0,
        // 动态计算最大边界
        maxX: window.innerWidth - 100, // 预留100px的边距
        maxY: window.innerHeight - 100
      }
    });

    // 监听窗口大小变化，更新边界
    const handleResize = () => {
      const maxX = window.innerWidth - 100;
      const maxY = window.innerHeight - 100;
      
      // 确保当前位置不超出新边界
      if (position.value.x > maxX) {
        position.value.x = maxX;
      }
      if (position.value.y > maxY) {
        position.value.y = maxY;
      }
    };

    window.addEventListener('resize', handleResize);

    // 组件卸载时清理
    onBeforeUnmount(() => {
      window.removeEventListener('resize', handleResize);
      stopDrag(); // 确保拖拽事件被清理
    });
    
    // 提供更新位置的方法
    const setPosition = (newPos) => {
      if (!newPos) return;
      
      const maxX = window.innerWidth - 100;
      const maxY = window.innerHeight - 100;
      
      // 确保新位置在边界内
      const x = Math.min(Math.max(newPos.x ?? position.value.x, 0), maxX);
      const y = Math.min(Math.max(newPos.y ?? position.value.y, 0), maxY);
      
      updatePosition({ x, y });
      emit('position-change', { x, y });
    };

    return {
      position,
      isDragging,
      startDrag: props.draggable ? startDrag : () => {},
      panelStyle: computed(() => ({
        left: `${position.value.x}px`,
        top: `${position.value.y}px`,
        width: props.width !== 'auto' ? (typeof props.width === 'number' ? `${props.width}px` : props.width) : 'auto',
        height: props.height !== 'auto' ? (typeof props.height === 'number' ? `${props.height}px` : props.height) : 'auto'
      })),
      setPosition
    };
  }
}
</script>

<style lang="scss" scoped>
@use '../../styles/variables.scss' as vars;
@use '../../styles/mixins.scss' as mixins;

.base-panel {
  @include mixins.panel-style;
  position: absolute;
  z-index: 100;
  transition: box-shadow vars.$transition-fast ease;
  
  &.is-dragging {
    box-shadow: vars.$shadow-heavy;
    opacity: 0.95;
  }
}

.panel-header {
  @include mixins.flex(row, space-between, center);
  background: rgba(vars.$primary-color, 0.2);
  padding: vars.$spacing-sm vars.$spacing-md;
  color: vars.$primary-color;
  font-weight: bold;
  cursor: move;
  user-select: none;
}

.panel-content {
  padding: vars.$spacing-md;
}

.panel-footer {
  padding: vars.$spacing-sm;
  border-top: 1px solid vars.$section-border;
  @include mixins.flex(row, space-between, center);
}
</style>
