import { ref, shallowRef } from 'vue';
import * as THREE from 'three';
import { saveOriginalColor, restoreOriginalColor } from '@/utils/threeUtils';
import { isDevice } from '@/utils/deviceUtils';

/**
 * 场景对象管理器composable
 * 
 * 负责管理场景中的对象、高亮状态和交互逻辑
 */
export default function useSceneObjects() {
  // 场景中的主要对象
  const sceneModel = shallowRef(null);          // 整个场景模型
  const mainSceneContainer = shallowRef(null);   // 主场景容器
  const racks = ref([]);                         // 所有机架
  const devices = ref([]);                       // 所有设备
  
  // 当前视图的特定对象
  const currentSceneContainer = shallowRef(null);
  const currentRack = shallowRef(null);
  const currentDevice = shallowRef(null);
  
  // 高亮状态管理
  const highlightedObject = shallowRef(null);
  const originalColors = ref(new Map());
  const HIGHLIGHT_COLOR = new THREE.Color(0x00aaff);
  
  /**
   * 设置场景主模型
   * @param {THREE.Object3D} model - 加载的场景模型
   */
  function setSceneModel(model) {
    sceneModel.value = model;
    mainSceneContainer.value = model;
    currentSceneContainer.value = model;
    
    // 重置对象列表
    racks.value = [];
    devices.value = [];
  }
  
  /**
   * 查找并缓存场景中的所有机架和设备
   */
  function findAllObjects() {
    if (!sceneModel.value) return;
    
    // 找到所有的机架和设备
    const foundRacks = [];
    const foundDevices = [];
    
    sceneModel.value.traverse((obj) => {
      if (obj.name && obj.name.toLowerCase().includes('rack')) {
        foundRacks.push(obj);
      } else if (isDevice(obj)) {
        foundDevices.push(obj);
      }
    });
    
    // 更新缓存
    racks.value = foundRacks;
    devices.value = foundDevices;
    
    console.log(`找到 ${foundRacks.length} 个机架和 ${foundDevices.length} 个设备`);
  }
  
  /**
   * 根据名称查找对象
   * @param {String} name - 对象名称
   * @param {THREE.Object3D} container - 搜索的容器，默认为主场景
   * @returns {THREE.Object3D|null} - 找到的对象或null
   */
  function findObjectByName(name, container = null) {
    const searchContainer = container || sceneModel.value;
    if (!searchContainer) return null;
    
    return searchContainer.getObjectByName(name);
  }
  
  /**
   * 高亮对象
   * @param {THREE.Object3D} object - 要高亮的对象
   * @param {THREE.Color} color - 高亮颜色，默认为预设的高亮色
   */
  function highlightObject(object, color = HIGHLIGHT_COLOR) {
    if (!object) return;
    
    // 保存当前高亮对象的引用
    highlightedObject.value = object;
    
    // 保存原始颜色并应用高亮色
    saveOriginalColor(object, originalColors.value);
    
    // 设置高亮颜色
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(mat => {
          if (mat.color) mat.color.copy(color);
        });
      } else if (object.material.color) {
        object.material.color.copy(color);
      }
    }
    
    // 高亮子对象
    object.traverse(child => {
      if (child !== object && child.material) {
        saveOriginalColor(child, originalColors.value);
        
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => {
            if (mat.color) mat.color.copy(color);
          });
        } else if (child.material.color) {
          child.material.color.copy(color);
        }
      }
    });
  }
  
  /**
   * 重置高亮状态
   */
  function resetHighlight() {
    if (highlightedObject.value) {
      restoreOriginalColor(highlightedObject.value, originalColors.value);
      
      // 恢复子对象的颜色
      highlightedObject.value.traverse(child => {
        if (child !== highlightedObject.value) {
          restoreOriginalColor(child, originalColors.value);
        }
      });
      
      highlightedObject.value = null;
    }
  }
  
  /**
   * 设置当前场景容器
   * @param {THREE.Object3D} container - 新的场景容器
   */
  function setCurrentSceneContainer(container) {
    currentSceneContainer.value = container;
  }
  
  /**
   * 设置当前机架
   * @param {THREE.Object3D} rack - 机架对象
   */
  function setCurrentRack(rack) {
    currentRack.value = rack;
  }
  
  /**
   * 设置当前设备
   * @param {THREE.Object3D} device - 设备对象
   */
  function setCurrentDevice(device) {
    currentDevice.value = device;
  }
  
  return {
    // 场景对象引用
    sceneModel,
    mainSceneContainer,
    currentSceneContainer,
    racks,
    devices,
    currentRack,
    currentDevice,
    
    // 高亮状态管理
    highlightedObject,
    originalColors,
    HIGHLIGHT_COLOR,
    
    // 方法
    setSceneModel,
    findAllObjects,
    findObjectByName,
    highlightObject,
    resetHighlight,
    setCurrentSceneContainer,
    setCurrentRack,
    setCurrentDevice
  };
} 