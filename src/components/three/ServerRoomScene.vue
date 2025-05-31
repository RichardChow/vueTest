<template>
  <base-three-scene
    :model-path="modelPath"
    :background-color="enableTransparentBackground ? 'transparent' : backgroundColor"
    :alpha="enableTransparentBackground"
    :camera-position="cameraPosition"
    :camera-fov="cameraFov"
    :ambient-light-intensity="ambientLightIntensity"
    :directional-light-intensity="directionalLightIntensity"
    @object-clicked="handleObjectClick"
    @model-loaded="handleModelLoaded"
    ref="baseScene"
  />

  <!-- 修改 Tooltip 组件的 props 绑定 -->
  <Tooltip
    :visible="tooltip.visible"
    :title="tooltip.title"
    :content="tooltip.content"
    :html-content="tooltip.htmlContent"
    :x="tooltip.x"
    :y="tooltip.y"
    :type="tooltip.type"
    :style="tooltipStyle"
    :show-right-click-tip="tooltip.showRightClickTip"
    :right-click-tip-text="tooltip.rightClickTipText"
  />

  <!-- 上下文菜单 -->
  <context-menu
    :visible="contextMenu.visible"
    :x="contextMenu.x"
    :y="contextMenu.y"
    :rack-type="contextMenu.rackType"
    @select="handleMenuSelect"
  />
</template>

<script>
import BaseThreeScene from '@/components/three/BaseThreeScene.vue';
import * as THREE from 'three';
import { nextTick, ref, reactive, watch, onMounted, onBeforeUnmount, getCurrentInstance } from 'vue';
import { 
  formatDeviceName,
  processModelParents,
  DEVICE_TYPES
} from '@/utils/deviceUtils';
import { 
  createColorMap, 
} from '@/utils/colorUtils';
import { useRackView } from '@/composables/three/useRackView';
import { useDeviceView } from '@/composables/three/useDeviceView';
import { useSceneInteractions } from '@/composables/three/useSceneInteractions';
import { useTooltip } from '@/composables/ui/useTooltip';
import Tooltip from '@/components/ui/Tooltip.vue';
import { useSceneObjects } from '@/composables/three/useSceneObjects';
import { animate } from '@/utils/animations';
import ContextMenu from '@/components/ui/ContextMenu.vue';

