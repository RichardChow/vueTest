<template>
  <div class="three-scene-container" ref="containerRef"></div>
</template>

<script>
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { markRaw, ref, onMounted, onBeforeUnmount, shallowRef } from 'vue';
import { useSceneCore } from '@/composables/three/useSceneCore';
import { useSceneInteractions } from '@/composables/three/useSceneInteractions';

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
  setup(props, { emit }) {
    // 使用useSceneCore获取场景核心功能
    const {
      scene,
      camera,
      renderer,
      controls,
      initScene,
      startRenderLoop,
      onWindowResize,
      resetCameraToFitModel,
      cleanup
    } = useSceneCore();

    // 使用useSceneInteractions获取交互功能
    const {
      setDependencies,
      initialize: initInteractions,
      onObjectClick,
      onObjectHover
    } = useSceneInteractions();

    // 使用shallowRef而不是ref来引用Three.js对象
    const containerRef = ref(null);
    const model = shallowRef(null);
    const raycaster = shallowRef(null);
    const mouse = shallowRef(null);
    const currentHoveredObject = shallowRef(null);
    const isLoading = ref(true);
    const loadingProgress = ref(0);
    const loadingError = ref(null);
    const isComponentDestroyed = ref(false);
    const animationFrameId = ref(null);

    // 初始化场景
    onMounted(() => {
      if (containerRef.value) {
        // 设置场景初始化选项
        const options = {
          backgroundColor: props.backgroundColor,
          alpha: props.alpha,
          cameraPosition: props.cameraPosition,
          cameraFov: props.cameraFov,
          ambientLightIntensity: props.ambientLightIntensity,
          directionalLightIntensity: props.directionalLightIntensity
        };

    // 初始化Three.js场景
        initScene(containerRef.value, options);

        // 设置交互系统依赖
        setDependencies({
          sceneRef: scene.value,
          cameraRef: camera.value,
          containerReference: containerRef.value
        });

        // 加载模型
        loadModel();

        // 开始渲染循环
        startRenderLoop();

        // 通知场景准备就绪
        emit('scene-ready', {
          message: 'Three.js scene initialized'
        });
      }

      // 监听窗口大小变化
      window.addEventListener('resize', onWindowResize);

      // 注册事件转发
      onObjectClick((object, eventData) => {
        emit('object-clicked', {
          name: object.name,
          type: object.userData.type || 'unknown',
          position: {
            x: eventData.intersection.point.x,
            y: eventData.intersection.point.y,
            z: eventData.intersection.point.z
          }
        });
      });
      
      onObjectHover({
        onEnter: (object, eventData) => {
          emit('object-hover', {
            objectFound: true,
            objectName: object.name,
            objectType: object.userData.type || 'unknown',
            x: eventData.position.clientX,
            y: eventData.position.clientY
          });
        },
        onLeave: () => {
          emit('object-hover', {
            objectFound: false
          });
        }
      });
    });

    // 资源清理
    onBeforeUnmount(() => {
      isComponentDestroyed.value = true;
      
      // 停止动画
      if (animationFrameId.value) {
        cancelAnimationFrame(animationFrameId.value);
      }
      
      // 移除事件监听器
      window.removeEventListener('resize', onWindowResize);
      
      // 清理所有资源
      cleanup();
    });

    // 加载模型
    function loadModel() {
      if (!props.modelPath) {
        console.error('没有提供模型路径');
        loadingError.value = '没有提供模型路径';
        isLoading.value = false;
        return;
      }
      
      // 使用GLTFLoader加载模型
      const loader = markRaw(new GLTFLoader());
      
      loader.load(
        props.modelPath,
        (gltf) => {
          // 检查组件是否已被销毁
          if (isComponentDestroyed.value) {
            console.warn('组件已被销毁，取消模型加载处理');
            return;
          }
          
          // 使用markRaw处理gltf.scene
          model.value = markRaw(gltf.scene);
          
          // 检查scene是否存在再添加模型
          if (scene.value) {
            scene.value.add(model.value);
          } else {
            console.error('场景对象不存在，无法添加模型');
            loadingError.value = '场景对象不存在，无法添加模型';
            return;
          }
          
          // 处理模型
          processModel();
          
          // 模型加载完成
          isLoading.value = false;
          loadingProgress.value = 100;
          
          // 重置相机位置以适应模型
          resetCameraToFitModel(model.value);
          
          // 通知父组件
          emit('model-loaded', {
            modelName: props.modelPath.split('/').pop(),
            modelObject: model.value
          });
        },
        (xhr) => {
          // 加载进度
          loadingProgress.value = Math.floor((xhr.loaded / xhr.total) * 100);
        },
        (error) => {
          // 加载错误
          console.error('加载模型时出错:', error);
          loadingError.value = error.message || '加载模型时出错';
          isLoading.value = false;
        }
      );
    }

    // 处理模型
    function processModel() {
      if (!model.value) {
        console.error('无法处理模型：模型为空');
        return;
      }
      
      console.log('处理模型基础属性:', props.modelPath);
      
      // 只进行基础处理：设置交互性和可拾取性
      model.value.traverse((object) => {
        // 设置每个对象的userData
        if (!object.userData) object.userData = {};
        
        // 标记模型对象，以便后续处理
        object.userData.isModelPart = true;
      });
      
      // 触发事件，不传递处理结果
      // emit('model-loaded', {
        // modelName: props.modelPath.split('/').pop(),
        // modelObject: model.value
      // });
    }

    // 获取悬停对象
    function getHoveredObject() {
      return currentHoveredObject.value ? {
        name: currentHoveredObject.value.name,
        type: currentHoveredObject.value.userData.type || 'unknown'
      } : null;
    }

    // 返回供模板和方法使用的内容
    return {
      // DOM引用
      containerRef,
      
      // Three.js核心对象
      scene,
      camera,
      renderer,
      controls,
      model,
      
      // 状态
      isLoading,
      loadingProgress,
      loadingError,
      
      // 方法
      loadModel,
      processModel,
      getHoveredObject,
      
      // 内部使用的方法不需要返回
    };
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