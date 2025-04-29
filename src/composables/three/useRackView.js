// src/composables/three/useRackView.js
import * as THREE from 'three';
import { reactive } from 'vue';

const easeInOutCubic = (t) => {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

const easeOutCubic = (t) => {
  return 1 - Math.pow(1 - t, 3);
};


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

  /**
   * 创建单机架视图
   * @param {Object} rackData - 机架数据
   * @param {Object} context - 场景上下文
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
      emitViewChanged
    } = context;
    
    if (!scene || !mainModel) {
      console.error('缺少基础场景或模型引用');
      return false;
    }
    
    console.log('创建单机架视图，参数:', rackData);
    
    // 保存选中的机架信息
    rackViewState.selectedRack = rackData;
    
    // 更新组件状态
    if (sceneState) {
      sceneState.selectedRack = rackData;
    }
    
    // 查找选中的机架对象
    const rackObject = getObjectByName(rackData.name);
    if (!rackObject) {
      console.error('找不到机架对象:', rackData.name);
      return false;
    }
    
    console.log('找到机架对象:', rackObject.name, '位置:', rackObject.position);
    
    try {
      // 提取机架名称，用于匹配相关设备
      let rackBaseName = '';
      if (rackData.name.includes('Rack-')) {
        rackBaseName = rackData.name.split('_')[0]; // 获取"Rack-XX"部分
        console.log('提取的机架基本名称:', rackBaseName);
      } else {
        // 如果没有标准命名，使用整个名称
        rackBaseName = rackData.name;
      }
      
      // 创建新的场景
      const mainScene = scene;
      const sceneChildren = [...mainScene.children];
      sceneChildren.forEach(child => {
        if (child !== mainModel && !child.isLight) {
          mainScene.remove(child);
        }
      });
      
      // 1. 清除原始模型，并创建一个新的场景容器
      mainScene.remove(mainModel);
      
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
      mainModel.traverse((child) => {
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
          if (sceneState && sceneState.currentDevicePositions) {
            sceneState.currentDevicePositions.set(deviceClone.id, deviceClone.position.clone());
          }
          
          // 添加到场景原点
          origin.add(deviceClone);
          deviceCount++;
          
          // 设置设备交互
          if (setupDeviceInteractivity) {
            setupDeviceInteractivity(deviceClone);
          }
          
          console.log(`添加设备到单机架视图: ${child.name}`);
        }
      });
      
      console.log(`添加了 ${deviceCount} 个设备到单机架视图`);
      
      // 8. 旋转整个原点以获得更好的视角
      origin.rotation.y = Math.PI / 4; // 改为45度，以获得侧面视图效果
      if (sceneState) {
        sceneState.isFrontView = false; // 初始设置为侧面视图
      }
      
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
      
      // 强制更新矩阵以确保准确的交互计算
      sceneContainer.updateWorldMatrix(true, true);
      
      // 强制重绘场景
      if (renderer) {
        renderer.render(mainScene, camera);
      }
      
      // 保存状态
      rackViewState.isActive = true;
      rackViewState.sceneContainer = sceneContainer;
      rackViewState.sceneOrigin = origin;
      
      // 更新组件状态
      if (sceneState) {
        sceneState.currentView = 'single-rack';
        sceneState.singleRackScene = sceneContainer;
        sceneState.singleRackContainer = sceneContainer;
        sceneState.singleRackOrigin = origin;
      }
      
      // 通知父组件视图已变更
      if (emitViewChanged) {
        emitViewChanged({
          view: 'single-rack',
          data: rackData
        });
      }
      
      // 重置第一次点击标记
      rackViewState.firstNetworkElementClick = true;
      
      console.log('单机架视图创建完成');
      return true;
    } catch (error) {
      console.error('创建单机架视图时出错:', error);
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
      
      // 6. 更新状态
      rackViewState.isActive = false;
      rackViewState.selectedRack = null;
      rackViewState.sceneContainer = null;
      rackViewState.sceneOrigin = null;
      
      // 7. 更新组件状态
      if (sceneState) {
        sceneState.currentView = 'main';
        sceneState.singleRackScene = null;
        sceneState.singleRackContainer = null;
        sceneState.singleRackOrigin = null;
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
      
      // 重置第一次点击标记
      rackViewState.firstNetworkElementClick = true;
      
      console.log('单机架视图清理完成');
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
    const startTime = Date.now();
    
    // 定义动画函数
    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1); // 0到1之间的进度值
      
      // 使用缓动函数使动画更加平滑
      const easedProgress = easeInOutCubic(progress);
      
      // 计算当前旋转角度
      const currentRotation = startRotation + (targetRotation - startRotation) * easedProgress;
      
      // 应用旋转
      origin.rotation.y = currentRotation;
      
      // 强制渲染
      if (renderer && camera && scene) {
        renderer.render(scene, camera);
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
    // 检查是否为网元设备
    const isNetworkElement = data.name && data.name.startsWith('NE_');
    
    // 如果是网元设备
    if (isNetworkElement) {
      console.log('单机架视图中点击网元设备:', data.name);
      
      // 如果当前是侧面视图，则先切换到正面视图
      if (!rackViewState.isFrontView && !sceneState?.isFrontView) {
        console.log('单机架视图中点击，切换到正面视图');
        switchToFrontView(context);
      }
      
      // 检查是否是第一次点击网元
      if (rackViewState.firstNetworkElementClick) {
        console.log('第一次点击网元，仅切换视图，不执行弹出动画');
        rackViewState.firstNetworkElementClick = false; // 更新状态
        return; // 直接返回，不执行弹出动画
      } else {
        // 非第一次点击，执行弹出动画
        console.log('非第一次点击网元，执行弹出动画');
        animateRackDevice(data.name, context);
      }
    } else if (data.type === 'rack') {
      // 点击机架对象
      console.log('单机架视图中点击机架:', data.name);
      // 如果当前是侧面视图，则切换到正面视图
      if (!rackViewState.isFrontView && !sceneState?.isFrontView) {
        switchToFrontView(context);
      }
    } else {
      // 如果点击的是其他非设备对象，不做特殊处理
      console.log('单机架视图中点击非设备对象:', data.name);
      // 如果当前是侧面视图，则切换到正面视图
      if (!rackViewState.isFrontView && !sceneState?.isFrontView) {
        console.log('单机架视图中点击，切换到正面视图');
        switchToFrontView(context);
      }
    }
  }

  // 设备动画方法 - 对外暴露的接口
  function animateRackDevice(deviceName, context) {
    const {scene, deviceInteractionState} = context;
    console.log('执行设备弹出动画:', deviceName);
    
    // 查找设备对象
    const deviceObj = findDeviceByName(deviceName, context);
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
    const duration = 500;     // 动画持续时间(毫秒)
    const startTime = Date.now();
    
    
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
      const easeProgress = easeOutCubic(progress);
      
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
      if (renderer && camera && scene) {
        renderer.render(
          scene,
          camera
        );
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  // 添加 resetRackDeviceAnimation 函数
  function resetRackDeviceAnimation(deviceObj, deviceParts, context) {
    const { renderer, camera, scene } = context;
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
      // 使用模块级别的 easeInOutCubic，而不是 this.easeInOutCubic
      const easeProgress = easeInOutCubic(progress);
      
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
      
      // 强制渲染 - 使用传入的 renderer 和 camera
      if (renderer && camera && scene) {
        renderer.render(scene, camera);
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        console.log('设备动画复位完成');
      }
    };
    
    animate();
  }


  // 查找设备对象 - 增强版，支持通过子部件找到父级网元设备
  function findDeviceByName(deviceName, context ) {
    const {scene} = context;
    if (!scene) {
      console.error('场景未初始化，无法查找设备');
      return null;
    }
    
    let foundDevice = null;
    
    // 尝试直接查找完整匹配
    scene.traverse(object => {
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
    scene.traverse(object => {
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
      scene.traverse(object => {
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
      
      scene.traverse(object => {
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
  }
  

  return {
    rackViewState,
    createSingleRackScene,
    destroySingleRackScene,
    animateRackRotation,
    switchToFrontView,
    handleSingleRackViewClick,
    animateRackDevice,
    resetRackDeviceAnimation,
    findDeviceByName
  };
}