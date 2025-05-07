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
  />
</template>

<script>
import BaseThreeScene from '@/components/three/BaseThreeScene.vue';
import * as THREE from 'three';
import { markRaw, nextTick, ref, reactive, watch, onMounted, getCurrentInstance } from 'vue';
import { 
  isDevice, 
  isNetworkElement, 
  setupDeviceProperties, 
  DEVICE_TYPES,
  formatDeviceName // <--- 新增导入
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

export default {
  name: 'ServerRoomScene',
  components: {
    BaseThreeScene,
    Tooltip
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
  setup() {
    const deviceInteractionState = reactive({
        selectedDevice: null,
        hoveredDevice: null,
      originalColors: new Map(), // 旧的颜色储存方式，保留向后兼容
      originalPositions: new Map(), // 保存原始位置
      colorMap: createColorMap(), // 新的颜色管理对象
      isSceneReady: false,
      lastHighlightedObject: null
    });
    
      // 场景状态
    const sceneState = reactive({
        currentView: 'main', // 'main', 'single-rack', 'single-device'
        mainScene: null,
        singleRackScene: null,
        singleDeviceScene: null,
        selectedRack: null,
        selectedDevice: null,
        originalCameraPosition: null,
        originalControlsTarget: null,
        isFrontView: false, // 是否为正面视图
        deviceAnimationStage: 0, // 设备动画阶段：0=初始，1=弹出，2=展开
        animatingDevice: null, // 当前正在动画的设备
        animatedDeviceParts: [], // 动画中的设备部件
        currentDevicePositions: new Map(), // 当前动画中的设备位置
        showTooltipInSingleRack: false // 在单机架视图中是否显示悬停提示
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
      findDeviceByName: _findDeviceByName
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
      setPickableObjects
    } = useSceneInteractions();

    const {
      tooltip,
      tooltipStyle,
      showTooltip,
      hideTooltip,
      updatePosition
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
    const {setSceneModel, findAllObjects, highlightObject, resetHighlight } = useSceneObjects();
    
    // 监听模型加载完成，更新可交互对象
    watch(() => baseScene.value?.model, (newModel) => {
      if (newModel) {
        setPickableObjects(newModel);
        // 设置场景模型并查找所有对象
        setSceneModel(newModel);
        findAllObjects();
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
        //if (object) {
          //highlightObject(object);
        //}
        
        if (object) {
          // --- 修改内容生成逻辑 ---
          const formattedName = formatDeviceName(object.name); // 使用 formatDeviceName
          const title = formattedName; // 将格式化名称设为标题
          const content = ''; // 保持内容为空，或根据需要添加其他信息
          // 例如: const content = `状态: ${object.userData?.status || '未知'}`;
          
          const type = object.userData?.status === 'error' ? 'error' : 
                       object.userData?.status === 'warning' ? 'warning' : 'info';
          
          showTooltip({ 
            title: title, 
            content: content, 
            type: type,
            x: eventData.position.clientX,
            y: eventData.position.clientY,
          });
          // --- 内容修改结束 ---
        }
      },
      onLeave: () => {
        hideTooltip();
      },
      onHover: (eventData) => {
        if (tooltip.visible) {
          updatePosition(eventData.position.clientX, eventData.position.clientY); 
        }
      }
    });

    
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
      tooltip, // <--- 修改这里
      tooltipStyle, // <--- 新增返回
      rackViewUtils,
      highlightObject,
      resetHighlight,
      animate,
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
      console.log('服务器房间模型已加载:', data.modelName);
      
      // 获取模型引用
      const model = this.$refs.baseScene.model;
      this.sceneState.mainScene = model;
      
      // 处理模型对象，设置自定义交互属性
      if (model) {
        model.traverse((child) => {
          if (child.isMesh || child.isGroup) {
            // 保存原始颜色
            if (child.material) {
              // 如果是数组，保存每个材质的颜色
              if (Array.isArray(child.material)) {
                child.material.forEach((mat, index) => {
                  if (mat.color) {
                    this.deviceInteractionState.originalColors.set(
                      `${child.id}_${index}`, 
                      markRaw(mat.color.clone())
                    );
                  }
                });
              } else if (child.material.color) {
                // 单个材质的情况
                this.deviceInteractionState.originalColors.set(
                  child.id, 
                  markRaw(child.material.color.clone())
                );
              }
              
              // 保存原始位置
              this.deviceInteractionState.originalPositions.set(
                child.id, 
                markRaw(child.position.clone())
              );
            }
            
            // 使用工具函数设置设备属性，更加简洁和统一
            if (isDevice(child)) {
              console.log('标记为设备:', child.name);
              // 设置设备属性
              setupDeviceProperties(child);
              
              // 兼容旧代码，对NE_开头的设备特殊处理
              if (isNetworkElement(child.name) && (!child.userData.type || child.userData.type === 'device')) {
                child.userData.type = DEVICE_TYPES.NE;
              }
            } else if (child.name.toLowerCase().includes('rack')) {
              // 通常机架主体是Group，但以防万一也检查Mesh
              child.userData.isInteractive = true;
              child.userData.type = DEVICE_TYPES.RACK;
              console.log(`设置交互标记 (Mesh): ${child.name} -> rack`);
            }
          }
          
          // --- 新增：检查 Group 对象 ---
          if (child.isGroup) {
            if (isNetworkElement(child.name)) {
              // 如果设备本身是Group
              child.userData.isInteractive = true;
              child.userData.type = DEVICE_TYPES.NE; // 明确设置为NE
              child.userData.category = this.getDeviceCategory(child.name);
              console.log(`设置交互标记 (Group): ${child.name} -> ne`);
            } else if (child.name.toLowerCase().includes('rack')) {
              // 如果机架是Group
              child.userData.isInteractive = true;
              child.userData.type = DEVICE_TYPES.RACK;
              console.log(`设置交互标记 (Group): ${child.name} -> rack`);
            }
          }
        });
      }
      
      // 保存原始相机位置和控制器目标
      if (this.$refs.baseScene.camera) {
        this.sceneState.originalCameraPosition = this.$refs.baseScene.camera.position.clone();
        if (this.$refs.baseScene.controls) {
          this.sceneState.originalControlsTarget = this.$refs.baseScene.controls.target.clone();
        }
      }
      
      // 转发事件到父组件
      this.$emit('model-loaded', data);
    },
    
    // 获取设备分类
    getDeviceCategory(deviceName) {
      if (deviceName.includes('server')) return 'server';
      if (deviceName.includes('switch')) return 'network';
      if (deviceName.includes('router')) return 'network';
      if (deviceName.includes('storage')) return 'storage';
      return 'unknown';
    },
    
    // 处理对象点击事件
    handleObjectClick(data) {
      console.log('对象点击:', data);
      
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
      console.log('单设备视图中点击:', data.name, data.type);
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
      emitViewChanged: (data) => this.$emit('view-changed', data)
    };
    
    // 调用composable中的实现
    return this._createSingleDeviceScene(deviceData, context);
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
      } else if (this.sceneState.currentView === 'single-device') {
        result = this.destroySingleDeviceScene(context);
      }

      // 清理直接事件处理
      this.cleanupDirectEventHandling();

      // 更新当前视图
      this.sceneState.currentView = 'main';
      
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
      emitViewChanged: (data) => this.$emit('view-changed', data)
    };
    
    // 调用composable中的实现
    return this._createSingleRackScene(rackData, context);
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
        const container = this.$refs.baseScene.$refs.container;
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
  },
  
  // 设置设备交互属性
  setupDeviceInteractivity(deviceObject) {
    // 设置设备为可交互
    if (!deviceObject.userData) deviceObject.userData = {};
    deviceObject.userData.isInteractive = true;
    
    // 如果是网元设备，设置相应类型
    if (deviceObject.name && deviceObject.name.startsWith('NE_')) {
      deviceObject.userData.type = 'NE';
    } else {
      deviceObject.userData.type = 'device';
    }
  }
};
</script>