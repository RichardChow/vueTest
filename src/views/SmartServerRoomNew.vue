<template>
  <div class="smart-server-room">
    <!-- 顶部状态栏 -->
    <TopStatusBar 
      :server-temperature="serverTemperature"
      :system-status="systemStatus"
    />

    <!-- 3D视图区域 -->
    <SceneContainer
      :current-view="currentView"
      :is-transitioning="isTransitioning"
      :transition-opacity="transitionOpacity"
      @switch-to-main="switchToMainView"
      @container-ready="initThreeJS"
      @container-resize="onContainerResize"
    >
      <!-- 设备详情面板 -->
      <DeviceDetailPanel
        v-if="selectedDevice"
        :visible="!!selectedDevice"
        :device-data="selectedDevice"
        :initial-x="detailPanelPosition.x"
        :initial-y="detailPanelPosition.y"
        @close="closeDeviceDetail"
        @refresh="refreshDeviceData"
        @position-change="updatePanelPosition"
      />
      
      <!-- 设备悬浮信息 -->
      <DeviceTooltip
        :visible="tooltipInfo.visible"
        :x="tooltipInfo.x"
        :y="tooltipInfo.y"
        :title="tooltipInfo.title"
        :status="tooltipInfo.status"
        :info="tooltipInfo.info"
      />
    </SceneContainer>
    
    <!-- 底部导航栏 -->
    <BottomNavBar
      v-if="currentView === 'main'"
      :active-item="currentNavItem"
      @nav-change="handleNavChange"
    />
  </div>
</template>

<script>
import { defineComponent, ref, reactive, onMounted, onBeforeUnmount, shallowRef, markRaw } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// 组件导入
import TopStatusBar from '../components/layout/TopStatusBar.vue';
import BottomNavBar from '../components/layout/BottomNavBar.vue';
import SceneContainer from '../components/scene/SceneContainer.vue';
import DeviceDetailPanel from '../components/device/DeviceDetailPanel.vue';
import DeviceTooltip from '../components/device/DeviceTooltip.vue';

