import * as THREE from 'three';
import { ref, onBeforeUnmount } from 'vue';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Three.js场景核心功能Composable
 * 提供场景初始化、资源管理、渲染循环等核心功能
 */
export function useSceneCore() {
  // 核心场景引用
  const scene = ref(null);
  const camera = ref(null);
  const renderer = ref(null);
  const controls = ref(null);
  const container = ref(null);
  
  // 状态管理
  const isInitialized = ref(false);
  const isRendering = ref(false);
  const animationFrameId = ref(null);
  const originalCameraState = ref({
    position: null,
    target: null
  });

  /**
   * 初始化场景
   * @param {HTMLElement} domContainer - DOM容器元素
   * @param {Object} options - 初始化选项
   * @returns {Object} 包含场景对象的对象
   */
  function initScene(domContainer, options = {}) {
    if (isInitialized.value) {
      console.warn('场景已经初始化');
      return { scene: scene.value, camera: camera.value, renderer: renderer.value, controls: controls.value };
    }

    const {
      backgroundColor = '#0a1222',
      alpha = false,
      cameraPosition = { x: 0, y: 2, z: 5 },
      cameraFov = 60,
      near = 0.1,
      far = 1000,
      ambientLightColor = 0x6b7caa,
      ambientLightIntensity = 1.2,
      directionalLightColor = 0xffffff,
      directionalLightIntensity = 0.8,
      addLights = true
    } = options;

    container.value = domContainer;

    // 创建场景
    scene.value = new THREE.Scene();
    
    // 根据透明度设置场景背景
    if (!alpha) {
      scene.value.background = new THREE.Color(backgroundColor);
    } else {
      scene.value.background = null;
    }

    // 创建相机
    camera.value = new THREE.PerspectiveCamera(
      cameraFov,
      container.value.clientWidth / container.value.clientHeight,
      near,
      far
    );
    camera.value.position.set(
      cameraPosition.x,
      cameraPosition.y,
      cameraPosition.z
    );

    // 创建渲染器
    renderer.value = new THREE.WebGLRenderer({
      antialias: true,
      alpha: alpha
    });
    renderer.value.setSize(container.value.clientWidth, container.value.clientHeight);
    renderer.value.setPixelRatio(window.devicePixelRatio);
    renderer.value.shadowMap.enabled = false;

    // 如果启用透明度，设置渲染器的透明背景
    if (alpha) {
      renderer.value.setClearColor(0x000000, 0);
    }

    // 将渲染器添加到DOM
    container.value.appendChild(renderer.value.domElement);

    // 创建控制器
    controls.value = new OrbitControls(camera.value, renderer.value.domElement);
    controls.value.enableDamping = true;
    controls.value.dampingFactor = 0.05;
    controls.value.minDistance = 2;
    controls.value.maxDistance = 20;

    // 添加灯光
    if (addLights) {
      // 环境光
      const ambientLight = new THREE.AmbientLight(ambientLightColor, ambientLightIntensity);
      scene.value.add(ambientLight);

      // 主定向光
      const mainLight = new THREE.DirectionalLight(directionalLightColor, directionalLightIntensity);
      mainLight.position.set(5, 5, 5);
      scene.value.add(mainLight);

      // 辅助蓝色光源
      const blueLight = new THREE.DirectionalLight(0x4c71eb, 0.5);
      blueLight.position.set(-5, 3, -5);
      scene.value.add(blueLight);

      // 顶部青色光源
      const cyanLight = new THREE.DirectionalLight(0x00d8ff, 0.3);
      cyanLight.position.set(0, 10, 0);
      scene.value.add(cyanLight);
    }

    // 添加窗口大小变化的监听器
    window.addEventListener('resize', onWindowResize);

    // 保存相机原始状态
    saveOriginalCameraState();

    isInitialized.value = true;

    // 返回场景对象的引用
    return {
      scene: scene.value,
      camera: camera.value,
      renderer: renderer.value,
      controls: controls.value
    };
  }

  /**
   * 保存相机的原始状态
   */
  function saveOriginalCameraState() {
    if (camera.value) {
      originalCameraState.value.position = camera.value.position.clone();
      if (controls.value) {
        originalCameraState.value.target = controls.value.target.clone();
      }
    }
  }

  /**
   * 恢复相机的原始状态
   */
  function resetCamera() {
    if (camera.value && originalCameraState.value.position) {
      camera.value.position.copy(originalCameraState.value.position);
      if (controls.value && originalCameraState.value.target) {
        controls.value.target.copy(originalCameraState.value.target);
        controls.value.update();
      }
    }
  }

  /**
   * 处理窗口大小变化
   */
  function onWindowResize() {
    if (!container.value || !camera.value || !renderer.value) return;

    // 更新相机宽高比
    camera.value.aspect = container.value.clientWidth / container.value.clientHeight;
    camera.value.updateProjectionMatrix();

    // 更新渲染器大小
    renderer.value.setSize(container.value.clientWidth, container.value.clientHeight);
    
    // 强制渲染一次
    if (scene.value) {
      forceRender();
    }
  }

  /**
   * 强制渲染一次
   */
  function forceRender() {
    if (renderer.value && scene.value && camera.value) {
      renderer.value.render(scene.value, camera.value);
    }
  }

  /**
   * 开始渲染循环
   */
  function startRenderLoop() {
    if (isRendering.value) return;

    isRendering.value = true;
    
    const animate = () => {
      if (!isRendering.value) return;

      animationFrameId.value = requestAnimationFrame(animate);

      if (controls.value) {
        controls.value.update();
      }

      if (renderer.value && scene.value && camera.value) {
        renderer.value.render(scene.value, camera.value);
      }
    };

    animate();
  }

  /**
   * 停止渲染循环
   */
  function stopRenderLoop() {
    isRendering.value = false;
    if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value);
      animationFrameId.value = null;
    }
  }

  /**
   * 清理场景中的资源
   */
  function disposeScene(sceneToDispose = null) {
    const targetScene = sceneToDispose || scene.value;
    if (!targetScene) return;

    console.log('清理场景资源');

    // 遍历场景对象
    targetScene.traverse((object) => {
      // 清理几何体
      if (object.geometry) {
        object.geometry.dispose();
      }

      // 清理材质
      if (object.material) {
        // 处理材质数组
        if (Array.isArray(object.material)) {
          object.material.forEach(material => disposeMaterial(material));
        } else {
          // 处理单个材质
          disposeMaterial(object.material);
        }
      }

      // 清理其他属性
      if (object.dispose && typeof object.dispose === 'function') {
        object.dispose();
      }
    });
  }

  /**
   * 清理材质及其纹理资源
   */
  function disposeMaterial(material) {
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
  }

  /**
   * 资源清理
   */
  function cleanup() {
    // 停止渲染循环
    stopRenderLoop();

    // 移除事件监听
    window.removeEventListener('resize', onWindowResize);

    // 清理场景
    disposeScene();

    // 清理渲染器
    if (renderer.value) {
      renderer.value.dispose();
      
      // 从DOM中移除渲染器元素
      if (container.value && renderer.value.domElement) {
        container.value.removeChild(renderer.value.domElement);
      }
      
      renderer.value.forceContextLoss();
      renderer.value.domElement = null;
    }

    // 清理控制器
    if (controls.value) {
      controls.value.dispose();
    }

    // 清空引用
    scene.value = null;
    camera.value = null;
    renderer.value = null;
    controls.value = null;
    animationFrameId.value = null;
    isInitialized.value = false;
  }

  // 组件销毁前自动清理
  onBeforeUnmount(() => {
    cleanup();
  });

  return {
    // 状态
    scene,
    camera,
    renderer,
    controls,
    container,
    isInitialized,
    isRendering,
    
    // 方法
    initScene,
    forceRender,
    startRenderLoop,
    stopRenderLoop,
    onWindowResize,
    disposeScene,
    disposeMaterial,
    saveOriginalCameraState,
    resetCamera,
    cleanup
  };
} 