<template>
  <div class="scene-container" ref="containerRef">
    <div class="model-wrapper" ref="modelWrapperRef"></div>
    
    <!-- 场景切换过渡效果 -->
    <div 
      class="scene-transition" 
      v-if="isTransitioning" 
      :style="{ opacity: transitionOpacity }"
    ></div>
    
    <!-- 返回按钮 -->
    <div 
      class="back-to-main-button" 
      v-if="currentView !== 'main'" 
      @click="$emit('switch-to-main')"
    >
      <el-icon><Back /></el-icon> 返回全景视图
    </div>
    
    <!-- 插槽 -->
    <slot></slot>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue';
import { Back } from '@element-plus/icons-vue';
import { useWindowResize } from '../../composables/ui/useWindowResize';

export default defineComponent({
  name: 'SceneContainer',
  
  components: {
    Back
  },
  
  props: {
    currentView: {
      type: String,
      default: 'main' // 'main', 'single-rack', 'single-device' 
    },
    isTransitioning: {
      type: Boolean,
      default: false
    },
    transitionOpacity: {
      type: Number,
      default: 0
    }
  },
  
  emits: ['switch-to-main', 'container-resize', 'container-ready'],
  
  setup(props, { emit }) {
    const containerRef = ref(null);
    const modelWrapperRef = ref(null);
    
    // 监听容器尺寸变化
    const onResize = () => {
      if (containerRef.value) {
        const container = containerRef.value;
        emit('container-resize', {
          width: container.clientWidth,
          height: container.clientHeight
        });
      }
    };
    
    // 窗口尺寸变化事件
    useWindowResize(onResize);
    
    // 生命周期钩子
    onMounted(() => {
      if (containerRef.value && modelWrapperRef.value) {
        emit('container-ready', {
          container: modelWrapperRef.value,
          width: containerRef.value.clientWidth,
          height: containerRef.value.clientHeight
        });
      }
      
      // 初始调用一次
      onResize();
    });
    
    return {
      containerRef,
      modelWrapperRef
    };
  }
});
</script>

<style lang="scss" scoped>
@use '../../styles/variables.scss' as vars;
@use '../../styles/mixins.scss' as mixins;

.scene-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

.model-wrapper {
  width: 100%;
  height: 100%;
}

.scene-transition {
  @include mixins.absolute(0, 0, 0, 0);
  background-color: vars.$bg-color;
  z-index: 50;
  transition: opacity vars.$transition-normal ease-in-out;
}

.back-to-main-button {
  position: absolute;
  top: vars.$spacing-md;
  left: vars.$spacing-md;
  background: rgba(vars.$primary-color, 0.2);
  border: 1px solid vars.$primary-color;
  border-radius: vars.$border-radius-md;
  padding: vars.$spacing-xs vars.$spacing-md;
  color: vars.$primary-color;
  cursor: pointer;
  transition: background-color vars.$transition-fast;
  z-index: 20;
  
  &:hover {
    background: rgba(vars.$primary-color, 0.3);
  }
  
  i {
    margin-right: vars.$spacing-xs;
  }
}
</style> 