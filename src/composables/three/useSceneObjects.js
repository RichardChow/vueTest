import * as THREE from 'three';
import { ref, reactive, shallowRef } from 'vue';
/**
 * 场景对象管理和查询功能Composable
 * 提供对象查找、属性设置、分组等功能
 */
export function useSceneObjects() {
  // 场景中的主要对象
  const sceneModel = shallowRef(null);          // 整个场景模型
  const mainSceneContainer = shallowRef(null);   // 主场景容器
  const racks = ref([]);                         // 所有机架
  const devices = ref([]);                       // 所有设备
  
  // 当前视图的特定对象
  const currentSceneContainer = shallowRef(null);
  const currentRack = shallowRef(null);
  const currentDevice = shallowRef(null);
  
  // 状态管理
  const state = reactive({
    objectRegistry: new Map(), // 注册的对象映射
    selectedObjects: new Map(), // 当前选中的对象
    hoveredObject: null, // 当前悬停的对象
    originalMaterials: new Map(), // 原始材质信息
    originalTransforms: new Map(), // 原始变换信息
    HIGHLIGHT_COLOR: new THREE.Color(0x00aaff)
  });

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
   * 判断对象是否为设备
   * @param {THREE.Object3D} object - 要检查的对象
   * @returns {boolean} 是否为设备
   */
  function isDevice(object) {
    return object && (
      (object.name && object.name.startsWith('NE_')) || 
      (object.userData && object.userData.type === 'device') ||
      (object.name && (
        object.name.includes('server') || 
        object.name.includes('switch') || 
        object.name.includes('router') || 
        object.name.includes('storage')
      ))
    );
  }
  
  /**
   * 在场景中查找对象
   * @param {THREE.Scene} scene - Three.js场景
   * @param {string} name - 对象名称
   * @param {boolean} [exact=true] - 是否精确匹配名称
   * @returns {THREE.Object3D|null} 找到的对象或null
   */
  function findObjectByName(scene, name, exact = true) {
    const searchScene = scene || sceneModel.value;
    if (!searchScene || !name) return null;

    // 尝试精确匹配
    const exactMatch = searchScene.getObjectByName(name);
    if (exactMatch || exact) return exactMatch;

    // 如果允许非精确匹配，查找包含该名称的对象
    let foundObject = null;
    searchScene.traverse(object => {
      if (object.name && object.name.includes(name) && !foundObject) {
        foundObject = object;
      }
    });

    return foundObject;
  }

  /**
   * 查找设备对象 - 增强版，支持通过子部件找到父级网元设备
   * @param {THREE.Scene} scene - Three.js场景
   * @param {string} deviceName - 设备名称
   * @returns {THREE.Object3D|null} 找到的设备对象或null
   */
  function findDeviceByName(scene, deviceName) {
    const searchScene = scene || sceneModel.value;
    if (!searchScene || !deviceName) {
      console.error('场景未初始化或设备名称为空，无法查找设备');
      return null;
    }
    
    let foundDevice = null;
    
    // 尝试直接查找完整匹配
    searchScene.traverse(object => {
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
    searchScene.traverse(object => {
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
      searchScene.traverse(object => {
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
      
      searchScene.traverse(object => {
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

  /**
   * 查找机架对象
   * @param {THREE.Scene} scene - Three.js场景
   * @param {string} rackName - 机架名称
   * @returns {THREE.Object3D|null} 找到的机架对象或null
   */
  function findRackByName(scene, rackName) {
    const searchScene = scene || sceneModel.value;
    if (!searchScene || !rackName) return null;
    
    // 尝试直接查找完整匹配
    const exactMatch = searchScene.getObjectByName(rackName);
    if (exactMatch) return exactMatch;
    
    // 尝试查找包含"Rack"并且名称匹配的对象
    let foundRack = null;
    
    searchScene.traverse(object => {
      if (object.name && 
          object.name.toLowerCase().includes('rack') && 
          object.name.includes(rackName) && 
          !foundRack) {
        foundRack = object;
      }
    });
    
    return foundRack;
  }

  /**
   * 获取对象的父级网元设备
   * @param {THREE.Object3D} object - Three.js对象
   * @returns {THREE.Object3D|null} 父级网元设备或null
   */
  function getParentNetworkElement(object) {
    if (!object) return null;
    
    // 检查对象自身是否为网元设备
    if (object.name && object.name.startsWith('NE_')) {
      return object;
    }
    
    // 向上遍历查找父级网元设备
    let currentParent = object.parent;
    while (currentParent) {
      if (currentParent.name && currentParent.name.startsWith('NE_')) {
        return currentParent;
      }
      currentParent = currentParent.parent;
    }
    
    return null;
  }

  /**
   * 收集设备的所有部件
   * @param {THREE.Scene} scene - Three.js场景
   * @param {THREE.Object3D} deviceObject - 设备对象
   * @returns {Array<THREE.Object3D>} 设备部件数组
   */
  function collectDeviceParts(scene, deviceObject) {
    const searchScene = scene || sceneModel.value;
    if (!searchScene || !deviceObject) return [];
    
    const deviceParts = [];
    const deviceId = deviceObject.userData?.originalDevice || deviceObject.name;
    
    searchScene.traverse(obj => {
      if (obj.isMesh && (
        obj === deviceObject || 
        (obj.userData && obj.userData.originalDevice === deviceId) ||
        (deviceObject.name.startsWith('NE_') && 
         obj.name.includes(deviceObject.name.split('_')[2]))
      )) {
        deviceParts.push(obj);
      }
    });
    
    // 如果没有找到其他部件，返回设备本身
    if (deviceParts.length === 0 && deviceObject.isMesh) {
      deviceParts.push(deviceObject);
    }
    
    return deviceParts;
  }

  /**
   * 检查一个对象是否是另一个对象的子对象
   * @param {THREE.Object3D} child - 要检查的子对象
   * @param {THREE.Object3D} parent - 要检查的父对象
   * @returns {boolean} 如果child是parent的子对象则返回true
   */
  function isChildOfObject(child, parent) {
    if (!child || !parent) return false;
    
    let currentParent = child.parent;
    while (currentParent) {
      if (currentParent === parent) {
        return true;
      }
      currentParent = currentParent.parent;
    }
    
    return false;
  }

  /**
   * 高亮对象
   * @param {THREE.Object3D} object - Three.js对象
   * @param {Object} options - 高亮选项
   */
  function highlightObject(object, options = {}) {
    if (!object) return;
    
    const color = options.color || state.HIGHLIGHT_COLOR;
    
    // 保存当前高亮对象的引用
    state.hoveredObject = object;
    
    // 保存原始材质（如果尚未保存）
    saveOriginalMaterial(object);
    
    // 应用高亮颜色
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(mat => {
          if (mat.color) mat.color.copy(color);
          if (mat.emissive && options.emissive) {
            mat.emissive.copy(options.emissive);
          }
        });
      } else if (object.material.color) {
        object.material.color.copy(color);
        if (object.material.emissive && options.emissive) {
          object.material.emissive.copy(options.emissive);
        }
      }
    }
    
    // 高亮子对象
    if (options.includeChildren !== false) {
      object.traverse(child => {
        if (child !== object && child.material) {
          saveOriginalMaterial(child);
          
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              if (mat.color) mat.color.copy(color);
              if (mat.emissive && options.emissive) {
                mat.emissive.copy(options.emissive);
              }
            });
          } else if (child.material.color) {
            child.material.color.copy(color);
            if (child.material.emissive && options.emissive) {
              child.material.emissive.copy(options.emissive);
            }
          }
        }
      });
    }
  }

  /**
   * 重置对象的高亮效果
   * @param {THREE.Object3D} object - Three.js对象
   */
  function resetHighlight(object) {
    const targetObject = object || state.hoveredObject;
    if (!targetObject) return;
    
    resetObjectMaterial(targetObject);
    
    // 重置子对象的材质
    targetObject.traverse(child => {
      if (child !== targetObject) {
        resetObjectMaterial(child);
      }
    });
    
    // 清除当前悬停对象
    if (state.hoveredObject === targetObject) {
      state.hoveredObject = null;
    }
  }
  
  /**
   * 重置单个对象的材质
   * @param {THREE.Object3D} object - Three.js对象 
   */
  function resetObjectMaterial(object) {
    if (!object || !object.material) return;
    
    const originalMaterial = state.originalMaterials.get(object.id);
    if (!originalMaterial) return;
    
    // 恢复原始材质属性
    if (Array.isArray(object.material)) {
      object.material.forEach((mat, index) => {
        const origMat = state.originalMaterials.get(`${object.id}_${index}`);
        if (origMat && mat.color) {
          mat.color.copy(origMat.color);
          if (mat.emissive && origMat.emissive) {
            mat.emissive.copy(origMat.emissive);
          } else if (mat.emissive) {
            mat.emissive.set(0, 0, 0);
          }
        }
      });
    } else if (object.material.color && originalMaterial.color) {
      object.material.color.copy(originalMaterial.color);
      if (object.material.emissive && originalMaterial.emissive) {
        object.material.emissive.copy(originalMaterial.emissive);
      } else if (object.material.emissive) {
        object.material.emissive.set(0, 0, 0);
      }
    }
  }

  /**
   * 保存对象的原始材质信息
   * @param {THREE.Object3D} object - Three.js对象
   */
  function saveOriginalMaterial(object) {
    if (!object || !object.material) return;
    
    // 如果已经保存过了，就不再保存
    if (state.originalMaterials.has(object.id)) return;
    
    // 处理材质数组
    if (Array.isArray(object.material)) {
      object.material.forEach((mat, index) => {
        if (mat && mat.color) {
          state.originalMaterials.set(
            `${object.id}_${index}`,
            {
              color: mat.color.clone(),
              emissive: mat.emissive ? mat.emissive.clone() : null
            }
          );
        }
      });
    } 
    // 处理单个材质
    else if (object.material.color) {
      state.originalMaterials.set(
        object.id,
        {
          color: object.material.color.clone(),
          emissive: object.material.emissive ? object.material.emissive.clone() : null
        }
      );
    }
  }

  /**
   * 保存对象的原始变换信息
   * @param {THREE.Object3D} object - Three.js对象
   */
  function saveOriginalTransform(object) {
    if (!object) return;
    
    state.originalTransforms.set(object.id, {
      position: object.position.clone(),
      rotation: object.rotation.clone(),
      scale: object.scale.clone()
    });
  }

  /**
   * 重置对象的变换
   * @param {THREE.Object3D} object - Three.js对象
   */
  function resetTransform(object) {
    if (!object) return;
    
    const originalTransform = state.originalTransforms.get(object.id);
    if (!originalTransform) return;
    
    object.position.copy(originalTransform.position);
    object.rotation.copy(originalTransform.rotation);
    object.scale.copy(originalTransform.scale);
  }

  /**
   * 设置对象交互属性
   * @param {THREE.Object3D} object - Three.js对象
   * @param {Object} options - 交互选项
   */
  function setupObjectInteractivity(object, options = {}) {
    if (!object) return;
    
    // 确保userData存在
    if (!object.userData) object.userData = {};
    
    // 设置基本交互属性
    object.userData.isInteractive = options.isInteractive ?? true;
    
    // 根据名称推断类型
    if (options.type) {
      object.userData.type = options.type;
    } else if (object.name) {
      if (object.name.startsWith('NE_')) {
        object.userData.type = 'NE';
      } else if (object.name.toLowerCase().includes('rack')) {
        object.userData.type = 'rack';
      } else {
        object.userData.type = 'device';
      }
    }
    
    // 设置其他自定义属性
    if (options.category) object.userData.category = options.category;
    if (options.status) object.userData.status = options.status;
    
    // 保存原始材质信息
    if (object.isMesh && object.material) {
      saveOriginalMaterial(object);
    }
  }

  return {
    // 状态和引用
    state,
    sceneModel,
    mainSceneContainer,
    currentSceneContainer,
    racks,
    devices,
    currentRack,
    currentDevice,
    
    // 对象管理方法
    setSceneModel,
    findAllObjects,
    isDevice,
    
    // 查找方法
    findObjectByName,
    findDeviceByName,
    findRackByName,
    getParentNetworkElement,
    collectDeviceParts,
    isChildOfObject,
    
    // 高亮和变换管理
    highlightObject,
    resetHighlight,
    saveOriginalMaterial,
    resetObjectMaterial,
    saveOriginalTransform,
    resetTransform,
    
    // 交互设置
    setupObjectInteractivity,
    
    // 视图管理
    setCurrentRack(rack) { currentRack.value = rack; },
    setCurrentDevice(device) { currentDevice.value = device; },
    setCurrentSceneContainer(container) { currentSceneContainer.value = container; }
  };
} 