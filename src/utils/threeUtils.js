import * as THREE from 'three';
import { isDevice, isNetworkElement } from '@/utils/deviceUtils';

/**
 * 缓动函数 - 三次方缓入缓出
 * @param {number} t - 0到1之间的进度值
 * @returns {number} 缓动后的进度值
 */
export function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 缓动函数 - 三次方缓出
 * @param {number} t - 0到1之间的进度值
 * @returns {number} 缓动后的进度值
 */
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * 查找父对象链中的指定对象
 * @param {THREE.Object3D} child - 子对象
 * @param {THREE.Object3D} parent - 要查找的父对象
 * @returns {boolean} 如果parent是child的祖先则返回true
 */
export function isChildOfObject(child, parent) {
  let current = child.parent;
  while (current) {
    if (current === parent) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * 保存对象的原始颜色
 * @param {THREE.Object3D} object - Three.js对象
 * @param {Map} colorMap - 用于存储颜色的Map对象
 */
export function saveOriginalColor(object, colorMap) {
  if (!object || !object.material) return;
  
  if (Array.isArray(object.material)) {
    // 处理多材质对象
    const materials = [];
    object.material.forEach((mat, index) => {
      if (mat.color) {
        materials.push({
          index,
          color: mat.color.clone()
        });
      }
    });
    if (materials.length > 0) {
      colorMap.set(object.uuid, { type: 'array', materials });
    }
  } else if (object.material.color) {
    // 处理单一材质对象
    colorMap.set(object.uuid, {
      type: 'single',
      color: object.material.color.clone()
    });
  }
}

/**
 * 恢复对象的原始颜色
 * @param {THREE.Object3D} object - Three.js对象
 * @param {Map} colorMap - 存储颜色的Map对象
 */
export function restoreOriginalColor(object, colorMap) {
  if (!object || !object.material || !colorMap.has(object.uuid)) return;
  
  const savedData = colorMap.get(object.uuid);
  
  if (savedData.type === 'array' && Array.isArray(object.material)) {
    // 恢复多材质对象颜色
    savedData.materials.forEach(item => {
      if (object.material[item.index] && object.material[item.index].color) {
        object.material[item.index].color.copy(item.color);
      }
    });
  } else if (savedData.type === 'single' && object.material.color) {
    // 恢复单一材质对象颜色
    object.material.color.copy(savedData.color);
  }
  
  // 从Map中移除记录
  colorMap.delete(object.uuid);
}

/**
 * 释放场景资源
 * @param {THREE.Scene} scene - 要释放的场景
 */
export function disposeScene(scene) {
  if (!scene) return;
  
  scene.traverse((object) => {
    if (object.geometry) {
      object.geometry.dispose();
    }
    
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(material => disposeMaterial(material));
      } else {
        disposeMaterial(object.material);
      }
    }
  });
}

/**
 * 释放材质资源
 * @param {THREE.Material} material - 要释放的材质
 */
export function disposeMaterial(material) {
  if (!material) return;
  
  // 清理材质的所有纹理和相关资源
  if (material.map) material.map.dispose();
  if (material.lightMap) material.lightMap.dispose();
  if (material.bumpMap) material.bumpMap.dispose();
  if (material.normalMap) material.normalMap.dispose();
  if (material.displacementMap) material.displacementMap.dispose();
  if (material.specularMap) material.specularMap.dispose();
  if (material.envMap) material.envMap.dispose();
  
  // 通用检查所有可能的纹理
  for (const key in material) {
    const value = material[key];
    if (value && value.isTexture) {
      value.dispose();
    }
  }
  
  // 清理材质本身
  material.dispose();
}

/**
 * 递归清理场景中的资源
 * @param {THREE.Object3D} obj - 要清理的对象
 */
export function disposeSceneResources(obj) {
  if (!obj) return;
  
  // 递归处理子对象
  if (obj.children && obj.children.length > 0) {
    // 创建一个副本进行遍历，因为在遍历过程中会修改children数组
    const children = [...obj.children];
    for (const child of children) {
      disposeSceneResources(child);
    }
  }
  
  // 从父级中移除
  if (obj.parent) {
    obj.parent.remove(obj);
  }
  
  // 清理几何体
  if (obj.geometry) {
    obj.geometry.dispose();
  }
  
  // 清理材质
  if (obj.material) {
    if (Array.isArray(obj.material)) {
      for (const material of obj.material) {
        disposeMaterial(material);
      }
    } else {
      disposeMaterial(obj.material);
    }
  }
}

