// src/composables/three/useRackView.js
import * as THREE from 'three';
import { reactive } from 'vue';

export function useRackView() {
  // 维护机架视图状态
  const rackViewState = reactive({
    selectedRack: null,
    isActive: false,
    sceneContainer: null,
    sceneOrigin: null
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
      
      console.log('单机架视图清理完成');
      return true;
    } catch (error) {
      console.error('清理单机架视图时出错:', error);
      return false;
    }
  }

  return {
    rackViewState,
    createSingleRackScene,
    destroySingleRackScene
  };
}