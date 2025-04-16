<template>
  <base-three-scene
    :model-path="modelPath"
    :backgroundColor="backgroundColor"
    :cameraPosition="cameraPosition"
    :cameraFov="cameraFov"
    :ambientLightIntensity="ambientLightIntensity"
    :directionalLightIntensity="directionalLightIntensity"
    @object-clicked="onObjectClicked"
    @object-hover="onObjectHover"
    @scene-ready="onSceneReady"
    @model-loaded="onModelLoaded"
    ref="baseSceneRef"
  />
</template>

<script>
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import BaseThreeScene from '@/components/three/BaseThreeScene.vue';

export default {
  name: 'SmartRoomScene',
  components: {
    BaseThreeScene
  },
  props: {
    modelPath: {
      type: String,
      default: '/models/interactive/server_room_interactive.gltf'
    },
    currentView: {
      type: String,
      default: 'main' // 'main', 'single-rack', 'single-device'
    }
  },
  emits: ['object-clicked', 'object-hover', 'scene-ready'],
  data() {
    return {
      // 场景配置
      backgroundColor: '#000714',
      cameraPosition: { x: 10, y: 10, z: 10 },
      cameraFov: 65,
      ambientLightIntensity: 1.0,
      directionalLightIntensity: 0.8,
      
      // 场景状态
      mainScene: null,
      singleRackScene: null,
      singleDeviceScene: null,
      activeScene: 'main',
      
      // 当前选中的对象
      selectedRack: null,
      selectedNetworkElement: null,
      
      // 模型对象
      originalModel: null,
      singleRackModel: null,
      singleDeviceModel: null,
      
      // 视图状态
      isFrontView: false,
      
      // 设备状态
      deviceInteractionState: {
        selectedDevice: null,
        deviceParts: [],
        interactionStage: 0, // 0=未选中, 1=部分弹出
        originalPositions: new Map()
      }
    };
  },
  watch: {
    currentView(newView, oldView) {
      if (newView !== oldView) {
        this.handleViewChange(newView);
      }
    }
  },
  methods: {
    onSceneReady(data) {
      console.log('智慧机房场景已就绪:', data);
      // 转发事件到父组件
      this.$emit('scene-ready', data);
    },
    
    onModelLoaded(data) {
      console.log('智慧机房模型已加载:', data.modelName);
      this.originalModel = data.modelObject;
      this.processModelForInteraction(this.originalModel);
    },
    
    processModelForInteraction(model) {
      // 处理模型中的设备和机架，设置交互属性
      model.traverse((child) => {
        if (child.isMesh) {
          // 检查是否为设备（以NE_开头的对象）
          if (child.name && child.name.startsWith('NE_')) {
            child.userData.isInteractive = true;
            child.userData.type = 'device';
            
            // 保存原始材质属性
            child.userData.originalMaterial = {
              color: child.material.color ? child.material.color.clone() : new THREE.Color(0xffffff),
              opacity: child.material.opacity || 1.0,
              transparent: child.material.transparent || false
            };
          }
          
          // 检查是否为机架（包含rack的对象）
          else if (child.name && child.name.toLowerCase().includes('rack')) {
            child.userData.isInteractive = true;
            child.userData.type = 'rack';
            child.userData.isRack = true;
            
            // 保存原始材质属性
            child.userData.originalMaterial = {
              color: child.material.color ? child.material.color.clone() : new THREE.Color(0xffffff),
              opacity: child.material.opacity || 1.0,
              transparent: child.material.transparent || false
            };
          }
        }
      });
    },
    
    onObjectClicked(objectData) {
      console.log('智慧机房场景对象点击:', objectData);
      
      // 转发事件到父组件
      this.$emit('object-clicked', objectData);
    },
    
    onObjectHover(hoverData) {
      // 转发悬停位置到父组件
      this.$emit('object-hover', hoverData);
    },
    
    handleViewChange(newView) {
      this.activeScene = newView;
      
      // 根据视图类型切换场景显示
      if (newView === 'main') {
        this.resetToMainScene();
      }
    },
    
    // 以下方法可以从父组件调用
    
    // 获取当前悬停的对象
    getHoveredObject() {
      const baseScene = this.$refs.baseSceneRef;
      return baseScene ? baseScene.getHoveredObject() : null;
    },
    
    // 创建单机架场景
    createSingleRackScene(rackData) {
      console.log('创建单机架场景:', rackData);
      
      const baseScene = this.$refs.baseSceneRef;
      if (!baseScene || !baseScene.scene || !baseScene.model) {
        console.error('基础场景未初始化');
        return;
      }
      
      // 保存选中的机架数据
      this.selectedRack = rackData;
      
      // 访问基础场景中的对象
      const scene = baseScene.scene;
      const model = baseScene.model;
      
      // 清空场景中的模型
      if (this.originalModel) {
        scene.remove(this.originalModel);
      }
      
      // 查找对应的机架对象
      let rackObject = null;
      model.traverse((child) => {
        if (child.name === rackData.name && child.userData.isRack) {
          rackObject = child;
        }
      });
      
      if (!rackObject) {
        console.error('未找到机架对象:', rackData.name);
        return;
      }
      
      // 克隆机架对象
      this.singleRackModel = rackObject.clone(true);
      
      // 调整机架位置，使其位于场景中心
      this.singleRackModel.position.set(0, 0, 0);
      
      // 添加到场景
      scene.add(this.singleRackModel);
      
      // 查找机架ID和房间代码，用于匹配设备
      let rackIdInfo = '';
      if (rackData.name) {
        const nameParts = rackData.name.split('_');
        if (nameParts.length >= 2) {
          rackIdInfo = `${nameParts[0]}_${nameParts[1]}`;
        }
      }
      
      // 添加该机架相关的设备
      if (rackIdInfo) {
        console.log('查找机架设备:', rackIdInfo);
        model.traverse((child) => {
          // 查找属于该机架的设备
          if (child.name && child.name.startsWith('NE_') && child.name.includes(rackIdInfo)) {
            console.log('找到设备:', child.name);
            
            // 克隆设备
            const deviceClone = child.clone(true);
            
            // 计算设备相对于机架的偏移量
            const relativePosition = new THREE.Vector3().subVectors(
              child.position,
              rackObject.position
            );
            
            // 设置设备相对于机架的位置
            deviceClone.position.copy(relativePosition);
            
            // 设置交互属性
            deviceClone.traverse((part) => {
              if (part.isMesh) {
                part.userData.isInteractive = true;
                part.userData.type = 'device';
                part.userData.originalDevice = child.name;
                
                // 保存原始材质属性
                part.userData.originalMaterial = {
                  color: part.material.color ? part.material.color.clone() : new THREE.Color(0xffffff),
                  opacity: part.material.opacity || 1.0,
                  transparent: part.material.transparent || false
                };
              }
            });
            
            // 添加到场景
            this.singleRackModel.add(deviceClone);
          }
        });
      }
      
      // 旋转机架以展示侧面视图
      this.singleRackModel.rotation.y = Math.PI / 6; // 30度
      this.isFrontView = false;
      
      // 重置相机位置
      this.resetCameraForRack(baseScene.camera, baseScene.controls);
    },
    
    // 创建单设备场景
    createSingleDeviceScene(deviceData) {
      console.log('创建单设备场景:', deviceData);
      
      const baseScene = this.$refs.baseSceneRef;
      if (!baseScene || !baseScene.scene || !baseScene.model) {
        console.error('基础场景未初始化');
        return;
      }
      
      // 保存选中的设备数据
      this.selectedNetworkElement = deviceData;
      
      // 访问基础场景中的对象
      const scene = baseScene.scene;
      const model = baseScene.model;
      
      // 清空场景中的模型
      if (this.originalModel) {
        scene.remove(this.originalModel);
      }
      
      // 查找对应的设备对象
      let deviceObject = null;
      model.traverse((child) => {
        if (child.name === deviceData.name && child.userData.type === 'device') {
          deviceObject = child;
        }
      });
      
      if (!deviceObject) {
        console.error('未找到设备对象:', deviceData.name);
        return;
      }
      
      // 克隆设备对象
      this.singleDeviceModel = deviceObject.clone(true);
      
      // 调整设备位置，使其位于场景中心
      this.singleDeviceModel.position.set(0, 0, 0);
      
      // 添加到场景
      scene.add(this.singleDeviceModel);
      
      // 旋转设备以正面朝向相机
      this.singleDeviceModel.rotation.y = Math.PI / 2; // 90度
      
      // 设置交互属性
      this.singleDeviceModel.traverse((part) => {
        if (part.isMesh) {
          part.userData.isInteractive = true;
          part.userData.type = 'device';
          
          // 保存原始材质属性
          part.userData.originalMaterial = {
            color: part.material.color ? part.material.color.clone() : new THREE.Color(0xffffff),
            opacity: part.material.opacity || 1.0,
            transparent: part.material.transparent || false
          };
        }
      });
      
      // 重置相机位置
      this.setupCameraForDevice(baseScene.camera, baseScene.controls);
    },
    
    // 切换回主场景
    resetToMainScene() {
      const baseScene = this.$refs.baseSceneRef;
      if (!baseScene || !baseScene.scene) return;
      
      // 清空场景中的特定视图模型
      if (this.singleRackModel) {
        baseScene.scene.remove(this.singleRackModel);
        this.singleRackModel = null;
      }
      
      if (this.singleDeviceModel) {
        baseScene.scene.remove(this.singleDeviceModel);
        this.singleDeviceModel = null;
      }
      
      // 重新添加原始模型
      if (this.originalModel && !baseScene.scene.children.includes(this.originalModel)) {
        baseScene.scene.add(this.originalModel);
      }
      
      // 重置相机位置
      this.resetCamera(baseScene.camera, baseScene.controls);
      
      // 重置选中的对象
      this.selectedRack = null;
      this.selectedNetworkElement = null;
      this.isFrontView = false;
      
      // 重置设备交互状态
      this.deviceInteractionState = {
        selectedDevice: null,
        deviceParts: [],
        interactionStage: 0,
        originalPositions: new Map()
      };
    },
    
    // 为单机架视图设置相机位置
    resetCameraForRack(camera, controls) {
      if (!this.singleRackModel || !camera || !controls) return;
      
      // 计算模型边界
      const box = new THREE.Box3().setFromObject(this.singleRackModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // 设置相机FOV
      camera.fov = 50;
      
      // 计算相机距离
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraDistance = Math.abs(maxDim / Math.tan(fov / 2));
      cameraDistance *= 0.8; // 减小相机距离，使机架显示更大
      
      // 设置相机位置
      if (this.isFrontView) {
        // 正面视图
        camera.position.set(
          center.x,
          center.y + size.y * 0.1,
          center.z + cameraDistance * 0.7
        );
      } else {
        // 侧面视图
        camera.position.set(
          center.x - cameraDistance * 0.3,
          center.y + size.y * 0.1,
          center.z + cameraDistance * 0.7
        );
      }
      
      // 设置控制器目标
      controls.target.set(center.x, center.y, center.z);
      controls.update();
      
      // 更新投影矩阵
      camera.updateProjectionMatrix();
    },
    
    // 为单设备视图设置相机位置
    setupCameraForDevice(camera, controls) {
      if (!this.singleDeviceModel || !camera || !controls) return;
      
      // 计算模型边界
      const box = new THREE.Box3().setFromObject(this.singleDeviceModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // 设置相机FOV
      camera.fov = 45;
      
      // 计算相机距离
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraDistance = Math.abs(maxDim / Math.tan(fov / 2));
      cameraDistance *= 1.2;
      
      // 设置相机位置
      camera.position.set(
        center.x,
        center.y,
        center.z + cameraDistance
      );
      
      // 设置控制器目标
      controls.target.set(center.x, center.y, center.z);
      controls.update();
      
      // 更新投影矩阵
      camera.updateProjectionMatrix();
    },
    
    // 重置相机到主视图
    resetCamera(camera, controls) {
      if (!this.originalModel || !camera || !controls) return;
      
      // 计算模型边界
      const box = new THREE.Box3().setFromObject(this.originalModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // 恢复默认FOV
      camera.fov = this.cameraFov;
      
      // 设置相机位置
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraDistance = Math.abs(maxDim / Math.tan(fov / 2));
      
      // 从高处俯视
      camera.position.set(
        center.x,
        center.y + size.y * 1.2,
        center.z + cameraDistance * 0.5
      );
      
      // 设置控制器目标
      controls.target.set(
        center.x,
        center.y - size.y * 0.2,
        center.z
      );
      
      controls.update();
      camera.updateProjectionMatrix();
    },
    
    // 切换到正面视图
    switchToFrontView() {
      if (!this.singleRackModel || !this.isFrontView) {
        this.isFrontView = true;
        
        // 旋转机架到正面视图
        if (this.singleRackModel) {
          this.animateRackRotation(Math.PI / 2); // 旋转到90度
        }
      }
    },
    
    // 动画旋转机架
    animateRackRotation(targetRotation) {
      if (!this.singleRackModel) return;
      
      const startRotation = this.singleRackModel.rotation.y;
      const duration = 500; // 旋转动画持续时间
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 使用缓动函数
        const easeProgress = this.easeOutCubic(progress);
        
        // 旋转机架
        this.singleRackModel.rotation.y = startRotation + (targetRotation - startRotation) * easeProgress;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // 动画完成后重置相机
          const baseScene = this.$refs.baseSceneRef;
          if (baseScene) {
            this.resetCameraForRack(baseScene.camera, baseScene.controls);
          }
        }
      };
      
      animate();
    },
    
    // 设备动画函数
    animateDevice(deviceName) {
      // 确保当前在单机架视图
      if (this.activeScene !== 'single-rack' || !this.singleRackModel) return;
      
      // 查找设备和所有部件
      let deviceParts = [];
      this.singleRackModel.traverse((child) => {
        if (child.userData && child.userData.originalDevice === deviceName) {
          deviceParts.push(child);
        }
      });
      
      if (deviceParts.length === 0) {
        console.warn('未找到设备部件:', deviceName);
        return;
      }
      
      // 检查当前状态
      const currentState = this.deviceInteractionState;
      const isClickingSameDevice = currentState.selectedDevice === deviceName;
      
      if (isClickingSameDevice && currentState.interactionStage === 1) {
        // 已经弹出，现在需要复位
        this.resetDeviceAnimation(deviceParts);
        
        // 清除状态
        this.deviceInteractionState = {
          selectedDevice: null,
          deviceParts: [],
          interactionStage: 0,
          originalPositions: new Map()
        };
      } else {
        // 先复位之前的设备（如果有）
        if (currentState.selectedDevice && currentState.deviceParts.length > 0) {
          this.resetDeviceAnimation(currentState.deviceParts);
        }
        
        // 保存新设备的原始位置
        const originalPositions = new Map();
        deviceParts.forEach(part => {
          originalPositions.set(part.id, part.position.clone());
        });
        
        // 更新状态
        this.deviceInteractionState = {
          selectedDevice: deviceName,
          deviceParts: deviceParts,
          interactionStage: 1,
          originalPositions: originalPositions
        };
        
        // 执行弹出动画
        this.animateDeviceStage1(deviceParts);
      }
    },
    
    // 第一阶段动画：设备部分弹出
    animateDeviceStage1(deviceParts) {
      const moveDistance = 0.3; // 弹出距离
      const duration = 200; // 动画持续时间(毫秒)
      const startTime = Date.now();
      
      // 保存动画开始时的位置
      const startPositions = deviceParts.map(part => part.position.clone());
      const originalPositions = this.deviceInteractionState.originalPositions;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = this.easeOutCubic(progress);
        
        deviceParts.forEach((part, index) => {
          const originalPosition = originalPositions.get(part.id);
          const startPosition = startPositions[index];
          
          if (!originalPosition || !startPosition) return;
          
          // 计算目标位置
          const targetZ = originalPosition.z + moveDistance;
          
          // 使用插值平滑移动
          part.position.z = startPosition.z + (targetZ - startPosition.z) * easeProgress;
          
          // 确保X和Y坐标不变
          part.position.x = originalPosition.x;
          part.position.y = originalPosition.y;
        });
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
    },
    
    // 重置设备动画
    resetDeviceAnimation(deviceParts) {
      const duration = 300; // 动画持续时间(毫秒)
      const startTime = Date.now();
      
      // 保存动画开始时的位置
      const startPositions = deviceParts.map(part => part.position.clone());
      const originalPositions = this.deviceInteractionState.originalPositions;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = this.easeInOutCubic(progress);
        
        deviceParts.forEach((part, index) => {
          const originalPosition = originalPositions.get(part.id);
          const startPosition = startPositions[index];
          
          if (!originalPosition || !startPosition) return;
          
          // 使用插值平滑移动回原位
          part.position.x = startPosition.x + (originalPosition.x - startPosition.x) * easeProgress;
          part.position.y = startPosition.y + (originalPosition.y - startPosition.y) * easeProgress;
          part.position.z = startPosition.z + (originalPosition.z - startPosition.z) * easeProgress;
        });
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
    },
    
    // 缓动函数
    easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    },
    
    easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
  }
};
</script> 