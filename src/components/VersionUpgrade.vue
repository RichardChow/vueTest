<template>
  <div class="version-upgrade">
    <div class="back-button">
      <button @click="goBack" class="btn-back">
        <i class="fas fa-arrow-left"></i> 返回仪表盘
      </button>
    </div>
    <h2>版本更新</h2>
    <div class="upgrade-content">
      <div class="upgrade-form">
        <form @submit.prevent="upgradeVersion">
          <div class="form-group">
            <label for="upgrade_type">upgrade_type</label>
            <select id="upgrade_type" v-model="upgradeType" required>
              <option value="force">force</option>
              <option value="normal">normal</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="work_type">work_type</label>
            <select id="work_type" v-model="workType" required>
              <option value="multi_process">multi_process</option>
              <option value="single_process">single_process</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="ne_ip">NE_IP</label>
            <select id="ne_ip" v-model="neIp" required>
              <option value="">Select a env...</option>
              <option value="env1">环境1</option>
              <option value="env2">环境2</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="ne_ip_input">NE_IP_Input</label>
            <input id="ne_ip_input" v-model="neIpInput" placeholder="可以手动输入IP地址，NE_IP，NE_IP_Input 只能选其一，多个IP地址，用以下格式：IP1|IP2|IP3，没有空格" />
          </div>
          
          <div class="form-group">
            <label for="ne_version_path">NE_Version_Path</label>
            <input id="ne_version_path" v-model="neVersionPath" placeholder="1.路径不需要引号了 2.如果是升级2xxx程序bin方式，可按如下格式：path/bin（同理是分号）" />
          </div>
          
          <button type="submit" class="btn-upgrade">开始升级</button>
        </form>
      </div>
      
      <div class="console-output">
        <h3>控制台输出</h3>
        <div class="log-area">
          <pre>{{ consoleOutput }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'VersionUpgrade',
  data() {
    return {
      upgradeType: 'force',
      workType: 'multi_process',
      neIp: '',
      neIpInput: '',
      neVersionPath: '',
      consoleOutput: ''
    }
  },
  methods: {
    goBack() {
      this.$router.push('/dashboard');
    },
    upgradeVersion() {
      this.consoleOutput = '开始升级过程...\n';
      this.appendLog(`升级类型: ${this.upgradeType}`);
      this.appendLog(`工作模式: ${this.workType}`);
      this.appendLog(`NE_IP: ${this.neIp}`);
      this.appendLog(`NE_IP_Input: ${this.neIpInput}`);
      this.appendLog(`NE_Version_Path: ${this.neVersionPath}`);
      
      // 模拟异步升级过程
      setTimeout(() => {
        this.appendLog('正在检查网络连接...');
      }, 1000);
      
      setTimeout(() => {
        this.appendLog('开始传输文件...');
      }, 2000);
      
      setTimeout(() => {
        this.appendLog('升级完成！');
      }, 3000);
    },
    appendLog(message) {
      this.consoleOutput += message + '\n';
    }
  }
}
</script>

<style scoped>
.version-upgrade {
  padding: 20px;
}

.back-button {
  margin-bottom: 20px;
}

.btn-back {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-size: 16px;
  margin: 4px 2px;
  cursor: pointer;
  border-radius: 5px;
}

.upgrade-content {
  display: flex;
  gap: 20px;
}

.upgrade-form, .console-output {
  flex: 1;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
}

select, input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.btn-upgrade {
  background-color: #4CAF50;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.log-area {
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  height: 300px;
  overflow-y: auto;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>