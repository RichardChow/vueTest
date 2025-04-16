<template>
  <div class="bottom-nav-bar">
    <div
      v-for="(item, index) in navigationItems"
      :key="index"
      class="nav-item"
      :class="{ active: activeItem === item.value }"
      @click="handleNavItemClick(item.value)"
    >
      {{ item.label }}
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'BottomNavBar',
  
  props: {
    activeItem: {
      type: String,
      default: 'realtime'
    },
    navigationItems: {
      type: Array,
      default: () => [
        { label: '资产', value: 'assets' },
        { label: '供电系统', value: 'power' },
        { label: '云端', value: 'cloud' },
        { label: '资源', value: 'resources' },
        { label: '实况', value: 'realtime' },
        { label: '巡检', value: 'inspection' },
        { label: '安防', value: 'security' },
        { label: '排障', value: 'troubleshoot' }
      ]
    }
  },
  
  emits: ['nav-change'],
  
  setup(props, { emit }) {
    const handleNavItemClick = (value) => {
      if (value !== props.activeItem) {
        emit('nav-change', value);
      }
    };
    
    return {
      handleNavItemClick
    };
  }
});
</script>

<style lang="scss" scoped>
@use '../../styles/variables.scss' as vars;
@use '../../styles/mixins.scss' as mixins;

.bottom-nav-bar {
  height: 60px;
  @include mixins.flex(row, space-around, center);
  background: linear-gradient(180deg, rgba(13, 21, 35, 0.8) 0%, rgba(20, 30, 48, 0.9) 100%);
  border-top: 1px solid vars.$panel-border;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  z-index: 10;
}

.nav-item {
  padding: vars.$spacing-sm vars.$spacing-md;
  color: rgba(vars.$text-color, 0.7);
  font-size: vars.$font-size-base;
  cursor: pointer;
  transition: all vars.$transition-fast;
  position: relative;
  
  &:hover {
    color: vars.$primary-color;
  }
  
  &.active {
    color: vars.$primary-color;
    font-weight: bold;
    
    &:after {
      content: '';
      position: absolute;
      bottom: -10px;
      left: 50%;
      transform: translateX(-50%);
      width: 6px;
      height: 6px;
      background-color: vars.$primary-color;
      border-radius: 50%;
      box-shadow: 0 0 8px vars.$primary-color;
    }
  }
  
  @include mixins.respond-to(md) {
    font-size: vars.$font-size-medium;
    padding: vars.$spacing-sm vars.$spacing-lg;
  }
}
</style> 