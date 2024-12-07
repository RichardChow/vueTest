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
              <option v-for="env in environments" :key="env.ne_env" :value="env.ne_env">
                {{ env.ne_env }}
              </option>
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
                <div class="dropdown-hint">按住 Ctrl 键可进行多选</div>
                <div 
                  v-for="ip in filteredIpList" 
                  :key="ip" 
                  @click.stop="toggleIpSelection(ip, $event)"
                  class="dropdown-item"
                  :class="{ 
                    'selected': neIp.includes(ip),
                    'disabled': isDisabled(ip)
                  }"
                >
                  <span>{{ ip }}</span>
                  <input 
                    type="checkbox" 
                    :checked="neIp.includes(ip)"
                    :disabled="isDisabled(ip)"
                    @click.stop="toggleIpSelection(ip, $event)"
                    @change.stop
                  >
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
        <div class="input-group button-group">
          <button @click="startUpgrade" class="upgrade-button" :disabled="isUpgrading">
            {{ isUpgrading ? '正在更新...' : '开始更新' }}
          </button>
          <button 
            v-if="isUpgrading" 
            @click="stopUpgrade" 
            class="stop-button"
          >
            停止更新
          </button>
        </div>
        
        <!-- 新增 build list -->
        <div class="build-list">
          <h3>构建历史</h3>
          <ul>
            <li 
              v-for="build in buildHistory" 
              :key="build.id" 
              @click="showBuildLog(build)"
              :class="{ 
                'active': build.id === currentBuildId,
                'status-success': build.status === 'success',
                'status-failed': build.status === 'failed',
                'status-in-progress': build.status === 'in_progress',
                'status-stopped': build.status === 'stopped'
              }"
            >
              <div class="build-info">
                <span class="build-number">构建 #{{ build.id }}</span>
                <span class="build-status">{{ getStatusText(build.status) }}</span>
                <span class="build-time">{{ build.created_at }}</span>
              </div>
              <div class="build-details">
                <div>升级类型: {{ build.upgrade_type }}</div>
                <div>工作类型: {{ build.work_type }}</div>
                <div>NE IP: {{ build.ne_ip }}</div>
              </div>
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
      environments: [],
      isUpgrading: false,
      isPolling: false,
    }
  },
  computed: {
    filteredIpList() {
      if (!this.selectedIpList) return [];
      
      const selectedEnv = this.environments.find(env => env.ne_env === this.selectedIpList);
      if (!selectedEnv) return [];

      // 获取IP列表
      const ipList = selectedEnv.ne_ip_list;
      if (!Array.isArray(ipList)) return [];

      // 返回所有可能的选项（移除了 'All' 选项）
      return [
        ipList.join(','), // 完整IP列表作为一个选项
        ...ipList // 单个IP选项
      ];
    },
    selectedIpsDisplay() {
      if (!this.neIp.length) return '';
      return this.neIp.join(' | ');
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
    async startUpgrade() {
      try {
        this.isUpgrading = true;
        await this.enhancedLog('开始升级流程', 'system');
        
        // 准备升级数据
        const upgradeData = {
          upgrade_type: this.upgradeType,
          work_type: this.workType,
          ne_ip: this.neIp.length ? this.neIp.join(',') : this.neIpInput,
          ne_ip_input: this.neIpInput,
          version_path: this.neVersionPath
        };

        // 打印请求数据
        console.log('发送升级请求数据:', upgradeData);
        
        console.log('开始发送请求到:', '/api/build/');
        console.log('请求URL:', '/api/build/');
        console.log('请求数据:', upgradeData);
        
        const response = await axios({
          method: 'post',
          url: '/api/build/',
          data: upgradeData,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('请求响应:', response);
        
        if (!response.data || !response.data.id) {
          throw new Error('服务器未返回有效的构建ID');
        }

        const buildId = response.data.id;
        await this.enhancedLog(`获取到构建ID: ${buildId}`, 'success');
        this.currentBuildId = buildId;

        // 记录参数
        await this.enhancedLog('升级参数:', 'info');
        await this.enhancedLog(`Upgrade Type: ${upgradeData.upgrade_type}`, 'info');
        await this.enhancedLog(`Work Type: ${upgradeData.work_type}`, 'info');
        await this.enhancedLog(`NE IP: ${upgradeData.ne_ip}`, 'info');
        if (upgradeData.ne_ip_input) {
          await this.enhancedLog(`NE IP Input: ${upgradeData.ne_ip_input}`, 'info');
        }
        await this.enhancedLog(`Version Path: ${upgradeData.version_path}`, 'info');

        // 开始轮询日志
        this.startPollingLogs(buildId);

        // 刷新构建历史
        await this.loadBuildHistory();

      } catch (error) {
        console.error('升级失败:', error);
        if (error.response) {
          console.error('错误响应:', error.response.data);
        }
        await this.enhancedLog(`升级失败: ${error.message}`, 'error');
        alert('升级失败，请查看控制台输出');
        this.isUpgrading = false;  // 出错时重置状态
      }
    },
    async startPollingLogs(buildId) {
      let lastLogId = 0;
      const pollInterval = 2000;
      this.isPolling = true;

      const pollLogs = async () => {
        try {
          if (!this.isPolling) {
            return;
          }

          const response = await axios.get(`/api/build/${buildId}/logs/`, {
            params: { last_log_id: lastLogId }
          });

          const logs = response.data.logs;
          const buildStatus = response.data.status;
          
          if (response.data.last_log_id) {
            lastLogId = response.data.last_log_id;
          }

          if (Array.isArray(logs) && logs.length > 0) {
            for (const log of logs) {
              await this.enhancedLog(log.message, log.type || 'info', buildId);
            }
          }

          // 根据状态决定是否继续轮询
          if (buildStatus === 'in_progress') {
            setTimeout(pollLogs, pollInterval);
          } else if (buildStatus === 'stopped') {
            // 如果是手动停止，保持按钮状态
            setTimeout(pollLogs, pollInterval);
          } else {
            // 其他状态（成功/失败）时才自动停止
            this.isPolling = false;
            this.isUpgrading = false;
            const statusMap = {
              'success': '成功',
              'failed': '失败',
              'cancelled': '已取消'
            };
            await this.enhancedLog(
              `升级任务${statusMap[buildStatus] || buildStatus}`, 
              buildStatus === 'success' ? 'success' : 'warning'
            );
            // 刷新构建历史
            this.loadBuildHistory().catch(error => {
              console.error('刷新构建历史失败:', error);
            });
          }

        } catch (error) {
          console.error('获取日志失败:', error);
          if (this.isPolling) {
            setTimeout(pollLogs, pollInterval);
          }
        }
      };

      await pollLogs();
    },
    async log(message, buildId) {
      const timestamp = new Date().toLocaleTimeString();
      const logMessage = `[${timestamp}] ${message}\n`;
      this.consoleOutput += logMessage;

      if (buildId) {
        try {
          // 将日志发送到后端
          await axios.post(`/api/build/${buildId}/log/`, {
            log_message: logMessage
          });
        } catch (error) {
          console.error('保存日志失败:', error);
        }
      }

      this.$nextTick(() => {
        const outputArea = this.$el.querySelector('.output-area');
        outputArea.scrollTop = outputArea.scrollHeight;
      });
    },
    async loadConfig() {
      try {
        const response = await axios.get('/api/config/');
        console.log('加载配置成功:', response.data);
        
        // 处理 upgrade_type
        if (Array.isArray(response.data.upgrade_type)) {
          this.upgradeTypes = response.data.upgrade_type;
          // 设置默认值为第一个选项
          if (this.upgradeTypes.length > 0) {
            this.upgradeType = this.upgradeTypes[0];
          }
        }
        
        // 处理 work_type
        if (Array.isArray(response.data.work_type)) {
          this.workTypes = response.data.work_type;
          // 设置默认值为第一个选项
          if (this.workTypes.length > 0) {
            this.workType = this.workTypes[0];
          }
        }
        
        // 处理环境配置
        if (Array.isArray(response.data.environments)) {
          this.environments = response.data.environments.map(env => ({
            ne_env: env.ne_env,
            ne_ip_list: Array.isArray(env.ne_ip_list) ? env.ne_ip_list : env.ne_ip_list.split(',').map(ip => ip.trim())
          }));
          // 不设置默认选中的环境和IP
          this.selectedIpList = '';
          this.neIp = [];
        }

        console.log('配置加载完成，当前状态:', {
          upgradeType: this.upgradeType,
          workType: this.workType,
          selectedIpList: this.selectedIpList,
          neIp: this.neIp
        });
      } catch (error) {
        console.error('加载配置失败:', error);
      }
    },
    toggleDropdown() {
      this.isDropdownOpen = !this.isDropdownOpen;
    },
    toggleIpSelection(ip, event) {
      event.stopPropagation();
      
      if (this.isDisabled(ip)) {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        // 多选模式
        const index = this.neIp.indexOf(ip);
        if (index === -1) {
          if (ip === this.getAllIpsString()) {
            this.neIp = [ip];
          } else {
            this.neIp = this.neIp.filter(item => item !== this.getAllIpsString());
            this.neIp.push(ip);
          }
        } else {
          this.neIp.splice(index, 1);
        }
        // 多选模式下保持下拉框打开
        this.isDropdownOpen = true;
      } else {
        // 单选模式
        if (this.neIp.length === 1 && this.neIp[0] === ip) {
          this.neIp = [];
        } else {
          this.neIp = [ip];
        }
        // 单选模式下关闭下拉框
        this.isDropdownOpen = false;
      }
    },
    onEnvChange() {
      if (this.selectedIpList) {
        const selectedEnv = this.environments.find(env => env.ne_env === this.selectedIpList);
        if (selectedEnv) {
          // 清空之前的选择
          this.neIp = [];
          // 不自动选择任何IP，让用户手动选择
        }
      } else {
        this.neIp = [];
      }
      this.isDropdownOpen = true; // 当择环境时，自动打开IP选择下拉框
    },
    // 修改 showBuildLog 法
    async showBuildLog(build) {
      try {
        this.currentBuildId = build.id;
        this.consoleOutput = ''; // 清空当前日志
        await this.enhancedLog(`加载构建 #${build.id} 的日志...`, 'system');
        
        // 获取该构的所有日志
        const response = await axios.get(`/api/build/${build.id}/build_logs/`);
        
        if (response.data.logs && response.data.logs.length > 0) {
          // 按时间顺序显示日志
          for (const log of response.data.logs) {
            await this.enhancedLog(log.message, log.log_type);
          }
        } else {
          await this.enhancedLog('没有找到相关日志', 'warning');
        }
        
        // 如果构建正在进行中开始轮询新日志
        if (build.status === 'in_progress') {
          this.isUpgrading = true;
          this.startPollingLogs(build.id);
        }
        
      } catch (error) {
        console.error('加载构建日志失败:', error);
        await this.enhancedLog(`加载日志失败: ${error.message}`, 'error');
      }
    },
    async loadBuildHistory() {
      try {
        console.log('正在加载构建历史...');
        const response = await axios.get('/api/build/');
        
        if (Array.isArray(response.data)) {
          this.buildHistory = response.data.map(build => ({
            id: build.id,
            upgrade_type: build.upgrade_type,
            work_type: build.work_type,
            ne_ip: build.ne_ip,
            status: build.status,
            created_at: new Date(build.created_at).toLocaleString()
          }));
          console.log('构建历史加载成功:', this.buildHistory);
        } else {
          console.error('构建历史数据格式错误:', response.data);
        }
      } catch (error) {
        console.error('加载构建历史失败:', error);
        if (error.response) {
          console.error('错误响应:', error.response.data);
        }
        this.buildHistory = [];
      }
    },
    // 添新方法处理复选框的点击事件
    handleCheckboxClick(event) {
      // 阻止事件冒泡防止触发父元素的点击事件
      event.stopPropagation();
    },
    // 添加新方法：判断选项是否应该禁用
    isDisabled(ip) {
      const allIpsString = this.getAllIpsString();
      // 如果当前IP是完整列表且已有单个IP被选中，则禁用
      if (ip === allIpsString && this.neIp.some(selected => selected !== allIpsString)) {
        return true;
      }
      // 如果已选中完整列表，则禁用所有单个IP
      if (this.neIp.includes(allIpsString) && ip !== allIpsString) {
        return true;
      }
      return false;
    },
    // 添加新方法：获取完整IP列表字符串
    getAllIpsString() {
      const selectedEnv = this.environments.find(env => env.ne_env === this.selectedIpList);
      return selectedEnv ? selectedEnv.ne_ip_list.join(',') : '';
    },
    // 修改 handleKeyUp 方法
    handleKeyUp(event) {
      // 当 Ctrl 键被释放时
      if (event.key === 'Control') {
        // 如果下拉框是打开的，则关闭它
        if (this.isDropdownOpen) {
          this.isDropdownOpen = false;
        }
      }
    },
    async enhancedLog(message, type = 'info', buildId = null) {
      const timestamp = new Date().toLocaleTimeString();
      let prefix = '';
      
      switch(type) {
        case 'error':
          prefix = '🔴 [错误]';
          console.error(message);
          break;
        case 'success':
          prefix = '✅ [成功]';
          console.log(message);
          break;
        case 'warning':
          prefix = '⚠️ [警告]';
          console.warn(message);
          break;
        case 'system':
          prefix = '🔧 [系统]';
          console.info(message);
          break;
        default:
          prefix = 'ℹ️ [信息]';
          console.log(message);
      }

      const logMessage = `[${timestamp}] ${prefix} ${message}\n`;
      this.consoleOutput += logMessage;

      // 发送日志到后端
      if (buildId) {
        try {
          await axios.post(`/api/build/${buildId}/log/`, {
            log_message: logMessage,
            log_type: type,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('保存日志失败:', error);
        }
      }

      // 自动滚动到底部
      this.$nextTick(() => {
        const outputArea = this.$el.querySelector('.output-area');
        outputArea.scrollTop = outputArea.scrollHeight;
      });
    },
    async stopUpgrade() {
      try {
        await this.enhancedLog('正在停止升级...', 'warning');
        
        // 立即停止轮询和更新状态
        this.isPolling = false;
        this.isUpgrading = false;
        
        try {
          // 发送停止请求到后端
          await axios.post(`/api/build/${this.currentBuildId}/stop/`);
          await this.enhancedLog('升级已停止', 'system');
        } catch (error) {
          if (error.response && error.response.status === 404) {
            await this.enhancedLog('升级任务不存在，可能已被删除', 'warning');
          } else {
            throw error;
          }
        }
        
        // 刷新构建历史
        await this.loadBuildHistory();
        
      } catch (error) {
        await this.enhancedLog(`停止升级失败: ${error.message}`, 'error');
      }
    },
    getStatusText(status) {
      const statusMap = {
        'success': '成功',
        'failed': '失败',
        'in_progress': '进行中',
        'stopped': '已停止',
        'pending': '等待中'
      };
      return statusMap[status] || status;
    }
  },
  mounted() {
    console.log('版本更新页面已加载');
    this.loadConfig(); // 确保在页面加载时获配置
    this.loadBuildHistory(); // 加载构建历史

    // 添加事件监听器来检测配置变化
    window.addEventListener('upgradeConfigUpdated', this.loadConfig);

    // 添加键盘事件监听器
    document.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Control') {
        // 可以在这里添加一些视觉反馈，如果需要的话
      }
    });
  },
  beforeDestroy() {
    // 移除事件监听器
    window.removeEventListener('upgradeConfigUpdated', this.loadConfig);

    // 移除键盘事件监听器
    document.removeEventListener('keyup', this.handleKeyUp);
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

/* 新特定样式 */
#upgradeType, #workType {
  width: 200px; /* 或者您想要的任何度 */
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
  max-height: 400px;
  overflow-y: auto;
}

.build-list li {
  padding: 10px;
  margin: 5px 0;
  cursor: pointer;
  border-radius: 4px;
  border-left: 3px solid transparent;
  transition: all 0.3s ease;
}

.build-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.build-details {
  margin-top: 5px;
  font-size: 0.9em;
  color: #666;
}

.build-list h3 {
  margin-bottom: 10px;
  color: #333;
}

.build-list li {
  padding: 10px;
  margin: 5px 0;
  cursor: pointer;
  border-radius: 4px;
  border-left: 3px solid transparent;
  transition: all 0.3s ease;
}

.build-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.build-number {
  font-weight: bold;
}

.build-status {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.9em;
}

.build-time {
  color: #666;
  font-size: 0.9em;
}

.status-success {
  border-left-color: #4CAF50;
  background-color: #E8F5E9;
}

.status-failed {
  border-left-color: #f44336;
  background-color: #FFEBEE;
}

.status-in-progress {
  border-left-color: #2196F3;
  background-color: #E3F2FD;
}

.status-stopped {
  border-left-color: #FFA000;
  background-color: #FFF3E0;
}

.active {
  box-shadow: 0 0 5px rgba(0,0,0,0.1);
}

.button-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.upgrade-button {
  background-color: #4CAF50;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.upgrade-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.stop-button {
  background-color: #ff4444;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.stop-button:hover {
  background-color: #cc0000;
}
</style>
