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
    @object-hover="handleObjectHover"
    @scene-ready="handleSceneReady"
    @model-loaded="handleModelLoaded"
    ref="baseScene"
  />
</template>

<script>
import BaseThreeScene from '@/components/three/BaseThreeScene.vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { markRaw } from 'vue';

export default {
  name: 'ServerRoomScene',
  components: {
    BaseThreeScene
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
  emits: ['object-clicked', 'object-hover', 'scene-ready', 'model-loaded', 'view-changed'],
  data() {
    return {
      deviceInteractionState: {
        selectedDevice: null,
        hoveredDevice: null,
        originalColors: new Map(), // 存储原始颜色
        originalPositions: new Map() // 存储原始位置
      },
      // 场景状态
      sceneState: {
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
      },
      // 动画状态
      animationState: {
        isAnimating: false,
        startTime: 0,
        duration: 1000,
        startPosition: null,
        targetPosition: null,
        startTarget: null,
        targetTarget: null
      },
      // 指针悬停处理
      pointer: { x: 0, y: 0 },
      width: 0,
      height: 0
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
            
            // 使用优化的判断函数
            if (this.isDevice(child)) {
              console.log('标记为网元设备:', child.name);
              child.userData.isInteractive = true;
              child.userData.type = 'server'; 
              
              // 可以进一步从名称中提取设备细节
              const deviceDetails = this.extractDeviceDetails(child.name);
              if (deviceDetails) {
                child.userData.model = deviceDetails.model;
                child.userData.position = deviceDetails.position;
                // 其他设备细节...
              }
            } else if (child.name.toLowerCase().includes('rack')) {
              // 通常机架主体是Group，但以防万一也检查Mesh
              child.userData.isInteractive = true;
              child.userData.type = 'rack';
              console.log(`设置交互标记 (Mesh): ${child.name} -> rack`);
            }
          }
          
          // --- 新增：检查 Group 对象 ---
          if (child.isGroup) {
             if (child.name.startsWith('NE_')) {
              // 如果设备本身是Group
              child.userData.isInteractive = true;
              child.userData.type = 'device';
              child.userData.category = this.getDeviceCategory(child.name);
              console.log(`设置交互标记 (Group): ${child.name} -> device`);
            } else if (child.name.toLowerCase().includes('rack')) {
              // 如果机架是Group
              child.userData.isInteractive = true;
              child.userData.type = 'rack';
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
      else if (data.type === 'device') {
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
    
    // 处理对象悬停事件
    handleObjectHover(hoverData) {
      // 在单机架视图中，不显示悬停提示
      if (this.sceneState.currentView === 'single-rack' && !this.sceneState.showTooltipInSingleRack) {
        // 清除之前的悬停对象
        this.deviceInteractionState.hoveredDevice = null;
        return;
      }
      
      // 获取当前悬停的对象
      const hoveredObject = hoverData.objectFound ? 
        { name: hoverData.objectName, type: hoverData.objectType } : null;
      
      // 更新悬停设备信息
      this.deviceInteractionState.hoveredDevice = hoveredObject;
      
      // 转发悬停事件到父组件
      this.$emit('object-hover', {
        ...hoverData,
        hoveredObject
      });
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
      if (!object.material) return;
      
      // 高亮设备对象
      if (object.userData.type === 'device') {
        this.deviceInteractionState.hoveredDevice = object.name;
        
        // 设置高亮颜色（浅蓝色）
        const highlightColor = markRaw(new THREE.Color(0x66ccff));
        
        if (Array.isArray(object.material)) {
          object.material.forEach(mat => {
            if (mat.color) {
              mat.color.set(highlightColor);
              mat.emissive = markRaw(new THREE.Color(0x112233));
            }
          });
        } else if (object.material.color) {
          object.material.color.set(highlightColor);
          object.material.emissive = markRaw(new THREE.Color(0x112233));
        }
      }
      
      // 高亮机架对象
      if (object.userData.type === 'rack') {
        // 设置高亮颜色（浅绿色）
        const highlightColor = markRaw(new THREE.Color(0x66ffcc));
        
        if (Array.isArray(object.material)) {
          object.material.forEach(mat => {
            if (mat.color) {
              mat.color.set(highlightColor);
            }
          });
        } else if (object.material.color) {
          object.material.color.set(highlightColor);
        }
      }
    },
    
    // 重置高亮 - 覆盖基础组件方法
    resetHighlight(object) {
      if (!object.material) return;
      
      // 重置设备对象颜色
      if (object.userData.type === 'device') {
        this.deviceInteractionState.hoveredDevice = null;
        
        if (Array.isArray(object.material)) {
          object.material.forEach((mat, index) => {
            const originalColor = this.deviceInteractionState.originalColors.get(`${object.id}_${index}`);
            if (mat.color && originalColor) {
              mat.color.copy(originalColor);
              mat.emissive = markRaw(new THREE.Color(0x000000));
            }
          });
        } else if (object.material.color) {
          const originalColor = this.deviceInteractionState.originalColors.get(object.id);
          if (originalColor) {
            object.material.color.copy(originalColor);
            object.material.emissive = markRaw(new THREE.Color(0x000000));
          }
        }
      }
      
      // 重置机架对象颜色
      if (object.userData.type === 'rack') {
        if (Array.isArray(object.material)) {
          object.material.forEach((mat, index) => {
            const originalColor = this.deviceInteractionState.originalColors.get(`${object.id}_${index}`);
            if (mat.color && originalColor) {
              mat.color.copy(originalColor);
            }
          });
        } else if (object.material.color) {
          const originalColor = this.deviceInteractionState.originalColors.get(object.id);
          if (originalColor) {
            object.material.color.copy(originalColor);
          }
        }
      }
    },
    
    // 创建单机架视图
    createSingleRackScene(rackData) {
      if (!this.$refs.baseScene || !this.$refs.baseScene.model) {
        console.error('缺少基础场景或模型引用');
        return false;
      }
      
      console.log('创建单机架视图，参数:', rackData);
      
      // 保存选中的机架信息
      this.sceneState.selectedRack = rackData;
      
      // 查找选中的机架对象
      const rackObject = this.getObjectByName(rackData.name);
      if (!rackObject) {
        console.error('找不到机架对象:', rackData.name);
        return false;
      }
      
      console.log('找到机架对象:', rackObject.name, '位置:', rackObject.position);
      
      // 记录当前的相机状态，以便之后返回
      if (!this.sceneState.originalCameraPosition) {
        this.sceneState.originalCameraPosition = this.$refs.baseScene.camera.position.clone();
        this.sceneState.originalControlsTarget = this.$refs.baseScene.controls.target.clone();
      }

      try {
        // 获取当前场景和相机引用
        const renderer = this.$refs.baseScene.renderer;
        const mainScene = this.$refs.baseScene.scene;
        const camera = this.$refs.baseScene.camera;
        const controls = this.$refs.baseScene.controls;
        
        // 提取机架名称，用于匹配相关设备
        let rackBaseName = '';
        if (rackData.name.includes('Rack-')) {
          rackBaseName = rackData.name.split('_')[0]; // 获取"Rack-XX"部分
          console.log('提取的机架基本名称:', rackBaseName);
        } else {
          // 如果没有标准命名，使用整个名称
          rackBaseName = rackData.name;
        }
        
        // 临时保存原始场景
        const originalModel = this.$refs.baseScene.model;
        
        // 创建新的场景
        // 注意：我们不完全创建新的THREE.Scene，而是清空并重用现有场景，保留相机和控制器
        const sceneChildren = [...mainScene.children];
        sceneChildren.forEach(child => {
          if (child !== this.$refs.baseScene.model && !child.isLight) {
            mainScene.remove(child);
          }
        });
        
        // 1. 清除原始模型，并创建一个新的场景容器
        mainScene.remove(originalModel);
        
        // 2. 创建新的场景容器
        const sceneContainer = new THREE.Group();
        mainScene.add(sceneContainer);
        
        // 3. 创建原点，用于放置机架和设备
        const origin = new THREE.Group();
        // 将整个机架组向上移动一点，避开底部黑色区域
        origin.position.y = -0.2; // 向上移动一小段距离
        sceneContainer.add(origin);
        
        // 4. 克隆机架并添加到新场景
        const rackClone = rackObject.clone(true);
        rackClone.position.set(0, 0, 0); // 重置位置到原点
        origin.add(rackClone);
        
        // 5. 确保机架材质正确
        rackClone.traverse((child) => {
          if (child.isMesh && child.material) {
            // 处理数组材质
            if (Array.isArray(child.material)) {
              child.material = child.material.map(mat => {
                // 克隆材质确保独立性
                const newMat = mat.clone();
                // 确保不是黑色
                if (newMat.color && newMat.color.r === 0 && newMat.color.g === 0 && newMat.color.b === 0) {
                  newMat.color.setRGB(0.8, 0.8, 0.8);
                }
                return newMat;
              });
            } 
            // 处理单个材质
            else {
              // 克隆材质确保独立性
              child.material = child.material.clone();
              if (child.material.color && 
                  child.material.color.r === 0 && 
                  child.material.color.g === 0 && 
                  child.material.color.b === 0) {
                child.material.color.setRGB(0.8, 0.8, 0.8);
              }
            }
            
            // 设置交互标记
            child.userData.isInteractive = true;
            child.userData.type = 'rack';
            child.userData.originalMaterial = {
              color: child.material.color ? child.material.color.clone() : new THREE.Color(0xcccccc),
              opacity: child.material.opacity || 1.0,
              transparent: child.material.transparent || false
            };
            
            // 禁用阴影
            child.castShadow = false;
            child.receiveShadow = false;
          }
        });
        
        // 6. 保存原始机架位置，用于计算设备相对位置
        const rackOriginalPosition = rackObject.position.clone();
        
        // 7. 查找并添加相关设备
        let deviceCount = 0;
        originalModel.traverse((child) => {
          // 查找与该机架相关的设备
          if (child.name && child.name.startsWith('NE_') && child.name.includes(rackBaseName)) {
            console.log("找到设备:", child.name);
            
            // 克隆设备
            const deviceClone = child.clone(true);
            
            // 计算设备相对于原始机架的偏移量
            const relativePosition = new THREE.Vector3().subVectors(
              child.position, 
              rackOriginalPosition
            );
            
            // 设置设备相对于机架的位置
            deviceClone.position.copy(relativePosition);
            
            // 确保设备材质正确
            deviceClone.traverse((subChild) => {
              if (subChild.isMesh && subChild.material) {
                // 处理数组材质
                if (Array.isArray(subChild.material)) {
                  subChild.material = subChild.material.map(mat => {
                    // 克隆材质确保独立性
                    const newMat = mat.clone();
                    // 确保不是黑色
                    if (newMat.color && newMat.color.r === 0 && newMat.color.g === 0 && newMat.color.b === 0) {
                      newMat.color.setRGB(0.8, 0.8, 0.8);
                    }
                    return newMat;
                  });
                } 
                // 处理单个材质
                else {
                  // 克隆材质确保独立性
                  subChild.material = subChild.material.clone();
                  if (subChild.material.color && 
                      subChild.material.color.r === 0 && 
                      subChild.material.color.g === 0 && 
                      subChild.material.color.b === 0) {
                    subChild.material.color.setRGB(0.8, 0.8, 0.8);
                  }
                }
                
                // 设置交互标记
                subChild.userData.isInteractive = true;
                subChild.userData.type = 'device';
                subChild.userData.originalDevice = child.name;
                subChild.userData.originalMaterial = {
                  color: subChild.material.color ? subChild.material.color.clone() : new THREE.Color(0xcccccc),
                  opacity: subChild.material.opacity || 1.0,
                  transparent: subChild.material.transparent || false
                };
                
                // 禁用阴影
                subChild.castShadow = false;
                subChild.receiveShadow = false;
              }
            });
            
            // 记录设备原始位置，用于后续动画
            this.sceneState.currentDevicePositions.set(deviceClone.id, deviceClone.position.clone());
            
            // 添加到场景原点
            origin.add(deviceClone);
            deviceCount++;
            
            console.log(`添加设备到单机架视图: ${child.name}`);
          }
        });
        
        console.log(`添加了 ${deviceCount} 个设备到单机架视图`);
        
        // 8. 旋转整个原点以获得更好的视角
        origin.rotation.y = Math.PI / 4; // 改为45度，以获得侧面视图效果
        this.sceneState.isFrontView = false; // 初始设置为侧面视图
        
        // 9. 不添加额外灯光，保留原有灯光
        // 原来的代码如下，现在注释掉：
        /*
        // 重新添加灯光，确保场景照明充足
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // 降低环境光强度
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.6); // 降低定向光强度
        mainLight.position.set(5, 5, 5);
        mainLight.castShadow = false;
        
        mainScene.add(ambientLight);
        mainScene.add(mainLight);
        */
        
        // 10. 调整相机视角
        // 计算边界框，用于定位相机
        const box = new THREE.Box3().setFromObject(sceneContainer);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // 计算适当的相机距离
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        const cameraDistance = (maxDim / 2) / Math.tan(fov / 2) * 1.2;
        
        // 设置相机位置 - 修改为更平行的视角（减少Y轴高度）
        camera.position.set(
          center.x, 
          center.y + maxDim * 0.3, // 原来是0.7，现在降低为0.3，减少俯视角度
          center.z + cameraDistance * 1.0 // 原来是0.8，现在增加到1.0，让相机距离更远一些
        );
        
        // 设置相机目标 - 稍微调整目标点，让视线更加水平
        controls.target.set(
          center.x,
          center.y + maxDim * 0.1 - 0.2, // 减去0.2以匹配机架的上移
          center.z
        );
        controls.update();
        
        // 强制重绘场景
        if (renderer) {
          renderer.render(mainScene, camera);
        }
        
        // 11. 更新当前视图状态
        this.sceneState.currentView = 'single-rack';
        this.sceneState.singleRackScene = sceneContainer;
        
        // 保存场景容器和原点引用，用于后续动画
        this.sceneState.singleRackContainer = sceneContainer;
        this.sceneState.singleRackOrigin = origin;
        
        // 12. 通知父组件视图已变更
        this.$emit('view-changed', {
          view: 'single-rack',
          data: rackData
        });
        
        console.log('单机架视图创建完成');
        return true;
      } catch (error) {
        console.error('创建单机架视图时出错:', error);
        return false;
      }
    },
    
    // 创建单设备视图
    createSingleDeviceScene(deviceData) {
      if (!this.$refs.baseScene || !this.$refs.baseScene.model) return false;
      
      // 保存选中的设备信息
      this.sceneState.selectedDevice = deviceData;
      
      // 查找选中的设备对象
      const deviceObject = this.getObjectByName(deviceData.name);
      if (!deviceObject) return false;
      
      console.log('创建单设备视图:', deviceData.name);
      
      // 记录当前的相机状态，以便之后返回
      if (!this.sceneState.originalCameraPosition) {
        this.sceneState.originalCameraPosition = this.$refs.baseScene.camera.position.clone();
        this.sceneState.originalControlsTarget = this.$refs.baseScene.controls.target.clone();
      }
      
      // 隐藏不相关的物体，只保留当前设备
      this.model.traverse((child) => {
        if (child.isMesh || child.isGroup) {
          // 如果是当前设备或其子物体，则保持可见
          if (child === deviceObject || this.isChildOfObject(child, deviceObject)) {
            child.visible = true;
          } 
          // 不是当前设备的相关物体，则隐藏
          else if (!child.name.toLowerCase().includes('floor') && 
                  !child.name.toLowerCase().includes('wall') &&
                  !child.name.toLowerCase().includes('ceiling')) {
            child.visible = false;
          }
        }
      });
      
      // 聚焦到设备
      this.focusOnDevice(deviceData.name);
      
      // 更新当前视图状态
      this.sceneState.currentView = 'single-device';
      
      // 不添加额外灯光，保持原有灯光设置
      
      // 通知父组件视图已变更
      this.$emit('view-changed', {
        view: 'single-device',
        data: deviceData
      });
      
      return true;
    },
    
    // 重置到主场景
    resetToMainScene() {
      console.log('重置到主场景');
      
      if (!this.$refs.baseScene) {
        console.error('基础场景引用不存在');
        return false;
      }
      
      try {
        // 获取当前场景和相机引用
        const renderer = this.$refs.baseScene.renderer;
        const mainScene = this.$refs.baseScene.scene;
        const camera = this.$refs.baseScene.camera;
        const controls = this.$refs.baseScene.controls;
        
        // 清空当前场景中的所有对象，包括灯光
        const sceneChildren = [...mainScene.children];
        sceneChildren.forEach(child => {
          mainScene.remove(child);
        });
        
        // 使用BaseThreeScene中的默认灯光
        this.$refs.baseScene.setupLights();
        
        // 重新加载原始模型
        this.loadModel()
          .then(model => {
            // 添加模型到场景
            mainScene.add(model);
            
            // 处理模型对象，设置交互属性
            this.processModel(model);
            
            // 重置相机位置
            if (this.sceneState.originalCameraPosition && this.sceneState.originalControlsTarget) {
              camera.position.copy(this.sceneState.originalCameraPosition);
              controls.target.copy(this.sceneState.originalControlsTarget);
              
              controls.update();
              
              console.log('已恢复原始相机位置和目标');
            } else {
              // 如果没有保存原始相机位置，计算适当的新位置
              this.resetCamera(camera, controls, model);
            }
            
            // 更新当前视图状态
            this.sceneState.currentView = 'main';
            this.sceneState.selectedRack = null;
            this.sceneState.selectedDevice = null;
            this.sceneState.singleRackScene = null;
            this.sceneState.singleDeviceScene = null;
            
            // 强制重绘场景
            if (renderer) {
              renderer.render(mainScene, camera);
            }
            
            // 通知父组件视图已变更
            this.$emit('view-changed', {
              view: 'main',
              data: null
            });
            
            console.log('重置到主场景完成');
            return true;
          })
          .catch(error => {
            console.error('重新加载模型失败:', error);
            return false;
          });
        
        return true;
      } catch (error) {
        console.error('重置到主场景时出错:', error);
        return false;
      }
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
        
        // 使用优化的判断函数
        if (this.isDevice(child)) {
          console.log('标记为网元设备:', child.name);
          child.userData.isInteractive = true;
          child.userData.type = 'server'; 
          
          // 可以进一步从名称中提取设备细节
          const deviceDetails = this.extractDeviceDetails(child.name);
          if (deviceDetails) {
            child.userData.model = deviceDetails.model;
            child.userData.position = deviceDetails.position;
            // 其他设备细节...
          }
        } else if (child.name.toLowerCase().includes('rack')) {
          // 机架对象
          child.userData.isInteractive = true;
          child.userData.type = 'rack';
        }
      });
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
    
    // 动画设备（例如弹出或移动设备）
    animateDevice(deviceName) {
      const device = this.getObjectByName(deviceName);
      if (!device) {
        console.error('找不到设备，无法执行动画:', deviceName);
        return false;
      }
      
      console.log('执行设备动画:', deviceName, '对象:', device);
      
      // 重置之前的动画状态
      if (this.sceneState.animatingDevice && 
          this.sceneState.animatingDevice !== deviceName &&
          this.sceneState.animatedDeviceParts.length > 0) {
        this.resetPreviousDeviceAnimation();
      }
      
      // 执行第一阶段动画（设备弹出）
      return this.animateDeviceStage1(device);
    },
    
    // 设备动画 - 第一阶段（设备弹出）
    animateDeviceStage1(deviceObj) {
      if (!deviceObj) {
        console.error('设备对象为空，无法执行动画');
        return false;
      }
      
      // 检查是否为网元设备，只处理网元设备
      const isNetworkElement = deviceObj.name && deviceObj.name.startsWith('NE_');
      if (!isNetworkElement) {
        console.log('非网元设备，不执行弹出动画:', deviceObj.name);
        return false;
      }
      
      console.log('执行网元设备第一阶段动画:', deviceObj.name);
      
      // 重置之前的动画状态
      if (this.sceneState.animatingDevice && 
          this.sceneState.animatingDevice !== deviceObj.name &&
          this.sceneState.animatedDeviceParts.length > 0) {
        this.resetPreviousDeviceAnimation();
      }
      
      // 设置当前动画状态
      this.sceneState.animatingDevice = deviceObj.name;
      this.sceneState.deviceAnimationStage = 1;
      
      // 收集设备的所有部件
      const deviceParts = [];
      deviceObj.traverse((child) => {
        if (child.isMesh && child !== deviceObj) {
          deviceParts.push(child);
        }
      });
      
      // 如果没有部件，使用设备本身
      if (deviceParts.length === 0) {
        deviceParts.push(deviceObj);
      }
      
      this.sceneState.animatedDeviceParts = deviceParts;
      
      // 保存原始位置
      deviceParts.forEach(part => {
        const originalPosition = part.position.clone();
        this.deviceInteractionState.originalPositions.set(part.id, markRaw(originalPosition));
      });
      
      // 确定动画方向
      // 通常服务器设备是水平放置的，应该沿X轴移动
      // 网络设备可能是垂直放置的，应该沿Z轴移动
      const isServer = deviceObj.name.includes('server');
      const isSwitch = deviceObj.name.includes('switch') || deviceObj.name.includes('router');
      
      // 分析设备的边界框来确定最佳移动方向
      const box = new THREE.Box3().setFromObject(deviceObj);
      const size = box.getSize(new THREE.Vector3());
      
      let moveAxis = 'x'; // 默认沿X轴移动
      let moveDistance = 0.3; // 默认移动距离
      
      // 根据设备类型和尺寸确定移动轴向
      if (isServer) {
        // 服务器通常是水平放置的（X轴更长）
        if (size.z > size.x) {
          moveAxis = 'z';
        } else {
          moveAxis = 'x';
        }
        moveDistance = Math.min(size.x, size.z) * 0.5; // 移动设备尺寸的一半距离
      } else if (isSwitch) {
        // 交换机可能是垂直放置的（Y轴或Z轴更长）
        if (size.y > size.x) {
          moveAxis = 'y';
        } else {
          moveAxis = 'x';
        }
        moveDistance = Math.min(size.x, size.y) * 0.5;
      }
      
      // 确保移动距离最小有0.2单位
      moveDistance = Math.max(moveDistance, 0.2);
      
      console.log(`设备动画方向: ${moveAxis}, 距离: ${moveDistance}`);
      
      // 执行动画
      const duration = 800; // 动画持续时间(毫秒)
      const startTime = Date.now();
      
      // 保存开始位置
      const startPositions = deviceParts.map(part => part.position.clone());
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = this.easeOutCubic(progress);
        
        deviceParts.forEach((part, index) => {
          const startPos = startPositions[index];
          
          // 根据移动轴向更新位置
          if (moveAxis === 'x') {
            part.position.x = startPos.x + moveDistance * easeProgress;
          } else if (moveAxis === 'y') {
            part.position.y = startPos.y + moveDistance * easeProgress;
          } else {
            part.position.z = startPos.z + moveDistance * easeProgress;
          }
        });
        
        // 强制重绘
        if (this.$refs.baseScene && this.$refs.baseScene.renderer) {
          this.$refs.baseScene.renderer.render(
            this.$refs.baseScene.scene,
            this.$refs.baseScene.camera
          );
        }
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          console.log('设备第一阶段动画完成');
          
          // 动画完成后，设置一个计时器在一段时间后回到原位
          setTimeout(() => {
            this.resetDeviceAnimation();
          }, 3000); // 3秒后复位
        }
      };
      
      // 开始动画
      requestAnimationFrame(animate);
      
      return true;
    },
    
    // 重置设备动画
    resetDeviceAnimation() {
      if (!this.sceneState.animatedDeviceParts || this.sceneState.animatedDeviceParts.length === 0) {
        return;
      }
      
      const deviceParts = this.sceneState.animatedDeviceParts;
      const duration = 500; // 回到原位的动画持续时间(毫秒)
      const startTime = Date.now();
      
      // 保存当前位置
      const startPositions = deviceParts.map(part => part.position.clone());
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = this.easeInOutCubic(progress);
        
        deviceParts.forEach((part, index) => {
          const originalPos = this.deviceInteractionState.originalPositions.get(part.id);
          const startPos = startPositions[index];
          
          if (originalPos) {
            // 平滑过渡回到原始位置
            part.position.x = startPos.x + (originalPos.x - startPos.x) * easeProgress;
            part.position.y = startPos.y + (originalPos.y - startPos.y) * easeProgress;
            part.position.z = startPos.z + (originalPos.z - startPos.z) * easeProgress;
          }
        });
        
        // 强制重绘
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
          
          // 重置动画状态
          this.sceneState.animatingDevice = null;
          this.sceneState.deviceAnimationStage = 0;
          this.sceneState.animatedDeviceParts = [];
        }
      };
      
      // 开始复位动画
      requestAnimationFrame(animate);
    },
    
    // 重置之前的设备动画
    resetPreviousDeviceAnimation() {
      // 立即重置之前的动画，不使用过渡
      const deviceParts = this.sceneState.animatedDeviceParts;
      
      deviceParts.forEach(part => {
        const originalPos = this.deviceInteractionState.originalPositions.get(part.id);
        if (originalPos) {
          part.position.copy(originalPos);
        }
      });
      
      // 重置动画状态
      this.sceneState.animatingDevice = null;
      this.sceneState.deviceAnimationStage = 0;
      this.sceneState.animatedDeviceParts = [];
    },
    
    // 获取对象通过名称
    getObjectByName(name) {
      if (!this.$refs.baseScene || !this.$refs.baseScene.model) {
        return null;
      }
      return this.$refs.baseScene.model.getObjectByName(name);
    },
    
    // 优化的设备判断函数
    isDevice(object) {
      if (!object) return false;
      
      // 条件1: 对象类型是device
      if (object.type === 'device') return true;
      
      // 条件2: 名称以NE_开头（网元）
      if (object.name && object.name.startsWith('NE_')) return true;
      
      // 条件3: 名称包含常见设备关键词
      if (object.name) {
        const lowerName = object.name.toLowerCase();
        const deviceKeywords = ['server', 'switch', 'router', 'device', 'net', 'hw_'];
        return deviceKeywords.some(keyword => lowerName.includes(keyword));
      }
      
      return false;
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
    
    // 高亮网元设备
    highlightNetworkElementOnly(obj) {
      if (!obj) return;
      
      // 检查是否为网元设备
      const isNetworkElement = obj.name && obj.name.startsWith('NE_');
      if (!isNetworkElement) {
        console.log('非网元设备，不执行高亮:', obj.name);
        return;
      }
      
      console.log('高亮网元设备:', obj.name);
      
      // 首先清除之前的高亮效果
      this.clearHighlights();
      
      // 保存当前对象的材质颜色
      if (!obj.userData._highlightOriginalColor && obj.material && obj.material.color) {
        obj.userData._highlightOriginalColor = obj.material.color.clone();
      }
      
      if (obj.material) {
        // 高亮效果 - 淡蓝色，降低强度避免过亮
        const highlightColor = new THREE.Color(0x66ccff);
        
        // 如果是数组材质
        if (Array.isArray(obj.material)) {
          obj.material.forEach(mat => {
            if (mat.color) {
              // 使用lerp而不是直接设置，保持部分原始颜色
              mat.color.lerp(highlightColor, 0.3);
            }
          });
        }
        // 单个材质
        else if (obj.material.color) {
          // 使用lerp而不是直接设置，保持部分原始颜色
          obj.material.color.lerp(highlightColor, 0.3);
        }
      }
      
      // 递归应用到所有子对象
      if (obj.children && obj.children.length > 0) {
        obj.children.forEach(child => {
          // 保存子对象材质
          if (child.isMesh && child.material && child.material.color) {
            if (!child.userData._highlightOriginalColor) {
              child.userData._highlightOriginalColor = child.material.color.clone();
            }
            
            // 高亮子对象
            const highlightColor = new THREE.Color(0x66ccff);
            child.material.color.lerp(highlightColor, 0.3);
          }
          
          // 递归处理深层子对象
          if (child.children && child.children.length > 0) {
            this.highlightChildObjects(child);
          }
        });
      }
    },
    
    // 递归高亮子对象（辅助方法）
    highlightChildObjects(obj) {
      if (!obj) return;
      
      if (obj.isMesh && obj.material && obj.material.color) {
        if (!obj.userData._highlightOriginalColor) {
          obj.userData._highlightOriginalColor = obj.material.color.clone();
        }
        
        // 高亮子对象
        const highlightColor = new THREE.Color(0x66ccff);
        obj.material.color.lerp(highlightColor, 0.3);
      }
      
      // 递归处理深层子对象
      if (obj.children && obj.children.length > 0) {
        obj.children.forEach(child => {
          this.highlightChildObjects(child);
        });
      }
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
    
    // 指针悬停处理
    onPointerOver(event) {
      // 计算指针位置
      this.pointer.x = (event.offsetX / this.width) * 2 - 1;
      this.pointer.y = -(event.offsetY / this.height) * 2 + 1;
      
      // 对不同视图进行不同处理
      if (this.currentView === 'single-rack') {
        // 在单机架视图中，高亮悬停的网元设备
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        if (intersects.length > 0) {
          const obj = intersects[0].object;
          // 向上查找可交互设备
          let deviceObj = obj;
          while (deviceObj && !(deviceObj.userData && deviceObj.userData.isInteractive)) {
            deviceObj = deviceObj.parent;
          }
          
          // 如果找到了可交互设备，检查是否为网元设备
          if (deviceObj && deviceObj.userData && deviceObj.userData.isInteractive) {
            // 检查是否为网元设备
            const isNetworkElement = deviceObj.name && deviceObj.name.startsWith('NE_');
            if (isNetworkElement) {
              // 只高亮网元设备
              this.highlightNetworkElementOnly(deviceObj);
            }
          }
        }
      }
      // 其他视图处理可以按需添加...
    },
  },
  
  mounted() {
    console.log('ServerRoomScene组件挂载完成');
  },
  
  beforeUnmount() {
    console.log('ServerRoomScene组件卸载，执行清理...');
    
    // 清理动画相关状态
    if (window.animationFrameId) {
      cancelAnimationFrame(window.animationFrameId);
      window.animationFrameId = null;
    }
    
    // 清理存储的原始数据
    if (this.deviceInteractionState) {
      this.deviceInteractionState.originalColors.clear();
      this.deviceInteractionState.originalPositions.clear();
    }
    
    // 清理场景状态
    if (this.sceneState) {
      this.sceneState.mainScene = null;
      this.sceneState.singleRackScene = null;
      this.sceneState.singleDeviceScene = null;
      this.sceneState.selectedRack = null;
      this.sceneState.selectedDevice = null;
      this.sceneState.originalCameraPosition = null;
      this.sceneState.originalControlsTarget = null;
    }
  }
};
</script>