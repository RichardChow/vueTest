<template>
  <div 
    v-if="visible" 
    class="device-tooltip"
    :style="{ left: `${x}px`, top: `${y}px` }"
  >
    <div class="tooltip-title">{{ title }}</div>
    <div class="tooltip-content">
      <div v-if="status" class="tooltip-status" :class="status">
        {{ statusMap[status] }}
      </div>
      <div v-if="info" class="tooltip-info">{{ info }}</div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'DeviceTooltip',
  
  props: {
    visible: {
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
    title: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      default: ''
    },
    info: {
      type: String,
      default: ''
    }
  },
  
  setup() {
    const statusMap = {
      'normal': '正常',
      'warning': '警告',
      'error': '错误',
      'offline': '离线'
    };
    
    return {
      statusMap
    };
  }
});
</script>

<style lang="scss" scoped>
@use '../../styles/variables.scss' as vars;
@use '../../styles/mixins.scss' as mixins;

.device-tooltip {
  position: absolute;
  @include mixins.glassmorphism(0.9);
  border: 1px solid vars.$panel-border;
  border-radius: vars.$border-radius-sm;
  padding: vars.$spacing-sm;
  min-width: 150px;
  max-width: 200px;
  z-index: 1000;
  transform: translate(10px, -50%);
  box-shadow: vars.$shadow-medium;
  pointer-events: none;
  animation: fadeIn vars.$transition-fast ease-in;
  
  &:after {
    content: '';
    position: absolute;
    left: -6px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 6px solid rgba(vars.$primary-color, 0.3);
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translate(0, -50%); }
  to { opacity: 1; transform: translate(10px, -50%); }
}

.tooltip-title {
  font-size: vars.$font-size-base;
  font-weight: bold;
  color: vars.$primary-color;
  margin-bottom: vars.$spacing-xs;
  @include mixins.text-ellipsis;
}

.tooltip-content {
  font-size: vars.$font-size-small;
}

.tooltip-status {
  display: inline-block;
  margin-bottom: vars.$spacing-xs;
  padding: 2px vars.$spacing-xs;
  border-radius: 2px;
  font-size: 11px;
  
  &.normal {
    background-color: rgba(vars.$accent-color, 0.2);
    @include mixins.status-color('normal');
  }
  
  &.warning {
    background-color: rgba(vars.$warning-color, 0.2);
    @include mixins.status-color('warning');
  }
  
  &.error {
    background-color: rgba(vars.$error-color, 0.2);
    @include mixins.status-color('error');
  }
  
  &.offline {
    background-color: rgba(#888888, 0.2);
    @include mixins.status-color('offline');
  }
}

.tooltip-info {
  color: vars.$text-color;
  @include mixins.multi-line-ellipsis(2);
}
</style> 