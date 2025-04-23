<template>
  <div class="smart-server-room" :class="{'main-view': currentSceneView === 'main'}">
    <!-- 顶部状态栏 -->
    <div class="status-bar">
      <div class="status-item">
        <span class="label">机房温度：</span>
        <span class="value">{{ formatTemperature(roomStatus.temperature) }}</span>
      </div>
      <div class="status-item">
        <span class="label">湿度：</span>
        <span class="value">{{ formatPercentage(roomStatus.humidity) }}</span>
      </div>
      <div class="status-item">
        <span class="label">电力负载：</span>
        <span class="value">{{ formatPercentage(roomStatus.powerLoad) }}</span>
        </div>
      <div class="status-item">
        <span class="label">在线设备：</span>
        <span class="value">{{ roomStatus.onlineDevices }}/{{ roomStatus.totalDevices }}</span>
      </div>
      <div class="status-date">{{ currentTime }}</div>
    </div>

    <!-- 3D视图区域 -->
    <div class="server-room-view" :class="{'full-height': currentSceneView !== 'main'}">
      <server-room-scene 
        :model-path="modelPath" 
        @object-clicked="onObjectClicked"
        @scene-ready="onSceneReady"
        @view-changed="onViewChanged"
        ref="serverRoomSceneRef"
        :current-view="currentSceneView"
        :background-color="'transparent'"
        :enable-transparent-background="true"
      />
      
      <!-- 场景切换过渡效果 -->
      <div class="scene-transition" v-if="isTransitioning" :style="{ opacity: transitionOpacity }"></div>
      
      <!-- 返回按钮 -->
      <div class="back-to-main-button" v-if="currentSceneView !== 'main'" @click="switchToMainView">
        <i class="el-icon-back"></i> 返回全景视图
      </div>
    </div>
    
    <!-- 粒子效果容器 - 新增 -->
    <div class="particle-container">
      <div class="particle" v-for="n in 10" :key="n"></div>
    </div>
      
    <!-- 设备详情面板 -->
    <base-panel 
      class="device-details-panel"
      v-model:visible="deviceDetailPanelVisible"
      :width="350"
      :height="430"
      :initialX="panelX" 
      :initialY="100" 
      :draggable="true"
      @close="closeDeviceDetails"
      ref="basePanelRef"
    >
      <template #header>
        <div class="panel-header">
          <div class="panel-title">设备详情</div>
          <div class="panel-actions">
            <button class="btn-close" @click="closeDeviceDetails">×</button>
        </div>
          </div>
      </template>
      
      <template #default>
        <div class="device-details" v-if="selectedDevice">
          <div class="device-name">{{ selectedDevice.displayName || formatDeviceName(selectedDevice.name) }}</div>
          <div class="device-type">{{ getDeviceTypeLabel(selectedDevice.type) }}</div>
          
          <div class="detail-section">
          <div class="detail-item">
              <div class="detail-label">状态</div>
              <div class="detail-value" :class="`status-${selectedDevice.status}`">
                {{ getStatusLabel(selectedDevice.status) }}
          </div>
            </div>
            
          <div class="detail-item">
              <div class="detail-label">位置</div>
              <div class="detail-value">{{ selectedDevice.location || '未知' }}</div>
          </div>
            
            <div class="detail-item">
              <div class="detail-label">序列号</div>
              <div class="detail-value">{{ selectedDevice.serialNumber || 'N/A' }}</div>
          </div>
            
            <div class="detail-item">
              <div class="detail-label">IP地址</div>
              <div class="detail-value">{{ selectedDevice.ipAddress }}</div>
          </div>
            
            <div class="detail-item">
              <div class="detail-label">温度</div>
              <div class="detail-value" :class="getTemperatureClass(selectedDevice.temperature)">
                {{ formatTemperature(selectedDevice.temperature) }}
          </div>
          </div>
          
          <div class="detail-item">
              <div class="detail-label">CPU负载</div>
              <div class="detail-value" :class="getLoadClass(selectedDevice.cpuLoad)">
                {{ formatPercentage(selectedDevice.cpuLoad) }}
          </div>
            </div>
              
          <div class="detail-item">
              <div class="detail-label">内存使用</div>
              <div class="detail-value" :class="getLoadClass(selectedDevice.memoryUsage)">
                {{ formatPercentage(selectedDevice.memoryUsage) }}
          </div>
            </div>
          
          <div class="detail-item">
              <div class="detail-label">硬盘使用</div>
              <div class="detail-value" :class="getLoadClass(selectedDevice.diskUsage)">
                {{ formatPercentage(selectedDevice.diskUsage) }}
          </div>
            </div>
            
          <div class="detail-item">
              <div class="detail-label">运行时间</div>
              <div class="detail-value">{{ selectedDevice.uptime || 'N/A' }}</div>
          </div>
          
            <div class="detail-item">
              <div class="detail-label">上次维护</div>
              <div class="detail-value">{{ selectedDevice.lastMaintenance || 'N/A' }}</div>
          </div>
          
            <div class="detail-item">
              <div class="detail-label">最后更新</div>
              <div class="detail-value">{{ formatTime(selectedDevice.lastUpdated) }}</div>
          </div>
        </div>
          
          <div class="device-actions">
            <button class="btn btn-primary" @click="restartDevice">重启设备</button>
            <button class="btn btn-secondary" @click="showDeviceLogs">查看日志</button>
        </div>
      </div>
      </template>
    </base-panel>
    

    
    <!-- 底部导航栏 -->
    <div class="bottom-nav" v-if="currentSceneView === 'main'">
      <div class="nav-item" @click="toggleView('overview')" :class="{ active: currentView === 'overview' }">
        概览
      </div>
      <div class="nav-item" @click="toggleView('alerts')" :class="{ active: currentView === 'alerts' }">
        告警
        <div class="alert-badge" v-if="alertCount > 0">{{ alertCount }}</div>
      </div>
      <div class="nav-item" @click="toggleView('stats')" :class="{ active: currentView === 'stats' }">
        统计
      </div>
      <div class="nav-item" @click="toggleView('settings')" :class="{ active: currentView === 'settings' }">
        设置
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onBeforeUnmount, onMounted, computed } from 'vue';
import ServerRoomScene from '@/components/three/ServerRoomScene.vue';
import BasePanel from '@/components/ui/BasePanel.vue';
import { formatTemperature, formatPercentage, formatTime } from '@/utils/formatters';
import { useWindowResize } from '@/composables/ui/useWindowResize';
import { 
  isDevice, 
  isNetworkElement, 
  getDeviceTypeLabel,
  formatDeviceName,
  DEVICE_TYPES 
} from '@/utils/deviceUtils';

