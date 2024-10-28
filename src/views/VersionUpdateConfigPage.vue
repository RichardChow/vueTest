<template>
  <div class="config-page">
    <h2>版本更新配置</h2>
    <div class="config-form">
      <div class="form-section">
        <h3>通用配置</h3>
        <div class="form-group">
          <label for="upgradeType">upgrade type:</label>
          <textarea id="upgradeType" v-model="config.upgradeType" placeholder="输入 Upgrade Type，每行一个类型"></textarea>
          <small>请每行输入一个类型</small>
        </div>
        <div class="form-group">
          <label for="workType">work type:</label>
          <textarea id="workType" v-model="config.workType" placeholder="输入 Work Type，每行一个类型"></textarea>
          <small>请每行输入一个类型</small>
        </div>
      </div>
      
      <div class="form-section">
        <h3>网元环境IP配置</h3>
        <div class="form-group">
          <label for="neEnv">Env name:</label>
          <input id="neEnv" type="text" v-model="newEnv.name" placeholder="输入环境名称">
        </div>
        <div class="form-group">
          <label for="neIpList">IP List:</label>
          <textarea id="neIpList" v-model="newEnv.ipList" placeholder="输入 IP 列表，使用逗号分隔"></textarea>
        </div>
        <button @click="addEnv" class="add-button">添加环境</button>
        <small>您也可以直接点击"保存配置"按钮来保存新输入的环境数据</small>
        
        <h4>已保存的环境配置：</h4>
        <ul class="saved-envs">
          <li v-for="(env, index) in config.environments" :key="index">
            <span>{{ env.name }}: {{ env.ipList }}</span>
            <button @click="deleteEnv(index)" class="delete-button">删除</button>
          </li>
        </ul>
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
        id: null,
        upgradeType: '',
        workType: '',
        environments: []
      },
      newEnv: {
        name: '',
        ipList: ''
      }
    }
  },
  methods: {
    async loadConfig() {
      try {
        console.log('开始加载配置');
        const response = await axios.get('/api/config/');
        console.log('成功加载配置:', response.data);
        
        // 处理后端返回的数据
        this.config.id = response.data.id;
        this.config.upgradeType = Array.isArray(response.data.upgrade_type) 
          ? response.data.upgrade_type.join('\n')
          : response.data.upgrade_type;
        this.config.workType = Array.isArray(response.data.work_type)
          ? response.data.work_type.join('\n')
          : response.data.work_type;
        this.config.environments = Array.isArray(response.data.environments)
          ? response.data.environments.map(env => ({
              name: env.ne_env,
              ipList: Array.isArray(env.ne_ip_list) ? env.ne_ip_list.join(', ') : env.ne_ip_list
            }))
          : [];
      } catch (error) {
        console.error('加载配置失败:', error);
      }
    },
    async saveConfig() {
      try {
        console.log('开始保存配置');
        console.log('当前配置:', this.config);

        // 将数据转换为后端期望的格式
        const formattedConfig = {
          id: this.config.id,
          upgrade_type: this.config.upgradeType.split('\n').filter(item => item.trim() !== ''),
          work_type: this.config.workType.split('\n').filter(item => item.trim() !== ''),
          environments: this.config.environments.map(env => ({
            ne_env: env.name,
            ne_ip_list: env.ipList.split(',').map(ip => ip.trim())
          }))
        };

        // 如果有新的环境数据，也将其添加到 environments 数组中
        if (this.newEnv.name && this.newEnv.ipList) {
          formattedConfig.environments.push({
            ne_env: this.newEnv.name,
            ne_ip_list: this.newEnv.ipList.split(',').map(ip => ip.trim())
          });
        }

        console.log('发送到后端的数据:', JSON.stringify(formattedConfig, null, 2));

        const response = await axios.post('/api/config/', formattedConfig);
        console.log('保存配置成功，后端响应:', response.data);
        alert('配置已保存');
        
        // 清空新环境输入框
        this.newEnv = { name: '', ipList: '' };
        
        // 重新加载配置以确保显示最新数据
        await this.loadConfig();
        
        this.$router.push('/version-upgrade');
      } catch (error) {
        console.error('保存配置失败:', error);
        if (error.response) {
          console.error('错误响应:', error.response.data);
          alert('保存配置失败，请重试。错误: ' + JSON.stringify(error.response.data));
        } else {
          alert('保存配置失败，请重试。错误: ' + error.message);
        }
      }
    },
    goBack() {
      this.$router.push('/version-upgrade');
    },
    addEnv() {
      if (this.newEnv.name && this.newEnv.ipList) {
        console.log('添加新环境:', this.newEnv);
        // 检查是否已存在相同名称的环境
        const existingEnv = this.config.environments.find(env => env.name === this.newEnv.name);
        if (existingEnv) {
          alert('已存在相同名称的环境，请使用不同的名称。');
          return;
        }
        this.config.environments.push({...this.newEnv});
        this.newEnv = { name: '', ipList: '' };
      } else {
        alert('请填写环境名称和IP列表。');
      }
    },
    deleteEnv(index) {
      console.log('删除环境:', this.config.environments[index]);
      this.config.environments.splice(index, 1);
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

.add-button, .delete-button {
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-top: 10px;
}

.add-button {
  background-color: #4CAF50;
  color: white;
}

.delete-button {
  background-color: #f44336;
  color: white;
  margin-left: 10px;
}

.saved-envs {
  list-style-type: none;
  padding: 0;
}

.saved-envs li {
  margin-bottom: 10px;
  padding: 10px;
  background-color: #f0f0f0;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

small {
  display: block;
  margin-top: 5px;
  color: #666;
  font-size: 12px;
}
</style>
