<template>
  <div class="three-scene-container" ref="container"></div>
</template>

<script>
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { markRaw, onBeforeUnmount } from 'vue';

/**
 * BaseThreeScene 组件
 * 
 * 注意：我们使用 markRaw 来包装所有 Three.js 对象，以防止 Vue 的响应式系统
 * 对它们进行代理。Three.js 对象包含特殊属性（如 Matrix4）和循环引用，
 * 这些特性与 Vue 的响应式系统不兼容，可能导致 "modelViewMatrix is a read-only" 错误。
 */
export default {
  name: 'BaseThreeScene',
  props: {
    modelPath: {
      type: String,
      required: true
    },
    backgroundColor: {
      type: String,
      default: '#0a1222'
    },
    alpha: {
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
    }
  },
  emits: ['object-clicked', 'object-hover', 'scene-ready', 'model-loaded'],
  data() {
    return {
      // 场景核心对象
      scene: null,
      camera: null,
      renderer: null,
      controls: null,
      model: null,
      raycaster: null,
      mouse: null,
      
      // 动画ID
      animationFrameId: null,
      
      // 当前悬停的对象
      currentHoveredObject: null,
      
      // 加载状态
      isLoading: true,
      loadingProgress: 0,
      loadingError: null,
      
      // 新增标志
      isComponentDestroyed: false
    };
  },
  mounted() {
    // 初始化Three.js场景
    this.initThree();
    
    // 监听窗口大小变化
    window.addEventListener('resize', this.onWindowResize);
    
    // 使用 Composition API 的 onBeforeUnmount 钩子
    onBeforeUnmount(() => {
      // 清理资源
      this.cleanup();
    });
  },
  beforeUnmount() {
    // 设置组件销毁标志
    this.isComponentDestroyed = true;
    
    // 处理组件销毁的清理工作
    this.dispose();
  },
  methods: {
    initThree() {
      // 获取容器
      const container = this.$refs.container;
      
      // 创建场景
      this.scene = markRaw(new THREE.Scene());
      
      // 根据alpha属性决定是否设置背景色
      if (!this.alpha) {
        this.scene.background = new THREE.Color(this.backgroundColor);
      } else {
        // 如果启用透明度，则不设置背景色或将其设置为null以实现透明
        this.scene.background = null;
      }
      
      // 创建相机
      this.camera = markRaw(new THREE.PerspectiveCamera(
        this.cameraFov,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
      ));
      this.camera.position.set(
        this.cameraPosition.x,
        this.cameraPosition.y,
        this.cameraPosition.z
      );
      
      // 创建渲染器，添加alpha支持
      this.renderer = markRaw(new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: this.alpha // 启用透明度支持
      }));
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.shadowMap.enabled = false;
      
      // 如果启用透明度，设置渲染器的透明背景
      if (this.alpha) {
        this.renderer.setClearColor(0x000000, 0); // 设置为完全透明
      }
      
      container.appendChild(this.renderer.domElement);
      
      // 添加控制器
      this.controls = markRaw(new OrbitControls(this.camera, this.renderer.domElement));
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.minDistance = 2;
      this.controls.maxDistance = 20;
      
      // 添加灯光
      this.setupLights();
      
      // 加载模型
      this.loadModel();
      
      // 设置交互
      this.setupInteraction();
      
      // 开始渲染循环
      this.startAnimation();
    },
    
    setupLights() {
      // 添加环境光 - 增强亮度
      const ambientLight = markRaw(new THREE.AmbientLight(0x6b7caa, 1.2));
      this.scene.add(ambientLight);
      
      // 添加主定向光 - 增强亮度和色彩
      const mainLight = markRaw(new THREE.DirectionalLight(0xffffff, 0.8));
      mainLight.position.set(5, 5, 5);
      mainLight.castShadow = false;
      this.scene.add(mainLight);
      
      // 添加辅助蓝色光源，增强科技感
      const blueLight = markRaw(new THREE.DirectionalLight(0x4c71eb, 0.5));
      blueLight.position.set(-5, 3, -5);
      blueLight.castShadow = false;
      this.scene.add(blueLight);
      
      // 添加顶部弱青色光源
      const cyanLight = markRaw(new THREE.DirectionalLight(0x00d8ff, 0.3));
      cyanLight.position.set(0, 10, 0);
      cyanLight.castShadow = false;
      this.scene.add(cyanLight);
    },
    
    loadModel() {
      // 检查模型路径
      if (!this.modelPath) {
        console.error('没有提供模型路径');
        this.loadingError = '没有提供模型路径';
        this.isLoading = false;
        return;
      }
      
      // 使用GLTFLoader加载模型
      const loader = markRaw(new GLTFLoader());
      
      loader.load(
        this.modelPath,
        (gltf) => {
          // 检查组件是否已被销毁
          if (this.isComponentDestroyed) {
            console.warn('组件已被销毁，取消模型加载处理');
            return;
          }
          
          this.model = markRaw(gltf.scene);
          
          // 检查scene是否存在再添加模型
          if (this.scene) {
            this.scene.add(this.model);
          } else {
            console.error('场景对象不存在，无法添加模型');
            this.loadingError = '场景对象不存在，无法添加模型';
            return;
          }
          
          // 处理模型
          this.processModel();
          
          // 模型加载完成
          this.isLoading = false;
          this.loadingProgress = 100;
          
          // 重置相机位置
          this.resetCamera();
          
          // 通知父组件
          this.$emit('model-loaded', {
            modelName: this.modelPath.split('/').pop(),
            modelObject: this.model
          });
          
          // 通知场景准备就绪
          this.$emit('scene-ready', {
            message: 'Three.js scene initialized and model loaded',
            modelPath: this.modelPath
          });
        },
        (xhr) => {
          // 加载进度
          this.loadingProgress = Math.floor((xhr.loaded / xhr.total) * 100);
        },
        (error) => {
          // 加载错误
          console.error('加载模型时出错:', error);
          this.loadingError = error.message || '加载模型时出错';
          this.isLoading = false;
        }
      );
    },
    
    processModel() {
      // 如果没有模型则返回
      if (!this.model) {
        console.error('无法处理模型：模型为空');
        return;
      }
      
      console.log('处理模型:', this.modelPath);
      
      // 添加调试日志，查看模型的层次结构
      console.log('模型结构:');
      this.logModelStructure(this.model);
      
      // 设置所有对象为可见
      this.model.traverse((child) => {
        if (child.isMesh || child.isGroup) {
          child.visible = true;
          
          // 如果是Mesh，确保材质正确
          if (child.isMesh && !child.material) {
            console.warn('Mesh缺少材质:', child.name);
            // 添加默认材质
            child.material = new THREE.MeshStandardMaterial({ color: 0x888888 });
          }
        }
      });
      
      // 检查命名的对象并输出信息
      let meshCount = 0;
      let interactiveObjectsCount = 0;
      
      this.model.traverse((child) => {
        if (child.isMesh) {
          meshCount++;
          
          if (child.name) {
            console.log(`Mesh对象: ${child.name}, 位置: ${JSON.stringify(child.position)}, 可见性: ${child.visible}`);
            
            // 标记特定对象为可交互
            if (child.name.toLowerCase().includes('rack') || child.name.startsWith('NE_')) {
              child.userData.isInteractive = true;
              interactiveObjectsCount++;
            }
          }
        }
      });
      
      console.log(`模型包含 ${meshCount} 个Mesh对象，其中 ${interactiveObjectsCount} 个标记为可交互`);
    },
    
    // 添加辅助方法，递归打印模型结构
    logModelStructure(object, indent = 0) {
      const spaces = ' '.repeat(indent * 2);
      let objType = 'Object';
      
      if (object.isMesh) objType = 'Mesh';
      else if (object.isGroup) objType = 'Group';
      else if (object.isLight) objType = 'Light';
      
      console.log(`${spaces}${objType}: ${object.name || '未命名'} (子对象: ${object.children.length})`);
      
      // 递归打印子对象
      if (object.children && object.children.length > 0 && indent < 3) { // 限制递归深度
        object.children.forEach(child => {
          this.logModelStructure(child, indent + 1);
        });
      }
    },
    
    setupMeshUserData(mesh) {
      // 为不同类型的对象设置特殊标记，例如机架和设备
      if (!mesh.userData) {
        mesh.userData = {};
      }
      
      if (mesh.name) {
        console.log(`设置Mesh元数据: ${mesh.name}`);
        
        // 检查是否是机架对象
        if (mesh.name.toLowerCase().includes('rack')) {
          mesh.userData.isInteractive = true;
          mesh.userData.type = 'rack';
          console.log(`标记为可交互机架: ${mesh.name}`);
        }
        // 检查是否是网元设备（服务器、交换机等）
        else if (mesh.name.startsWith('NE_')) {
          mesh.userData.isInteractive = true;
          mesh.userData.type = 'device';
          console.log(`标记为可交互设备: ${mesh.name}`);
        }
        // 检查是否是环境对象
        else if (mesh.name.toLowerCase().includes('floor') || 
                mesh.name.toLowerCase().includes('wall') || 
                mesh.name.toLowerCase().includes('ceiling')) {
          mesh.userData.isInteractive = false;
          mesh.userData.type = 'environment';
          console.log(`标记为环境对象: ${mesh.name}`);
        }
      }
    },
    
    setupInteraction() {
      // 创建射线发射器和鼠标向量
      this.raycaster = markRaw(new THREE.Raycaster());
      this.mouse = markRaw(new THREE.Vector2());
      
      // 获取容器
      const container = this.$refs.container;
      
      // 添加点击事件监听器
      container.addEventListener('click', this.onMouseClick);
      
      // 添加鼠标移动事件监听器（用于悬停效果）
      container.addEventListener('mousemove', this.onMouseMove);
    },
    
    onMouseClick(event) {
      // 计算鼠标在归一化设备坐标中的位置
      const container = this.$refs.container;
      const rect = container.getBoundingClientRect();
      
      this.mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
      
      // 更新射线发射器
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      // 计算与射线相交的对象
      const intersects = markRaw(this.raycaster.intersectObjects(this.scene.children, true));
      
      if (intersects.length > 0) {
        // 获取第一个相交的对象
        let selectedObject = intersects[0].object;
        
        // 向上遍历对象层级，找到第一个有名称和交互属性的对象
        while (selectedObject && (!selectedObject.name || !selectedObject.userData.isInteractive) && selectedObject.parent) {
          selectedObject = selectedObject.parent;
        }
        
        // 如果对象有名称且被标记为可交互
        if (selectedObject && selectedObject.name && selectedObject.userData.isInteractive) {
          // 执行点击处理，可以被子类重写
          this.handleObjectClick(selectedObject, intersects[0].point);
        }
      }
    },
    
    handleObjectClick(object, intersectionPoint) {
      // 基础点击处理，发送事件到父组件
      this.$emit('object-clicked', {
        name: object.name,
        type: object.userData.type || 'unknown',
        position: {
          x: intersectionPoint.x,
          y: intersectionPoint.y,
          z: intersectionPoint.z
        }
      });
    },
    
    onMouseMove(event) {
      // 计算鼠标在归一化设备坐标中的位置
      const container = this.$refs.container;
      const rect = container.getBoundingClientRect();
      
      this.mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
      
      // 更新射线发射器
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      // 计算与射线相交的对象
      const intersects = markRaw(this.raycaster.intersectObjects(this.scene.children, true));
      
      // 重置之前高亮的对象
      if (this.currentHoveredObject) {
        this.resetHighlight(this.currentHoveredObject);
        this.currentHoveredObject = null;
      }
      
      let foundInteractiveObject = null;
      if (intersects.length > 0) {
        let currentObject = intersects[0].object;
        console.log('基础场景: 原始相交对象:', currentObject.name, currentObject);
        
        // 向上遍历查找第一个标记为可交互的对象
        while (currentObject) {
          console.log(`基础场景: 检查对象: ${currentObject.name}, isInteractive: ${currentObject.userData?.isInteractive}`);
          if (currentObject.userData && currentObject.userData.isInteractive) {
            foundInteractiveObject = currentObject;
            console.log(`基础场景: 找到可交互对象 ${foundInteractiveObject.name}`);
            break; // 找到后即停止遍历
          }
          if (!currentObject.parent) {
            console.log('基础场景: 到达顶层，未找到可交互父级');
            break;
          }
          currentObject = currentObject.parent;
        }
      }

      // 如果找到了可交互对象
      if (foundInteractiveObject) {
        console.log(`基础场景: 设置悬停对象 ${foundInteractiveObject.name}, userData:`, foundInteractiveObject.userData);
        this.highlightObject(foundInteractiveObject); // 高亮
        this.currentHoveredObject = markRaw(foundInteractiveObject); // 设置当前悬停对象
        
        // 发送鼠标悬停位置事件，包含对象信息
        this.$emit('object-hover', {
          x: event.clientX,
          y: event.clientY,
          objectFound: true,
          objectName: foundInteractiveObject.name,
          objectType: foundInteractiveObject.userData.type || 'unknown'
        });
      } else {
        // 未找到可交互对象，只发送鼠标位置
        this.$emit('object-hover', {
          x: event.clientX,
          y: event.clientY,
          objectFound: false
        });
        console.log('基础场景: 无相交对象或未找到可交互对象');
      }
    },
    
    // eslint-disable-next-line no-unused-vars
    highlightObject(object) {
      // 基础高亮处理，子类可以重写
      // 默认不做任何事情
    },
    
    // eslint-disable-next-line no-unused-vars
    resetHighlight(object) {
      // 基础取消高亮处理，子类可以重写
      // 默认不做任何事情
    },
    
    startAnimation() {
      // 如果已经有动画帧ID，先取消它
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      
      // 动画循环函数
      const animate = () => {
        this.animationFrameId = requestAnimationFrame(animate);
        
        // 更新控制器
        if (this.controls) {
          this.controls.update();
        }
        
        // 渲染场景
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
        
        // 额外的动画处理，可以被子类重写
        this.updateAnimation();
      };
      
      // 开始动画
      animate();
    },
    
    updateAnimation() {
      // 基础动画更新，子类可以重写
      // 默认不做任何事情
    },
    
    resetCamera() {
      // 如果没有模型则返回
      if (!this.model) return;
      
      // 创建一个边界框来包含整个模型
      const box = markRaw(new THREE.Box3().setFromObject(this.model));
      const center = markRaw(box.getCenter(new THREE.Vector3()));
      const size = markRaw(box.getSize(new THREE.Vector3()));
      
      // 找到最大尺寸
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera.fov * (Math.PI / 180);
      let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
      
      // 添加一些边距
      cameraDistance *= 1.5;
      
      // 设置相机位置，从稍微上方看向中心
      this.camera.position.set(
        center.x,
        center.y + cameraDistance * 0.5,
        center.z + cameraDistance
      );
      
      // 设置控制器目标
      this.controls.target.set(center.x, center.y, center.z);
      this.controls.update();
      
      // 更新投影矩阵
      this.camera.updateProjectionMatrix();
    },
    
    onWindowResize() {
      // 如果组件未挂载或者没有容器，则返回
      if (!this.$refs.container || !this.camera || !this.renderer) return;
      
      const container = this.$refs.container;
      
      // 更新相机宽高比
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      
      // 更新渲染器大小
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    },
    
    cleanup() {
      // 取消动画帧
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      
      // 移除事件监听器
      window.removeEventListener('resize', this.onWindowResize);
      
      const container = this.$refs.container;
      if (container) {
        container.removeEventListener('click', this.onMouseClick);
        container.removeEventListener('mousemove', this.onMouseMove);
      }
      
      // 清理渲染器
      if (this.renderer) {
        this.renderer.dispose();
        
        // 移除渲染器的DOM元素
        if (container && this.renderer.domElement) {
          container.removeChild(this.renderer.domElement);
        }
      }
      
      // 清理控制器
      if (this.controls) {
        this.controls.dispose();
      }
      
      // 清理场景
      if (this.scene) {
        this.disposeScene(this.scene);
      }
      
      // 清空引用
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.controls = null;
      this.model = null;
      this.raycaster = null;
      this.mouse = null;
    },
    
    disposeScene(scene) {
      // 递归清理场景中的对象
      scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => this.disposeMaterial(material));
          } else {
            this.disposeMaterial(object.material);
          }
        }
      });
    },
    
    disposeMaterial(material) {
      if (!material) return;
      
      // 清理材质的所有纹理和相关资源
      // 特定属性检查
      if (material.map) material.map.dispose();
      if (material.lightMap) material.lightMap.dispose();
      if (material.bumpMap) material.bumpMap.dispose();
      if (material.normalMap) material.normalMap.dispose();
      if (material.displacementMap) material.displacementMap.dispose();
      if (material.specularMap) material.specularMap.dispose();
      if (material.envMap) material.envMap.dispose();
      
      // 通用检查所有可能的纹理
      for (const key in material) {
        const value = material[key];
        if (value && value.isTexture) {
          value.dispose();
        }
      }
      
      // 清理材质本身
      material.dispose();
    },
    
    /**
     * 递归清理场景中的资源
     */
    disposeSceneResources(obj) {
      if (!obj) return;
      
      // 递归处理子对象
      if (obj.children && obj.children.length > 0) {
        // 创建一个副本进行遍历，因为在遍历过程中会修改children数组
        const children = [...obj.children];
        for (const child of children) {
          this.disposeSceneResources(child);
        }
      }
      
      // 从父级中移除
      if (obj.parent) {
        obj.parent.remove(obj);
      }
      
      // 清理几何体
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      
      // 清理材质
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          for (const material of obj.material) {
            this.disposeMaterial(material);
          }
        } else {
          this.disposeMaterial(obj.material);
        }
      }
    },
    
    // 公共方法，可供父组件调用
    getHoveredObject() {
      return this.currentHoveredObject ? {
        name: this.currentHoveredObject.name,
        type: this.currentHoveredObject.userData.type || 'unknown'
      } : null;
    },
    
    /**
     * 清理Three.js资源，防止内存泄漏
     */
    dispose() {
      console.log('清理Three.js资源');
      
      // 移除事件监听器
      if (this.$refs.container) {
        this.$refs.container.removeEventListener('click', this.onMouseClick);
        this.$refs.container.removeEventListener('mousemove', this.onMouseMove);
      }
      
      // 停止动画循环
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      
      // 清理场景资源
      if (this.scene) {
        this.disposeSceneResources(this.scene);
        this.scene = null;
      }
      
      // 清理渲染器
      if (this.renderer) {
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.renderer.domElement = null;
        this.renderer = null;
      }
      
      // 清理相机
      if (this.camera) {
        this.camera = null;
      }
      
      // 清理其他Three.js对象
      this.raycaster = null;
      this.mouse = null;
      this.model = null;
      
      console.log('Three.js资源清理完成');
    }
  }
};
</script>

<style lang="scss" scoped>
.three-scene-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  touch-action: none; /* 防止触摸设备上的默认行为干扰 */
}
</style> 