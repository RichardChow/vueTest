<template>
  <div class="top-status-bar">
    <div class="left-info">
      <div class="timestamp">{{ currentDateTime }}</div>
      <div class="status-icon" :class="systemStatus"></div>
    </div>
    <div class="center-title">
      <span class="glow-text">{{ title }}</span> 
    </div>
    <div class="right-info">
      <div class="temp-info">
        <el-icon class="temp-icon"><Cloudy /></el-icon>
        <span>服务器温度 {{ serverTemperature }}°C</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Cloudy } from '@element-plus/icons-vue';
import { useWindowResize } from '../../composables/ui/useWindowResize';

export default {
  name: 'TopStatusBar',
  
  components: {
    Cloudy
  },
  
  props: {
    title: {
      type: String,
      default: '智慧机房'
    },
    serverTemperature: {
      type: [Number, String],
      default: '--'
    },
    systemStatus: {
      type: String,
      default: 'online' // 可选值: online, warning, error, offline
    }
  },
  
  setup() {
    // 当前时间状态
    const currentDateTime = ref('');
    let datetimeInterval = null;
    
    // 更新日期时间
    const updateDateTime = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      
      currentDateTime.value = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };
    
    // 监听窗口大小变化，确保响应式布局
    useWindowResize();
    
    // 生命周期钩子
    onMounted(() => {
      updateDateTime();
      datetimeInterval = setInterval(updateDateTime, 1000);
    });
    
    onBeforeUnmount(() => {
      if (datetimeInterval) {
        clearInterval(datetimeInterval);
      }
    });
    
    return {
      currentDateTime
    };
  }
}
</script>

<style lang="scss" scoped>
@use '../../styles/variables.scss' as vars;
@use '../../styles/mixins.scss' as mixins;

.top-status-bar {
  height: 50px;
  @include mixins.flex(row, space-between, center);
  padding: 0 vars.$spacing-md;
  @include mixins.gradient-bg(90deg, rgba(20,30,48,0.8), rgba(36,59,85,0.8));
  border-bottom: 1px solid vars.$panel-border;
  box-shadow: 0 0 10px rgba(vars.$primary-color, 0.2);
  z-index: 10;
}

.left-info, .right-info {
  @include mixins.flex(row, flex-start, center);
}

.timestamp {
  font-family: vars.$font-family-code;
  font-size: vars.$font-size-base;
  color: vars.$primary-color;
  margin-right: vars.$spacing-md;
}

.status-icon {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 5px;
  
  &.online {
    background-color: vars.$accent-color;
    box-shadow: 0 0 5px vars.$accent-color;
  }
  
  &.warning {
    background-color: vars.$warning-color;
    box-shadow: 0 0 5px vars.$warning-color;
  }
  
  &.error {
    background-color: vars.$error-color;
    box-shadow: 0 0 5px vars.$error-color;
  }
  
  &.offline {
    background-color: #888888;
    box-shadow: 0 0 5px #888888;
  }
}

.center-title {
  font-size: vars.$font-size-large;
  font-weight: bold;
  letter-spacing: 1px;
  text-shadow: 0 0 5px rgba(vars.$primary-color, 0.5);
}

.glow-text {
  color: vars.$primary-color;
}

.temp-info {
  @include mixins.flex(row, flex-start, center);
  font-size: vars.$font-size-base;
  
  .temp-icon {
    color: vars.$primary-color;
    margin-right: 5px;
    font-size: 18px;
  }
}
</style> 