export default {
  name: 'ServerRoomScene',
  components: {
    BaseThreeScene,
    Tooltip,
    ContextMenu
  },
  props: {
    modelPath: {
      type: String,
      default: '/models/animated/server_room_animated.gltf'
    },
    backgroundColor: {
      type: String,
      default: '#0a1222'
    },
    enableTransparentBackground: {
      type: Boolean,
      default: false
    },
    cameraPosition: {
      type: Object,
      default: () => ({ x: 0, y: 2, z: 5 })
    },
    cameraFov: {
      type: Number,
      default: 60
    },
    ambientLightIntensity: {
      type: Number,
      default: 1.5
    },
    directionalLightIntensity: {
      type: Number,
      default: 1.0
    },
    currentView: {
      type: String,
      default: 'main' // 'main', 'single-rack', 'single-device'
    }
  },
  emits: ['object-clicked', 'object-hover', 'scene-ready', 'model-loaded', 'view-changed', 'update:currentView'],
  setup(props, { emit }) {
    const deviceInteractionState = reactive({
        selectedDevice: null,
        hoveredDevice: null,
      originalColors: new Map(),
      originalPositions: new Map(),
      colorMap: createColorMap(),
      isSceneReady: false,
      lastHighlightedObject: null,
      
      // 添加索引化存储 
      deviceMap: new Map(), // 名称 -> 设备对象
      rackMap: new Map(),   // 名称 -> 机架对象
      devicesByType: {},    // 类型 -> 设备数组
      devicesByRack: {},     // 机架 -> 设备数组
      objectParentMap: new Map(), // 对象ID到其父对象的映射
      interactiveObjectsSet: new Set(), // 可交互对象集合

      // === 新增：机架到设备的精确映射 ===
      rackToDevicesMap: new Map() // rackName -> deviceObject[]
    });
    
      // 场景状态
    const sceneState = reactive({
        currentView: 'main',
        mainScene: null,
        singleRackScene: null,
        singleDeviceScene: null,
        selectedRack: null,
        selectedDevice: null,
        originalCameraPosition: null,
        originalControlsTarget: null,
        isFrontView: false,
        rackInitialRotation: 0, // 机架初始旋转角度
        deviceAnimationStage: 0,
        animatingDevice: null,
        animatedDeviceParts: [],
        currentDevicePositions: new Map(),
        showTooltipInSingleRack: false,
        multiRackLayout: null,
        multiRackId: null,
    });

      // 动画状态
    const animationState = reactive({
        isAnimating: false,
        startTime: 0,
        duration: 1000,
        startPosition: null,
        targetPosition: null,
        startTarget: null,
        targetTarget: null
    });
    
    // 指针悬停处理
    const pointer = reactive({ x: 0, y: 0 });
    const width = ref(0);
    const height = ref(0);
    
    // 悬停状态管理
    const hoverState = reactive({
      raycaster: null,
      mouse: new THREE.Vector2(),
      tooltipInfo: {
        visible: false,
        x: 0,
        y: 0,
        title: '',
        status: 'normal',
        info: ''
      },
      lastHoveredObject: null
    });
    const sceneContainer = ref(null);
    
    // 直接事件处理状态 - 新增
    const directEventState = reactive({
      initialized: false,
      raycaster: null,
      mouse: null,
      lastIntersection: null,
      hoveredObject: null
    });
    
    // 创建对baseScene的引用
    const baseScene = ref(null);
    
    // 使用机架视图composable
    const { 
      rackViewState, 
      createSingleRackScene: _createSingleRackScene, 
      destroySingleRackScene,
      animateRackRotation: _animateRackRotation,
      switchToFrontView: _switchToFrontView,
      handleSingleRackViewClick: _handleSingleRackViewClick,
      animateRackDevice: _animateRackDevice,
      resetRackDeviceAnimation: _resetRackDeviceAnimation,
      findDeviceByName: _findDeviceByName,
      createMultiRackScene: _createMultiRackScene,
      destroyMultiRackScene: _destroyMultiRackScene,
      initLayoutMarkers
    } = useRackView();

      // 创建 rackViewUtils 对象，封装所有方法调用
    const rackViewUtils = {
      createContext() {
        return {
          scene: baseScene.value?.scene,
          camera: baseScene.value?.camera,
          renderer: baseScene.value?.renderer,
          controls: baseScene.value?.controls,
          mainModel: baseScene.value?.model,
          sceneState,
          deviceInteractionState
        };
      },

      switchToFrontView() {
        const context = this.createContext();
        return _switchToFrontView(context);
      },
    
      animateRackRotation(targetRotation) {
        const context = this.createContext();
        return _animateRackRotation(targetRotation, context);
      },
      
      handleSingleRackViewClick(data) {
        const context = this.createContext();
        return _handleSingleRackViewClick(data, context);
      },
      
      animateRackDevice(deviceName) {
        const context = this.createContext();
        return _animateRackDevice(deviceName, context);
      },
      
      resetRackDeviceAnimation(deviceObj, deviceParts) {
        const context = this.createContext();
        return _resetRackDeviceAnimation(deviceObj, deviceParts, context);
      },
      
      findDeviceByName(deviceName) {
        const context = this.createContext();
        return _findDeviceByName(deviceName, context);
      }
    };

    watch(() => rackViewState.isFrontView, (newVal) => {
      sceneState.isFrontView = newVal;
    });

    // 使用设备视图 composable
    const {
      deviceViewState,
      createSingleDeviceScene: _createSingleDeviceScene,
      destroySingleDeviceScene,
      animateDevice: _animateDevice
    } = useDeviceView();

    const { 
      state: interactionState,
      setDependencies,
      onObjectClick,
      onObjectHover,
      getHoveredObject,
      setPickableObjects,
      setObjectParentMap,
      onContextMenu
    } = useSceneInteractions();

    const {
      tooltip,
      tooltipStyle,
      showTooltip,
      hideTooltip,
      updatePosition,
      updateTooltip,
      hideTooltipImmediately
    } = useTooltip({
      offset: { x: 10, y: 10 } 
    });
    
    // 设置设备交互属性的辅助函数
    const setupDeviceInteractivity = (deviceObject) => {
      // 设置设备为可交互
      if (!deviceObject.userData) deviceObject.userData = {};
      deviceObject.userData.isInteractive = true;
      
      // 如果是网元设备，设置相应类型
      if (deviceObject.name && deviceObject.name.startsWith('NE_')) {
        deviceObject.userData.type = 'NE';
      } else {
        deviceObject.userData.type = 'device';
      }
    };

    // 定义内部引用，用于桥接methods和setup
    const methodsRef = ref({
      handleObjectClick: null,
      highlightObject: null,
      resetHighlight: null
    });

    // 在组件挂载后设置引用
    onMounted(() => {
      // 确保组件实例可用
      const instance = getCurrentInstance();
      if (instance) {
        methodsRef.value = {
          handleObjectClick: instance.ctx.handleObjectClick,
          highlightObject: instance.ctx.highlightObject,
          resetHighlight: instance.ctx.resetHighlight
        };
      }
      
      if (baseScene.value) {
        setDependencies({
          sceneRef: baseScene.value.scene,
          cameraRef: baseScene.value.camera,
          containerReference: baseScene.value.$el
        });
        
        // 如果有模型，设置为可拾取
        if (baseScene.value.model) {
          setPickableObjects(baseScene.value.model);
        }
      }
    });

    // 集成场景对象管理
    const {setSceneModel, highlightObject, resetHighlight } = useSceneObjects();
    
    // 监听模型加载完成，更新可交互对象
    watch(() => baseScene.value?.model, (newModel) => {
      if (newModel) {
        setPickableObjects(newModel);
        // 设置场景模型并查找所有对象
        setSceneModel(newModel);

        // 在处理模型后建立对象ID到父对象的映射
        newModel.traverse(object => {
          if (object.parent && object.parent !== newModel) {
            deviceInteractionState.objectParentMap.set(object.id, object.parent);
          }
        });
      }
    }, { immediate: true });

    // 注册点击处理函数
    onObjectClick((object) => {
      if (object && methodsRef.value.handleObjectClick) {
        const data = {
          name: object.name,
          type: object.userData?.type || 'unknown',
          position: {
            x: object.position.x,
            y: object.position.y,
            z: object.position.z
          }
        };
        methodsRef.value.handleObjectClick(data);
      }
    });

    // 注册悬停处理函数
    onObjectHover({
      onEnter: (object, eventData) => {
        // console.log('鼠标进入对象:', object.name, '类型:', object.userData?.type);
        
        if (object) {
          const formattedName = formatDeviceName(object.name);
          const title = formattedName;
          let content = '';
          let showRightClickTip = false;
          
          // 添加右键提示内容 - 修改判断条件，同时支持"rack"和"Rack"
          if (object.userData && (object.userData.type === 'rack' || object.userData.type === 'Rack' || object.userData.type === DEVICE_TYPES.RACK)) {
            // console.log('检测到机架对象，设置右键提示');
            content = ''; // 不在content中显示右键提示，避免重复
            showRightClickTip = true;
          }
          
          const type = object.userData?.status === 'error' ? 'error' : 
                       object.userData?.status === 'warning' ? 'warning' : 'info';
          
          if (sceneState.currentView === 'main') {
            // console.log('显示提示，设置showRightClickTip:', showRightClickTip);
            showTooltip({ 
              title: title, 
              content: content, 
              type: type,
              x: eventData.position.clientX,
              y: eventData.position.clientY,
              showRightClickTip: showRightClickTip,
              rightClickTipText: '右键点击查看更多选项',
              duration: 3000 // 设置3秒后自动消失
            });
          }
        }
      },
      onLeave: () => {
        hideTooltip();
      },
      onHover: (object, eventData) => {
        if (tooltip.visible) {
          if (eventData && eventData.position) {
            updatePosition(eventData.position.clientX, eventData.position.clientY);
          }
        }
      },
      // 添加右键菜单事件处理，立即隐藏tooltip
      onContextMenu: () => {
        // 立即隐藏tooltip，不使用延迟
        hideTooltipImmediately();
      }
    });

    
    const modelProcessed = ref(false);
    
    // 添加上下文菜单状态
    const contextMenu = reactive({
      visible: false,
      x: 0,
      y: 0,
      rackLayout: 'col',
      selectedObject: null
    });
    
    // 注册右键菜单事件
    onContextMenu((object, eventData) => {
      console.log('右键点击对象:', object.name, '类型:', object.userData?.type);
      
      // 检查对象是否为机架 - 修改判断条件，同时支持"rack"和"Rack"
      if (object.userData && (object.userData.type === 'Rack' || object.userData.type === DEVICE_TYPES.RACK)) {
        // 提取机架类型
        const rackLayout = extractRackLayout(object.name);
        
        if (rackLayout) {
          // 显示上下文菜单
          contextMenu.visible = true;
          contextMenu.x = eventData.position.clientX;
          contextMenu.y = eventData.position.clientY;
          contextMenu.rackLayout = rackLayout;
          contextMenu.selectedObject = object;
        }
      }
    });
    
    // 处理菜单选择
    const handleMenuSelect = (action) => {
      if (action === 'view-multi-rack' && contextMenu.selectedObject) {
        // 创建多机架视图
        createMultiRackScene(contextMenu.selectedObject);
      }
      
      // 隐藏菜单
      contextMenu.visible = false;
    };
    
    // 点击其他地方隐藏菜单
    const hideContextMenu = () => {
      contextMenu.visible = false;
    };
    
    // 添加document点击事件监听器
    onMounted(() => {
      document.addEventListener('click', hideContextMenu);
    });
    
    onBeforeUnmount(() => {
      document.removeEventListener('click', hideContextMenu);
    });
    
    // 在setup函数中添加extractRackLayout函数定义
    const extractRackLayout = (rackName) => {
      if (rackName.includes('row-')) return 'row';
      if (rackName.includes('col-')) return 'col';
      return null;
    };

    // 在setup函数中修改createMultiRackScene函数定义
    const createMultiRackScene = (rackData) => {
      if (!baseScene.value || !baseScene.value.model) {
        console.error('缺少基础场景或模型引用');
        return false;
      }
      
      // 从机架名称中提取行/列信息
      const rackLayout = extractRackLayout(rackData.name);
      const rackId = extractRackId(rackData.name);
      
      if (!rackLayout || !rackId) {
        console.error('无法从机架名称提取行/列信息:', rackData.name);
        return false;
      }
      
      // 构建上下文对象 - 使用安全的 emit 传递
      const context = {
        scene: baseScene.value.scene,
        camera: baseScene.value.camera,
        renderer: baseScene.value.renderer,
        controls: baseScene.value.controls,
        mainModel: baseScene.value.model,
        sceneState,
        deviceInteractionState,
        setPickableObjects,
        setObjectParentMap,
        // 修改为使用传入的 emit 函数
        emitViewChanged: (data) => emit('view-changed', data)
      };
      
      // 调用composable中的实现
      return _createMultiRackScene(rackLayout, rackId, context);
    };

    // 在setup函数中添加extractRackId函数定义
    const extractRackId = (rackName) => {
      const rowMatch = rackName.match(/row-(\d+)/);
      if (rowMatch && rowMatch[1]) return rowMatch[1];
      
      const colMatch = rackName.match(/col-(\d+)/);
      if (colMatch && colMatch[1]) return colMatch[1];
      
      return null;
    };

    return {
      deviceInteractionState,
      sceneState,
      animationState,
      pointer,
      width,
      height,
      hoverState,
      sceneContainer,
      directEventState,
      baseScene,
      rackViewState,
      _createSingleRackScene,
      destroySingleRackScene,
      setupDeviceInteractivity,
      deviceViewState,
      _createSingleDeviceScene,
      destroySingleDeviceScene,
      _animateDevice,
      interactionState,
      getHoveredObject,
      methodsRef,
      tooltip,
      tooltipStyle,
      rackViewUtils,
      highlightObject,
      resetHighlight,
      animate,
      modelProcessed,
      setObjectParentMap,
      setPickableObjects,
      _createMultiRackScene,
      contextMenu,
      handleMenuSelect,
      extractRackLayout,
      extractRackId,
      createMultiRackScene,
      _destroyMultiRackScene,
      initLayoutMarkers
    };
  },
  computed: {
    // 提供对模型的快捷访问
    model() {
      return this.$refs.baseScene?.model || this.sceneState.mainScene;
    }
  },
  watch: {
    currentView: {
      immediate: true,
      handler(newView) {
        // 如果内部状态与外部传入不一致，则更新内部状态
        if (this.sceneState.currentView !== newView) {
          this.sceneState.currentView = newView;
          
          // 当视图状态变化时，通知父组件
          this.$emit('view-changed', {
            view: newView,
            data: this.sceneState.currentView === 'single-rack' 
              ? this.sceneState.selectedRack 
              : this.sceneState.selectedDevice
          });
        }
      }
    }
  },
  methods: {
    // 处理模型加载完成事件
    handleModelLoaded(data) {
      // 检查模型是否已处理
      if (this.modelProcessed) {
        console.log('模型已处理，跳过重复处理');
        return;
      }
      
      console.log('服务器房间模型已加载:', data.modelName);
      
      // 获取模型引用
      const model = this.$refs.baseScene.model;
      this.sceneState.mainScene = model;
      
      // 初始化布局标记
      if (this._createMultiRackScene) {
        // 直接初始化布局标记
        const initResult = this.initLayoutMarkers(model);
        console.log(`初始化布局标记: 找到 ${this.rackViewState.layoutMarkers.size} 个标记`);
      }
      
      // 创建全局状态对象
      const globalState = {
        originalMaterials: new Map(),
        originalPositions: new Map(),
        devices: [],
        racks: []
      };
      
      // 在这里调用processModelParents进行业务处理
      const processedObjects = processModelParents(model, globalState);
      
      // 将处理结果保存在当前组件的状态中
      this.deviceInteractionState.devices = globalState.devices;
      this.deviceInteractionState.racks = globalState.racks;
      this.deviceInteractionState.originalMaterials = globalState.originalMaterials;
      this.deviceInteractionState.originalPositions = globalState.originalPositions;
      
      console.log(`处理了 ${processedObjects.length} 个父对象，${globalState.devices.length} 个设备，${globalState.racks.length} 个机架`);
      
      // === 新增：构建 rackToDevicesMap ===
      console.log('开始构建 rackToDevicesMap...');
      this.deviceInteractionState.rackToDevicesMap.clear(); // 清空旧映射
      globalState.devices.forEach(device => {
        // 确保设备有 details 和 rack 信息
        if (device.userData?.details?.rack) {
          const rackId = device.userData.details.rack; // 例如 "Rack-01"
          if (!this.deviceInteractionState.rackToDevicesMap.has(rackId)) {
            this.deviceInteractionState.rackToDevicesMap.set(rackId, []);
          }
          this.deviceInteractionState.rackToDevicesMap.get(rackId).push(device);
        } else {
          // 可以选择记录没有关联机架的设备
          // console.warn(`设备 ${device.name} 没有找到关联的机架ID`);
          const unknownRackId = 'UNKNOWN_RACK';
          if (!this.deviceInteractionState.rackToDevicesMap.has(unknownRackId)) {
            this.deviceInteractionState.rackToDevicesMap.set(unknownRackId, []);
          }
          this.deviceInteractionState.rackToDevicesMap.get(unknownRackId).push(device);
        }
      });
      console.log('rackToDevicesMap 构建完成:', this.deviceInteractionState.rackToDevicesMap);
      // === 构建映射结束 ===

      // 构建对象父级映射和可交互对象集合
      this.buildObjectMappings(model);
      
      // 标记模型已处理
      this.modelProcessed = true;
      
      // 保存原始相机位置和控制器目标
      if (this.$refs.baseScene.camera) {
        this.sceneState.originalCameraPosition = this.$refs.baseScene.camera.position.clone();
        if (this.$refs.baseScene.controls) {
          this.sceneState.originalControlsTarget = this.$refs.baseScene.controls.target.clone();
        }
      }
      
      // 转发事件到父组件
      this.$emit('model-loaded', {
        modelName: data.modelName,
        deviceCount: globalState.devices.length,
        rackCount: globalState.racks.length
      });
      
      // 创建旧的索引 (这部分现在可以被 rackToDevicesMap 替代或增强，暂时保留)
      this.buildIndexMappings(globalState);
    },
    
    // 处理对象点击事件
    handleObjectClick(data) {
      console.log('原始点击数据:', data); // 诊断用
      
      // 如果在单设备视图中，使用存储的selectedDevice信息
      if (this.sceneState.currentView === 'single-device' && 
          this.sceneState.selectedDevice) {
        
        // 创建新的数据对象，使用已保存的设备信息
        data = { 
          ...data, 
          name: this.sceneState.selectedDevice.name,
          type: this.sceneState.selectedDevice.type || 'NE'
        };
        
        console.log('已使用已保存的设备信息更新事件数据:', data.name);
      }
      
      // 如果在单机架视图中点击机架子对象，使用当前选中机架名称
      else if (this.sceneState.currentView === 'single-rack' && 
               data.type === 'rack' && 
               this.sceneState.selectedRack) {
        
        // 创建新的数据对象，保持原始数据其他部分不变
        data = { 
          ...data, 
          name: this.sceneState.selectedRack.name,
          type: 'Rack'  // 与主视图保持一致
        };
      }
      
      // 根据当前视图处理点击事件
      if (this.sceneState.currentView === 'single-rack') {
        this.handleSingleRackViewClick(data);
      } else if (this.sceneState.currentView === 'single-device') {
        this.handleSingleDeviceViewClick(data);
      } else {
        this.handleMainViewClick(data);
      }
      
      // 设置选中的设备或机架
      if (data.type === 'device') {
        this.deviceInteractionState.selectedDevice = data.name;
      } else if (data.type === 'rack') {
        this.sceneState.selectedRack = data;
      }
      
      // 转发点击事件到父组件
      this.$emit('object-clicked', data);
    },
    
    // 主视图中的点击处理
    handleMainViewClick(data) {
      // 如果点击的是机架，切换到单机架视图
      if (data.type === 'rack') {
        console.log('主视图中点击机架，切换到单机架视图:', data.name);
        this.createSingleRackScene(data);
      }
      // 如果点击的是设备，切换到单设备视图
      else if (data.type === 'NE') {
        console.log('主视图中点击设备，切换到单设备视图:', data.name);
        this.createSingleDeviceScene(data);
      }
    },
    
    // 单机架视图中的点击处理
    handleSingleRackViewClick(data) {
      return this.rackViewUtils.handleSingleRackViewClick(data);
    },
    
    // 单设备视图中的点击处理
    handleSingleDeviceViewClick(data) {
      console.log('单设备视图中点击111:', data.name, data.type);
      // 在单设备视图中可以实现其他交互，如部件动画等
    },
    
    // 切换到正面视图
    switchToFrontView() {
      this.rackViewUtils.switchToFrontView();
    },
    
    // 机架旋转动画
    animateRackRotation(targetRotation) {
      return this.rackViewUtils.animateRackRotation(targetRotation);
    },
    
    // 创建单设备视图
    createSingleDeviceScene(deviceData) {
      if (!this.$refs.baseScene || !this.$refs.baseScene.model) {
        console.error('缺少基础场景或模型引用');
        return false;
      }
      
      // 记录当前的相机状态，以便之后返回
      if (!this.sceneState.originalCameraPosition) {
        this.sceneState.originalCameraPosition = this.$refs.baseScene.camera.position.clone();
        this.sceneState.originalControlsTarget = this.$refs.baseScene.controls.target.clone();
      }

    // 构建上下文对象
    const context = {
      scene: this.$refs.baseScene.scene,
      camera: this.$refs.baseScene.camera,
      renderer: this.$refs.baseScene.renderer,
      controls: this.$refs.baseScene.controls,
      mainModel: this.$refs.baseScene.model,
      getObjectByName: this.getObjectByName.bind(this),
      setupDeviceInteractivity: this.setupDeviceInteractivity.bind(this),
      sceneState: this.sceneState,
      emitViewChanged: (data) => this.$emit('view-changed', data),
      setPickableObjects: this.setPickableObjects,
      setObjectParentMap: this.setObjectParentMap
    };
    
    // 调用composable中的实现
    const result = this._createSingleDeviceScene(deviceData, context);

    // === 新增：切换pickable对象 ===
    if (result && this.sceneState.singleDeviceScene) {
      const pickable = this.buildObjectMappings(this.sceneState.singleDeviceScene);
      this.setPickableObjects(pickable);
      console.log('single-device: pickable 对象已更新');
    }
    
    return result;
    },

    // 重置到主视图
    resetToMainScene() {
      // 构建上下文对象
      const context = {
        scene: this.$refs.baseScene.scene,
        camera: this.$refs.baseScene.camera,
        renderer: this.$refs.baseScene.renderer,
        controls: this.$refs.baseScene.controls,
        mainModel: this.$refs.baseScene.model,
        sceneState: this.sceneState,
        emitViewChanged: (data) => this.$emit('view-changed', data)
      };

      // 如果有保存的相机位置，恢复它
      if (this.sceneState.originalCameraPosition) {
        this.$refs.baseScene.camera.position.copy(this.sceneState.originalCameraPosition);
        this.$refs.baseScene.controls.target.copy(this.sceneState.originalControlsTarget || new THREE.Vector3());
        this.$refs.baseScene.controls.update();
      }

      let result = false;
      
      // 根据当前视图类型，选择对应的重置方法
      if (this.sceneState.currentView === 'single-rack') {
        result = this.destroySingleRackScene(context);
        
        // 备份重置逻辑
        if (this.rackViewState) {
          this.rackViewState.firstNetworkElementClick = true;
          this.rackViewState.isFrontView = false;
          console.log('resetToMainScene: 备份重置rackViewState关键状态');
        }
      } else if (this.sceneState.currentView === 'single-device') {
        result = this.destroySingleDeviceScene(context);
      } else if (this.sceneState.currentView === 'multi-rack') {
        // 添加multi-rack视图的重置处理
        result = this.destroyMultiRackScene(context);
      }

      // 修改这一段：主动同步构建主场景的交互对象列表
      if (this.$refs.baseScene?.model) {
        // 立即构建主视图的交互对象数组
        const interactive = [];
        const parentMap = new Map();
        
        // 同步遍历一次
        this.$refs.baseScene.model.traverse(obj => {
          if (obj.userData?.isInteractive) {
            interactive.push(obj);
          }
          if (obj.parent && obj.parent !== this.$refs.baseScene.model) {
            parentMap.set(obj.id, obj.parent);
          }
        });
        
        // 立即更新
        this.setPickableObjects(interactive);
        this.setObjectParentMap(parentMap);
        
        // 补充更新状态
        this.deviceInteractionState.objectParentMap = parentMap;
        this.deviceInteractionState.interactiveObjectsSet = new Set(interactive);
        
        console.log(`返回主视图: 设置了 ${interactive.length} 个可拾取对象，${parentMap.size} 个父级映射`);
      }
      
      // 清理直接事件处理
      this.cleanupDirectEventHandling();

      // 更新当前视图
      this.sceneState.currentView = 'main';
      // 清理 multi-rack 状态
      this.sceneState.multiRackLayout = null;
      this.sceneState.multiRackId = null;
      
      // 强制更新模型显示
      if (this.$refs.baseScene.model) {
        this.$refs.baseScene.model.visible = true;
        // 遍历确保所有子对象可见
        this.$refs.baseScene.model.traverse(child => {
          if (child.visible !== undefined) {
            child.visible = true;
          }
        });
      }
      
      // 强制重渲染
      if (this.$refs.baseScene.renderer && this.$refs.baseScene.camera) {
        this.$refs.baseScene.renderer.render(this.$refs.baseScene.scene, this.$refs.baseScene.camera);
      }

      return result;
    },
    
    // 设备动画方法 - 对外暴露的接口
    animateRackDevice(deviceName) {
      return this.rackViewUtils.animateRackDevice(deviceName);
    },
    
    // 重置设备动画 - 恢复到原始位置
    resetRackDeviceAnimation(deviceObj, deviceParts) {
      return this.rackViewUtils.resetRackDeviceAnimation(deviceObj, deviceParts);
    },
    
    // 查找设备对象 - 增强版，支持通过子部件找到父级网元设备
    findDeviceByName(deviceName) {
      return this.rackViewUtils.findDeviceByName(deviceName);
    },
    
    // 获取对象通过名称
    getObjectByName(name) {
      if (!this.$refs.baseScene || !this.$refs.baseScene.model) {
        return null;
      }
      return this.$refs.baseScene.model.getObjectByName(name);
    },
    
    
    // 从ServerRoom.vue中移植的清理方法
    disposeScene(scene) {
      if (!scene) return;
      
      console.log('清理场景资源');
      scene.traverse((object) => {
        // 清理几何体
        if (object.geometry) {
          object.geometry.dispose();
        }
        
        // 清理材质
        if (object.material) {
          // 处理材质数组
          if (Array.isArray(object.material)) {
            object.material.forEach(material => this.disposeMaterial(material));
            } else {
            // 处理单个材质
            this.disposeMaterial(object.material);
          }
        }
        
        // 清理其他属性
        if (object.dispose && typeof object.dispose === 'function') {
          object.dispose();
        }
      });
    },
    
    // 辅助函数：清理材质及其贴图资源
    disposeMaterial(material) {
      if (!material) return;
      
      // 清理材质的所有纹理资源
      if (material.map) material.map.dispose();
      if (material.lightMap) material.lightMap.dispose();
      if (material.bumpMap) material.bumpMap.dispose();
      if (material.normalMap) material.normalMap.dispose();
      if (material.displacementMap) material.displacementMap.dispose();
      if (material.specularMap) material.specularMap.dispose();
      if (material.envMap) material.envMap.dispose();
      
      // 通用遍历所有可能的纹理属性
      for (const key in material) {
        const value = material[key];
        if (value && value.isTexture) {
          value.dispose();
        }
      }
      
      // 清理材质本身
      material.dispose();
    },
    
    // 窗口大小调整处理
    onWindowResize() {
      console.log('窗口大小改变');
    },
    
    // 初始化直接事件处理
    initializeDirectEventHandling() {
      console.log('交互系统自动管理事件处理')
    },
    
    // 清理直接事件处理
    cleanupDirectEventHandling() {
      console.log('清理交互系统')
    },
    
    // 创建单机架视图 - 组件层面的方法
    createSingleRackScene(rackData) {
      if (!this.$refs.baseScene || !this.$refs.baseScene.model) {
        console.error('缺少基础场景或模型引用');
        return false;
      }
      
      // 记录当前的相机状态，以便之后返回
      if (!this.sceneState.originalCameraPosition) {
        this.sceneState.originalCameraPosition = this.$refs.baseScene.camera.position.clone();
        this.sceneState.originalControlsTarget = this.$refs.baseScene.controls.target.clone();
      }
      
      // 构建上下文对象，包含所有必要的引用
      const context = {
        scene: this.$refs.baseScene.scene,
        camera: this.$refs.baseScene.camera,
        renderer: this.$refs.baseScene.renderer,
        controls: this.$refs.baseScene.controls,
        mainModel: this.$refs.baseScene.model,
        getObjectByName: this.getObjectByName.bind(this),
        setupDeviceInteractivity: this.setupDeviceInteractivity.bind(this),
        sceneState: this.sceneState,
        deviceInteractionState: this.deviceInteractionState,
        emitViewChanged: (data) => this.$emit('view-changed', data),
        setPickableObjects: this.setPickableObjects,
        setObjectParentMap: this.setObjectParentMap
      };
      
      // 调用composable中的实现
      const result = this._createSingleRackScene(rackData, context);

      return result;
    },

    buildObjectMappings(model) {
      const interactive = [];
      const task = () => {
        this.deviceInteractionState.objectParentMap.clear();
        this.deviceInteractionState.interactiveObjectsSet.clear();

        model.traverse(obj => {
          if (obj.parent && obj.parent !== model) {
            this.deviceInteractionState.objectParentMap.set(obj.id, obj.parent);
          }
          if (obj.userData?.isInteractive) {
            this.deviceInteractionState.interactiveObjectsSet.add(obj);
            interactive.push(obj);
          }
        });

        // 把父级映射发给交互系统
        this.setObjectParentMap?.(this.deviceInteractionState.objectParentMap);
        console.log(
          `映射完成: ${interactive.length} 可交互对象 / ` +
          `${this.deviceInteractionState.objectParentMap.size} 父级映射`);
      };

      window.requestIdleCallback ? window.requestIdleCallback(task) : setTimeout(task);
      return interactive;
    },

    buildIndexMappings(globalState) {
      // 创建设备索引
      globalState.devices.forEach(device => {
        // 按名称索引
        this.deviceInteractionState.deviceMap.set(device.name, device);
        
        // 按类型索引
        const type = device.userData.type || 'unknown';
        if (!this.deviceInteractionState.devicesByType[type]) {
          this.deviceInteractionState.devicesByType[type] = [];
        }
        this.deviceInteractionState.devicesByType[type].push(device);
        
        // 按机架索引
        const rackId = device.userData.details?.rack || 'unknown';
        if (rackId !== 'unknown') {
          if (!this.deviceInteractionState.devicesByRack[rackId]) {
            this.deviceInteractionState.devicesByRack[rackId] = [];
          }
          this.deviceInteractionState.devicesByRack[rackId].push(device);
        }
      });

      // 创建机架索引
      globalState.racks.forEach(rack => {
        this.deviceInteractionState.rackMap.set(rack.name, rack);
      });
    },

    // 添加 destroyMultiRackScene 方法到 methods 中
    destroyMultiRackScene(context) {
      // 调用 composable 中的实现
      return this._destroyMultiRackScene ? this._destroyMultiRackScene(context) : false;
    }
  },
  
  mounted() {
    console.log('ServerRoomScene组件挂载完成');
    
    // 添加窗口大小变化的监听器
    window.addEventListener('resize', this.onWindowResize, false);
    
    // 延迟初始化，确保基础组件已经完全渲染
    nextTick(() => {
      // 初始化悬停相关对象
      this.hoverState.raycaster = new THREE.Raycaster();
      
      // 注册鼠标移动事件监听器，直接在本组件处理
      if (this.$refs.baseScene && this.$refs.baseScene.$refs.container) {
        // const container = this.$refs.baseScene.$refs.container;
        const container = this.$refs.baseScene.$el
        //container.addEventListener('mousemove', this.onDirectMouseMove);
        console.log('已注册直接鼠标移动事件处理器');
        
        // 获取容器尺寸
        this.width = container.clientWidth;
        this.height = container.clientHeight;
          } else {
        console.warn('无法获取容器引用，未能注册直接鼠标移动事件处理器');
      }
    });
    
    // 初始化直接事件处理
    this.$nextTick(() => {
      this.initializeDirectEventHandling();
    });
  },
  
  beforeUnmount() {
    console.log('ServerRoomScene组件卸载，执行清理...');
    
    // 移除事件监听器
    window.removeEventListener('resize', this.onWindowResize, false);
    
    // 取消任何可能正在进行的动画
      if (window.animationFrameId) {
        cancelAnimationFrame(window.animationFrameId);
      window.animationFrameId = null;
    }
    
    // 释放Three.js资源
    if (this.$refs.baseScene) {
      // 如果有控制器，先清理控制器
      if (this.$refs.baseScene.controls) {
        this.$refs.baseScene.controls.dispose();
      }
      
      // 清理场景内的所有资源
      if (this.$refs.baseScene.scene) {
        this.disposeScene(this.$refs.baseScene.scene);
      }
      
      // 清理渲染器
      if (this.$refs.baseScene.renderer) {
        this.$refs.baseScene.renderer.dispose();
        this.$refs.baseScene.renderer.forceContextLoss();
        this.$refs.baseScene.renderer.domElement = null;
      }
      
      // 清理其他THREE.js对象的引用
      if (this.$refs.baseScene.camera) {
        this.$refs.baseScene.camera = null;
      }
      
      if (this.$refs.baseScene.raycaster) {
        this.$refs.baseScene.raycaster = null;
      }
    }
    
    console.log('ServerRoomScene组件资源清理完成');
    
    // 移除鼠标移动事件监听器
    if (this.$refs.baseScene && this.$refs.baseScene.$refs.container) {
      //container.removeEventListener('mousemove', this.onDirectMouseMove);
      console.log('已移除直接鼠标移动事件处理器');
    }
    
    this.cleanupDirectEventHandling();
    
    this.modelProcessed = false;
  },
};
</script>