<template>
  <div class="server-info" v-if="serverInfo">
    <div class="info-card">
      <h3>服务器信息</h3>
      <p>ID: {{ serverInfo.id }}</p>
      <p>状态: {{ serverInfo.status }}</p>
      <p>温度: {{ serverInfo.temperature.toFixed(1) }}°C</p>
      <button @click="closeInfo">关闭</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ServerInfo',
  props: {
    serverInfo: {
      type: Object,
      default: null
    }
  },
  methods: {
    closeInfo() {
      this.$emit('close');
    }
  }
}
</script>

<style scoped>
.server-info {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 20px;
  border-radius: 8px;
  z-index: 1000;
}

.info-card {
  min-width: 200px;
}

button {
  margin-top: 10px;
  padding: 5px 15px;
  background: #4CAF50;
  border: none;
  color: white;
  cursor: pointer;
  border-radius: 4px;
}

button:hover {
  background: #45a049;
}
</style> 