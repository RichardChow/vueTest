// src/composables/three/useRackView.js
import * as THREE from 'three';
import { reactive } from 'vue';
import { animate, easeInOutCubic, easeOutCubic } from '@/utils/animations';
import { useSceneObjects } from '@/composables/three/useSceneObjects';


export function useRackView() {
  // 维护机架视图状态
  const rackViewState = reactive({
    selectedRack: null,
    isActive: false,
    sceneContainer: null,
    sceneOrigin: null,
    isFrontView: false,
    currentRack: null,
    activeDevice: null,
    activeDeviceParts: [],
    deviceInteractionState: 0,
    firstNetworkElementClick: true
  });

  const { findDeviceByName } = useSceneObjects();
  
  /**
   * 创建单机架视图
   * @param {Object} rackData - 机架数据 (包含被点击机架的名称等)
   * @param {Object} context - 场景上下文，包含 deviceInteractionState
   * @returns {Boolean} 是否成功创建
   */
  function createSingleRackScene(rackData, context) {
    const { 
      scene, 
      camera, 
      renderer, 
      controls,
      mainModel,
      getObjectByName, 
      setupDeviceInteractivity,
      sceneState,
      deviceInteractionState,
      emitViewChanged,
      setPickableObjects,
      setObjectParentMap
    } = context;
    
    if (!scene || !mainModel) {
      console.error('useRackView: 缺少基础场景或模型引用');
      return false;
    }
    
    if (!deviceInteractionState || !deviceInteractionState.rackToDevicesMap) {
      console.error('useRackView: deviceInteractionState 或 rackToDevicesMap 未提供');
      return false;
    }
    
    console.log('useRackView: 创建单机架视图，参数:', rackData);
    
    rackViewState.selectedRack = rackData;
    if (sceneState) {
      sceneState.selectedRack = rackData;
    }
    
    const rackObject = getObjectByName(rackData.name);
    if (!rackObject) {
      console.error('useRackView: 找不到机架对象:', rackData.name);
      return false;
    }
    
    console.log('useRackView: 找到机架对象:', rackObject.name, '位置:', rackObject.position);
    
    try {
      let rackBaseName = rackData.name; 
      if (rackData.name.includes('_')) {
        rackBaseName = rackData.name.split('_')[0];
      } else if (rackData.name.startsWith('Rack-') && !rackData.name.includes(' ')) {
        rackBaseName = rackData.name;
      }
      
      console.log('useRackView: 提取的机架基本名称 (用于查找设备):', rackBaseName);
      
      const mainScene = scene;
      mainScene.remove(mainModel);
      
      const sceneContainer = new THREE.Group();
      sceneContainer.name = "SingleRackSceneContainer";
      mainScene.add(sceneContainer);
      
      const origin = new THREE.Group();
      origin.position.y = -0.2;
      sceneContainer.add(origin);
      
      const rackClone = rackObject.clone(true);
      rackClone.position.set(0, 0, 0);
      origin.add(rackClone);
      
      // 创建搜集交互对象和父级映射的数组和Map
      const interactiveObjects = [];
      const parentMapping = new Map();
      
      rackClone.traverse((child) => {
        if (child.isMesh && child.material) {
          child.userData.isInteractive = true;
          child.userData.type = 'rack';
          child.userData.originalMaterial = {
            color: child.material.color ? child.material.color.clone() : new THREE.Color(0xcccccc),
            opacity: child.material.opacity || 1.0,
            transparent: child.material.transparent || false
          };
          child.castShadow = false;
          child.receiveShadow = false;
          
          // 添加到交互对象数组
          interactiveObjects.push(child);
          
          // 记录父级映射关系
          if (child.parent && child.parent !== rackClone) {
            parentMapping.set(child.id, child.parent);
          }
          
          // 添加这一行，保存父级机架信息
          child.userData.parentRack = {
            name: rackData.name,
            type: 'rack'
          };
        }
      });
      
      const rackOriginalPosition = rackObject.position.clone();
      
      let deviceCount = 0;
      const devicesForThisRack = deviceInteractionState.rackToDevicesMap.get(rackBaseName);

      if (devicesForThisRack && devicesForThisRack.length > 0) {
        console.log(`useRackView: 找到 ${devicesForThisRack.length} 个设备`);
        
        devicesForThisRack.forEach(deviceObjectFromMap => {
          const deviceClone = deviceObjectFromMap.clone(true);
          
          const relativePosition = new THREE.Vector3().subVectors(
            deviceObjectFromMap.position, 
            rackOriginalPosition
          );
          deviceClone.position.copy(relativePosition);
          
          deviceClone.traverse((subChild) => {
            if (subChild.isMesh && subChild.material) {
              subChild.userData.isInteractive = true;
              subChild.userData.type = 'device';
              subChild.userData.originalDevice = deviceObjectFromMap.name;
              subChild.userData.originalMaterial = {
                color: subChild.material.color ? subChild.material.color.clone() : new THREE.Color(0xcccccc),
                opacity: subChild.material.opacity || 1.0,
                transparent: subChild.material.transparent || false
              };
              subChild.castShadow = false;
              subChild.receiveShadow = false;
              
              // 添加到交互对象数组
              interactiveObjects.push(subChild);
              
              // 记录父级映射关系
              if (subChild.parent && subChild.parent !== deviceClone) {
                parentMapping.set(subChild.id, subChild.parent);
              }
            }
          });
          
          if (sceneState && sceneState.currentDevicePositions) {
            sceneState.currentDevicePositions.set(deviceClone.id, deviceClone.position.clone());
          }
          
          origin.add(deviceClone);
          deviceCount++;
          
          if (setupDeviceInteractivity) {
            setupDeviceInteractivity(deviceClone);
          }
        });
      } else {
        console.warn(`useRackView: 未能在 rackToDevicesMap 中为机架 "${rackBaseName}" 找到任何设备。`);
      }
      
      console.log(`useRackView: 添加了 ${deviceCount} 个设备到单机架视图`);
      
      origin.rotation.y = Math.PI / 4;
      if (sceneState) {
        sceneState.isFrontView = false;
      }
      
      const box = new THREE.Box3().setFromObject(sceneContainer);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const cameraDistance = (maxDim / 2) / Math.tan(fov / 2) * 1.2;
      
      camera.position.set(
        center.x, 
        center.y + maxDim * 0.3,
        center.z + cameraDistance * 1.0
      );
      
      controls.target.set(
        center.x,
        center.y + maxDim * 0.1 - 0.2,
        center.z
      );
      controls.update();
      
      sceneContainer.updateWorldMatrix(true, true);
      
      if (renderer) {
        renderer.render(mainScene, camera);
      }
      
      rackViewState.isActive = true;
      rackViewState.sceneContainer = sceneContainer;
      rackViewState.sceneOrigin = origin;
      
      if (sceneState) {
        sceneState.currentView = 'single-rack';
        sceneState.singleRackScene = sceneContainer;
        sceneState.singleRackContainer = sceneContainer;
        sceneState.singleRackOrigin = origin;
      }
      
      if (emitViewChanged) {
        emitViewChanged({
          view: 'single-rack',
          data: rackData
        });
      }
      
      rackViewState.firstNetworkElementClick = true;
      
      // ===== 新增：直接设置交互对象和映射 =====
      // 1. 更新父级映射
      if (setObjectParentMap) {
        setObjectParentMap(parentMapping);
        console.log(`useRackView: 设置了 ${parentMapping.size} 个父级映射关系`);
      }
      
      // 2. 直接设置可拾取对象
      if (setPickableObjects) {
        setPickableObjects(interactiveObjects);
        console.log(`useRackView: 设置了 ${interactiveObjects.length} 个可拾取对象`);
      }
      
      // 同时更新状态，方便其他地方使用
      if (deviceInteractionState) {
        deviceInteractionState.objectParentMap = parentMapping;
        deviceInteractionState.interactiveObjectsSet = new Set(interactiveObjects);
      }
      
      console.log('useRackView: 单机架视图创建完成，场景容器名称:', sceneContainer.name);
      return true;
    } catch (error) {
      console.error('useRackView: 创建单机架视图时出错:', error);
      if (mainModel && !scene.children.includes(mainModel)) {
        scene.add(mainModel);
      }
      return false;
    }
  }

/**
 * 销毁单机架视图
 * @param {Object} context - 场景上下文
 * @returns {Boolean} 是否成功销毁
 */
  function destroySingleRackScene(context) {
    const { scene, sceneState, mainModel, emitViewChanged, renderer, camera } = context;
    
    if (!rackViewState.isActive) return false;
    
    try {
      console.log('开始清理单机架视图');
      
      // 1. 找到并移除所有为单机架视图创建的容器和对象
      const container = scene.getObjectByName("SingleRackSceneContainer");
      const origin = scene.getObjectByName("SingleRackOrigin");
      
      // 记录要移除的对象列表
      const objectsToRemove = [];
      
      // 查找所有相关对象
      scene.traverse((object) => {
        // 检查与单机架视图相关的所有对象
        if (object.name && (
            object.name === "SingleRackSceneContainer" || 
            object.name === "SingleRackOrigin" ||
            (object.userData && object.userData.singleRackView === true)
        )) {
          objectsToRemove.push(object);
        }
      });
      
      // 移除找到的所有对象
      objectsToRemove.forEach(obj => {
        if (obj.parent) {
          console.log(`移除对象: ${obj.name}`);
          obj.parent.remove(obj);
        }
      });
      
      // 2. 确保直接移除容器和原点(为防止遍历没有捕获到)
      if (container && container.parent) {
        console.log('移除单机架容器');
        container.parent.remove(container);
      }
      
      if (origin && origin.parent) {
        console.log('移除单机架原点');
        origin.parent.remove(origin);
      }
      
      // 3. 强制清理场景中可能残留的任何无父级对象
      const cleanupScene = (sceneObj) => {
        // 创建子对象数组的副本，因为在遍历过程中会修改children数组
        const children = [...sceneObj.children];
        for (const child of children) {
          // 检查是否为单机架视图的对象
          if (child !== mainModel && !child.isLight && 
              (!child.type || child.type !== 'AmbientLight') && 
              (!child.type || child.type !== 'DirectionalLight')) {
            console.log(`清理可能的残留对象: ${child.name || '未命名'}`);
            sceneObj.remove(child);
            
            // 递归清理子对象的资源
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        }
      };
      
      // 4. 恢复主场景模型
      if (mainModel && !scene.children.includes(mainModel)) {
        console.log('重新添加主场景模型');
        scene.add(mainModel);
      }
      
      // 5. 执行全场景清理
      cleanupScene(scene);
      
      // 6. 更新状态 - 全面重置所有状态
      rackViewState.isActive = false;
      rackViewState.selectedRack = null;
      rackViewState.sceneContainer = null;
      rackViewState.sceneOrigin = null;
      rackViewState.firstNetworkElementClick = true; // 确保下次进入是第一次点击
      rackViewState.isFrontView = false; // 重置视图方向状态
      rackViewState.currentRack = null; // 重置当前机架引用
      rackViewState.activeDevice = null; // 重置活动设备
      rackViewState.activeDeviceParts = []; // 重置活动设备部件
      rackViewState.deviceInteractionState = 0; // 重置设备交互阶段
      
      // 7. 更新组件状态
      if (sceneState) {
        sceneState.currentView = 'main';
        sceneState.singleRackScene = null;
        sceneState.singleRackContainer = null;
        sceneState.singleRackOrigin = null;
        sceneState.isFrontView = false; // 同步重置组件状态中的视图方向
      }
      
      // 8. 强制重绘场景
      if (renderer && camera) {
        renderer.render(scene, camera);
      }
      
      // 9. 通知父组件
      if (emitViewChanged) {
        emitViewChanged({
          view: 'main',
          data: null
        });
      }
      
      console.log('单机架视图清理完成，所有状态已重置');
      return true;
    } catch (error) {
      console.error('清理单机架视图时出错:', error);
      return false;
    }
  }

  
  function animateRackRotation(targetRotation, context) {
    const {renderer, camera, sceneState, scene} = context;
    const origin = rackViewState.sceneOrigin || sceneState.singleRackOrigin;
    if (!origin) {
      console.error('单机架场景原点不存在，无法执行旋转动画');
      return;
    }
    
    const startRotation = origin.rotation.y;
    const duration = 1000; // 旋转动画持续时间，单位毫秒
    // 使用 animate 函数
    animate({
        duration,
        onUpdate: (progress) => {
            const currentRotation = startRotation + (targetRotation - startRotation) * progress;
            origin.rotation.y = currentRotation;
        
            // 强制渲染
            if (renderer && camera && scene) {
                renderer.render(scene, camera);
            }
      },
      onComplete: () => {
          console.log('机架旋转动画完成');
      }
  });
  }
  
  function switchToFrontView(context) {
    const {sceneState} = context; 
    console.log('切换到正面视图');
    
    const origin = rackViewState.sceneOrigin || sceneState.singleRackOrigin;
    if (!origin) {
      console.error('单机架场景原点不存在，无法旋转');
      return false;  
    }
    
    if (rackViewState.isFrontView) {
      console.log('已经是正面视图，不需要切换');
      return false;
    }
    
    // 将机架旋转到正面（0度）
    animateRackRotation(Math.PI/2, context);
    rackViewState.isFrontView = true;
    if (sceneState) {
      sceneState.isFrontView = true;
    }
    
    return true;
  }

  // 单机架视图中的点击处理
  function handleSingleRackViewClick(data, context) {
    const {sceneState} = context;
    
    // 使用父级机架信息（如果有）
    const effectiveData = data.userData?.parentRack || data;
    
    // 检查是否为第一次点击（任何对象）
    if (rackViewState.firstNetworkElementClick) {
      console.log('单机架视图中的第一次点击，切换到正面视图');
      
      // 无论当前视角如何，直接切换到正面视图
      switchToFrontView(context);
      
      // 标记第一次点击已处理
      rackViewState.firstNetworkElementClick = false;
      
      // 直接返回，不执行后续逻辑
      return;
    }
    
    // 非第一次点击，检查是否为网元设备
    const isNetworkElement = effectiveData.name && effectiveData.name.startsWith('NE_');
    
    // 如果是网元设备，执行弹出动画
    if (isNetworkElement) {
      console.log('非第一次点击网元设备，执行弹出动画');
      animateRackDevice(effectiveData.name, context);
    } 
    // 如果是点击其他类型对象，但视角不是正面，仍然切换到正面
    else if (!rackViewState.isFrontView && !sceneState?.isFrontView) {
      console.log('点击其他对象，切换到正面视图');
      switchToFrontView(context);
    }
  }

  // 设备动画方法 - 对外暴露的接口
  function animateRackDevice(deviceName, context) {
    const {scene, deviceInteractionState} = context;
    console.log('执行设备弹出动画:', deviceName);
    
    // 查找设备对象
    const deviceObj = findDeviceByName(scene, deviceName);
    if (!deviceObj) {
      console.error('设备对象未找到:', deviceName);
      return false;
    }
    
    // 获取设备ID
    const deviceId = deviceObj.userData.originalDevice || deviceObj.name;
    
    // 查找同一设备ID下的所有部件
    let deviceParts = [];
    
    // 收集同一设备的所有部件
    scene.traverse((obj) => {
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
    const currentlySelectedDeviceObj = rackViewState.activeDevice || deviceInteractionState?.selectedDevice;
    const currentlySelectedParts = rackViewState.activeDeviceParts || deviceInteractionState?.deviceParts;
    const currentStage = rackViewState.deviceInteractionState || deviceInteractionState?.interactionStage;
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
      resetRackDeviceAnimation(currentlySelectedDeviceObj, currentlySelectedParts, context);
      
      // 清除全局状态
      rackViewState.activeDevice = null;
      rackViewState.activeDeviceParts = [];
      rackViewState.deviceInteractionState = 0;

      // 同时更新组件状态
      if (deviceInteractionState) {
        deviceInteractionState.selectedDevice = null;
        deviceInteractionState.deviceParts = [];
        deviceInteractionState.interactionStage = 0;
      }
      
      return true;
      } else {
      // 点击新设备或首次点击任何设备
      
      // 1. 复位之前的设备动画（如果有）
      if (currentlySelectedDeviceObj && !isClickingSameDevice) {
        console.log('先复位之前的设备:', currentlySelectedDeviceObj.name);
        resetRackDeviceAnimation(currentlySelectedDeviceObj, currentlySelectedParts, context);
      }
      
      // 2. 立即更新新设备的全局状态
      rackViewState.activeDevice = deviceObj;
      rackViewState.activeDeviceParts = deviceParts;
      rackViewState.deviceInteractionState = 1;

      // 同时更新组件状态
      if (deviceInteractionState) {
        deviceInteractionState.selectedDevice = deviceObj;
        deviceInteractionState.deviceParts = deviceParts;
        deviceInteractionState.interactionStage = 1;
      }

      // 3. 存储新设备的原始变换（在动画之前）
      deviceParts.forEach(part => {
        if (!part.userData.originalPosition) {
          part.userData.originalPosition = part.position.clone();
        }
      });
      
      // 4. 执行新设备的弹出动画
      console.log('执行新设备的弹出动画');
      animateRackDeviceStage1(deviceObj, deviceParts, context);
      
      return true;
    }
  }

  // 设备弹出动画第一阶段 - 向前弹出
  function animateRackDeviceStage1(deviceObj, partsToAnimate, context) {
    const {renderer, camera, scene} = context;
    // 使用传入的部件或回退
    const deviceParts = partsToAnimate || [deviceObj];
    if (!deviceParts || deviceParts.length === 0) {
      console.error("animateRackDeviceStage1: 没有可以动画的部件");
      return;
    }
    
    console.log(`开始执行设备弹出动画，有 ${deviceParts.length} 个部件需要处理`);
    
    // 确定设备的弹出方向 - 向前弹出 (Z轴正方向，即从屏幕向用户方向)
    const isNetworkElement = deviceObj.name && deviceObj.name.startsWith('NE_');
    const moveDistance = isNetworkElement ? 0.30 : 0.1; // 调整为更短的弹出距离
    
    // 存储每个部件的原始位置
    deviceParts.forEach(part => {
      if (!part.userData.originalPosition) {
        part.userData.originalPosition = part.position.clone();
      }
    });
    animate({
      duration: 500,
      easing: easeOutCubic,
      onUpdate: (progress) => {
        deviceParts.forEach(part => {
          const originalPosition = part.userData.originalPosition;
          
          if (!originalPosition) {
            console.warn("缺少部件的原始位置:", part.name);
            return;
          }
          
          // 向前弹出 - 使用Z轴正方向
          const targetZ = originalPosition.z + moveDistance;
          
          // 使用插值计算当前位置
          part.position.z = originalPosition.z + (targetZ - originalPosition.z) * progress;
          
          // 确保X和Y轴保持在原始位置
          part.position.x = originalPosition.x;
          part.position.y = originalPosition.y;
        });
        
        // 强制渲染
        if (renderer && camera && scene) {
          renderer.render(scene, camera);
        }
      },
      onComplete: () => {
        console.log('设备弹出动画完成');
      }
    });    
  }

  // 添加 resetRackDeviceAnimation 函数
  function resetRackDeviceAnimation(deviceObj, deviceParts, context) {
    const { renderer, camera, scene } = context;
    console.log('重置设备动画:', deviceObj ? deviceObj.name : '无');
    
    if (!deviceParts || deviceParts.length === 0) {
      return;
    }
    // 存储动画开始时的位置
    const startPositions = deviceParts.map(part => part.position.clone());
    animate({
      duration: 400,
      easing: easeInOutCubic,
      onUpdate: (progress) => {
        deviceParts.forEach((part, index) => {
          const originalPosition = part.userData.originalPosition;
          const startPosition = startPositions[index];
          
          if (!originalPosition || !startPosition) {
            return;
          }
          
          // 计算当前位置 - 平滑过渡回原始位置
          part.position.x = startPosition.x + (originalPosition.x - startPosition.x) * progress;
          part.position.y = startPosition.y + (originalPosition.y - startPosition.y) * progress;
          part.position.z = startPosition.z + (originalPosition.z - startPosition.z) * progress;
          
        });
        
        // 强制渲染
        if (renderer && camera && scene) {
          renderer.render(scene, camera);
        }
      },
      onComplete: () => {
        console.log('设备动画复位完成');
      }
    });    
  }
  
  return {
    rackViewState,
    createSingleRackScene,
    destroySingleRackScene,
    animateRackRotation,
    switchToFrontView,
    handleSingleRackViewClick,
    animateRackDevice,
    resetRackDeviceAnimation
  };
}