// 添加formatObjectName作为formatDeviceName的别名
const formatObjectName = formatDeviceName;

export default {
  name: 'SmartServerRoom',
  components: {
    ServerRoomScene,
    BasePanel
  },
  setup() {
    // 状态数据
    const roomStatus = reactive({
      temperature: 21.5,
      humidity: 45,
      powerLoad: 68,
      onlineDevices: 42,
      totalDevices: 50
    });

    // 当前时间
    const currentTime = ref(new Date().toLocaleString());
    const updateTimeInterval = setInterval(() => {
      currentTime.value = new Date().toLocaleString();
    }, 1000);

    // 3D模型路径
    const modelPath = '/models/interactive/server_room_interactive.gltf';

    // 选中的设备
    const selectedDevice = ref(null);
    const deviceDetailPanelVisible = ref(false);

    // 当前视图模式
    const currentView = ref('overview');
    const alertCount = ref(3);

    // 场景相关状态
    const serverRoomSceneRef = ref(null);
    const basePanelRef = ref(null);
    const currentSceneView = ref('main'); // 'main', 'single-rack', 'single-device'
    const selectedRack = ref(null);
    const selectedNetworkElement = ref(null);
    const isTransitioning = ref(false);
    const transitionOpacity = ref(0);
    const isFrontView = ref(false);

    // 窗口大小变化处理
    const { width: windowWidth, height: windowHeight } = useWindowResize();
    
    // 计算面板位置
    const panelX = computed(() => windowWidth.value - 370);

    // 处理对象点击事件
    const onObjectClicked = (objectData) => {
      console.log('对象被点击:', objectData, '当前视图:', currentSceneView.value);
      
      // 诊断信息：检查是否为网元设备
      const isNE = isNetworkElement(objectData.name);
      const isDeviceType = objectData.type === DEVICE_TYPES.NE;
      const isDeviceObject = isDevice(objectData);
      console.log('点击诊断:', {
        对象名称: objectData.name, 
        对象类型: objectData.type,
        是网元设备: isNE,
        是设备类型: isDeviceType,
        满足设备条件: isDeviceObject
      });
      
      if (currentSceneView.value === 'main') {
        // 主视图中的点击处理
        if (objectData.type === DEVICE_TYPES.RACK) {
          // 切换到单机架视图
          switchToSingleRackView(objectData);
          
          // 如果之前有设备详情面板显示，关闭它
          deviceDetailPanelVisible.value = false;
          return;
        } else if (isDeviceObject) {
          // 切换到单设备视图
          switchToSingleDeviceView(objectData);
          return;
        }
      } else if (currentSceneView.value === 'single-rack') {
        // 单机架视图中的点击处理
        if (isDeviceObject) {
          console.log('单机架视图中点击设备:', objectData.name);
          console.log('hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh')
          handleDeviceClick(objectData);
          return;
        } else {
          // 点击了机架或其他非设备对象，不显示设备详情
          deviceDetailPanelVisible.value = false;
            return;
          }
      } else if (currentSceneView.value === 'single-device') {
        // 单设备视图中的点击处理，可以添加特定逻辑
        console.log('单设备视图中点击:', objectData.name);
      }
      
      // 通用点击处理：只有点击设备类型时才显示设备详情面板
      if (isDeviceObject) {
        const randomUptime = Math.floor(Math.random() * 30) + 1; // 1-30天
        const randomLastMaintenance = new Date();
        randomLastMaintenance.setDate(randomLastMaintenance.getDate() - Math.floor(Math.random() * 90)); // 0-90天前
        
        selectedDevice.value = {
          name: objectData.name,
          displayName: formatDeviceName(objectData.name),
          type: objectData.type || (
            isNE ? DEVICE_TYPES.NE : 
            isDeviceType ? DEVICE_TYPES.NE : 
            objectData.name && objectData.name.includes('server') ? DEVICE_TYPES.SERVER : 
            objectData.name && (objectData.name.includes('switch') || objectData.name.includes('router')) ? DEVICE_TYPES.NETWORK : 
            'device'
          ),
          status: getRandomStatus(),
          ipAddress: generateRandomIP(),
          temperature: 20 + Math.random() * 15,
          cpuLoad: Math.random() * 100,
          memoryUsage: Math.random() * 100,
          diskUsage: Math.random() * 100,
          lastUpdated: Date.now(),
          uptime: `${randomUptime}天`,
          lastMaintenance: randomLastMaintenance.toLocaleDateString(),
          location: objectData.name.includes('Rack') ? formatDeviceName(objectData.name) : '未知位置',
          serialNumber: `SN-${Math.floor(Math.random() * 1000000)}`
        };
        
        // 显示设备详情面板
        deviceDetailPanelVisible.value = true;
        console.log('设置设备详情面板显示', selectedDevice.value);
      } else {
        // 不是设备类型的对象，不显示设备详情面板
        deviceDetailPanelVisible.value = false;
        console.log('设备详情面板隐藏 - 非设备对象');
      }
    };



    // 场景就绪事件处理
    const onSceneReady = (data) => {
      console.log('场景已就绪:', data);
      // 此处可以添加场景就绪后的处理逻辑
    };

    // 关闭设备详情
    const closeDeviceDetails = () => {
      deviceDetailPanelVisible.value = false;
    };

    // 设备操作函数
    const restartDevice = () => {
      if (!selectedDevice.value) return;
      alert(`即将重启设备: ${formatDeviceName(selectedDevice.value.name)}`);
    };

    const showDeviceLogs = () => {
      if (!selectedDevice.value) return;
      alert(`查看设备日志: ${formatDeviceName(selectedDevice.value.name)}`);
    };

    // 切换视图
    const toggleView = (view) => {
      currentView.value = view;
    };
    
    // 切换到单机架视图
    const switchToSingleRackView = (rackData) => {
      if (isTransitioning.value) {
        console.log('正在过渡中，忽略切换请求');
        return;
      }
      
      console.log('切换到单机架视图:', rackData.name);
      
      // 关闭设备详情面板
      deviceDetailPanelVisible.value = false;
      selectedDevice.value = null;
      
      selectedRack.value = rackData;
      isTransitioning.value = true;
      transitionOpacity.value = 0;
      
      // 淡出动画
      const fadeOut = () => {
        if (transitionOpacity.value < 1) {
          transitionOpacity.value += 0.1; // 加快速度
          requestAnimationFrame(fadeOut);
        } else {
          // 创建单机架场景
          if (serverRoomSceneRef.value) {
            console.log('开始调用serverRoomSceneRef.createSingleRackScene，参数:', rackData);
            const result = serverRoomSceneRef.value.createSingleRackScene(rackData);
            
            if (!result) {
              console.error('创建单机架场景失败，检查ServerRoomScene组件的createSingleRackScene方法');
              
              // 尝试直接获取并检查组件内部实例
              if (serverRoomSceneRef.value.$refs && serverRoomSceneRef.value.$refs.baseScene) {
                console.log('尝试访问内部BaseScene组件');
                const innerScene = serverRoomSceneRef.value.$refs.baseScene;
                
                if (innerScene && typeof innerScene.createSingleRackScene === 'function') {
                  console.log('尝试直接调用内部组件的createSingleRackScene方法');
                  const innerResult = innerScene.createSingleRackScene(rackData);
                  console.log('内部调用结果:', innerResult);
                } else {
                  console.error('内部组件不存在或方法不可用');
                }
              }
              
              // 恢复UI状态
              isTransitioning.value = false;
              transitionOpacity.value = 0;
              
              console.error('serverRoomSceneRef为空，无法访问3D场景组件');
              return;
            }
          } else {
            console.error('serverRoomSceneRef为空');
          }
          
          // 更新当前视图
          currentSceneView.value = 'single-rack';
          
          // 开始淡入动画
          fadeIn();
        }
      };
      
      // 淡入动画
      const fadeIn = () => {
        if (transitionOpacity.value > 0) {
          transitionOpacity.value -= 0.1; // 加快速度
          requestAnimationFrame(fadeIn);
        } else {
          isTransitioning.value = false;
          console.log('切换到单机架视图完成');
        }
      };
      
      // 开始动画
      fadeOut();
    };

    // 切换到单设备视图
    const switchToSingleDeviceView = (deviceData) => {
      if (isTransitioning.value) {
        console.log('正在过渡中，忽略切换请求');
        return;
      }
      
      console.log('切换到单设备视图:', deviceData.name);
      
      selectedNetworkElement.value = deviceData;
      isTransitioning.value = true;
      transitionOpacity.value = 0;
      
      // 淡出动画
      const fadeOut = () => {
        if (transitionOpacity.value < 1) {
          transitionOpacity.value += 0.1;
          requestAnimationFrame(fadeOut);
        } else {
          // 创建单设备场景
          if (serverRoomSceneRef.value) {
            const result = serverRoomSceneRef.value.createSingleDeviceScene(deviceData);
            if (!result) {
              console.error('创建单设备场景失败');
            }
          } else {
            console.error('serverRoomSceneRef为空');
          }
          
          // 更新当前视图
          currentSceneView.value = 'single-device';
          
          // 开始淡入动画
          fadeIn();
        }
      };
      
      // 淡入动画
      const fadeIn = () => {
        if (transitionOpacity.value > 0) {
          transitionOpacity.value -= 0.1;
          requestAnimationFrame(fadeIn);
        } else {
          isTransitioning.value = false;
          console.log('切换到单设备视图完成');
          
          // 显示设备详情
          selectedDevice.value = {
            name: deviceData.name,
            type: deviceData.type,
            status: getRandomStatus(),
            ipAddress: generateRandomIP(),
            temperature: 20 + Math.random() * 15,
            cpuLoad: Math.random() * 100,
            memoryUsage: Math.random() * 100,
            diskUsage: Math.random() * 100,
            lastUpdated: Date.now()
          };
          
          deviceDetailPanelVisible.value = true;
        }
      };
      
      // 开始动画
      fadeOut();
    };
    
    // 切换回主视图
    const switchToMainView = () => {
      if (isTransitioning.value) {
        console.log('正在过渡中，忽略切换请求');
        return;
      }
      
      console.log('切换回主视图');
      
      isTransitioning.value = true;
      transitionOpacity.value = 0;
      
      // 淡出动画
      const fadeOut = () => {
        if (transitionOpacity.value < 1) {
          transitionOpacity.value += 0.1;
          requestAnimationFrame(fadeOut);
        } else {
          // 重置视图
          isFrontView.value = false;
          
          // 通知ServerRoomScene组件切换回主视图
          if (serverRoomSceneRef.value) {
            const result = serverRoomSceneRef.value.resetToMainScene();
            if (!result) {
              console.error('重置到主视图失败');
            }
          } else {
            console.error('serverRoomSceneRef为空');
          }
          
          // 更新当前视图
          currentSceneView.value = 'main';
          
          // 清除选中的设备
          selectedRack.value = null;
          selectedNetworkElement.value = null;
          
          // 关闭设备详情面板
          deviceDetailPanelVisible.value = false;
          selectedDevice.value = null;
          
          // 开始淡入动画
          fadeIn();
        }
      };
      
      // 淡入动画
      const fadeIn = () => {
        if (transitionOpacity.value > 0) {
          transitionOpacity.value -= 0.1;
          requestAnimationFrame(fadeIn);
        } else {
          isTransitioning.value = false;
          console.log('切换回主视图完成');
        }
      };
      
      // 开始动画
      fadeOut();
    };

    // 处理单机架视图中设备的点击
    const handleDeviceClick = (deviceData) => {
      console.log('处理设备点击:', deviceData);
      
      // 检查是否为有效的设备对象
      const isValidDevice = isDevice(deviceData);
      console.log('设备点击诊断:', {
        对象名称: deviceData.name, 
        对象类型: deviceData.type,
        是有效设备: isValidDevice
      });
      
      // 先执行机架旋转动画，使设备正对屏幕
      if (serverRoomSceneRef.value && typeof serverRoomSceneRef.value.animateRackRotation === 'function') {
        console.log('执行机架旋转动画');
        serverRoomSceneRef.value.animateRackRotation(Math.PI/2); // 旋转到0度 (正对屏幕)
      } else if (serverRoomSceneRef.value && serverRoomSceneRef.value.switchToFrontView) {
        // 如果直接的旋转方法不可用，尝试使用switchToFrontView
        console.log('尝试通过switchToFrontView执行旋转');
        serverRoomSceneRef.value.switchToFrontView();
      }
      
      // 如果ServerRoomScene组件支持设备弹出动画，则调用
      if (serverRoomSceneRef.value && serverRoomSceneRef.value.animateDevice) {
        // 这里使用输入的原始名称，增强后的findDeviceByName会处理子部件的情况
        console.log('执行设备弹出动画:', deviceData.name);
        const result = serverRoomSceneRef.value.animateDevice(deviceData.name);
        
        // 动画执行成功的情况，无论是否点击相同设备
        if (result) {
          // 检查是否是已经弹出状态的相同设备 - 这时候复位并关闭详情面板
          if (serverRoomSceneRef.value.$refs && 
              serverRoomSceneRef.value.$refs.baseScene && 
              !serverRoomSceneRef.value.deviceInteractionState.selectedDevice) {
              deviceDetailPanelVisible.value = false;
              selectedDevice.value = null;
              console.log('设备已复位，关闭详情面板');
              return;
            }
          
          // 准备设备详情数据
          const randomUptime = Math.floor(Math.random() * 30) + 1; // 1-30天
          const randomLastMaintenance = new Date();
          randomLastMaintenance.setDate(randomLastMaintenance.getDate() - Math.floor(Math.random() * 90)); // 0-90天前
          
          // 获取更多信息
          const deviceName = deviceData.name;
          const isNE = isNetworkElement(deviceName);
          const isServer = deviceName.includes('server');
          const isSwitch = deviceName.includes('switch') || deviceName.includes('router');
          
          // 更新设备详情数据
          selectedDevice.value = {
            name: deviceName,
            displayName: formatDeviceName(deviceName),
            type: deviceData.type || (
              isNE ? DEVICE_TYPES.NE : 
              isServer ? DEVICE_TYPES.SERVER : 
              isSwitch ? DEVICE_TYPES.NETWORK : 
              'device'
            ),
            status: getRandomStatus(),
            ipAddress: generateRandomIP(),
            temperature: 20 + Math.random() * 15,
            cpuLoad: Math.random() * 100,
            memoryUsage: Math.random() * 100,
            diskUsage: Math.random() * 100,
            lastUpdated: Date.now(),
            uptime: `${randomUptime}天`,
            lastMaintenance: randomLastMaintenance.toLocaleDateString(),
            location: selectedRack.value ? formatDeviceName(selectedRack.value.name) : '未知位置',
            serialNumber: `SN-${Math.floor(Math.random() * 1000000)}`
          };
          
          // 显示设备详情面板，强制设置为true
          deviceDetailPanelVisible.value = true;
          console.log('handleDeviceClick: 设置面板显示', deviceDetailPanelVisible.value, selectedDevice.value);
        }
      }
    };

    const getStatusLabel = (status) => {
      const statusMap = {
        'normal': '正常',
        'warning': '警告',
        'error': '错误',
        'offline': '离线'
      };
      return statusMap[status] || '未知状态';
    };

    const getTemperatureClass = (temp) => {
      if (temp < 25) return 'status-normal';
      if (temp < 35) return 'status-warning';
      return 'status-error';
    };

    const getLoadClass = (load) => {
      if (load < 70) return 'status-normal';
      if (load < 90) return 'status-warning';
      return 'status-error';
    };

    // 模拟数据生成函数
    const getRandomStatus = () => {
      const statuses = ['normal', 'warning', 'error', 'offline'];
      const weights = [70, 15, 10, 5]; // 权重，使得'normal'更有可能被选中
      
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      let random = Math.random() * totalWeight;
      
      for (let i = 0; i < statuses.length; i++) {
        if (random < weights[i]) {
          return statuses[i];
        }
        random -= weights[i];
      }
      
      return statuses[0];
    };

    const generateRandomIP = () => {
      return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    };

    // 定期更新机房状态数据（模拟实时数据）
    const updateInterval = setInterval(() => {
      roomStatus.temperature = 20 + Math.random() * 5;
      roomStatus.humidity = 40 + Math.random() * 15;
      roomStatus.powerLoad = 60 + Math.random() * 20;
      roomStatus.onlineDevices = Math.floor(roomStatus.totalDevices * (0.8 + Math.random() * 0.2));
      
      // 随机更新告警数量
      if (Math.random() > 0.9) {
        alertCount.value = Math.floor(Math.random() * 5);
      }
    }, 10000);

    // 处理视图变化事件
    const onViewChanged = (data) => {
      console.log('视图变化:', data);
      
      // 更新当前视图状态
      currentSceneView.value = data.view;
      
      // 根据不同视图类型更新相关数据
      if (data.view === 'single-rack') {
        selectedRack.value = data.data;
      } else if (data.view === 'single-device') {
        selectedNetworkElement.value = data.data;
      } else if (data.view === 'main') {
        // 重置选中状态
        selectedRack.value = null;
        selectedNetworkElement.value = null;
      }
    };

    // 组件挂载和卸载
    onMounted(() => {
      console.log('SmartServerRoom 组件已挂载');
      console.log('窗口宽度:', windowWidth.value);
      console.log('计算的面板X位置:', panelX.value);
    });

    // 组件卸载前清理
    onBeforeUnmount(() => {
      clearInterval(updateTimeInterval);
      clearInterval(updateInterval);
    });

    return {
      roomStatus,
      currentTime,
      modelPath,
      selectedDevice,
      deviceDetailPanelVisible,
      currentView,
      alertCount,
      windowWidth,
      windowHeight,
      onObjectClicked,
      onSceneReady,
      closeDeviceDetails,
      restartDevice,
      showDeviceLogs,
      toggleView,
      getDeviceTypeLabel,
      getStatusLabel,
      getTemperatureClass,
      getLoadClass,
      formatTemperature,
      formatPercentage,
      formatTime,
      formatDeviceName,
      // 场景切换相关
      serverRoomSceneRef,
      currentSceneView,
      isTransitioning,
      transitionOpacity,
      switchToSingleRackView,
      switchToSingleDeviceView,
      switchToMainView,
      handleDeviceClick,
      formatObjectName,
      onViewChanged,
      basePanelRef,
      panelX
    };
  }
};
</script>