export default defineComponent({
  components: {
    TopStatusBar,
    BottomNavBar,
    SceneContainer,
    DeviceDetailPanel,
    DeviceTooltip
  },
  
  setup() {
    // 使用shallowRef和markRaw来避免Vue对Three.js对象的响应式代理
    const scene = shallowRef(null);
    const camera = shallowRef(null);
    const renderer = shallowRef(null);
    const controls = shallowRef(null);
    const model = shallowRef(null);
    const raycaster = shallowRef(markRaw(new THREE.Raycaster()));
    const mouse = shallowRef(markRaw(new THREE.Vector2()));
    
    // 当前视图
    const currentView = ref('main');
    
    // 设备数据
    const devices = ref([
      {
        id: 1,
        name: 'SERVER_RACK_A1',
        type: 'rack',
        status: 'normal',
        temperature: 24.5,
        loadPercent: 68,
        position: { x: 2, y: 1, z: 2 },
        devices: [
          { id: 101, name: 'SERVER_A1S1', type: 'server', status: 'warning', temperature: 36.8, loadPercent: 92 },
          { id: 102, name: 'SERVER_A1S2', type: 'server', status: 'error', temperature: 42.1, loadPercent: 98 },
          { id: 103, name: 'SERVER_A1S3', type: 'server', status: 'normal', temperature: 32.5, loadPercent: 76 }
        ]
      },
      {
        id: 2,
        name: 'SERVER_RACK_B2',
        type: 'rack',
        status: 'normal',
        temperature: 23.8,
        loadPercent: 45,
        position: { x: -2, y: 1, z: 2 },
        devices: [
          { id: 201, name: 'SERVER_B2S1', type: 'server', status: 'normal', temperature: 29.2, loadPercent: 65 },
          { id: 202, name: 'SERVER_B2S2', type: 'server', status: 'normal', temperature: 30.5, loadPercent: 72 }
        ]
      },
      {
        id: 3,
        name: 'AC_UNIT_C1',
        type: 'ac',
        status: 'normal',
        temperature: 18.2,
        loadPercent: 58,
        position: { x: 0, y: 1, z: -3 }
      }
    ]);
    
    // 当前选中设备
    const selectedDevice = ref(null);
    
    // 视图状态
    const isTransitioning = ref(false);
    const transitionOpacity = ref(0);
    
    // 导航栏状态
    const currentNavItem = ref('realtime');
    
    // UI数据
    const serverTemperature = ref(26.5);
    const systemStatus = ref('online');
    
    // 设备详情面板
    const detailPanelPosition = reactive({
      x: 20,
      y: 20
    });
    
    // 设备悬浮信息
    const tooltipInfo = reactive({
      visible: false,
      x: 0,
      y: 0,
      title: '',
      status: '',
      info: ''
    });

    // 动画循环
    let animationFrameId = null;
    
    const startAnimation = () => {
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        controls.value?.update();
        renderer.value?.render(scene.value, camera.value);
      };
      animate();
    };
    
    // 清理动画和事件监听
    onBeforeUnmount(() => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      // 清理定时器
      if (temperatureIntervalId !== null) {
          clearInterval(temperatureIntervalId);
      }
      // 清理事件监听器
      if (renderer.value && renderer.value.domElement) {
        const canvas = renderer.value.domElement;
        canvas.removeEventListener('click', onModelClick);
        canvas.removeEventListener('mousemove', onModelHover);
      }
      // 清理 Three.js 资源
      controls.value?.dispose();
      renderer.value?.dispose();
      // 你可能还需要更彻底地清理场景中的对象和材质，可以添加一个 disposeScene 函数
    });
    
    // 初始化Three.js
    const initThreeJS = (containerInfo) => {
      try {
        // 创建场景
        scene.value = markRaw(new THREE.Scene());
        scene.value.background = new THREE.Color(0x0a1222);
        
        // 容器信息
        const { container, width, height } = containerInfo;
        
        // 创建相机
        camera.value = markRaw(new THREE.PerspectiveCamera(70, width / height, 0.1, 1000));
        camera.value.position.set(10, 10, 10);
        
        // 创建渲染器
        renderer.value = markRaw(new THREE.WebGLRenderer({ 
          antialias: true, 
          alpha: true,
          powerPreference: 'high-performance'
        }));
        renderer.value.setSize(width, height);
        renderer.value.setPixelRatio(window.devicePixelRatio);
        renderer.value.shadowMap.enabled = false;
        renderer.value.toneMappingExposure = 1.5;
        container.appendChild(renderer.value.domElement);
        
        // 添加灯光
        const ambientLight = markRaw(new THREE.AmbientLight(0xffffff, 1.0));
        scene.value.add(ambientLight);
        
        const mainLight = markRaw(new THREE.DirectionalLight(0xffffff, 0.8));
        mainLight.position.set(0, 15, 0);
        mainLight.castShadow = false;
        scene.value.add(mainLight);
        
        // 添加轨道控制
        controls.value = markRaw(new OrbitControls(camera.value, renderer.value.domElement));
        controls.value.enableDamping = true;
        controls.value.dampingFactor = 0.05;
        
        // 加载3D模型
        const loader = new GLTFLoader();
        loader.load('/models/interactive/server_room_interactive.gltf', (gltf) => {
          const rawGltf = markRaw(gltf);
          model.value = markRaw(rawGltf.scene);
          
          // 处理模型以适应Vue并添加交互数据
          processModelForVue(model.value); 
          traverseModel(model.value);
          
          scene.value.add(model.value);
          resetCamera();
          startAnimation();
          setupInteraction();
        });
      } catch (error) {
        console.error('初始化Three.js时发生错误:', error);
      }
    };
    
    // 深度处理模型对象，确保所有子对象都被标记为非响应式
    const processModelForVue = (obj) => {
      if (!obj) return;
      
      // 标记整个对象树
      markRaw(obj);
      
      // 处理材质
      if (obj.material) {
        markRaw(obj.material);
        // 处理材质的所有属性
        for (const key in obj.material) {
          if (obj.material[key] && typeof obj.material[key] === 'object') {
            markRaw(obj.material[key]);
          }
        }
      }
      
      // 处理几何体
      if (obj.geometry) {
        markRaw(obj.geometry);
      }
      
      // 遍历所有子对象
      if (obj.children && obj.children.length > 0) {
        for (let i = 0; i < obj.children.length; i++) {
          const child = obj.children[i];
          markRaw(child);
          processModelForVue(child);
        }
      }
    };
    
    // 安全地遍历模型，并添加交互数据
    const traverseModel = (modelObj) => {
      if (!modelObj) return;
      
      // 为避免遍历过程中产生代理，使用内部函数
      const processObject = (child) => {
        if (!child) return;
        
        // 确保对象不是响应式的
        markRaw(child);
        
        if (child.isMesh) {
          // 标记整个Mesh
          markRaw(child);
          
          // 阴影设置
          child.castShadow = false;
          child.receiveShadow = false;
          
          // 材质处理
          if (child.material) {
            // 标记材质对象
            markRaw(child.material);
            
            // 处理材质属性
            child.material.emissive = markRaw(new THREE.Color(0x000000));
            child.material.emissiveIntensity = 0;
            
            if (child.material.color) {
              markRaw(child.material.color);
              const r = Math.min(1, child.material.color.r * 1.3);
              const g = Math.min(1, child.material.color.g * 1.3);
              const b = Math.min(1, child.material.color.b * 1.3);
              child.material.color.setRGB(r, g, b);
            }
            
            // 存储原始材质属性
            child.userData = markRaw(child.userData || {});
            child.userData.originalMaterial = markRaw({
              color: child.material.color ? markRaw(child.material.color.clone()) : null,
              opacity: child.material.opacity,
              transparent: child.material.transparent
            });
          }
          
          // 标记交互对象
          if (child.name && child.name.startsWith('NE_')) {
            child.userData = markRaw(child.userData || {});
            child.userData.isInteractive = true;
            child.userData.type = 'server';
            
            // 添加设备数据（非响应式对象）
            const deviceData = {
              id: child.name,
              meshId: child.id,
              type: '服务器',
              status: getRandomStatus(),
              temperature: (20 + Math.random() * 15).toFixed(1),
              cpu: Math.floor(Math.random() * 100),
              memory: Math.floor(Math.random() * 100),
              ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
              manufacturer: getRandomManufacturer(),
              model: `Model-${Math.floor(Math.random() * 1000)}`
            };
            
            // 将设备数据添加到列表
            devices.value.push(deviceData);
          } else if (child.name && child.name.toLowerCase().includes('rack')) {
            child.userData = markRaw(child.userData || {});
            child.userData.isInteractive = true;
            child.userData.type = 'rack';
            child.userData.isRack = true;
          }
        }
      };
      
      // 以非响应式方式处理模型内部的每个对象
      const traverseFunction = (obj) => {
        processObject(obj);
        const children = obj.children ? [...obj.children] : [];
        for (let i = 0; i < children.length; i++) {
          traverseFunction(children[i]);
        }
      };
      
      traverseFunction(modelObj);
    };
    
    // 设置交互事件
    const setupInteraction = () => {
      // 点击和悬停事件由SceneContainer组件绑定
      if (renderer.value) {
        const canvas = renderer.value.domElement;
        canvas.addEventListener('click', onModelClick);
        canvas.addEventListener('mousemove', onModelHover);
      }
    };
    
    // 模型点击处理
    const onModelClick = (event) => {
      try {
        // 使用本地变量而非响应式引用
        const _renderer = renderer.value;
        const _camera = camera.value;
        const _raycaster = raycaster.value;
        const _mouse = mouse.value;
        const _scene = scene.value;
        
        // 确保所有必要的对象都存在
        if (!_renderer || !_camera || !_raycaster || !_mouse) return;
        
        // 计算鼠标位置
        const rect = _renderer.domElement.getBoundingClientRect();
        _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        _mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // 射线检测
        _raycaster.setFromCamera(_mouse, _camera);
        
        // 执行射线检测并处理结果
        const intersects = _raycaster.intersectObjects(_scene.children, true);
        
        if (intersects.length > 0) {
          handleObjectClick(intersects[0].object);
        }
      } catch (error) {
        console.error('处理模型点击时发生错误:', error);
      }
    };
    
    // 对象点击处理
    const handleObjectClick = (obj) => {
      try {
        // 防止响应式访问
        let deviceObj = obj;
        
        // 向上查找可交互对象
        while (deviceObj && !(deviceObj.userData && deviceObj.userData.isInteractive)) {
          deviceObj = deviceObj.parent;
        }
        
        if (deviceObj && deviceObj.userData && deviceObj.userData.isInteractive) {
          if (deviceObj.userData.type === 'server' || deviceObj.userData.type === 'device') {
            // 找到匹配的设备数据
            const deviceId = deviceObj.name;
            const meshId = deviceObj.id;
            
            // 查找设备数据
            const deviceData = devices.value.find(d => d.meshId === meshId || d.id === deviceId);
            
            if (deviceData) {
              // 选中设备 - 使用非响应式副本解除引用
              selectedDevice.value = { ...deviceData };
            }
          } else if (deviceObj.userData.isRack) {
            // 这里处理机架视图切换（根据需要实现）
            console.log('点击了机架:', deviceObj.name);
          }
        }
      } catch (error) {
        console.error('处理对象点击时发生错误:', error);
      }
    };
    
    // 模型悬停处理
    const onModelHover = (event) => {
      try {
        // 使用本地变量而非响应式引用
        const _renderer = renderer.value;
        const _camera = camera.value;
        const _raycaster = raycaster.value;
        const _mouse = mouse.value;
        const _scene = scene.value;
        
        if (!_renderer || !_camera || !_raycaster || !_mouse) {
          hideTooltip();
          return;
        }
        
        // 计算鼠标位置
        const rect = _renderer.domElement.getBoundingClientRect();
        _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        _mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // 射线检测
        _raycaster.setFromCamera(_mouse, _camera);
        
        // 执行射线检测
        const intersects = _raycaster.intersectObjects(_scene.children, true);
        
        if (intersects.length > 0) {
          let hoverObj = intersects[0].object;
          
          // 向上查找可交互对象
          while (hoverObj && !(hoverObj.userData && hoverObj.userData.isInteractive)) {
            hoverObj = hoverObj.parent;
          }
          
          if (hoverObj && hoverObj.userData && hoverObj.userData.isInteractive) {
            handleObjectHover(hoverObj, event);
          } else {
            hideTooltip();
          }
        } else {
          hideTooltip();
        }
      } catch (error) {
        console.error('处理模型悬停时发生错误:', error);
        hideTooltip();
      }
    };
    
    // 对象悬停处理
    const handleObjectHover = (obj, event) => {
      try {
        // 使用本地变量获取名称和ID
        const objName = obj.name;
        const objId = obj.id;
        const objType = obj.userData.type;
        const isRack = obj.userData.isRack;
        
        // 显示悬浮提示
        if (objType === 'server' || objType === 'device') {
          // 查找匹配设备
          const device = devices.value.find(d => d.meshId === objId || d.id === objName);
          
          if (device) {
            // 更新提示信息
            tooltipInfo.visible = true;
            tooltipInfo.x = event.clientX;
            tooltipInfo.y = event.clientY;
            tooltipInfo.title = formatDeviceName(device.id);
            tooltipInfo.status = device.status;
            tooltipInfo.info = `温度: ${device.temperature}°C | CPU: ${device.cpu}%`;
          }
        } else if (isRack) {
          // 机架悬停提示
          tooltipInfo.visible = true;
          tooltipInfo.x = event.clientX;
          tooltipInfo.y = event.clientY;
          tooltipInfo.title = formatDeviceName(objName);
          tooltipInfo.status = 'normal';
          tooltipInfo.info = '点击查看详情';
        }
      } catch (error) {
        console.error('处理对象悬停时发生错误:', error);
        hideTooltip();
      }
    };
    
    // 隐藏提示
    const hideTooltip = () => {
      tooltipInfo.visible = false;
    };
    
    // 容器尺寸变化处理
    const onContainerResize = (size) => {
      if (camera.value && renderer.value) {
        camera.value.aspect = size.width / size.height;
        camera.value.updateProjectionMatrix();
        renderer.value.setSize(size.width, size.height);
      }
    };
    
    // 重置相机
    const resetCamera = () => {
      if (camera.value && controls.value) {
        camera.value.position.set(10, 10, 10);
        controls.value.target.set(0, 0, 0);
        controls.value.update();
      }
    };
    
    // 切换到主视图
    const switchToMainView = () => {
      currentView.value = 'main';
      resetCamera();
    };
    
    // 关闭设备详情面板
    const closeDeviceDetail = () => {
      selectedDevice.value = null;
    };
    
    // 刷新设备数据
    const refreshDeviceData = (deviceId) => {
      // 模拟数据刷新
      const deviceIndex = devices.value.findIndex(d => d.id === deviceId);
      if (deviceIndex !== -1) {
        const device = devices.value[deviceIndex];
        device.temperature = (20 + Math.random() * 15).toFixed(1);
        device.cpu = Math.floor(Math.random() * 100);
        device.memory = Math.floor(Math.random() * 100);
        
        // 更新状态
        device.status = getRandomStatus();
        
        // 如果是当前选中的设备，更新详情面板
        if (selectedDevice.value && selectedDevice.value.id === deviceId) {
          selectedDevice.value = { ...device };
        }
      }
    };
    
    // 更新面板位置
    const updatePanelPosition = (position) => {
      detailPanelPosition.x = position.x;
      detailPanelPosition.y = position.y;
    };
    
    // 导航切换
    const handleNavChange = (navItem) => {
      currentNavItem.value = navItem;
      // 处理导航切换逻辑
    };
    
    // 更新温度（定时模拟）
    const updateTemperature = () => {
      const randomDelta = (Math.random() - 0.5) * 0.2;
      serverTemperature.value = parseFloat((serverTemperature.value + randomDelta).toFixed(1));
    };

    // 定时器ID
    let temperatureIntervalId = null;

    // 组件挂载后启动定时器
    onMounted(() => {
        temperatureIntervalId = setInterval(updateTemperature, 5000);
    });
    
    // 辅助函数：获取随机状态
    const getRandomStatus = () => {
      const statusValues = ['normal', 'warning', 'error', 'offline'];
      const weights = [0.85, 0.1, 0.03, 0.02]; // 权重，大多数是正常状态
      
      const rand = Math.random();
      let sum = 0;
      for (let i = 0; i < weights.length; i++) {
        sum += weights[i];
        if (rand < sum) return statusValues[i];
      }
      return 'normal';
    };
    
    // 辅助函数：获取随机制造商
    const getRandomManufacturer = () => {
      const manufacturers = ['Dell', 'HP', 'IBM', 'Lenovo', 'Cisco', 'Huawei'];
      return manufacturers[Math.floor(Math.random() * manufacturers.length)];
    };
    
    // 辅助函数：格式化设备名称
    const formatDeviceName = (name) => {
      let formattedName = name;
      if (formattedName.startsWith('NE_')) {
        formattedName = formattedName.substring(3);
      }
      return formattedName.replace(/_/g, ' ');
    };

    return {
      currentView,
      selectedDevice,
      isTransitioning,
      transitionOpacity,
      currentNavItem,
      serverTemperature,
      systemStatus,
      detailPanelPosition,
      tooltipInfo,
      initThreeJS,
      onContainerResize,
      switchToMainView,
      closeDeviceDetail,
      refreshDeviceData,
      updatePanelPosition,
      handleNavChange
    };
  }
});
</script>

<style lang="scss" scoped>
@use '../styles/variables.scss' as vars;
@use '../styles/mixins.scss' as mixins;

.smart-server-room {
  width: 100%;
  height: 100%;
  @include mixins.flex(column, flex-start, stretch);
  background-color: vars.$bg-color;
  color: vars.$text-color;
  position: relative;
  overflow: hidden;
}
</style> 