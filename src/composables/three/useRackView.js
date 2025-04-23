// src/composables/three/useRackView.js
import * as THREE from 'three';
import { reactive } from 'vue';

export function useRackView() {
  // 维护机架视图自身的内部状态
  const rackViewState = reactive({
    selectedRackData: null,    // 当前显示的机架数据
    isActive: false,           // 当前视图是否激活
    rackScene: null,           // 【新增】存储独立的机架场景
    sceneContainer: null,      // 【可能保留】场景内的容器 Group
    sceneOrigin: null          // 【可能保留】容器内的原点 Group
  });

  /**
   * 创建单机架视图 (重构后)
   * @param {Object} rackData - 机架数据 (包含 name 等信息)
   * @param {Object} context - 上下文，包含必要的外部引用和方法
   * @returns {THREE.Scene | null} 返回新创建的场景对象，或在失败时返回 null
   */
  function createSingleRackScene(rackData, context) {
    const {
      // 【注意】不再直接使用或修改 context.scene (主场景)
      camera,             // 共享的相机
      renderer,           // 共享的渲染器 (可能需要设置其场景)
      controls,           // 共享的控制器
      mainModel,          // 主模型引用 (用于查找和克隆)
      getObjectByName,    // 查找对象的方法 (在 mainModel 上操作)
      // setupDeviceInteractivity, // 这个现在应该在克隆对象后在新场景中处理
      // sceneState,        // 【移除】不再直接操作外部共享状态
      emitViewChanged     // 用于通知外部状态变更
    } = context;

    if (!mainModel) {
      console.error('[useRackView] 缺少主模型引用 (mainModel)');
      return null;
    }
    if (!camera || !controls) {
        console.error('[useRackView] 缺少相机或控制器引用');
        return null;
    }

    console.log('[useRackView] 开始创建单机架视图，机架数据:', rackData);

    // --- 1. 创建新的独立场景 ---
    const newRackScene = new THREE.Scene();
    // 可以设置背景，或者让渲染器清除背景
    newRackScene.background = new THREE.Color(0x050810); // 设置一个稍暗的背景

    // --- 2. 添加灯光到新场景 ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // 调整光照强度
    newRackScene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5); // 调整光源位置
    newRackScene.add(directionalLight);
    // 可选：添加点光源或其他光源增强效果
    // const pointLight = new THREE.PointLight(0xffffff, 0.5);
    // pointLight.position.set(0, 2, 2);
    // newRackScene.add(pointLight);

    // --- 3. 查找原始机架对象 ---
    const rackObject = getObjectByName(rackData.name); // 在 mainModel 中查找
    if (!rackObject) {
      console.error(`[useRackView] 在主模型中找不到机架对象: ${rackData.name}`);
      // 【注意】这里需要清理已创建的 newRackScene 中的资源吗？暂时不，因为还没添加复杂对象
      return null;
    }
    console.log('[useRackView] 找到原始机架对象:', rackObject.name);
    const rackOriginalPosition = rackObject.position.clone(); // 保存原始位置用于计算相对位置

    // --- 4. 创建场景容器和原点 (在新场景中) ---
    const sceneContainer = new THREE.Group();
    sceneContainer.name = `RackViewContainer_${rackData.name}`;
    newRackScene.add(sceneContainer);

    const origin = new THREE.Group();
    origin.name = `RackOrigin_${rackData.name}`;
    // origin.position.y = -0.2; // 可以根据需要调整垂直位置
    sceneContainer.add(origin);


    try {
      // --- 5. 克隆机架并添加到新场景的原点 ---
      const rackClone = rackObject.clone(true); // 深度克隆
      rackClone.position.set(0, 0, 0); // 重置在原点内的位置
      origin.add(rackClone);
      console.log('[useRackView] 已克隆机架并添加到新场景');

      // --- 6. 处理克隆机架的材质和 userData ---
      rackClone.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false; // 单视图通常不需要阴影
          child.receiveShadow = false;
          if (!child.userData) child.userData = {};
          child.userData.isInteractive = true; // 标记为可交互
          child.userData.type = 'rack';

          if (child.material) {
            // 克隆材质，防止共享材质导致的问题
            if (Array.isArray(child.material)) {
              child.material = child.material.map(mat => mat.clone());
            } else {
              child.material = child.material.clone();
            }
            // 可选：保存原始材质信息，用于高亮等
            // child.userData.originalMaterial = ...;
          }
        }
      });

      // --- 7. 查找并克隆相关设备到新场景的原点 ---
      let deviceCount = 0;
      // 从 rackData 中提取基础名称用于匹配
      let rackBaseName = rackData.name.includes('Rack-') ? rackData.name.split('_')[0] : rackData.name;

      mainModel.traverse((child) => { // 遍历原始主模型查找设备
        if (child.name && child.name.startsWith('NE_') && child.name.includes(rackBaseName)) {
          const deviceClone = child.clone(true); // 深度克隆设备

          // 计算相对位置
          const relativePosition = new THREE.Vector3().subVectors(
            child.position,
            rackOriginalPosition // 使用保存的原始机架位置
          );
          deviceClone.position.copy(relativePosition); // 设置相对位置

          // 处理克隆设备的材质和 userData
          deviceClone.traverse((subChild) => {
            if (subChild.isMesh) {
              subChild.castShadow = false;
              subChild.receiveShadow = false;
              if (!subChild.userData) subChild.userData = {};
              subChild.userData.isInteractive = true; // 标记为可交互
              subChild.userData.type = 'NE'; // 或更具体的设备类型
              subChild.userData.originalDeviceName = child.name; // 保存原始名称

              if (subChild.material) {
                if (Array.isArray(subChild.material)) {
                  subChild.material = subChild.material.map(mat => mat.clone());
                } else {
                  subChild.material = subChild.material.clone();
                }
                 // 可选：保存原始材质信息
                // subChild.userData.originalMaterial = ...;
              }
              // 【重要】调用 setupDeviceInteractivity (如果需要在 useRackView 内部处理)
              // if (setupDeviceInteractivity) {
              //    setupDeviceInteractivity(subChild); // 但更推荐在交互 Composable 中处理
              // }
            }
          });

          origin.add(deviceClone); // 添加到新场景的原点
          deviceCount++;
          console.log(`[useRackView] 添加克隆设备: ${child.name} 到新场景`);
        }
      });
      console.log(`[useRackView] 共添加 ${deviceCount} 个设备到新场景`);


      // --- 8. 旋转原点 (可选，用于初始视角) ---
      origin.rotation.y = Math.PI / 4; // 初始侧面 45 度视角


      // --- 9. 调整【共享】相机聚焦到新场景内容 ---
      // 计算新场景内容的边界框
      const box = new THREE.Box3().setFromObject(sceneContainer); // 使用容器计算边界
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // 检查边界框是否有效
      if (size.length() === 0 || !box.min || !box.max || box.isEmpty()) {
          console.warn("[useRackView] 计算出的边界框无效，使用默认相机位置。");
          camera.position.set(0, 1, 3); // 设置一个备用位置
          controls.target.set(0, 0, 0);
      } else {
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = camera.fov * (Math.PI / 180);
          // 调整距离因子，确保机架充满视图，但不过近
          const distanceFactor = 1.5; // 稍微拉远一点
          let cameraDistance = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * distanceFactor;
          cameraDistance = Math.max(cameraDistance, 1.5); // 保证最小距离

          // 设置相机位置（例如，侧前方视角）
          camera.position.set(
              center.x + cameraDistance * 0.7, // X 偏移实现侧视
              center.y + cameraDistance * 0.4, // Y 偏移实现俯视
              center.z + cameraDistance * 0.7  // Z 距离
          );
          // 设置相机目标点为容器中心
          controls.target.copy(center);
      }
      controls.update(); // 更新控制器使相机朝向目标
      console.log('[useRackView] 已调整相机视角');


      // --- 10. 更新内部状态 ---
      rackViewState.selectedRackData = rackData;
      rackViewState.isActive = true;
      rackViewState.rackScene = newRackScene; // 存储新场景的引用
      rackViewState.sceneContainer = sceneContainer;
      rackViewState.sceneOrigin = origin;


      // --- 11. 通知外部视图已切换，并传递新场景 ---
      if (emitViewChanged) {
        emitViewChanged({
            view: 'single-rack',
            data: rackData,
            scene: newRackScene // 传递新场景的引用
        });
        console.log('[useRackView] 已发出 view-changed 事件，切换到 single-rack');
      }

      return newRackScene; // 返回新创建的场景

    } catch (error) {
      console.error('[useRackView] 创建单机架视图过程中发生错误:', error);
      // 【需要错误处理】如果克隆或处理中出错，需要清理 newRackScene
      // disposeSceneResources(newRackScene); // 假设有这个清理函数
      rackViewState.isActive = false; // 重置状态
      rackViewState.rackScene = null;
      // 可能需要通知外部创建失败
      // if (emitViewChanged) { emitViewChanged({ view: 'main', error: true }); }
      return null;
    }
  }

  // ... destroySingleRackScene 函数也需要重构 ...

  // 【辅助函数】清理场景资源（示例，需要根据实际情况完善）
  function disposeSceneResources(sceneObj) {
      if (!sceneObj) return;
      sceneObj.traverse((object) => {
          if (object.geometry) {
              object.geometry.dispose();
              // console.log(`Disposed geometry for ${object.name}`);
          }
          if (object.material) {
              if (Array.isArray(object.material)) {
                  object.material.forEach(material => {
                      if (material.map) material.map.dispose();
                      material.dispose();
                  });
              } else {
                  if (object.material.map) object.material.map.dispose();
                  object.material.dispose();
              }
              // console.log(`Disposed material for ${object.name}`);
          }
      });
      // 清空场景
      while(sceneObj.children.length > 0){
          sceneObj.remove(sceneObj.children[0]);
      }
      console.log(`[useRackView] Scene resources disposed for scene: ${sceneObj.uuid}`);
  }


  // --- 需要重构 destroySingleRackScene ---
  /**
   * 销毁单机架视图 (需要重构)
   * @param {Object} context - 上下文，包含恢复相机等所需信息
   * @returns {Boolean}
   */
  function destroySingleRackScene(context) {
      const { camera, controls, emitViewChanged, originalCameraPosition, originalControlsTarget } = context;

      console.log('[useRackView] 开始销毁单机架视图...');

      if (!rackViewState.isActive || !rackViewState.rackScene) {
          console.warn('[useRackView] 单机架视图未激活或场景不存在，无需销毁。');
          return false;
      }

      // --- 1. 清理独立的机架场景资源 ---
      disposeSceneResources(rackViewState.rackScene);
      console.log('[useRackView] 单机架场景资源已释放');

      // --- 2. 重置内部状态 ---
      rackViewState.selectedRackData = null;
      rackViewState.isActive = false;
      rackViewState.rackScene = null;
      rackViewState.sceneContainer = null;
      rackViewState.sceneOrigin = null;
      console.log('[useRackView] 内部状态已重置');

      // --- 3. 恢复相机位置和目标 ---
      // 【重要】原始相机位置应由调用者管理和传入
      if (originalCameraPosition && originalControlsTarget && camera && controls) {
          camera.position.copy(originalCameraPosition);
          controls.target.copy(originalControlsTarget);
          controls.update();
          console.log('[useRackView] 相机已恢复到主视图位置');
      } else {
          console.warn('[useRackView] 未提供原始相机状态，无法恢复相机');
          // 可以设置一个默认的主视图相机位置作为备用
          // camera.position.set(0, 2, 5);
          // controls.target.set(0, 0, 0);
          // controls.update();
      }

      // --- 4. 通知外部视图已切换回主视图 ---
      if (emitViewChanged) {
          emitViewChanged({ view: 'main' });
          console.log('[useRackView] 已发出 view-changed 事件，切换回 main');
      }

      return true;
  }


  // 返回状态和方法
  return {
    rackViewState, // 只读的状态
    createSingleRackScene,
    destroySingleRackScene
    // 可能还有其他与机架视图相关的方法，如旋转机架等
  };
}