/**
 * 创建基础的Three.js场景、相机和渲染器
 * @param {HTMLElement} container - 容器元素
 * @param {Object} options - 配置选项
 * @returns {Object} - 包含场景、相机和渲染器的对象
 */
export function createBasicThreeComponents(container, options = {}) {
  // 创建场景
  const scene = new THREE.Scene();
  if (options.sceneBackground) {
    scene.background = new THREE.Color(options.sceneBackground);
  }
  
  // 创建相机
  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(
    options.fov || 45,
    aspect,
    options.near || 0.1,
    options.far || 1000
  );
  
  // 设置相机位置
  const cameraPosition = options.cameraPosition || { x: 5, y: 5, z: 5 };
  camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
  camera.lookAt(0, 0, 0);
  
  // 创建渲染器
  const renderer = new THREE.WebGLRenderer({
    antialias: options.antialias !== false,
    alpha: options.alpha !== false
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  
  // 启用阴影（如果需要）
  if (options.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  
  // 将渲染器的canvas添加到容器
  container.appendChild(renderer.domElement);
  
  return { scene, camera, renderer };
}

/**
 * 创建光源
 * @param {THREE.Scene} scene - 要添加光源的场景
 * @param {Object} options - 光源配置选项
 */
export function addLightsToScene(scene, options = {}) {
  // 环境光
  const ambientIntensity = options.ambientIntensity || 0.5;
  const ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity);
  scene.add(ambientLight);
  
  // 方向光
  if (options.directionalLight !== false) {
    const directionalIntensity = options.directionalIntensity || 0.8;
    const directionalLight = new THREE.DirectionalLight(0xffffff, directionalIntensity);
    directionalLight.position.set(1, 1, 1);
    
    if (options.shadows) {
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
    }
    
    scene.add(directionalLight);
  }
  
  // 聚光灯（可选）
  if (options.spotlight) {
    const spotlightIntensity = options.spotlightIntensity || 1.0;
    const spotlight = new THREE.SpotLight(0xffffff, spotlightIntensity);
    spotlight.position.set(0, 5, 5);
    spotlight.angle = Math.PI / 6;
    spotlight.penumbra = 0.1;
    
    if (options.shadows) {
      spotlight.castShadow = true;
      spotlight.shadow.mapSize.width = 1024;
      spotlight.shadow.mapSize.height = 1024;
    }
    
    scene.add(spotlight);
  }
  
  return scene;
}

/**
 * 调整Three.js场景大小以匹配容器
 * @param {Object} threeComponents - 包含renderer和camera的对象
 * @param {HTMLElement} container - 容器元素
 */
export function resizeThreeScene(threeComponents, container) {
  const { renderer, camera } = threeComponents;
  
  // 更新相机宽高比
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  
  // 调整渲染器大小
  renderer.setSize(container.clientWidth, container.clientHeight);
}

/**
 * 将物体居中到坐标原点
 * @param {THREE.Object3D} object - 要居中的物体
 */
export function centerObject(object) {
  if (!object) return;
  
  // 计算物体的边界框
  const boundingBox = new THREE.Box3().setFromObject(object);
  const center = boundingBox.getCenter(new THREE.Vector3());
  
  // 移动物体使其居中
  object.position.sub(center);
  
  return object;
}

/**
 * 为3D对象生成唯一ID
 * @returns {string} 唯一ID
 */
export function generateUniqueObjectId() {
  return `obj_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
}

/**
 * 检查对象是否可见
 * @param {THREE.Object3D} object - 要检查的对象
 * @returns {boolean} 对象是否可见
 */
export function isObjectVisible(object) {
  if (!object) return false;
  
  // 检查对象自身的可见性
  if (!object.visible) return false;
  
  // 检查所有父对象的可见性
  let parent = object.parent;
  while (parent) {
    if (!parent.visible) return false;
    parent = parent.parent;
  }
  
  return true;
} 