<style lang="scss" scoped>
@use '@/styles/variables' as *;
@use '@/styles/mixins' as *;
@use "sass:math";

/* Add Google Fonts import */
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto+Mono&display=swap');

.smart-server-room {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: #e0f2ff; /* Fallback text color */
  overflow: hidden;
  font-family: 'Orbitron', sans-serif; /* Sci-fi font */

  /* Sci-fi Background */
  background-color: #020a1a; /* Very dark blue */
  background-image: 
    /* Subtle radial gradient */
    radial-gradient(circle at center, rgba(10, 25, 50, 0.5) 0%, transparent 70%),
    /* Grid pattern */
    repeating-linear-gradient(#0a2040 0, #0a2040 1px, transparent 1px, transparent 20px),
    repeating-linear-gradient(90deg, #0a2040 0, #0a2040 1px, transparent 1px, transparent 20px);
  background-size: 100% 100%, 20px 20px, 20px 20px;
  background-position: center center, 0 0, 0 0;

  // 当不是主视图时，移除底部的任何背景条
  &:not(.main-view) {
    .bottom-nav {
      display: none !important;
    }
  }
  
  // 当前是主视图时添加类名
  &.main-view {
    // 主视图状态样式
  }
}

/* Sci-fi Frame - using pseudo-elements */
.smart-server-room::before {
  content: '';
  position: absolute;
  top: 15px; /* Adjust spacing */
  left: 15px;
  right: 15px;
  bottom: 15px;
  border: 1px solid rgba(0, 191, 255, 0.6); /* Cyan border */
  box-shadow: 
    0 0 15px rgba(0, 191, 255, 0.5), 
    inset 0 0 10px rgba(0, 128, 200, 0.4);
  pointer-events: none; /* Allow clicks through */
  z-index: 1;
  /* Add subtle animation */
  animation: pulse-glow 4s infinite alternate;
}

/* Frame corner/side details (simplified example) */
.smart-server-room::after {
  content: '';
  position: absolute;
  z-index: 2;
  pointer-events: none;
  /* Example: Top-left corner detail */
  top: 10px;
  left: 10px;
  width: 60px;
  height: 40px;
  border-left: 3px solid #00bfff; /* Deep sky blue */
  border-top: 3px solid #00bfff;
  box-shadow: -2px -2px 10px rgba(0, 191, 255, 0.6);
  /* Add more details similarly using box-shadow or other pseudo-elements */
}

@keyframes pulse-glow {
  from {
    box-shadow: 
      0 0 10px rgba(0, 191, 255, 0.4), 
      inset 0 0 8px rgba(0, 128, 200, 0.3);
  }
  to {
    box-shadow: 
      0 0 20px rgba(0, 191, 255, 0.7), 
      inset 0 0 12px rgba(0, 128, 200, 0.5);
  }
}

.status-bar {
  @include flex(row, space-between, center);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50px;
  padding: 0 30px; /* Increased padding compared to original */
  /* Use a gradient background that fits the theme */
  background: linear-gradient(90deg, rgba(5, 15, 30, 0.7) 0%, rgba(10, 25, 50, 0.8) 100%);
  // background-color: rgba(0, 10, 30, 0.8); /* Original fallback */
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(0, 191, 255, 0.3);
  box-shadow: 0 2px 10px rgba(0, 191, 255, 0.1);
  z-index: 10;
}

.status-item {
  @include flex(row, flex-start, center);
  margin-right: $spacing-lg; /* Adjusted spacing */
  color: #00bfff; /* Deep sky blue for text */
  text-shadow: 0 0 3px rgba(0, 191, 255, 0.7);
  
  .label {
    font-size: $font-size-small;
    opacity: 0.8;
    margin-right: $spacing-xs;
    color: #aaddff; /* Lighter blue for labels */
  }
  
  .value {
    font-size: $font-size-medium;
    font-weight: 600;
  }
}

.status-date {
  font-size: $font-size-small;
  opacity: 0.8;
  color: #00bfff;
  text-shadow: 0 0 3px rgba(0, 191, 255, 0.7);
  font-family: 'Roboto Mono', monospace;
}

.server-room-view {
  position: absolute;
  top: 50px; /* Below status bar */
  left: 0;
  right: 0;
  bottom: 60px; /* Above bottom nav */
  /* Remove default background to let the main background show */
  background: none;
  
  // When not main view, take full height minus top bar
  .smart-server-room:not(.main-view) & {
    bottom: 0 !important;
  }
}

/* Scene Transition */
.scene-transition {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #020a1a; /* Match main background */
  opacity: 0;
  pointer-events: none;
  z-index: 150;
  transition: opacity 0.1s ease-in-out; /* Faster transition */
}

/* Back Button */
.back-to-main-button {
  position: absolute;
  top: 20px; /* Keep position relative to view container */
  left: 30px; /* Match status bar padding */
  padding: 8px 15px;
  /* Sci-fi button styling */
  background: rgba(0, 128, 200, 0.5);
  border: 1px solid rgba(0, 191, 255, 0.7);
  border-radius: $border-radius-md;
  color: #ffffff;
  cursor: pointer;
  font-size: 14px;
  font-family: 'Orbitron', sans-serif;
  z-index: 120;
  transition: all 0.3s ease;
  box-shadow: 0 0 8px rgba(0, 191, 255, 0.4);
  text-shadow: 0 0 3px rgba(0, 191, 255, 0.7);
  
  &:hover {
    background: rgba(0, 150, 230, 0.7);
    box-shadow: 0 0 15px rgba(0, 191, 255, 0.7);
    color: #fff;
  }
  
  i {
    margin-right: 8px;
  }
}

.bottom-nav {
  @include flex(row, space-around, center);
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  // background-color: rgba(0, 10, 30, 0.8); /* Original */
  background: linear-gradient(90deg, rgba(5, 15, 30, 0.8) 0%, rgba(10, 25, 50, 0.9) 100%);
  backdrop-filter: blur(8px);
  border-top: 1px solid rgba(0, 191, 255, 0.3);
  box-shadow: 0 -2px 10px rgba(0, 191, 255, 0.1);
  z-index: 10;
}

.nav-item {
  @include flex(row, center, center);
  position: relative;
  padding: $spacing-md;
  cursor: pointer;
  flex: 1;
  text-align: center;
  transition: all 0.3s ease;
  font-family: 'Orbitron', sans-serif;
  color: #aaddff; /* Default nav item color */
  border-top: 3px solid transparent; /* Prepare for active state */
  
  &::after { /* Subtle bottom glow on hover */
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: #00bfff;
    opacity: 0;
    transition: opacity 0.3s ease;
    box-shadow: 0 0 8px #00bfff;
  }

  &:hover {
    color: #ffffff;
    text-shadow: 0 0 5px #ffffff;
    background: none; /* Remove original hover background */
  }

  &:hover::after {
    opacity: 0.7;
  }
  
  &.active {
    color: #ffffff;
    border-top-color: #00bfff; /* Active indicator */
    background: rgba(0, 128, 200, 0.2);
    text-shadow: 0 0 5px #ffffff;
    font-weight: normal; /* Remove original bold */
  }
  
  &.active::after {
    opacity: 1;
  }
  
  .alert-badge {
    position: absolute;
    top: 10px;
    right: calc(50% - 25px); /* Adjusted position */
    @include flex(row, center, center);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: $error-color; /* Use variable */
    color: white;
    font-size: 11px; /* Slightly smaller */
    font-weight: 600;
    line-height: 20px; /* Center text vertically */
    box-shadow: 0 0 5px $error-color;
  }
}

.device-details-panel {
  // Inherits BasePanel styles, override or extend here
  // Update background and border to match theme
  --panel-bg-color: rgba(5, 15, 30, 0.85); /* Use CSS var if BasePanel supports */
  --panel-border-color: rgba(0, 191, 255, 0.5);
  background-color: var(--panel-bg-color, rgba(5, 15, 30, 0.85));
  border: 1px solid var(--panel-border-color, rgba(0, 191, 255, 0.5));
  border-radius: $border-radius-md; /* Use variable */
  box-shadow: 0 0 20px rgba(0, 128, 200, 0.5);
  backdrop-filter: blur(8px);
  color: #e0f2ff; /* Ensure text color matches */
}

.panel-header {
  @include flex(row, space-between, center);
  width: 100%;
  padding: $spacing-sm $spacing-md;
  /* Use a gradient and border */
  background: linear-gradient(90deg, rgba(10, 30, 60, 0.8) 0%, rgba(20, 50, 90, 0.8) 100%);
  color: #ffffff;
  font-weight: 600; /* Reapply bold if needed */
  font-family: 'Orbitron', sans-serif;
  // cursor: move; /* Provided by BasePanel probably */
  // user-select: none;
  border-bottom: 1px solid rgba(0, 191, 255, 0.4);
  text-shadow: 0 0 3px rgba(0, 191, 255, 0.7);
  
  .panel-title {
    font-weight: 600; /* Inherited */
    font-size: $font-size-medium;
  }
  
  .btn-close {
    @include flex(row, center, center);
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background-color: rgba(0, 191, 255, 0.2);
    color: #00bfff;
    cursor: pointer;
    transition: all 0.2s ease;
    line-height: 24px; /* Center the 'x' */
    font-size: 16px;
    font-weight: bold;
    
    &:hover {
      background-color: rgba(0, 191, 255, 0.4);
      color: #ffffff;
    }
  }
}

.device-details {
  padding: $spacing-md;
  font-family: 'Roboto Mono', monospace;
  
  .device-name {
    font-size: $font-size-large;
    font-weight: 600;
    margin-bottom: $spacing-xs;
    color: #ffffff;
    text-shadow: 0 0 5px #00bfff;
    font-family: 'Orbitron', sans-serif;
  }
  
  .device-type {
    font-size: $font-size-small;
    opacity: 0.7;
    margin-bottom: $spacing-md;
    color: #aaddff;
  }
  
  .detail-section {
    margin-bottom: $spacing-md;
    max-height: 260px;
    overflow-y: auto;
    padding-right: $spacing-sm;
    
    // Custom scrollbar styles
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-track {
      background: rgba(0, 191, 255, 0.1);
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: rgba(0, 191, 255, 0.4);
      border-radius: 3px;
      &:hover { background: rgba(0, 191, 255, 0.6); }
    }
  }

  .detail-item {
    @include flex(row, space-between, center);
    margin-bottom: $spacing-sm;

    .detail-label {
      font-size: $font-size-small;
      color: #88aaff; /* Lighter blue label */
      opacity: 0.8;
      flex-basis: 40%;
    }

    .detail-value {
      font-family: $font-family-code; /* Use variable */
      font-size: $font-size-small;
      font-weight: normal; /* Remove previous bold */
      color: #e0f2ff;
      flex-basis: 60%;
      text-align: right;

      // Status colors with subtle glow
      &.status-normal { color: #00ff88; text-shadow: 0 0 3px rgba(0, 255, 136, 0.7); }
      &.status-warning { color: #ffdd00; text-shadow: 0 0 3px rgba(255, 221, 0, 0.7); }
      &.status-error { color: #ff4466; text-shadow: 0 0 3px rgba(255, 68, 102, 0.7); }
      &.status-offline { color: #88aaff; opacity: 0.7; }
    }
  }
  
  .device-actions {
    @include flex(row, space-around, center); /* Space out buttons */
    margin-top: $spacing-lg; /* More space */
    padding-top: $spacing-md;
    border-top: 1px solid rgba(0, 191, 255, 0.2);
    
    .btn {
      padding: $spacing-sm $spacing-lg; /* Larger buttons */
      border-radius: $border-radius-sm;
      border: 1px solid rgba(0, 191, 255, 0.5);
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s ease;
      font-family: 'Orbitron', sans-serif;
      box-shadow: 0 0 5px rgba(0, 191, 255, 0.2);
      
      &.btn-primary {
        background-color: rgba(0, 128, 200, 0.6);
        color: #ffffff;
        border-color: rgba(0, 191, 255, 0.7);
        
        &:hover {
          background-color: rgba(0, 150, 230, 0.8);
          border-color: rgba(0, 191, 255, 1);
          box-shadow: 0 0 10px rgba(0, 191, 255, 0.5);
        }
      }
      
      &.btn-secondary {
        background-color: rgba(0, 191, 255, 0.1);
        color: #aaddff;
        border-color: rgba(0, 191, 255, 0.4);
        
        &:hover {
          background-color: rgba(0, 191, 255, 0.2);
          color: #ffffff;
          border-color: rgba(0, 191, 255, 0.7);
          box-shadow: 0 0 8px rgba(0, 191, 255, 0.4);
        }
      }
    }
  }
}

.device-tooltip {
  position: absolute;
  padding: $spacing-sm $spacing-md;
  background-color: rgba(5, 15, 30, 0.9); /* Darker background */
  backdrop-filter: blur(8px);
  border-radius: $border-radius-md;
  border: 1px solid rgba(0, 191, 255, 0.6);
  box-shadow: 0 0 15px rgba(0, 128, 200, 0.6);
  pointer-events: none;
  z-index: 100;
  min-width: 200px;
  font-family: 'Roboto Mono', monospace;
  color: #cceeff;

  .tooltip-title {
    font-weight: 600;
    font-size: $font-size-small;
    margin-bottom: $spacing-xs;
    color: #ffffff;
    text-shadow: 0 0 3px rgba(0, 191, 255, 0.7);
  }

  .tooltip-status {
    font-size: 10px; /* Smaller status text */
    font-weight: bold;
    text-transform: uppercase;
    margin-bottom: $spacing-sm; /* More space below status */
    padding: 2px 6px;
    border-radius: $border-radius-sm;
    width: fit-content;
    // Status colors with border
    &.status-normal { background-color: rgba(0, 255, 128, 0.2); color: #00ff88; border: 1px solid rgba(0, 255, 128, 0.5); }
    &.status-warning { background-color: rgba(255, 221, 0, 0.2); color: #ffdd00; border: 1px solid rgba(255, 221, 0, 0.5); }
    &.status-error { background-color: rgba(255, 68, 102, 0.2); color: #ff4466; border: 1px solid rgba(255, 68, 102, 0.5); }
    &.status-offline { background-color: rgba(136, 170, 255, 0.2); color: #88aaff; border: 1px solid rgba(136, 170, 255, 0.5); }
  }
  
  .tooltip-detail {
    @include flex(row, space-between, center);
    font-size: 11px; /* Smaller detail text */
    margin-bottom: 4px;
    
    .tooltip-label {
      opacity: 0.7;
      margin-right: $spacing-sm;
    }
    // Status colors for values in tooltip
    .status-normal { color: #00ff88; }
    .status-warning { color: #ffdd00; }
    .status-error { color: #ff4466; }
    .status-offline { color: #88aaff; }
  }
}

/* Particle Effect Styles (optional, requires HTML structure) */
.particle-container {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 150px; /* Area for particles */
  pointer-events: none;
  overflow: hidden; 
  z-index: 0;
}

.particle {
  position: absolute;
  bottom: -10px; /* Start below screen */
  left: 50%; 
  width: 3px;
  height: 3px;
  background: rgba(0, 191, 255, 0.7);
  border-radius: 50%;
  box-shadow: 0 0 5px rgba(0, 191, 255, 0.8), 0 0 8px rgba(0, 191, 255, 0.5);
  animation: float 10s infinite linear;
  opacity: 0;
}

/* Generate multiple particles with different delays/positions/sizes */
@for $i from 1 through 100 {
  .particle:nth-child(#{$i}) {
    top: 0;
    left: math.percentage(math.random());
    width: #{math.random(3) + 1}px;
    height: #{math.random(3) + 1}px;
    animation-duration: #{math.random(10) + 8}s; /* 8s to 18s */
    animation-delay: #{math.div(math.random(10), 10)}s; /* Random delay 0-1s */
    opacity: calc(math.random(5) / 10 + 0.3); /* Random initial opacity 0.3-0.8 */
    transform: translateY(calc(-100% - 20px));
    box-shadow: 0 0 #{math.random(5) + 2}px #{math.random(3) + 1}px rgba(0, 195, 255, 0.8);
  }
}

@keyframes float {
  0% {
    transform: translateY(0) translateX(0);
    opacity: 0;
  }
  10%, 90% {
    /* Keep opacity set by nth-child */
    opacity: inherit; 
  }
  100% {
    transform: translateY(-150px) translateX(#{math.random(20) - 10}px); /* Move up and slightly sideways */
    opacity: 0;
  }
}

// Animations
@keyframes pulse-glow {
  from {
    box-shadow: 
      0 0 10px rgba(0, 191, 255, 0.4), 
      inset 0 0 8px rgba(0, 128, 200, 0.3);
  }
  to {
    box-shadow: 
      0 0 20px rgba(0, 191, 255, 0.7), 
      inset 0 0 12px rgba(0, 128, 200, 0.5);
  }
}

/* Keyframes needed for device panel animation (if not global) */
@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
</style> 