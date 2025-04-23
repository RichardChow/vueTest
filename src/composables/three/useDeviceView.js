// src/composables/three/useDeviceView.js

import * as THREE from 'three';
import { reactive } from 'vue';

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
    }
  });

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
      setupDeviceInteractivity,
      sceneState,
      emitViewChanged
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
        }
      });
      
      // 6. 添加设备到场景原点
      origin.add(deviceClone);
      
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
      const cameraDistance = (maxDim / 2) / Math.tan(fov / 2) * 1.5;
      
      // 设置相机位置 - 稍微斜向上的视角
      camera.position.set(
        center.x + cameraDistance * 0.8,
        center.y + cameraDistance * 0.5,
        center.z + cameraDistance * 0.8
      );
      
      // 设置相机目标
      controls.target.set(center.x, center.y, center.z);
      controls.update();
      
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
      
      console.log('单设备视图创建完成');
      return true;
    } catch (error) {
      console.error('创建单设备视图时出错:', error);
      return false;
    }
  }

  /**
   * 销毁单设备视图
   * @param {Object} context - 场景上下文
   * @returns {Boolean} 是否成功销毁
   */
  function destroySingleDeviceScene(context) {
    const { scene, sceneState, mainModel, emitViewChanged, renderer, camera } = context;
    
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
      
      console.log('单设备视图清理完成');
      return true;
    } catch (error) {
      console.error('清理单设备视图时出错:', error);
      return false;
    }
  }

  /**
   * 动画展示设备
   * @param {Object} deviceObject - 设备对象
   * @param {Object} context - 场景上下文
   * @returns {Boolean} 是否成功开始动画
   */
  function animateDevice(deviceObject, context) {
    if (!deviceViewState.isActive || !deviceViewState.deviceParts.length) {
      console.error('无法执行设备动画：设备视图未激活或无部件');
      return false;
    }
    
    const { animationState } = deviceViewState;
    const { renderer, camera, scene } = context;
    
    // 如果已经在动画中，则忽略请求
    if (animationState.isAnimating) return false;
    
    animationState.isAnimating = true;
    
    // 根据当前阶段执行不同动画
    switch (animationState.stage) {
      case 0: // 初始状态：执行弹出动画
        console.log('执行设备弹出动画');
        // 这里可以实现弹出动画逻辑
        animationState.stage = 1;
        break;
        
      case 1: // 弹出状态：执行展开动画
        console.log('执行设备展开动画');
        // 这里可以实现展开动画逻辑
        animationState.stage = 2;
        break;
        
      case 2: // 展开状态：返回初始状态
        console.log('重置设备到初始状态');
        // 这里可以实现重置动画逻辑
        animationState.stage = 0;
        break;
    }
    
    // 更新场景渲染
    if (renderer && camera && scene) {
      renderer.render(scene, camera);
    }
    
    // 动画完成
    animationState.isAnimating = false;
    
    return true;
  }

  return {
    deviceViewState,
    createSingleDeviceScene,
    destroySingleDeviceScene,
    animateDevice
  };
}