<template>
  <div class="three-scene-container" ref="containerRef"></div>
</template>

<script>
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { markRaw, ref, onMounted, onBeforeUnmount, shallowRef } from 'vue';
import { useSceneCore } from '@/composables/three/useSceneCore';

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

        // 设置交互
        setupInteraction();

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
      
      if (containerRef.value) {
        containerRef.value.removeEventListener('click', onMouseClick);
        containerRef.value.removeEventListener('mousemove', onMouseMove);
      }
      
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

      console.log('处理模型:', props.modelPath);

      // 添加调试日志，查看模型的层次结构
      logModelStructure(model.value);

      // 设置所有对象为可见
      model.value.traverse((child) => {
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

      model.value.traverse((child) => {
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
    }

    // 递归打印模型结构
    function logModelStructure(object, indent = 0) {
      const spaces = ' '.repeat(indent * 2);
      let objType = 'Object';

      if (object.isMesh) objType = 'Mesh';
      else if (object.isGroup) objType = 'Group';
      else if (object.isLight) objType = 'Light';

      console.log(`${spaces}${objType}: ${object.name || '未命名'} (子对象: ${object.children.length})`);

      // 递归打印子对象
      if (object.children && object.children.length > 0 && indent < 3) { // 限制递归深度
        object.children.forEach(child => {
          logModelStructure(child, indent + 1);
        });
      }
    }

    // 设置交互
    function setupInteraction() {
      // 创建射线发射器和鼠标向量
      raycaster.value = markRaw(new THREE.Raycaster());
      mouse.value = markRaw(new THREE.Vector2());

      // 添加点击事件监听器
      if (containerRef.value) {
        containerRef.value.addEventListener('click', onMouseClick);
        containerRef.value.addEventListener('mousemove', onMouseMove);
      }
    }

    // 鼠标点击处理
    function onMouseClick(event) {
      // 计算鼠标在归一化设备坐标中的位置
      if (!containerRef.value) return;
      
      const rect = containerRef.value.getBoundingClientRect();

      mouse.value.x = ((event.clientX - rect.left) / containerRef.value.clientWidth) * 2 - 1;
      mouse.value.y = -((event.clientY - rect.top) / containerRef.value.clientHeight) * 2 + 1;

      // 更新射线发射器
      raycaster.value.setFromCamera(mouse.value, camera.value);

      // 使用markRaw处理intersects
      const intersects = markRaw(raycaster.value.intersectObjects(scene.value.children, true));

      if (intersects.length > 0) {
        // 获取第一个相交的对象
        let selectedObject = intersects[0].object;
        let foundInteractiveObject = null;
        let foundParentNetworkElement = null;

        console.log('基础场景: 点击原始相交对象:', selectedObject.name);

        // 向上遍历对象层级查找可交互对象
        while (selectedObject) {
          // 如果对象有交互属性
          if (selectedObject.name && selectedObject.userData && selectedObject.userData.isInteractive) {
            if (!foundInteractiveObject) {
              foundInteractiveObject = selectedObject;
              console.log(`基础场景: 点击找到可交互对象 ${foundInteractiveObject.name}`);
            }

            // 如果当前对象是网元设备，优先使用它
            if (selectedObject.name.startsWith('NE_')) {
              foundParentNetworkElement = selectedObject;
              console.log(`基础场景: 点击找到父级网元设备 ${foundParentNetworkElement.name}`);
              break; // 找到网元设备后停止遍历
            }
          }

          // 继续向上遍历，除非已到达顶层
          if (!selectedObject.parent) {
            console.log('基础场景: 点击到达顶层，未找到网元设备父级');
            break;
          }
          selectedObject = selectedObject.parent;
        }

        // 优先使用网元设备，否则使用找到的第一个可交互对象
        const finalObject = foundParentNetworkElement || foundInteractiveObject;

        // 如果找到了最终对象
        if (finalObject) {
          // 执行点击处理
          handleObjectClick(finalObject, intersects[0].point);
        }
      }
    }

    // 对象点击处理
    function handleObjectClick(object, intersectionPoint) {
      // 基础点击处理，发送事件到父组件
      emit('object-clicked', {
        name: object.name,
        type: object.userData.type || 'unknown',
        position: {
          x: intersectionPoint.x,
          y: intersectionPoint.y,
          z: intersectionPoint.z
        }
      });
    }

    // 鼠标移动处理
    function onMouseMove(event) {
      if (!containerRef.value) return;
      
      // 计算鼠标在归一化设备坐标中的位置
      const rect = containerRef.value.getBoundingClientRect();

      mouse.value.x = ((event.clientX - rect.left) / containerRef.value.clientWidth) * 2 - 1;
      mouse.value.y = -((event.clientY - rect.top) / containerRef.value.clientHeight) * 2 + 1;

      // 更新射线发射器
      raycaster.value.setFromCamera(mouse.value, camera.value);

      // 计算与射线相交的对象
      const intersects = markRaw(raycaster.value.intersectObjects(scene.value.children, true));

      // 重置之前高亮的对象
      if (currentHoveredObject.value) {
        resetHighlight(currentHoveredObject.value);
        currentHoveredObject.value = null;
      }

      let foundInteractiveObject = null;
      let foundParentNetworkElement = null;

      if (intersects.length > 0) {
        let currentObject = intersects[0].object;

        // 向上遍历查找第一个标记为可交互的对象
        while (currentObject) {
          // 标记可交互的对象
          if (currentObject.userData && currentObject.userData.isInteractive) {
            if (!foundInteractiveObject) {
              foundInteractiveObject = currentObject;
            }

            // 如果当前对象是网元设备（名称以NE_开头），优先使用它
            if (currentObject.name && currentObject.name.startsWith('NE_')) {
              foundParentNetworkElement = currentObject;
              break; // 找到网元设备后停止遍历
            }
          }

          // 继续向上遍历
          if (!currentObject.parent) {
            break;
          }
          currentObject = currentObject.parent;
        }
      }

      // 优先使用网元设备，如果没有则使用找到的第一个可交互对象
      const finalObject = foundParentNetworkElement || foundInteractiveObject;

      // 如果找到了最终对象
      if (finalObject) {
        highlightObject(finalObject); // 高亮
        currentHoveredObject.value = markRaw(finalObject); // 设置当前悬停对象

        // 发送鼠标悬停位置事件，包含对象信息
        emit('object-hover', {
          x: event.clientX,
          y: event.clientY,
          objectFound: true,
          objectName: finalObject.name,
          objectType: finalObject.userData.type || 'unknown'
        });
      } else {
        // 未找到可交互对象，只发送鼠标位置
        emit('object-hover', {
          x: event.clientX,
          y: event.clientY,
          objectFound: false
        });
      }
    }

    // 对象高亮
    function highlightObject() {
      // 子类可以重写此方法进行特定的高亮处理
    }

    // 重置高亮
    function resetHighlight() {
      // 子类可以重写此方法进行特定的高亮重置处理
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
      highlightObject,
      resetHighlight,
      
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