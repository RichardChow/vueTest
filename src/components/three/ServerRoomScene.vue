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
    @scene-ready="handleSceneReady"
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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { markRaw, nextTick, ref, reactive, watch, onMounted, getCurrentInstance } from 'vue';
import { 
  isDevice, 
  isNetworkElement, 
  setupDeviceProperties, 
  DEVICE_TYPES,
  formatDeviceName // <--- 新增导入
} from '@/utils/deviceUtils';
import { 
  saveOriginalColor, 
  restoreOriginalColor, 
  setHighlightColor, 
  setDeviceHighlight, 
  setDeviceOutlineHighlight,
  createColorMap, 
  HIGHLIGHT_COLORS 
} from '@/utils/colorUtils';
import { useRackView } from '@/composables/three/useRackView';
import { useDeviceView } from '@/composables/three/useDeviceView';
import { useSceneInteractions } from '@/composables/three/useSceneInteractions';
import { useTooltip } from '@/composables/ui/useTooltip';
import Tooltip from '@/components/ui/Tooltip.vue';
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
      destroySingleRackScene 
    } = useRackView();

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
      tooltipState,
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
    
    // 创建内部处理函数
    const handleObjectClickSetup = (object, eventData) => {
      console.log('Object clicked in setup:', object?.name);
      // 基本处理逻辑，具体实现可以在组件挂载后补充
      const data = {
        name: object.name,
        type: object.userData?.type || 'unknown',
        position: {
          x: object.position.x,
          y: object.position.y,
          z: object.position.z
        }
      };
    };

    const highlightObjectSetup = (object) => {
      console.log('Highlight object in setup:', object?.name);
      // 高亮基本逻辑
    };

    const resetHighlightSetup = (object) => {
      console.log('Reset highlight in setup:', object?.name);
      // 重置高亮基本逻辑
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

    // 监听模型加载完成，更新可交互对象
    watch(() => baseScene.value?.model, (newModel) => {
      if (newModel) {
        setPickableObjects(newModel);
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
        if (object && methodsRef.value.highlightObject) {
          methodsRef.value.highlightObject(object); 
        }
        
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
      onLeave: (object, eventData) => {
        if (object && methodsRef.value.resetHighlight) {
          methodsRef.value.resetHighlight(object); 
        }
        hideTooltip();
      },
      onHover: (object, eventData) => {
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
      tooltipStyle // <--- 新增返回
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
              console.log(`设置交互标记 (Group): ${child.name} -> device`);
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
        // 检查是否点击了当前已经弹出的设备
        const isNetworkElement = data.name && data.name.startsWith('NE_');
        const isClickingSameDevice = this.deviceInteractionState.selectedDevice && 
                                     this.deviceInteractionState.selectedDevice.name === data.name;
        
        if (isClickingSameDevice && this.deviceInteractionState.interactionStage === 1) {
          console.log('点击已弹出的设备，只执行复位动作，不触发新的点击事件');
          
          // 复位动画 - 直接调用，不通过emit向上传递点击事件
          if (isNetworkElement) {
            this.animateDevice(data.name);
          }
          
          // 设置选中的设备为null
          this.deviceInteractionState.selectedDevice = null;
          
          // 不触发click事件
          return;
        }
        
        // 非复位操作的正常点击处理
        this.handleSingleRackViewClick(data);
      } else if (this.sceneState.currentView === 'single-device') {
        this.handleSingleDeviceViewClick(data);
      } else {
        // 主视图点击处理
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
      // 检查是否为网元设备
      const isNetworkElement = data.name && data.name.startsWith('NE_');
      
      // 如果是网元设备，执行设备弹出动画
      if (isNetworkElement) {
        console.log('单机架视图中点击网元设备，执行弹出动画:', data.name);
        // 如果当前是侧面视图，则先切换到正面视图
        if (!this.sceneState.isFrontView) {
          console.log('单机架视图中点击，切换到正面视图');
          this.switchToFrontView();
        }
        this.animateDevice(data.name);
      } else if (data.type === 'device') {
        // 其他普通设备，只输出日志不执行弹出
        console.log('单机架视图中点击普通设备，不执行弹出:', data.name);
        // 如果当前是侧面视图，则切换到正面视图
        if (!this.sceneState.isFrontView) {
          this.switchToFrontView();
        }
      } else {
        // 如果点击的是机架本身或其他非设备对象，不做特殊处理
        console.log('单机架视图中点击非设备对象:', data.name);
        // 如果当前是侧面视图，则切换到正面视图
        if (!this.sceneState.isFrontView) {
          console.log('单机架视图中点击，切换到正面视图');
          this.switchToFrontView();
        }
      }
    },
    
    // 单设备视图中的点击处理
    handleSingleDeviceViewClick(data) {
      console.log('单设备视图中点击:', data.name, data.type);
      // 在单设备视图中可以实现其他交互，如部件动画等
    },
    
    // 切换到正面视图
    switchToFrontView() {
      console.log('切换到正面视图');
      
      if (!this.sceneState.singleRackOrigin) {
        console.error('单机架场景原点不存在，无法旋转');
        return false;
      }
      
      if (this.sceneState.isFrontView) {
        console.log('已经是正面视图，不需要切换');
        return false;
      }
      
      // 将机架旋转到正面（0度）
      this.animateRackRotation(Math.PI/2);
      this.sceneState.isFrontView = true;
      
      return true;
    },
    
    // 机架旋转动画
    animateRackRotation(targetRotation) {
      if (!this.sceneState.singleRackOrigin) {
        console.error('单机架场景原点不存在，无法执行旋转动画');
        return;
      }
      
      const origin = this.sceneState.singleRackOrigin;
      const startRotation = origin.rotation.y;
      const duration = 1000; // 旋转动画持续时间，单位毫秒
      const startTime = Date.now();
      
      // 定义动画函数
      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1); // 0到1之间的进度值
        
        // 使用缓动函数使动画更加平滑
        const easedProgress = this.easeInOutCubic(progress);
        
        // 计算当前旋转角度
        const currentRotation = startRotation + (targetRotation - startRotation) * easedProgress;
        
        // 应用旋转
        origin.rotation.y = currentRotation;
        
        // 强制渲染
        if (this.$refs.baseScene && this.$refs.baseScene.renderer) {
          this.$refs.baseScene.renderer.render(
            this.$refs.baseScene.scene,
            this.$refs.baseScene.camera
          );
        }
        
        // 如果动画未完成，继续
        if (progress < 1) {
          window.requestAnimationFrame(animate);
        } else {
          console.log('机架旋转动画完成');
        }
      };
      
      // 启动动画
      window.requestAnimationFrame(animate);
    },
    
    // 缓动函数 - 三次方缓入缓出
    easeInOutCubic(t) {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    
    // 缓动函数 - 三次方缓出
    easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    },
    
    // 处理场景就绪事件
    handleSceneReady(data) {
      // 转发事件到父组件
      this.$emit('scene-ready', data);
    },
    
    // 高亮对象 - 覆盖基础组件方法
    highlightObject(object) {
      // 确保colorMap存在
      if (!this.deviceInteractionState.colorMap) {
        this.deviceInteractionState.colorMap = createColorMap();
      }
      
      // 保存原始颜色
      saveOriginalColor(object, this.deviceInteractionState.colorMap);
      
      // 根据对象类型应用高亮颜色
      if (isDevice(object)) {
        // 设备高亮使用特定颜色
        const deviceType = object.userData.type || "unknown";
        //setDeviceHighlight(object, deviceType);
        //setDeviceOutlineHighlight(object, deviceType);
        
        // 设置当前悬停的设备
        this.deviceInteractionState.hoveredDevice = {
          name: object.name,
          object: object
        };
      } 
      else if (object.name.includes('rack')) {
        // 机架使用不同的高亮颜色
        // setHighlightColor(object, HIGHLIGHT_COLORS.RACK, this.deviceInteractionState.colorMap);
      } 
      else {
        // 其他对象使用通用高亮颜色
        // setHighlightColor(object, HIGHLIGHT_COLORS.DEFAULT, this.deviceInteractionState.colorMap);
        console.log('暂时不处理高亮')
      }
    },
    
    // 重置高亮 - 覆盖基础组件方法
    resetHighlight(object) {
      // 确保colorMap存在
      if (!this.deviceInteractionState.colorMap) {
        this.deviceInteractionState.colorMap = createColorMap();
      }
      
      // 恢复原始颜色
      restoreOriginalColor(object, this.deviceInteractionState.colorMap);
      
      // 如果是当前悬停的设备，重置状态
      if (this.deviceInteractionState.hoveredDevice && 
          this.deviceInteractionState.hoveredDevice.object === object) {
        this.deviceInteractionState.hoveredDevice = null;
      }
    },
    
    // 仅高亮网络设备
    highlightNetworkElementOnly(object) {
      // 确保colorMap存在
      if (!this.deviceInteractionState.colorMap) {
        this.deviceInteractionState.colorMap = createColorMap();
      }
      
      // 保存原始颜色
      saveOriginalColor(object, this.deviceInteractionState.colorMap);
      
      // 设置网络设备特定的高亮颜色
      setHighlightColor(object, HIGHLIGHT_COLORS.NETWORK, this.deviceInteractionState.colorMap);
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
    resetDeviceView() {
    // 构建上下文对象
    const context = {
      scene: this.$refs.baseScene.scene,
      camera: this.$refs.baseScene.camera,
      renderer: this.$refs.baseScene.renderer,
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
    
    // 调用composable中的实现
    return this.destroySingleDeviceScene(context);
    },
    
    // 加载模型辅助方法
    loadModel() {
      return new Promise((resolve, reject) => {
        if (!this.modelPath) {
          reject(new Error('模型路径未定义'));
          return;
        }
        
        // 使用GLTFLoader加载模型
        const loader = new GLTFLoader();
        
        loader.load(
          this.modelPath,
          (gltf) => {
            const model = gltf.scene;
            resolve(model);
          },
          (xhr) => {
            console.log('模型加载进度:', (xhr.loaded / xhr.total) * 100 + '%');
          },
          (error) => {
            console.error('加载模型时出错:', error);
            reject(error);
          }
        );
      });
    },
    
    // 处理模型辅助方法
    processModel(model) {
      if (!model) {
        console.error('模型对象为空');
        return;
      }
      
      model.traverse((child) => {
        // 确保所有对象可见
        if (child.isMesh || child.isGroup) {
          child.visible = true;
        }
        
        // 使用设备工具函数
        if (isDevice(child)) {
          console.log('标记为设备:', child.name);
          setupDeviceProperties(child);
          
          // 兼容旧代码，确保NE_开头的设备类型正确
          if (isNetworkElement(child.name) && (!child.userData.type || child.userData.type === 'device')) {
            child.userData.type = DEVICE_TYPES.NE;
          }
        } else if (child.name.toLowerCase().includes('rack')) {
          // 机架对象
          child.userData.isInteractive = true;
          child.userData.type = DEVICE_TYPES.RACK;
        }
      });
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
    
    // 重置相机辅助方法
    resetCamera(camera, controls, model) {
      // 计算边界框
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // 找到最大尺寸
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const cameraDistance = maxDim / (2 * Math.tan(fov / 2)) * 1.5;
      
      // 设置相机位置
      camera.position.set(
        center.x,
        center.y + cameraDistance * 0.5,
        center.z + cameraDistance
      );
      
      // 设置控制器目标
      controls.target.set(center.x, center.y, center.z);
      controls.update();
      
      console.log('相机位置已重置');
    },
    
    // 判断一个对象是否是另一个对象的子对象
    isChildOfObject(child, parent) {
      let current = child.parent;
      while (current) {
        if (current === parent) {
          return true;
        }
        current = current.parent;
      }
      return false;
    },
    
    // 聚焦到机架
    focusOnRack(rackName) {
      const rack = this.getObjectByName(rackName);
      if (!rack || !this.$refs.baseScene.camera || !this.$refs.baseScene.controls) {
        console.error('聚焦到机架失败:', rackName);
        return false;
      }
      
      console.log('聚焦到机架:', rackName);
      
      try {
        // 计算机架的边界框
        const box = markRaw(new THREE.Box3().setFromObject(rack));
        const center = markRaw(box.getCenter(new THREE.Vector3()));
        const size = markRaw(box.getSize(new THREE.Vector3()));
        
        console.log('机架尺寸:', size, '中心点:', center);
        
        // 检查边界框是否有效
        if (size.length() === 0 || !isFinite(center.x) || !isFinite(center.y) || !isFinite(center.z)) {
          console.error('机架边界框无效');
          
          // 使用备用方法：直接基于机架位置设置相机
          const fallbackPosition = new THREE.Vector3(
            rack.position.x,
            rack.position.y + 1,
            rack.position.z + 3
          );
          
          console.log('使用备用相机位置:', fallbackPosition);
          
          // 简单地将相机移到机架前方
          this.$refs.baseScene.camera.position.copy(fallbackPosition);
          this.$refs.baseScene.controls.target.set(rack.position.x, rack.position.y, rack.position.z);
          this.$refs.baseScene.controls.update();
          
          return true;
        }
        
        // 计算适合的相机位置
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.$refs.baseScene.camera.fov * (Math.PI / 180);
        let cameraDistance = maxDim / Math.tan(fov / 2);
        
        // 添加一些边距
        cameraDistance *= 2.0; // 增加边距，确保视图更清晰
        
        // 创建目标相机位置（多个视角选项）
        let targetPosition;
        
        // 使用前视图（默认）
        targetPosition = markRaw(new THREE.Vector3(
          center.x,
          center.y + size.y * 0.3 - 0.2, // 减去0.2以匹配机架的上移
          center.z + cameraDistance
        ));
        
        console.log('设置相机位置到:', targetPosition);
        
        // 立即设置相机位置（为了调试）
        this.$refs.baseScene.camera.position.copy(targetPosition);
        // 调整目标点，考虑机架上移因素
        const adjustedCenter = center.clone();
        adjustedCenter.y -= 0.2; // 匹配机架上移
        this.$refs.baseScene.controls.target.copy(adjustedCenter);
        this.$refs.baseScene.controls.update();
        
        // 还需要动画？可以取消下面的注释
        // this.animateCameraToPosition(targetPosition, center);
      } catch(error) {
        console.error('聚焦机架时出错:', error);
        
        // 备用方案：重置相机到默认位置
        this.$refs.baseScene.camera.position.set(0, 2, 5);
        this.$refs.baseScene.controls.target.set(0, 0, 0);
        this.$refs.baseScene.controls.update();
      }
      
      // 计算机架的边界框
      const box = markRaw(new THREE.Box3().setFromObject(rack));
      const center = markRaw(box.getCenter(new THREE.Vector3()));
      const size = markRaw(box.getSize(new THREE.Vector3()));
      
      // 计算适合的相机位置
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.$refs.baseScene.camera.fov * (Math.PI / 180);
      let cameraDistance = maxDim / Math.tan(fov / 2);
      
      // 添加一些边距
      cameraDistance *= 1.8;
      
      // 创建目标相机位置（正面视角）
      const targetPosition = markRaw(new THREE.Vector3(
        center.x,
        center.y + size.y * 0.2 - 0.2, // 减去0.2以匹配机架的上移
        center.z + cameraDistance
      ));
      
      // 动画过渡到新的相机位置
      this.animateCameraToPosition(targetPosition, center.clone().add(new THREE.Vector3(0, -0.2, 0)));
      
      return true;
    },
    
    // 聚焦到设备
    focusOnDevice(deviceName) {
      const device = this.getObjectByName(deviceName);
      if (!device) return false;
      
      console.log('聚焦到设备:', deviceName);
      
      // 获取基础场景引用
      const baseScene = this.$refs.baseScene;
      if (!baseScene || !baseScene.camera || !baseScene.controls) return false;
      
      // 设置设备为选中状态
      this.deviceInteractionState.selectedDevice = deviceName;
      
      // 创建设备的边界框
      const box = markRaw(new THREE.Box3().setFromObject(device));
      const center = markRaw(box.getCenter(new THREE.Vector3()));
      const size = markRaw(box.getSize(new THREE.Vector3()));
      
      // 计算适合的相机位置
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = baseScene.camera.fov * (Math.PI / 180);
      let cameraDistance = maxDim / (Math.tan(fov / 2));
      
      // 添加一些边距
      cameraDistance *= 2.5;
      
      // 创建目标相机位置 - 根据设备类型调整视角
      // 尝试从设备名称识别设备类型
      const isServer = deviceName.includes('server');
      const isSwitch = deviceName.includes('switch') || deviceName.includes('router');
      
      let targetPosition;
      
      if (isServer) {
        // 服务器通常需要从侧面观察
        targetPosition = markRaw(new THREE.Vector3(
          center.x - cameraDistance * 0.7,
          center.y + cameraDistance * 0.3,
          center.z + cameraDistance * 0.6
        ));
      } else if (isSwitch) {
        // 交换机通常需要从正面观察
        targetPosition = markRaw(new THREE.Vector3(
          center.x,
          center.y + cameraDistance * 0.2,
          center.z + cameraDistance * 0.9
        ));
      } else {
        // 默认观察角度
        targetPosition = markRaw(new THREE.Vector3(
          center.x - cameraDistance * 0.5,
          center.y + cameraDistance * 0.3,
          center.z + cameraDistance * 0.8
        ));
      }
      
      // 动画过渡到新的相机位置
      this.animateCameraToPosition(targetPosition, center);
      
      return true;
    },
    
    // 动画过渡相机位置
    animateCameraToPosition(targetPosition, targetTarget) {
      const camera = this.$refs.baseScene.camera;
      const controls = this.$refs.baseScene.controls;
      
      if (!camera || !controls) return;
      
      // 保存当前状态
      this.animationState.startPosition = camera.position.clone();
      this.animationState.targetPosition = targetPosition.clone();
      this.animationState.startTarget = controls.target.clone();
      this.animationState.targetTarget = targetTarget.clone();
      this.animationState.startTime = Date.now();
      this.animationState.duration = 1000; // 1秒动画
      this.animationState.isAnimating = true;
      
      // 定义动画函数
      const animate = () => {
        if (!this.animationState.isAnimating) return;
        
        const now = Date.now();
        const elapsed = now - this.animationState.startTime;
        let progress = Math.min(elapsed / this.animationState.duration, 1);
        
        // 使用缓动函数使动画更平滑
        progress = this.easeInOutCubic(progress);
        
        // 计算当前位置
        const currentPosition = new THREE.Vector3(
          this.animationState.startPosition.x + (this.animationState.targetPosition.x - this.animationState.startPosition.x) * progress,
          this.animationState.startPosition.y + (this.animationState.targetPosition.y - this.animationState.startPosition.y) * progress,
          this.animationState.startPosition.z + (this.animationState.targetPosition.z - this.animationState.startPosition.z) * progress
        );
        
        // 计算当前目标点
        const currentTarget = new THREE.Vector3(
          this.animationState.startTarget.x + (this.animationState.targetTarget.x - this.animationState.startTarget.x) * progress,
          this.animationState.startTarget.y + (this.animationState.targetTarget.y - this.animationState.startTarget.y) * progress,
          this.animationState.startTarget.z + (this.animationState.targetTarget.z - this.animationState.startTarget.z) * progress
        );
        
        // 更新相机位置和控制器目标
        camera.position.copy(currentPosition);
        controls.target.copy(currentTarget);
        controls.update();
        
        // 如果动画未完成，继续请求下一帧
        if (progress < 1) {
          window.animationFrameId = requestAnimationFrame(animate);
        } else {
          // 动画完成
          this.animationState.isAnimating = false;
        }
      };
      
      // 开始动画
      if (window.animationFrameId) {
        cancelAnimationFrame(window.animationFrameId);
      }
      window.animationFrameId = requestAnimationFrame(animate);
    },
    
    // 设备动画方法 - 对外暴露的接口
    animateDevice(deviceName) {
      console.log('执行设备弹出动画:', deviceName);
      
      // 查找设备对象
      const deviceObj = this.findDeviceByName(deviceName);
      if (!deviceObj) {
        console.error('设备对象未找到:', deviceName);
        return false;
      }
      
      // 获取设备ID
      const deviceId = deviceObj.userData.originalDevice || deviceObj.name;
      
      // 查找同一设备ID下的所有部件
      let deviceParts = [];
      const targetScene = this.$refs.baseScene.scene;
      
      // 收集同一设备的所有部件
      targetScene.traverse((obj) => {
        if (obj.isMesh && (
          obj === deviceObj || 
          (obj.userData && obj.userData.originalDevice === deviceId) ||
          (deviceObj.name.startsWith('NE_') && obj.name.includes(deviceObj.name.split('_')[2]))
        )) {
          deviceParts.push(obj);
        }
      });
      
      // 如果没有找到其他部件，就使用当前对象
      if (deviceParts.length === 0) {
        deviceParts = [deviceObj];
      }
      
      console.log(`找到设备 ${deviceId} 的 ${deviceParts.length} 个部件`);
      
      // 获取当前状态
      const currentlySelectedDeviceObj = this.deviceInteractionState.selectedDevice;
      const currentlySelectedParts = this.deviceInteractionState.deviceParts;
      const currentStage = this.deviceInteractionState.interactionStage;
      const isClickingSameDevice = currentlySelectedDeviceObj && 
                                  (currentlySelectedDeviceObj === deviceObj || 
                                   currentlySelectedDeviceObj.name === deviceObj.name);
      
      console.log('当前交互状态:', {
        当前选中设备: currentlySelectedDeviceObj ? currentlySelectedDeviceObj.name : 'null',
        当前交互阶段: currentStage,
        是否点击同一设备: isClickingSameDevice
      });
      
      if (isClickingSameDevice && currentStage === 1) {
        // 点击同一设备且处于弹出状态：复位并清除状态
        console.log('点击同一设备，执行复位');
        this.resetDeviceAnimation(currentlySelectedDeviceObj, currentlySelectedParts);
        
        // 清除全局状态
        this.deviceInteractionState.selectedDevice = null;
        this.deviceInteractionState.deviceParts = [];
        this.deviceInteractionState.interactionStage = 0;
        
        return true;
        } else {
        // 点击新设备或首次点击任何设备
        
        // 1. 复位之前的设备动画（如果有）
        if (currentlySelectedDeviceObj && !isClickingSameDevice) {
          console.log('先复位之前的设备:', currentlySelectedDeviceObj.name);
          this.resetDeviceAnimation(currentlySelectedDeviceObj, currentlySelectedParts);
        }
        
        // 2. 立即更新新设备的全局状态
        this.deviceInteractionState.selectedDevice = deviceObj;
        this.deviceInteractionState.deviceParts = deviceParts;
        
        // 3. 存储新设备的原始变换（在动画之前）
        deviceParts.forEach(part => {
          if (!part.userData.originalPosition) {
            part.userData.originalPosition = part.position.clone();
          }
        });
        
        this.deviceInteractionState.interactionStage = 1;  // 设置状态为阶段1
        
        // 4. 执行新设备的弹出动画
        console.log('执行新设备的弹出动画');
        this.animateDeviceStage1(deviceObj, deviceParts);
        
        return true;
      }
    },
    
    // 设备弹出动画第一阶段 - 向前弹出
    animateDeviceStage1(deviceObj, partsToAnimate) {
      // 使用传入的部件或回退
      const deviceParts = partsToAnimate || [deviceObj];
      if (!deviceParts || deviceParts.length === 0) {
        console.error("animateDeviceStage1: 没有可以动画的部件");
        return;
      }
      
      console.log(`开始执行设备弹出动画，有 ${deviceParts.length} 个部件需要处理`);
      
      // 确定设备的弹出方向 - 向前弹出 (Z轴正方向，即从屏幕向用户方向)
      const isNetworkElement = deviceObj.name && deviceObj.name.startsWith('NE_');
      const moveDistance = isNetworkElement ? 0.30 : 0.1; // 调整为更短的弹出距离
      const duration = 500;     // 动画持续时间(毫秒)
      const startTime = Date.now();
      
      // 对每个部件应用高亮效果
      deviceParts.forEach(part => {
        if (part.material) {
          if (Array.isArray(part.material)) {
            part.material.forEach(mat => {
              if (mat.color) {
                // 记录原始颜色
                if (!part.userData._originalColor) {
                  part.userData._originalColor = mat.color.clone();
                }
                // 应用高亮颜色 - 淡蓝色
                mat.color.setRGB(0.4, 0.8, 1.0);
                // 如果材质支持发光效果
                if (mat.emissive) {
                  mat.emissive.setRGB(0.1, 0.2, 0.3);
                }
              }
            });
          } else if (part.material.color) {
            // 记录原始颜色
            if (!part.userData._originalColor) {
              part.userData._originalColor = part.material.color.clone();
            }
            // 应用高亮颜色 - 淡蓝色
            part.material.color.setRGB(0.4, 0.8, 1.0);
            // 如果材质支持发光效果
            if (part.material.emissive) {
              part.material.emissive.setRGB(0.1, 0.2, 0.3);
            }
          }
        }
      });
      
      // 存储动画开始时的位置
      const startPositions = deviceParts.map(part => part.position.clone());
      
      // 存储每个部件的原始位置
      deviceParts.forEach(part => {
        if (!part.userData.originalPosition) {
          part.userData.originalPosition = part.position.clone();
        }
      });
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = this.easeOutCubic(progress);
        
        deviceParts.forEach((part, index) => {
          const originalPosition = part.userData.originalPosition; // 设备在机架内的原始位置
          const startPosition = startPositions[index]; // 动画开始时的位置
          
          if (!originalPosition || !startPosition) {
            console.warn("缺少部件的原始位置或起始位置:", part.name);
            return;
          }
          
          // 向前弹出 - 使用Z轴正方向 (从屏幕向用户方向)
          const targetZ = originalPosition.z + moveDistance; // 目标Z轴位置
          
          // 使用lerp平滑插值Z轴
          part.position.z = startPosition.z + (targetZ - startPosition.z) * easeProgress;
          
          // 确保X和Y轴保持在原始位置
          part.position.x = originalPosition.x;
          part.position.y = originalPosition.y;
        });
        
        // 强制渲染
        if (this.$refs.baseScene && this.$refs.baseScene.renderer) {
          this.$refs.baseScene.renderer.render(
            this.$refs.baseScene.scene,
            this.$refs.baseScene.camera
          );
        }
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
    },
    
    // 重置设备动画 - 恢复到原始位置
    resetDeviceAnimation(deviceObj, deviceParts) {
      console.log('重置设备动画:', deviceObj ? deviceObj.name : '无');
      
      if (!deviceParts || deviceParts.length === 0) {
        return;
      }
      
      const duration = 400;     // 复位动画持续时间(毫秒)
      const startTime = Date.now();
      
      // 存储动画开始时的位置
      const startPositions = deviceParts.map(part => part.position.clone());
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = this.easeInOutCubic(progress);
        
        deviceParts.forEach((part, index) => {
          const originalPosition = part.userData.originalPosition; // 原始位置
          const startPosition = startPositions[index]; // 动画开始时的位置
          
          if (!originalPosition || !startPosition) {
            return;
          }
          
          // 计算当前位置 - 平滑过渡回原始位置
          const currentX = startPosition.x + (originalPosition.x - startPosition.x) * easeProgress;
          const currentY = startPosition.y + (originalPosition.y - startPosition.y) * easeProgress;
          const currentZ = startPosition.z + (originalPosition.z - startPosition.z) * easeProgress;
          
          // 应用位置
          part.position.set(currentX, currentY, currentZ);
          
          // 恢复原始颜色
          if (part.material && part.userData._originalColor) {
            if (Array.isArray(part.material)) {
              part.material.forEach(mat => {
                if (mat.color) {
                  mat.color.copy(part.userData._originalColor);
                  if (mat.emissive) {
                    mat.emissive.setRGB(0, 0, 0);
                  }
                }
              });
            } else if (part.material.color) {
              part.material.color.copy(part.userData._originalColor);
              if (part.material.emissive) {
                part.material.emissive.setRGB(0, 0, 0);
              }
            }
          }
        });
        
        // 强制渲染
        if (this.$refs.baseScene && this.$refs.baseScene.renderer) {
          this.$refs.baseScene.renderer.render(
            this.$refs.baseScene.scene,
            this.$refs.baseScene.camera
          );
        }
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          console.log('设备动画复位完成');
        }
      };
      
      animate();
    },
    
    // 查找设备对象 - 增强版，支持通过子部件找到父级网元设备
    findDeviceByName(deviceName) {
      if (!this.$refs.baseScene || !this.$refs.baseScene.scene) {
        console.error('场景未初始化，无法查找设备');
        return null;
      }
      
      let foundDevice = null;
      
      // 尝试直接查找完整匹配
      this.$refs.baseScene.scene.traverse(object => {
        if (object.name === deviceName) {
          foundDevice = object;
        }
      });
      
      // 如果找到了，直接返回
      if (foundDevice) {
        console.log('直接找到设备:', foundDevice.name);
        return foundDevice;
      }
      
      // 如果未找到，可能是子部件名称，尝试查找父级网元设备
      // 先尝试查找精确匹配的子部件
      let foundChild = null;
      this.$refs.baseScene.scene.traverse(object => {
        if (object.name === deviceName) {
          foundChild = object;
        }
      });
      
      // 如果找到了子部件，向上查找其父级网元设备
      if (foundChild) {
        console.log('找到子部件:', foundChild.name, '开始查找父级网元设备');
        
        // 向上遍历查找父级，直到找到网元设备或达到根节点
        let currentParent = foundChild.parent;
        while (currentParent) {
          // 检查是否为网元设备
          if (currentParent.name && currentParent.name.startsWith('NE_')) {
            console.log('找到父级网元设备:', currentParent.name);
            return currentParent;
          }
          // 继续向上查找
          currentParent = currentParent.parent;
        }
        
        // 如果没有找到父级网元，返回子部件本身
        console.log('未找到父级网元设备，返回子部件:', foundChild.name);
        return foundChild;
      }
      
      // 如果上述方法都没找到，尝试寻找匹配的网元设备（部分匹配）
      if (deviceName.includes('Cube') || deviceName.includes('cube')) {
        console.log('尝试根据Cube部件名称查找相关网元设备');
        let networkElements = [];
        
        // 收集所有网元设备
        this.$refs.baseScene.scene.traverse(object => {
          if (object.name && object.name.startsWith('NE_')) {
            networkElements.push(object);
          }
        });
        
        // 尝试查找包含此Cube的网元设备
        for (const ne of networkElements) {
          let hasMatchingChild = false;
          ne.traverse(child => {
            if (child.name === deviceName) {
              hasMatchingChild = true;
            }
          });
          
          if (hasMatchingChild) {
            console.log('通过子部件查找到网元设备:', ne.name);
            return ne;
          }
        }
      }
      
      // 如果是点击了网元名称的部分匹配 (例如NE_Rack-01_east)
      if (deviceName.startsWith('NE_')) {
        const devicePrefix = deviceName.split('_').slice(0, 3).join('_'); // 例如 NE_Rack-01_east
        
        // 尝试查找以此前缀开头的网元设备
        let bestMatch = null;
        
        this.$refs.baseScene.scene.traverse(object => {
          if (object.name && object.name.startsWith(devicePrefix)) {
            // 如果还没有匹配或者当前对象的名称更长(更精确)
            if (!bestMatch || object.name.length > bestMatch.name.length) {
              bestMatch = object;
            }
          }
        });
        
        if (bestMatch) {
          console.log('通过前缀匹配找到网元设备:', bestMatch.name);
          return bestMatch;
        }
      }
      
      console.warn('无法找到设备:', deviceName);
      return null;
    },
    
    // 获取对象通过名称
    getObjectByName(name) {
      if (!this.$refs.baseScene || !this.$refs.baseScene.model) {
        return null;
      }
      return this.$refs.baseScene.model.getObjectByName(name);
    },
    
    isDevice(object) {
      // 直接使用工具函数，不再需要包装方法
      return isDevice(object);
    },
    
    // 从名称中提取设备细节
    extractDeviceDetails(name) {
      // 实现从名称中提取设备细节的逻辑
      // 这里可以根据你的命名规则来实现
      // 例如：从NE_Rack-02_east_AT-106_NPT1250_1中提取设备型号AT-106和NPT1250
      if (name.includes('_')) {
        const parts = name.split('_');
        // 检查是否包含常见设备型号前缀
        const modelPrefixes = ['AT-', 'NPT', 'SW-', 'RT-', 'SRV'];
        const model = parts.find(part => modelPrefixes.some(prefix => part.startsWith(prefix)));
        if (model) {
          const position = parts.find(part => part.includes('-'));
          if (position) {
            return {
              model: model,
              position: position
            };
          }
        }
      }
      return null;
    },
    
    // 辅助方法：在场景中查找指定名称的对象
    findObjectByName(name) {
      if (!this.scene) return null;
      
      console.log(`[查找对象] 开始查找名称为 ${name} 的对象`);
      let result = null;
      
      // 首先尝试在单机架容器中查找
      if (this.sceneContainer) {
        console.log(`[查找对象] 在单机架容器中查找`);
        
        // 直接查找对象
        result = this.sceneContainer.getObjectByName(name);
        if (result) {
          console.log(`[查找对象] 直接匹配成功`);
          return result;
        }
        
        // 如果直接查找不到，递归遍历查找
        this.sceneContainer.traverse((obj) => {
          if (obj.name === name) {
            console.log(`[查找对象] 通过遍历找到匹配对象: ${obj.name}`);
            result = obj;
          }
        });
        
        if (result) return result;
        
        // 如果还是找不到，尝试模糊匹配（可能名称有缺少或额外的前缀）
        console.log(`[查找对象] 尝试模糊匹配`);
        
        // 获取不带前缀的名称部分
        const simpleName = name.replace(/^.*?_/, '').trim();
        if (simpleName && simpleName !== name) {
          console.log(`[查找对象] 使用简化名称查找: ${simpleName}`);
          
          this.sceneContainer.traverse((obj) => {
            if (obj.name && obj.name.includes(simpleName)) {
              console.log(`[查找对象] 通过简化名称找到匹配对象: ${obj.name}`);
              if (!result) result = obj;
            }
          });
        }
        
        if (result) return result;
      }
      
      // 如果在单机架容器中没找到，尝试在整个场景中查找
      console.log(`[查找对象] 在整个场景中查找`);
      result = this.scene.getObjectByName(name);
      
      if (!result) {
        console.log(`[查找对象] 未找到名称为 ${name} 的对象`);
      }
      
      return result;
    },
    
    // 清除场景中所有对象的高亮效果
    clearHighlights() {
      // 根据当前视图选择合适的场景
      const targetScene = (this.currentView === 'single-rack') ? 
        this.$refs.baseScene.scene : this.$refs.baseScene.scene;
      
      targetScene.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          // 恢复原始颜色
          if (obj.userData._highlightOriginalColor) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(mat => {
                if (mat.color) {
                  mat.color.copy(obj.userData._highlightOriginalColor);
                }
              });
            } else if (obj.material.color) {
              obj.material.color.copy(obj.userData._highlightOriginalColor);
            }
            delete obj.userData._highlightOriginalColor;
          }
        }
      });
    },
    
    // 直接处理鼠标移动事件，基于旧版本的onModelHover方法
    // onDirectMouseMove(event) {
    //   // 计算鼠标在容器中的相对位置
    //   if (!this.hoverState.container || !this.scene) return;
      
    //   const rect = this.hoverState.container.getBoundingClientRect();
      
    //   // 归一化坐标 (-1 到 1)
    //   this.hoverState.mouse.x = ((event.clientX - rect.left) / this.hoverState.containerWidth) * 2 - 1;
    //   this.hoverState.mouse.y = -((event.clientY - rect.top) / this.hoverState.containerHeight) * 2 + 1;
      
    //   // 设置射线投射器的起点和方向
    //   this.hoverState.raycaster.setFromCamera(this.hoverState.mouse, this.camera);
      
    //   // 在检测前强制更新所有对象的世界矩阵，解决位置检测不准确的问题
    //   if (this.currentView === 'single-rack' && this.sceneContainer) {
    //     this.sceneContainer.updateMatrixWorld(true); // 递归更新所有子对象的世界矩阵
    //     console.log('[直接检测] 更新世界矩阵');
    //   }
      
    //   // 执行射线投射，获取所有相交的物体
    //   let intersects = this.hoverState.raycaster.intersectObjects(this.scene.children, true);
      
    //   // 调试信息
    //   console.log(`[直接检测] 射线检测到 ${intersects.length} 个相交对象`);
    //   if (intersects.length > 0) {
    //     console.log(`[直接检测] 第一个相交对象: ${intersects[0].object.name}`);
    //   }
      
    //   const previousHoveredObject = this.hoverState.hoveredObject;
    //   let currentHoveredObject = null;
    //   let tooltipContent = null;
    //   let tooltipPosition = { x: event.clientX, y: event.clientY };
      
    //   // 查找第一个可交互的物体
    //   for (let i = 0; i < intersects.length; i++) {
    //     const intersectedObject = intersects[i].object;
        
    //     // 查找当前物体或其父级是否为设备
    //     let currObj = intersectedObject;
    //     let foundDevice = null;
        
    //     // 向上查找设备对象
    //     const maxLevels = 10; // 限制向上查找的层级数以避免无限循环
    //     let level = 0;
        
    //     while (currObj && level < maxLevels) {
    //       // 使用工具函数判断是否是设备
    //       if (currObj.userData && (isDevice(currObj) || isNetworkElement(currObj))) {
    //         foundDevice = currObj;
    //         // 添加调试信息
    //         console.log(`[直接检测] 发现设备: ${currObj.name}，层级: ${level}，是网络设备: ${isNetworkElement(currObj)}, userData:`, JSON.stringify(currObj.userData));
    //         break;
    //       }
          
    //       // 检查该对象是否有特定标记表明它是可交互的
    //       if (currObj.userData && currObj.userData.isInteractive) {
    //         foundDevice = currObj;
    //         console.log(`[直接检测] 发现可交互对象: ${currObj.name}, userData:`, JSON.stringify(currObj.userData));
    //         break;
    //       }
          
    //       // 向上移动到父级
    //       currObj = currObj.parent;
    //       level++;
    //     }
        
    //     // 如果找到设备，则更新悬停状态
    //     if (foundDevice) {
    //       currentHoveredObject = foundDevice;
          
    //       // 格式化显示名称
    //       const displayName = formatDeviceName(foundDevice.name);
          
    //       // 获取或生成设备状态信息
    //       const deviceStatus = foundDevice.userData.status || '正常';
    //       const deviceTemp = foundDevice.userData.temperature || (20 + Math.floor(Math.random() * 15));
    //       const deviceLoad = foundDevice.userData.load || Math.floor(Math.random() * 100);
          
    //       // 根据设备类型构建不同的工具提示内容
    //       if (isNetworkElement(foundDevice)) {
    //         tooltipContent = {
    //           name: foundDevice.name,
    //           displayName: displayName,
    //           type: '网络设备',
    //           status: deviceStatus,
    //           temperature: deviceTemp,
    //           load: deviceLoad
    //         };
    //       } else if (isDevice(foundDevice)) {
    //         tooltipContent = {
    //           name: foundDevice.name,
    //           displayName: displayName,
    //           type: '服务器',
    //           status: deviceStatus,
    //           temperature: deviceTemp,
    //           cpuLoad: deviceLoad
    //         };
    //       } else {
    //         tooltipContent = {
    //           name: foundDevice.name,
    //           displayName: displayName,
    //           type: '其他设备',
    //           status: deviceStatus
    //         };
    //       }
          
    //       // 高亮显示当前对象
    //       this.highlightObject(foundDevice);
    //       break;
    //     }
    //   }
      
    //   // 如果没有找到可交互的物体，清除高亮
    //   if (!currentHoveredObject) {
    //     this.clearHighlights();
    //   }
      
    //   // 如果悬停物体发生变化，触发事件
    //   if (previousHoveredObject !== currentHoveredObject) {
    //     // 记录当前悬停的物体
    //     this.hoverState.hoveredObject = currentHoveredObject;
        
    //     // 更新工具提示状态
    //     this.hoverState.tooltipContent = tooltipContent;
    //     this.hoverState.tooltipPosition = tooltipPosition;
        
    //     // 触发事件
    //     if (tooltipContent) {
    //       console.log(`[直接检测] 发出悬停事件: ${tooltipContent.displayName}`);
    //       this.$emit('object-hover', {
    //         x: tooltipPosition.x,
    //         y: tooltipPosition.y,
    //         object: currentHoveredObject,
    //         tooltipContent: tooltipContent
    //       });
    //     } else {
    //       // 发出空悬停事件，隐藏工具提示
    //       this.$emit('object-hover', {
    //         x: tooltipPosition.x,
    //         y: tooltipPosition.y,
    //         object: null,
    //         tooltipContent: null
    //       });
    //     }
    //   }
    // },
    
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
      // 避免重复初始化
      //if (this.directEventState.initialized) {
        //return;
      //}
      
      // 确保容器元素存在
      //const container = document.getElementById('three-container');
      //if (!container) {
        //console.error('无法找到three-container元素，无法初始化直接事件处理');
        //return;
      //}
      
      //console.log('初始化直接事件处理系统');
      
      // 初始化射线和鼠标向量
      //this.directEventState.raycaster = new THREE.Raycaster();
      //this.directEventState.mouse = new THREE.Vector2();
      
      // 添加鼠标移动事件监听器
      //container.addEventListener('mousemove', this.onDirectMouseMove);
      
      // 标记为已初始化
      //this.directEventState.initialized = true;
      console.log('交互系统自动管理事件处理')
    },
    
    // 清理直接事件处理
    cleanupDirectEventHandling() {
      console.log('清理交互系统')
      //if (!this.directEventState.initialized) {
        //return;
      //}
      
      //console.log('清理直接事件处理系统');
      
      // 移除事件监听器
      //const container = document.getElementById('three-container');
      //if (container) {
        //container.removeEventListener('mousemove', this.onDirectMouseMove);
      //}
      
      // 重置事件状态
      //this.directEventState.initialized = false;
      //this.directEventState.hoveredObject = null;
      //this.directEventState.lastIntersection = null;
    },
    
    // 直接处理鼠标移动事件
    // _onDirectMouseMove(event) {
    //   if (!this.$refs.baseScene) return;
      
    //   const scene = this.$refs.baseScene.scene;
    //   const camera = this.$refs.baseScene.camera;
    //   if (!scene || !camera) return;
      
    //   // 更新鼠标位置
    //   this._updateMousePosition(event);
      
    //   // 更新射线发射器
    //   this.directEventState.raycaster.setFromCamera(this.directEventState.mouse, camera);
      
    //   // 强制更新矩阵，确保射线检测准确
    //   if (this.sceneState.currentView === 'single-rack' && this.sceneState.singleRackContainer) {
    //     this.sceneState.singleRackContainer.updateMatrixWorld(true);
    //   }
      
    //   // 执行射线检测
    //   const intersects = this.directEventState.raycaster.intersectObjects(scene.children, true);
    //   this.directEventState.lastIntersection = intersects;
      
    //   // 清除之前的高亮
    //   this._clearAllHighlights();
      
    //   // 根据当前视图选择处理方法
    //   if (this.sceneState.currentView === 'single-rack') {
    //     this._handleSingleRackHover(intersects, event);
    //   } else if (this.sceneState.currentView === 'single-device') {
    //     this._handleSingleDeviceHover(intersects, event);
    //   } else {
    //     this._handleMainViewHover(intersects, event);
    //   }
    // },
    
    // 辅助方法：更新鼠标位置
    _updateMousePosition(event) {
      const container = this.directEventState.container;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      this.directEventState.mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
      this.directEventState.mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
    },
    
    // 辅助方法：处理单机架视图的悬停
    _handleSingleRackHover(intersects, event) {
      if (intersects.length === 0) {
        // 没有相交对象，清除状态
        this._emitHoverEvent({ 
          x: event.clientX, 
          y: event.clientY, 
          objectFound: false 
        });
        return;
      }
      
      // 从相交点开始向上查找可交互对象
      const obj = intersects[0].object;
      let deviceObj = obj;
      let foundInteractive = false;
      
      // 向上查找可交互对象 - 采用老版本的稳定查找方式
      while (deviceObj) {
        if (deviceObj.userData && deviceObj.userData.isInteractive) {
          foundInteractive = true;
          console.log(`[单机架悬停] 找到可交互对象: ${deviceObj.name}`);
          
          // 确定设备类型并进行高亮
          if (this._isNetworkElement(deviceObj)) {
            this._highlightNetworkElement(deviceObj);
          } else {
            this._highlightDevice(deviceObj);
          }
          
          // 发送悬停事件
          this._emitHoverEvent({
            x: event.clientX,
            y: event.clientY,
            objectFound: true,
            objectName: deviceObj.name,
            objectType: deviceObj.userData.type || 'unknown'
          });
          
          // 更新悬停状态
          this.directEventState.hoveredObject = deviceObj;
          break;
        }
        
        // 继续向上查找
        if (!deviceObj.parent) break;
        deviceObj = deviceObj.parent;
      }
      
      // 如果没有找到可交互对象
      if (!foundInteractive) {
        this._emitHoverEvent({ 
          x: event.clientX, 
          y: event.clientY, 
          objectFound: false 
        });
        this.directEventState.hoveredObject = null;
      }
    },
    
    // 直接处理鼠标点击事件
    _onDirectMouseClick(event) {
      if (!this.$refs.baseScene) return;
      
      // 使用上次鼠标移动事件中的相交结果
      const intersects = this.directEventState.lastIntersection;
      if (!intersects || intersects.length === 0) return;
      
      // 根据当前视图处理点击
      if (this.sceneState.currentView === 'single-rack') {
        this._handleSingleRackClick(intersects, event);
      } else if (this.sceneState.currentView === 'single-device') {
        this._handleSingleDeviceClick(intersects, event);
      } else {
        this._handleMainViewClick(intersects, event);
      }
    },
    
    // 辅助方法：处理单机架视图中的点击
    _handleSingleRackClick(intersects) {
      const obj = intersects[0].object;
      let deviceObj = obj;
      
      // 查找可交互对象
      while (deviceObj) {
        if (deviceObj.userData && deviceObj.userData.isInteractive) {
          
          // 发送点击事件
          this.$emit('object-clicked', {
            name: deviceObj.name,
            type: deviceObj.userData.type || 'unknown',
            position: {
              x: intersects[0].point.x,
              y: intersects[0].point.y,
              z: intersects[0].point.z
            }
          });
          
          break;
        }
        
        if (!deviceObj.parent) break;
        deviceObj = deviceObj.parent;
      }
    },
    
    // 辅助方法：判断对象是否为网络元素
    _isNetworkElement(obj) {
      return (obj.userData && obj.userData.type === 'NE') || 
             (obj.name && obj.name.startsWith('NE_'));
    },
    
    // 辅助方法：高亮网络元素
    _highlightNetworkElement(obj) {
      const highlightColor = new THREE.Color(0x00ffff); // 青色
      const emissiveColor = new THREE.Color(0x003333); // 轻微发光效果
      
      obj.traverse((child) => {
        if (child.isMesh && child.material) {
          // 保存原始颜色
          if (!child.userData) child.userData = {};
          if (!child.userData._highlightOriginalColor && child.material.color) {
            child.userData._highlightOriginalColor = child.material.color.clone();
          }
          
          // 应用高亮
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              if (mat.color) {
                mat.color.copy(highlightColor);
                mat.emissive = emissiveColor;
                mat.opacity = 1.0;
                mat.transparent = true;
              }
            });
          } else if (child.material.color) {
            child.material.color.copy(highlightColor);
            child.material.emissive = emissiveColor;
            child.material.opacity = 1.0;
            child.material.transparent = true;
          }
        }
      });
    },
    
    // 辅助方法：高亮普通设备
    _highlightDevice(obj) {
      const highlightColor = new THREE.Color(0x66ccff); // 浅蓝色
      
      obj.traverse((child) => {
        if (child.isMesh && child.material) {
          // 保存原始颜色
          if (!child.userData) child.userData = {};
          if (!child.userData._highlightOriginalColor && child.material.color) {
            child.userData._highlightOriginalColor = child.material.color.clone();
          }
          
          // 应用高亮
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              if (mat.color) {
                mat.color.copy(highlightColor);
              }
            });
          } else if (child.material.color) {
            child.material.color.copy(highlightColor);
          }
        }
      });
    },
    
    // 辅助方法：清除所有高亮
    _clearAllHighlights() {
      const scene = this.$refs.baseScene.scene;
      if (!scene) return;
      
      scene.traverse((obj) => {
        if (obj.isMesh && obj.material && obj.userData && obj.userData._highlightOriginalColor) {
          // 恢复原始颜色
          if (Array.isArray(obj.material)) {
            obj.material.forEach(mat => {
              if (mat.color) {
                mat.color.copy(obj.userData._highlightOriginalColor);
                if (mat.emissive) mat.emissive.set(0, 0, 0);
              }
            });
          } else if (obj.material.color) {
            obj.material.color.copy(obj.userData._highlightOriginalColor);
            if (obj.material.emissive) obj.material.emissive.set(0, 0, 0);
          }
          
          // 清除保存的原始颜色
          delete obj.userData._highlightOriginalColor;
        }
      });
    },
    
    // 辅助方法：发送悬停事件
    _emitHoverEvent(data) {
      this.$emit('object-hover', data);
    },
    
    // 处理主视图悬停 - 暂时保持简单实现
    _handleMainViewHover(intersects, event) {
      // 直接传递事件数据
      if (intersects.length === 0) {
        this._emitHoverEvent({ 
          x: event.clientX, 
          y: event.clientY, 
          objectFound: false 
        });
        return;
      }
      
      // 简单实现，使用第一个相交对象
      const obj = intersects[0].object;
      this._emitHoverEvent({ 
        x: event.clientX, 
        y: event.clientY, 
        objectFound: true,
        objectName: obj.name,
        objectType: obj.userData && obj.userData.type ? obj.userData.type : 'unknown'
      });
    },
    
    // 处理单设备视图悬停 - 暂时保持简单实现
    _handleSingleDeviceHover(intersects, event) {
      // 直接使用主视图相同的处理方式
      this._handleMainViewHover(intersects, event);
    },
    
    // 处理主视图点击 - 暂时保持简单实现
    _handleMainViewClick(intersects) {
      if (intersects.length === 0) return;
      
      // 简单实现，使用第一个相交对象
      const obj = intersects[0].object;
      this.$emit('object-clicked', {
        name: obj.name,
        type: obj.userData && obj.userData.type ? obj.userData.type : 'unknown',
        position: {
          x: intersects[0].point.x,
          y: intersects[0].point.y,
          z: intersects[0].point.z
        }
      });
    },
    
    // 处理单设备视图点击 - 暂时保持简单实现
    _handleSingleDeviceClick(intersects, event) {
      // 直接使用主视图相同的处理方式
      this._handleMainViewClick(intersects, event);
    },
    
    /**
     * 处理直接悬停逻辑
     * @param {Array} intersects 射线检测的相交结果
     */
    _handleDirectHover(intersects) {
      // 重置之前的高亮
      if (this.directEventState.hoveredObject) {
        this.resetHighlight(this.directEventState.hoveredObject);
        this.directEventState.hoveredObject = null;
      }
      
      // 查找第一个可交互的对象
      const interactiveObject = this._findInteractiveObject(intersects);
      
      // 如果找到可交互对象
      if (interactiveObject) {
        // 高亮对象
        this.directEventState.hoveredObject = interactiveObject;
        
        // 根据对象类型进行高亮
        if (this._isDeviceOrRack(interactiveObject)) {
          this.highlightObject(interactiveObject);
        } else if (this.isRackNetworkElement(interactiveObject) && this.currentView === 'single-rack') {
          this.highlightNetworkElementOnly(interactiveObject);
        }
        
        // 发送悬停事件
        this.$emit('object-hover', {
          object: interactiveObject,
          point: intersects[0].point,
          view: this.currentView
        });
      }
    },
    
    /**
     * 查找第一个可交互的对象
     * @param {Array} intersects 射线检测的相交结果
     * @returns {Object|null} 找到的可交互对象或null
     */
    _findInteractiveObject(intersects) {
      // 如果没有相交结果，返回null
      if (!intersects || intersects.length === 0) {
        return null;
      }
      
      // 按照距离排序
      const sortedIntersects = [...intersects].sort((a, b) => a.distance - b.distance);
      
      // 查找第一个可交互对象
      for (const intersection of sortedIntersects) {
        let obj = intersection.object;
        
        // 向上遍历父级，查找可交互对象
        while (obj) {
          // 检查是否为设备或机柜
          if (this._isDeviceOrRack(obj)) {
            return obj;
          }
          
          // 检查是否为网络元素
          if (this.isRackNetworkElement(obj) && this.currentView === 'single-rack') {
            return obj;
          }
          
          // 查找父对象
          obj = obj.parent;
        }
      }
      
      return null;
    },
    
    /**
     * 判断对象是否为设备或机柜
     * @param {Object} object THREE.js对象
     * @returns {boolean} 是否为设备或机柜
     */
    _isDeviceOrRack(object) {
      if (!object) return false;
      
      // 检查对象名称
      const name = object.name || '';
      if (name.includes('rack') || name.includes('Rack')) {
        return true;
      }
      
      // 检查userData
      const userData = object.userData || {};
      if (userData.isDevice || userData.isRack) {
        return true;
      }
      
      // 使用现有的判断函数
      if (typeof this.isDevice === 'function' && this.isDevice(object)) {
        return true;
      }
      
      return false;
    },
    
    // 处理对象悬停事件
    handleObjectHover(data) {
      console.log(`[ServerRoomScene] 收到悬停事件，当前视图: ${this.currentView}`);
      
      // 清除之前的高亮，无论哪种视图
      if (this.deviceInteractionState.lastHighlightedObject) {
        this.resetHighlight(this.deviceInteractionState.lastHighlightedObject);
        this.deviceInteractionState.lastHighlightedObject = null;
      }
      
      // 在单机架视图中处理悬停
      if (this.currentView === 'single-rack') {
        // 检查是否有交互对象
        if (data && data.object) {
          console.log(`[ServerRoomScene] 单机架视图中悬停在对象: ${data.object.name}`);
          
          // 使用网络设备特有高亮效果 
          this.highlightNetworkElementOnly(data.object);
          
          // 记录最后高亮的对象
          this.deviceInteractionState.lastHighlightedObject = data.object;
        }
      }
      // 主视图中的悬停处理
      else if (this.currentView === 'main' && data && data.object) {
        console.log(`[ServerRoomScene] 主视图中悬停在对象: ${data.object.name}`);
        
        // 使用标准高亮处理
        // this.highlightObject(data.object);
        
        // 记录最后高亮的对象
        this.deviceInteractionState.lastHighlightedObject = data.object;
      }
      
      // 无论哪种视图，都发送悬停事件数据
      this.$emit('object-hover', data);
    },
    
    // 辅助方法：应用材质到克隆对象
    _applyMaterialsToClone(clone, original) {
      if (!clone || !original) return;
      
      // 处理当前对象的材质
      if (clone.material) {
        if (Array.isArray(clone.material)) {
          // 处理多材质数组
          clone.material = clone.material.map((mat) => {
            if (!mat) return null;
            const newMat = mat.clone();
            
            // 确保颜色不是黑色（这可能是默认值）
            if (newMat.color && newMat.color.r === 0 && newMat.color.g === 0 && newMat.color.b === 0) {
              newMat.color.setRGB(0.8, 0.8, 0.8);
            }
            
            // 确保半透明设置正确
            newMat.transparent = newMat.opacity < 1.0;
            
            return newMat;
          });
        } else if (clone.material) {
          // 处理单一材质
          const newMat = clone.material.clone();
          
          // 确保颜色不是黑色
          if (newMat.color && newMat.color.r === 0 && newMat.color.g === 0 && newMat.color.b === 0) {
            newMat.color.setRGB(0.8, 0.8, 0.8);
          }
          
          // 确保半透明设置正确
          newMat.transparent = newMat.opacity < 1.0;
          
          clone.material = newMat;
        }
      }
      
      // 设置交互标记
      if (!clone.userData) clone.userData = {};
      clone.userData.isInteractive = true;
      
      // 确定类型
      if (!clone.userData.type) {
        if (clone.name.includes('rack')) {
          clone.userData.type = 'rack';
        } else if (clone.name.startsWith('NE_')) {
          clone.userData.type = 'NE';
        } else if (isDevice(clone)) {
          clone.userData.type = 'device';
        }
      }
      
      // 递归处理子对象
      if (clone.children && clone.children.length > 0) {
        for (let i = 0; i < clone.children.length; i++) {
          const childClone = clone.children[i];
          const childOriginal = original.children[i];
          
          if (childClone && childOriginal) {
            this._applyMaterialsToClone(childClone, childOriginal);
          }
        }
      }
    },
    
    // 辅助方法：为机架视图设置相机位置
    _positionCameraForRackView() {
      if (!this.$refs.baseScene || !this.sceneState.singleRackScene) return;
      
      const camera = this.$refs.baseScene.camera;
      const controls = this.$refs.baseScene.controls;
      
      // 计算边界框，用于定位相机
      const box = new THREE.Box3().setFromObject(this.sceneState.singleRackScene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // 计算适当的相机距离
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const cameraDistance = (maxDim / 2) / Math.tan(fov / 2) * 1.2;
      
      // 设置相机位置 - 侧视角
      camera.position.set(
        center.x + cameraDistance * 0.5, 
        center.y + maxDim * 0.3,
        center.z + cameraDistance * 0.8
      );
      
      // 设置相机目标
      controls.target.set(
        center.x,
        center.y,
        center.z
      );
      
      // 更新控制器
      controls.update();
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
      const container = this.$refs.baseScene.$refs.container;
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