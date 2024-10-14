<template>
  <div class="version-upgrade">
    <div class="header">
      <button @click="goBack" class="back-button">
        <i class="fas fa-arrow-left"></i> 返回首页
      </button>
      <button @click="openConfig" class="config-button">
        <i class="fas fa-cog"></i> 配置
      </button>
    </div>
    <h2>版本更新</h2>
    <div class="upgrade-container">
      <div class="input-section">
        <div class="input-group">
          <label for="upgradeType">upgrade type:</label>
          <select id="upgradeType" v-model="upgradeType">
            <option v-for="type in upgradeTypes" :key="type" :value="type">{{ type }}</option>
            <option value="custom" v-if="!upgradeTypes.includes(upgradeType)">{{ upgradeType }}</option>
          </select>
        </div>
        <div class="input-group">
          <label for="workType">work type:</label>
          <select id="workType" v-model="workType">
            <option v-for="type in workTypes" :key="type" :value="type">{{ type }}</option>
            <option value="custom" v-if="!workTypes.includes(workType)">{{ workType }}</option>
          </select>
        </div>
        <div class="input-group">
          <label for="neIp">NE IP:</label>
          <div class="ne-ip-selector">
            <select v-model="selectedIpList" class="ip-list-select" @change="onEnvChange">
              <option value="" disabled selected>Select Env</option>
              <option v-if="config.neEnv" :value="config.neEnv">{{ config.neEnv }}</option>
            </select>
            <div class="custom-select">
              <input 
                type="text" 
                :value="selectedIpsDisplay" 
                readonly 
                @click="toggleDropdown"
                placeholder="Select IP addresses (multi-select, hold Ctrl)"
              >
              <div v-if="isDropdownOpen" class="dropdown">
                <div @click="selectAll" class="dropdown-item">
                  <span>All</span>
                  <input type="checkbox" :checked="isAllSelected" @change="selectAll">
                </div>
                <div 
                  v-for="ip in filteredIpList" 
                  :key="ip" 
                  @click.stop="toggleIpSelection(ip, $event)"
                  class="dropdown-item"
                >
                  <span>{{ ip }}</span>
                  <input type="checkbox" :checked="neIp.includes(ip)" @change.stop="toggleIpSelection(ip, $event)">
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="input-group">
          <label for="neIpInput">NE IP Input:</label>
          <input type="text" id="neIpInput" v-model="neIpInput" placeholder="可以手动输入IP地址。NE_IP,  NE_IP_Input 只能选其一多个IP地址， 用以下格式： IP1|IP2|IP3， 没有空格">
        </div>
        <div class="input-group">
          <label for="neVersionPath">NE Version Path:</label>
          <input 
            type="text" 
            id="neVersionPath" 
            v-model="neVersionPath"
            placeholder="升级路径，如果是升级2xxx想用bin方式，可按如下格式：path;bin （间隔是分号）"
          >
        </div>
        <button @click="startUpgrade" class="upgrade-button">开始更新</button>
        
        <!-- 新增 build list -->
        <div class="build-list">
          <h3>Build History</h3>
          <ul>
            <li v-for="(build, index) in buildHistory" :key="index" @click="showBuildLog(build)">
              Build #{{ build.id }} - {{ build.status }} - {{ build.timestamp }}
            </li>
          </ul>
        </div>
      </div>
      <div class="console-output">
        <h3>Console Output</h3>
        <div class="output-area">
          <pre>{{ consoleOutput }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'VersionUpgrade',
  data() {
    return {
      upgradeType: '',
      workType: '',
      selectedIpList: '',
      neIp: [],
      neIpInput: '',
      neVersionPath: '',
      consoleOutput: '',
      ipLists: {},
      isDropdownOpen: false,
      buildHistory: [],
      currentBuildId: 0,
      upgradeTypes: [],
      workTypes: [],
      config: {
        upgradeType: '',
        workType: '',
        neEnv: '',
        neIpList: ''
      },
    }
  },
  computed: {
    filteredIpList() {
      return this.config.neIpList ? this.config.neIpList.split(',').map(ip => ip.trim()) : [];
    },
    selectedIpsDisplay() {
      return this.neIp.length > 0 ? this.neIp.join(' | ') : '';
    },
    isAllSelected() {
      return this.filteredIpList.length > 0 && this.neIp.length === this.filteredIpList.length;
    }
  },
  methods: {
    goBack() {
      this.$router.push('/dashboard');
      console.log('返回首页');
    },
    openConfig() {
      this.$router.push('/version-update-config');
    },
    startUpgrade() {
      this.currentBuildId++;
      const buildInfo = {
        id: this.currentBuildId,
        status: 'In Progress',
        log: '',
        timestamp: new Date().toLocaleString()
      };
      this.buildHistory.unshift(buildInfo);
      if (this.buildHistory.length > 8) {
        this.buildHistory.pop();
      }
      
      // 保存 build history 到 localStorage
      this.saveBuildHistory();
      
      this.consoleOutput = ''; // 清空之前的日志
      this.log('开始更新版本...');
      this.log(`Upgrade Type: ${this.upgradeType}`);
      this.log(`Work Type: ${this.workType}`);
      this.log(`Selected IPs: ${this.neIp.join(', ')}`);
      this.log(`NE IP Input: ${this.neIpInput}`);
      this.log(`NE Version Path: ${this.neVersionPath}`);
      this.log('更新过程模拟中...');
      
      setTimeout(() => {
        this.log('更新完成！');
        buildInfo.status = 'Completed';
        buildInfo.log = this.consoleOutput; // 保存当前build的完整日志
      }, 3000);
    },
    log(message) {
      const timestamp = new Date().toLocaleTimeString();
      const logMessage = `[${timestamp}] ${message}\n`;
      this.consoleOutput += logMessage;
      if (this.buildHistory.length > 0) {
        this.buildHistory[0].log += logMessage;
      }
      this.$nextTick(() => {
        const outputArea = this.$el.querySelector('.output-area');
        outputArea.scrollTop = outputArea.scrollHeight;
      });
    },
    async loadConfig() {
      try {
        const response = await axios.get('/api/config');
        this.config = response.data;
        
        // 处理多行输入
        this.upgradeTypes = this.config.upgradeType ? this.config.upgradeType.split('\n').map(type => type.trim()).filter(Boolean) : [];
        this.workTypes = this.config.workType ? this.config.workType.split('\n').map(type => type.trim()).filter(Boolean) : [];
        
        // 设置默认值
        this.upgradeType = this.upgradeTypes.length > 0 ? this.upgradeTypes[0] : '';
        this.workType = this.workTypes.length > 0 ? this.workTypes[0] : '';
        
        // 设置环境和 IP 列表
        this.selectedIpList = this.config.neEnv;
        this.neIp = this.filteredIpList;
      } catch (error) {
        console.error('加载配置失败:', error);
      }
    },
    toggleDropdown() {
      this.isDropdownOpen = !this.isDropdownOpen;
    },
    toggleIpSelection(ip, event) {
      if (event.ctrlKey) {
        // 如果按住Ctrl键，不关闭下拉框
        const index = this.neIp.indexOf(ip);
        if (index === -1) {
          this.neIp.push(ip);
        } else {
          this.neIp.splice(index, 1);
        }
      } else {
        // 如果没有按住Ctrl键，切换选择并关闭下拉框
        const index = this.neIp.indexOf(ip);
        if (index === -1) {
          this.neIp = [ip];
        } else {
          this.neIp = [];
        }
        this.isDropdownOpen = false; // 关闭下拉框
      }
    },
    selectAll() {
      if (this.isAllSelected) {
        this.neIp = [];
      } else {
        this.neIp = [...this.filteredIpList];
      }
      this.isDropdownOpen = false; // 关闭下拉框
    },
    onEnvChange() {
      this.neIp = this.filteredIpList;
      this.isDropdownOpen = false;
    },
    showBuildLog(build) {
      this.consoleOutput = build.log;
    },
    saveBuildHistory() {
      localStorage.setItem('buildHistory', JSON.stringify(this.buildHistory));
      localStorage.setItem('currentBuildId', this.currentBuildId.toString());
    },
    loadBuildHistory() {
      const savedHistory = localStorage.getItem('buildHistory');
      const savedBuildId = localStorage.getItem('currentBuildId');
      if (savedHistory) {
        this.buildHistory = JSON.parse(savedHistory);
      }
      if (savedBuildId) {
        this.currentBuildId = parseInt(savedBuildId, 10);
      }
    },
  },
  mounted() {
    console.log('版本更新页面已加载');
    this.loadConfig();
    this.loadBuildHistory();

    // 添加事件监听器来检测配置变化
    window.addEventListener('upgradeConfigUpdated', this.loadConfig);
  },
  beforeDestroy() {
    // 移除事件监听器
    window.removeEventListener('upgradeConfigUpdated', this.loadConfig);
  }
}
</script>

