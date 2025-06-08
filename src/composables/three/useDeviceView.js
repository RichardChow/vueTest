// src/composables/three/useDeviceView.js

import * as THREE from 'three';
import { reactive } from 'vue';
import { findLayoutMarkers, getRackOrientation } from '@/utils/layoutUtils';

export function useDeviceView() {
  // 维护设备视图状态
  const deviceViewState = reactive({
    selectedDevice: null,
    isActive: false,
    sceneContainer: null,
    sceneOrigin: null,
    deviceParts: [],
    animationState: {
      stage: 0, // 0=初始, 1=弹出, 2=展开
      isAnimating: false
    },
    originalMinDistance: null,
    layoutMarkers: new Map() // 存储布局标记
  });

  /**
   * 初始化布局标记
   * @param {THREE.Object3D} model - 场景模型
   * @returns {Map<string, Object>} 布局标记映射
   */
  function initLayoutMarkers(model) {
    if (!model) return new Map();
    
    // 查找并存储所有布局标记
    deviceViewState.layoutMarkers = findLayoutMarkers(model);
    console.log(`设备视图: 找到 ${deviceViewState.layoutMarkers.size} 个布局标记`);
    return deviceViewState.layoutMarkers;
  }

  /**
   * 创建单设备视图
   * @param {Object} deviceData - 设备数据
   * @param {Object} context - 场景上下文
   * @returns {Boolean} 是否成功创建
   */
  function createSingleDeviceScene(deviceData, context) {
    const { 
      scene, 
      camera, 
      renderer, 
      controls,
      mainModel,
      getObjectByName,
      sceneState,
      emitViewChanged,
      setPickableObjects,
      setObjectParentMap
    } = context;
    
    if (!scene || !mainModel) {
      console.error('缺少基础场景或模型引用');
      return false;
    }
    
    console.log('创建单设备视图，参数:', deviceData);
    
    // 保存选中的设备信息
    deviceViewState.selectedDevice = deviceData;
    
    // 更新组件状态
    if (sceneState) {
      sceneState.selectedDevice = deviceData;
    }
    
    // 查找选中的设备对象
    const deviceObject = getObjectByName(deviceData.name);
    if (!deviceObject) {
      console.error('找不到设备对象:', deviceData.name);
      return false;
    }
    
    console.log('找到设备对象:', deviceObject.name, '位置:', deviceObject.position);
    
    try {
      // 获取当前场景引用
      const mainScene = scene;
      
      // 临时保存原始场景
      const originalModel = mainModel;
      
      // 创建新的场景容器
      const sceneChildren = [...mainScene.children];
      sceneChildren.forEach(child => {
        if (child !== originalModel && !child.isLight) {
          mainScene.remove(child);
        }
      });
      
      // 1. 清除原始模型，并创建一个新的场景容器
      mainScene.remove(originalModel);
      
      // 2. 创建新的场景容器
      const sceneContainer = new THREE.Group();
      sceneContainer.name = "SingleDeviceSceneContainer";
      mainScene.add(sceneContainer);
      
      // 3. 创建原点，用于放置设备
      const origin = new THREE.Group();
      origin.name = "SingleDeviceOrigin";
      sceneContainer.add(origin);
      
      // 在这里添加变量定义（在处理设备之前）
      const interactiveObjects = [];
      const parentMapping = new Map();
      
      // 4. 克隆设备并添加到新场景
      const deviceClone = deviceObject.clone(true);
      deviceClone.position.set(0, 0, 0); // 重置位置到原点
      
      // 5. 确保设备材质正确
      deviceClone.traverse((child) => {
        if (child.isMesh && child.material) {
          // 处理数组材质
          if (Array.isArray(child.material)) {
            child.material = child.material.map(mat => {
              // 克隆材质确保独立性
              const newMat = mat.clone();
              return newMat;
            });
          } 
          // 处理单个材质
          else {
            // 克隆材质确保独立性
            child.material = child.material.clone();
          }
          
          // 设置交互标记
          child.userData.isInteractive = true;
          child.userData.type = 'device';
          child.userData.singleDeviceView = true;
          child.userData.originalDevice = deviceObject.name;
          
          // 保存原始材质信息，用于后续动画或高亮
          child.userData.originalMaterial = {
            color: child.material.color ? child.material.color.clone() : new THREE.Color(0xcccccc),
            opacity: child.material.opacity || 1.0,
            transparent: child.material.transparent || false
          };
          
          // 禁用阴影
          child.castShadow = false;
          child.receiveShadow = false;
          
          // 添加到交互对象数组
          interactiveObjects.push(child);
          
          // 记录父级映射关系
          if (child.parent && child.parent !== deviceClone) {
            parentMapping.set(child.id, child.parent);
          }
          
          // 保存父级设备信息
          child.userData.parentDevice = {
            name: deviceData.name,
            type: deviceData.type || 'NE'
          };
        }
      });
      
      // 6. 添加设备到场景原点
      origin.add(deviceClone);
      
      // 6.5 处理设备朝向
      // 初始化布局标记（如果尚未初始化）
      if (deviceViewState.layoutMarkers.size === 0 && mainModel) {
        initLayoutMarkers(mainModel);
        console.log(`设备视图布局标记初始化完成: ${deviceViewState.layoutMarkers.size} 个标记`);
      }
      
      // 获取设备所属机架信息
      let rackName = null;
      if (deviceObject.userData && deviceObject.userData.details && deviceObject.userData.details.rack) {
        // 基本机架名称，例如 "Rack-01"
        const basicRackName = deviceObject.userData.details.rack;
        
        // 尝试在主模型中查找完整的机架名称（包含朝向信息）
        if (mainModel) {
          // 在主模型中查找完整的机架名称
          let fullRackName = null;
          console.log(`正在查找机架 ${basicRackName} 的完整名称...`);
          
          mainModel.traverse((obj) => {
            // 检查是否为目标机架（开头匹配基本名称）
            if (obj.name && obj.name.startsWith(basicRackName) && 
                obj.userData && obj.userData.type === 'Rack') {
              fullRackName = obj.name; // 保存完整名称，如 "Rack-01_east_col-01"
              console.log(`找到完整机架名称: ${fullRackName}，类型: ${obj.userData.type}`);
            }
          });
          
          // 使用找到的完整名称或回退到基本名称
          rackName = fullRackName || basicRackName;
          console.log(`设备 ${deviceData.name} 所属机架最终使用名称: ${rackName}`);
        } else {
          // 如果无法找到主模型，使用基本名称
          rackName = basicRackName;
        }
      }
      
      // 获取机架的朝向信息
      const orientationInfo = rackName ? 
        getRackOrientation(rackName, deviceViewState.layoutMarkers) : 
        { rotation: -Math.PI / 4 }; // 默认朝向左前方45度
      
      console.log('设备朝向信息:', orientationInfo);
      
      // 应用朝向
      const baseRotation = orientationInfo.rotation || 0;
      const viewOffset = -Math.PI / 2; // 左前方90度视角
      const initialRotation = baseRotation + viewOffset;
      console.log('initialRotation', initialRotation);
      
      // 设置设备旋转
      origin.rotation.y = initialRotation;
      
      // 存储朝向信息
      if (context.sceneState) {
        context.sceneState.deviceBaseOrientation = baseRotation;
        context.sceneState.deviceViewOffset = viewOffset;
      }
      
      // 7. 查找并添加设备的子部件
      const deviceParts = [];
      deviceClone.traverse(child => {
        if (child.isMesh && child !== deviceClone) {
          deviceParts.push(child);
        }
      });
      
      deviceViewState.deviceParts = deviceParts;
      console.log(`设备包含 ${deviceParts.length} 个部件`);
      
      // 8. 检查并创建设备周围的辅助几何体（可选）
      if (deviceParts.length > 0) {
        // 可以在这里添加额外的视觉元素，比如标注线、指示器等
      }
      
      // 9. 调整相机视角
      // 计算边界框，用于定位相机
      const box = new THREE.Box3().setFromObject(deviceClone);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // 计算适当的相机距离
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraDistance = (maxDim / 2) / Math.tan(fov / 2) * 1.5;
      
      // 确保cameraDistance不是0或负数，如果模型非常小
      if (cameraDistance <= 0) {
          cameraDistance = 1; // 设置一个最小默认距离
      }
      
      // 修改相机位置 - 从右前方45度角观察设备
      camera.position.set(
        center.x - cameraDistance * 0.85,
        center.y + maxDim * 0.1,
        center.z + cameraDistance * 0.85
      );
      
      // 控制器目标点保持不变
      controls.target.set(
        center.x,
        center.y,
        center.z
      );
      
      // 新增：调整OrbitControls的minDistance允许更近观察
      if (controls) {
        // 保存原始的minDistance，如果尚未保存
        if (deviceViewState.originalMinDistance === null) {
            deviceViewState.originalMinDistance = controls.minDistance;
        }
        // 允许相机靠近到模型尺寸的一小部分，例如模型最大维度的10%
        // 或者一个较小的固定值，确保可以放大
        controls.minDistance = Math.max(0.1, maxDim * 0.1); 
        // 你也可以根据需要设置一个非常小的值，如 controls.minDistance = 0.01;
        // 但要注意不要设置得太小以至于相机穿透模型
        console.log(`单设备视图: controls.minDistance 设置为 ${controls.minDistance}`);
      }
      
      controls.update(); // 应用相机和目标点的变化
      
      // 强制更新矩阵以确保准确的交互计算
      sceneContainer.updateWorldMatrix(true, true);
      
      // 10. 强制重绘场景
      if (renderer) {
        renderer.render(mainScene, camera);
      }
      
      // 11. 更新状态
      deviceViewState.isActive = true;
      deviceViewState.sceneContainer = sceneContainer;
      deviceViewState.sceneOrigin = origin;
      
      // 更新组件状态
      if (sceneState) {
        sceneState.currentView = 'single-device';
        sceneState.singleDeviceScene = sceneContainer;
      }
      
      // 12. 通知父组件视图已变更
      if (emitViewChanged) {
        emitViewChanged({
          view: 'single-device',
          data: deviceData
        });
      }
      
      // 设置可交互对象和父级映射
      if (setPickableObjects) {
        setPickableObjects(interactiveObjects);
      }
      
      if (setObjectParentMap) {
        setObjectParentMap(parentMapping);
      }
      
      console.log('单设备视图创建完成');
      return true;
    } catch (error) {
      console.error('创建单设备视图时出错:', error);
      // 确保在出错时也尝试恢复controls的设置（如果已修改）
      if (controls && deviceViewState.originalMinDistance !== null) {
          controls.minDistance = deviceViewState.originalMinDistance;
          deviceViewState.originalMinDistance = null; // 重置保存的值
      }
      return false;
    }
  }

  /**
   * 销毁单设备视图
   * @param {Object} context - 场景上下文
   * @returns {Boolean} 是否成功销毁
   */
  function destroySingleDeviceScene(context) {
    const { scene, sceneState, mainModel, emitViewChanged, renderer, camera, controls } = context;
    
    if (!deviceViewState.isActive) return false;
    
    try {
      console.log('开始清理单设备视图');
      
      // 1. 查找并移除所有为单设备视图创建的容器和对象
      const container = scene.getObjectByName("SingleDeviceSceneContainer");
      const origin = scene.getObjectByName("SingleDeviceOrigin");
      
      // 记录要移除的对象列表
      const objectsToRemove = [];
      
      // 查找所有相关对象
      scene.traverse((object) => {
        // 检查与单设备视图相关的所有对象
        if (object.name && (
            object.name === "SingleDeviceSceneContainer" || 
            object.name === "SingleDeviceOrigin" ||
            (object.userData && object.userData.singleDeviceView === true)
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
        console.log('移除单设备容器');
        container.parent.remove(container);
      }
      
      if (origin && origin.parent) {
        console.log('移除单设备原点');
        origin.parent.remove(origin);
      }
      
      // 3. 清理可能残留的资源
      deviceViewState.deviceParts.forEach(part => {
        if (part.geometry) part.geometry.dispose();
        if (part.material) {
          if (Array.isArray(part.material)) {
            part.material.forEach(mat => mat.dispose());
          } else {
            part.material.dispose();
          }
        }
      });
      
      // 4. 恢复主场景模型
      if (mainModel && !scene.children.includes(mainModel)) {
        console.log('重新添加主场景模型');
        scene.add(mainModel);
      }
      
      // 5. 更新状态
      deviceViewState.isActive = false;
      deviceViewState.selectedDevice = null;
      deviceViewState.sceneContainer = null;
      deviceViewState.sceneOrigin = null;
      deviceViewState.deviceParts = [];
      
      // 6. 更新组件状态
      if (sceneState) {
        sceneState.currentView = 'main';
        sceneState.selectedDevice = null;
        sceneState.singleDeviceScene = null;
      }
      
      // 7. 强制重绘场景
      if (renderer && camera) {
        renderer.render(scene, camera);
      }
      
      // 8. 通知父组件
      if (emitViewChanged) {
        emitViewChanged({
          view: 'main',
          data: null
        });
      }
      
      // 新增：恢复OrbitControls的原始minDistance
      if (controls && deviceViewState.originalMinDistance !== null) {
        controls.minDistance = deviceViewState.originalMinDistance;
        console.log(`单设备视图销毁: controls.minDistance 恢复为 ${controls.minDistance}`);
        deviceViewState.originalMinDistance = null; // 重置，以便下次正确保存
      }
      
      console.log('单设备视图清理完成');
      return true;
    } catch (error) {
      console.error('清理单设备视图时出错:', error);
      return false;
    }
  }

  return {
    deviceViewState,
    createSingleDeviceScene,
    destroySingleDeviceScene,
    initLayoutMarkers
  };
}