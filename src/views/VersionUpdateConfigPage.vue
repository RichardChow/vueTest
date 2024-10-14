<template>
  <div class="config-page">
    <h2>版本更新配置</h2>
    <div class="config-form">
      <div class="form-section">
        <h3>通用配置</h3>
        <div class="form-group">
          <label for="upgradeType">upgrade type:</label>
          <textarea id="upgradeType" v-model="config.upgradeType" placeholder="输入 Upgrade Type，每行一个类型"></textarea>
        </div>
        <div class="form-group">
          <label for="workType">work type:</label>
          <textarea id="workType" v-model="config.workType" placeholder="输入 Work Type，每行一个类型"></textarea>
        </div>
      </div>
      
      <div class="form-section">
        <h3>网元环境IP配置</h3>
        <div class="form-group">
          <label for="neEnv">Env name:</label>
          <input id="neEnv" type="text" v-model="config.neEnv" placeholder="输入环境名称">
        </div>
        <div class="form-group">
          <label for="neIpList">IP List:</label>
          <textarea id="neIpList" v-model="config.neIpList" placeholder="输入 IP 列表，使用逗号分隔"></textarea>
        </div>
      </div>
    </div>
    <div class="button-group">
      <button @click="saveConfig" class="save-button">保存配置</button>
      <button @click="goBack" class="back-button">返回</button>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'VersionUpdateConfigPage',
  data() {
    return {
      config: {
        upgradeType: '',
        workType: '',
        neEnv: '',
        neIpList: ''
      }
    }
  },
  methods: {
    async loadConfig() {
      try {
        const response = await axios.get('/api/config');
        this.config = response.data;
      } catch (error) {
        console.error('加载配置失败:', error);
      }
    },
    async saveConfig() {
      try {
        const response = await axios.post('/api/config', this.config);
        console.log('保存配置成功:', response.data);
        alert('配置已保存');
        this.$router.push('/version-upgrade');
      } catch (error) {
        console.error('保存配置失败:', error.response ? error.response.data : error.message);
        alert('保存配置失败，请重试。错误: ' + (error.response ? error.response.data : error.message));
      }
    },
    goBack() {
      this.$router.push('/version-upgrade');
    }
  },
  mounted() {
    this.loadConfig();
  }
}
</script>

<style scoped>
.config-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.form-section {
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

h2, h3 {
  margin-bottom: 20px;
  color: #333;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

input, textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

textarea {
  height: 100px;
  resize: vertical;
}

.ne-env-group {
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 15px;
}

.env-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.env-header h4 {
  margin: 0;
}

.remove-btn, .add-btn {
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.remove-btn {
  background-color: #ff4d4d;
  color: white;
}

.add-btn {
  background-color: #4CAF50;
  color: white;
  margin-top: 10px;
}

.button-group {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.save-button, .back-button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.save-button {
  background-color: #4CAF50;
  color: white;
}

.back-button {
  background-color: #3498db;
  color: white;
}
</style>
