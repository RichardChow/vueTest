<template>
  <div class="context-menu" v-if="visible" :style="positionStyle">
    <div class="menu-item" @click="$emit('select', 'view-multi-rack')">
      <i class="icon-view"></i>
      {{ menuTitle }}
    </div>
    <div class="menu-item" @click="$emit('select', 'cancel')">
      <i class="icon-cancel"></i>
      取消
    </div>
  </div>
</template>

<script>
export default {
  props: {
    visible: Boolean,
    x: Number,
    y: Number,
    rackType: {
      type: String,
      default: 'column'
    }
  },
  computed: {
    positionStyle() {
      return {
        left: `${this.x}px`,
        top: `${this.y}px`
      };
    },
    menuTitle() {
      // 根据机架类型自动调整菜单文本
      return this.rackType === 'column' ? '查看当前列机架' : '查看当前行机架';
    }
  }
};
</script>

<style lang="scss" scoped>
.context-menu {
  position: absolute;
  background: rgba(5, 15, 30, 0.9);
  border: 1px solid rgba(0, 191, 255, 0.6);
  border-radius: 4px;
  padding: 5px 0;
  min-width: 160px;
  box-shadow: 0 0 15px rgba(0, 128, 200, 0.6);
  z-index: 1000;
  backdrop-filter: blur(5px);
  
  .menu-item {
    padding: 8px 15px;
    color: #e0f2ff;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: background 0.2s;
    
    i {
      margin-right: 8px;
      font-size: 16px;
    }
    
    &:hover {
      background: rgba(0, 128, 200, 0.3);
    }
  }
}
</style>
