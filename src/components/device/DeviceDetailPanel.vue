<template>
  <BasePanel
    v-if="deviceData"
    :visible="visible"
    :initial-x="initialX"
    :initial-y="initialY"
    :width="width"
    @position-change="handlePositionChange"
  >
    <template #header>
      <div class="panel-header-content">
        <span>设备详情</span>
        <div class="header-actions">
          <span class="last-update">更新于: {{ lastUpdateTime }}</span>
          <i class="refresh-btn" @click="refreshData"></i>
          <el-icon class="close-btn" @click="closePanel"><Close /></el-icon>
        </div>
      </div>
    </template>
    
    <div class="panel-content">
      <div class="panel-section">基本信息</div>
      <div class="detail-item">
        <span class="detail-label">设备ID</span>
        <span class="detail-value">{{ deviceData.id }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">类型</span>
        <span class="detail-value">{{ deviceData.type }}</span>
      </div>
      <div class="detail-item" v-if="deviceData.manufacturer">
        <span class="detail-label">制造商</span>
        <span class="detail-value">{{ deviceData.manufacturer }}</span>
      </div>
      <div class="detail-item" v-if="deviceData.model">
        <span class="detail-label">型号</span>
        <span class="detail-value">{{ deviceData.model }}</span>
      </div>
      <div class="detail-item" v-if="deviceData.serialNumber">
        <span class="detail-label">序列号</span>
        <span class="detail-value">{{ deviceData.serialNumber }}</span>
      </div>
      <div class="detail-item" v-if="deviceData.rackPosition">
        <span class="detail-label">机架位置</span>
        <span class="detail-value">{{ deviceData.rackPosition }}</span>
      </div>
      
      <div class="panel-section">运行状态</div>
      <div class="detail-item">
        <span class="detail-label">状态</span>
        <span class="detail-value" :class="deviceData.status">
          {{ statusMap[deviceData.status] }}
        </span>
      </div>
      <div class="detail-item">
        <span class="detail-label">温度</span>
        <span class="detail-value">{{ deviceData.temperature }}°C</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">CPU使用率</span>
        <span class="detail-value">{{ deviceData.cpu }}%</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">内存使用率</span>
        <span class="detail-value">{{ deviceData.memory }}%</span>
      </div>
      
      <div class="panel-section">网络信息</div>
      <div class="detail-item" v-if="deviceData.ipAddress">
        <span class="detail-label">IP地址</span>
        <span class="detail-value">{{ deviceData.ipAddress }}</span>
      </div>
      
      <div class="panel-section">维护信息</div>
      <div class="detail-item" v-if="deviceData.lastMaintenance">
        <span class="detail-label">上次维护</span>
        <span class="detail-value">{{ deviceData.lastMaintenance }}</span>
      </div>
    </div>
    
    <template #footer>
      <div class="panel-actions">
        <el-button size="mini" type="primary">详细监控</el-button>
        <el-button size="mini" type="warning">告警记录</el-button>
      </div>
    </template>
  </BasePanel>
</template>

<script>
import { defineComponent, computed } from 'vue';
import BasePanel from '../ui/BasePanel.vue';
import { Close } from '@element-plus/icons-vue';

export default defineComponent({
  name: 'DeviceDetailPanel',
  
  components: {
    BasePanel,
    Close
  },
  
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    deviceData: {
      type: Object,
      default: null
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
      default: 280
    }
  },
  
  emits: ['close', 'refresh', 'position-change'],
  
  setup(props, { emit }) {
    // 状态映射
    const statusMap = {
      'normal': '正常',
      'warning': '警告',
      'error': '错误',
      'offline': '离线'
    };
    
    // 最后更新时间
    const lastUpdateTime = computed(() => {
      return new Date().toLocaleTimeString();
    });
    
    // 关闭面板
    const closePanel = () => {
      emit('close');
    };
    
    // 刷新数据
    const refreshData = () => {
      emit('refresh', props.deviceData.id);
    };
    
    // 位置变化
    const handlePositionChange = (position) => {
      emit('position-change', position);
    };
    
    return {
      statusMap,
      lastUpdateTime,
      closePanel,
      refreshData,
      handlePositionChange,
      Close
    };
  }
});
</script>

<style lang="scss" scoped>
@use '../../styles/variables.scss' as vars;
@use '../../styles/mixins.scss' as mixins;

.panel-header-content {
  @include mixins.flex(row, space-between, center);
  width: 100%;
}

.header-actions {
  @include mixins.flex(row, flex-end, center);
  
  .last-update {
    font-size: vars.$font-size-small;
    color: rgba(vars.$text-color, 0.7);
    margin-right: vars.$spacing-sm;
  }
  
  .refresh-btn {
    width: 16px;
    height: 16px;
    margin: 0 vars.$spacing-sm;
    cursor: pointer;
    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2366ccff"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>');
    
    &:hover {
      transform: rotate(45deg);
    }
  }
  
  .close-btn {
    cursor: pointer;
    color: vars.$primary-color;
    
    &:hover {
      color: vars.$error-color;
    }
  }
}

.panel-content {
  max-height: 70vh;
  overflow-y: auto;
}

.panel-section {
  font-size: vars.$font-size-small;
  color: vars.$primary-color;
  font-weight: bold;
  margin: vars.$spacing-md 0 vars.$spacing-sm 0;
  padding-bottom: 3px;
  border-bottom: 1px dashed rgba(vars.$primary-color, 0.3);
}

.detail-item {
  @include mixins.flex(row, space-between, center);
  margin: vars.$spacing-sm 0;
  font-size: vars.$font-size-base;
}

.detail-label {
  color: rgba(vars.$text-color, 0.7);
}

.detail-value {
  color: vars.$text-color;
  font-weight: bold;
  
  &.normal {
    @include mixins.status-color('normal');
  }
  
  &.warning {
    @include mixins.status-color('warning');
  }
  
  &.error {
    @include mixins.status-color('error');
  }
  
  &.offline {
    @include mixins.status-color('offline');
  }
}

.panel-actions {
  @include mixins.flex(row, space-between, center);
}
</style> 