<style scoped>
.version-upgrade {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.back-button, .config-button {
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.back-button {
  background-color: #3498db;
  color: white;
}

.config-button {
  background-color: #f39c12;
  color: white;
}

.upgrade-container {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
  align-items: flex-start; /* 确保顶部对齐 */
}

.input-section {
  width: 45%;
  /* 移除最小高度限制 */
}

.input-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
}

input, select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.ne-ip-selector {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.ip-list-select {
  width: 120px;
  color: #999;
  height: 38px;
}

.custom-select {
  position: relative;
  flex-grow: 1;
}

.custom-select input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  height: 38px;
  box-sizing: border-box;
}

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: white;
  border: 1px solid #ddd;
  border-top: none;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  width: 100%;
}

.dropdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  cursor: pointer;
}

.dropdown-item span {
  flex-grow: 1;
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
  padding-right: 10px;
  min-width: 0;
}

.dropdown-item input[type="checkbox"] {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-left: 10px;
}

.dropdown-item:hover {
  background-color: #f0f0f0;
}

.upgrade-button {
  background-color: #4CAF50;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.upgrade-button:hover {
  background-color: #45a049;
}

.console-output {
  width: 50%;
  background-color: #f0f0f0;
  border-radius: 4px;
  padding: 10px;
  /* 移除最小高度限制 */
  margin-top: -50px; /* 向上移动 console output */
}

.output-area {
  height: 600px;
  overflow-y: auto;
  background-color: #000;
  color: #00ff00;
  padding: 10px;
  font-family: monospace;
  border-radius: 4px;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.dropdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  cursor: pointer;
}

.dropdown-item span {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-item:hover {
  background-color: #f0f0f0;
}

.custom-select input::placeholder {
  color: #999;
  font-style: italic;
}

.ip-list-select option[value=""] {
  color: #999;
}

.ip-list-select:invalid {
  color: #999;
}

.ip-list-select option {
  color: #000;
}

/* 新增特定样式 */
#upgradeType, #workType {
  width: 200px; /* 或者您想要的任何宽度 */
}

/* 可以添加以下样式来调整 placeholder 的外观 */
input::placeholder {
  color: #999;
  font-style: italic;
  font-size: 0.9em;
}

.build-list {
  margin-top: 20px;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
}

.build-list h3 {
  margin-top: 0;
}

.build-list ul {
  list-style-type: none;
  padding: 0;
}

.build-list li {
  cursor: pointer;
  padding: 5px 0;
  border-bottom: 1px solid #eee;
}

.build-list li:last-child {
  border-bottom: none;
}

.build-list li:hover {
  background-color: #f0f0f0;
}
</style>