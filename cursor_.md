# 项目概述与问题分析
_Exported on 2025/5/31 at GMT+8 14:36:05 from Cursor (0.50.5)_

---

**User**

由于我删除了之前的chat， 我们丢失了之前的记录， 你可能不知道我们项目是干什么的了， 请你查看README 和 cursor_vue_3_click_logic_debugging.md  这包含了之前的修改记录， 能让你更好了解项目， 便于后续修改。

---

**Cursor**

我已经查看了项目结构和相关文件，现在对项目有了清晰的了解：

## 项目概述

这是一个**3D机房智慧大屏项目**，基于Vue3 + Three.js + Django技术栈构建。主要功能包括：

### 核心功能
1. **3D机房可视化** - 使用Three.js渲染3D机房场景
2. **多视图切换** - 支持主视图、单机架视图、单设备视图、多机架视图
3. **设备交互** - 点击设备查看详情、状态监控、操作控制
4. **实时监控** - 温度、湿度、电力负载等环境参数
5. **告警系统** - 设备状态告警和统计

### 技术架构
- **前端**: Vue3 + Three.js + SCSS
- **后端**: Django (API服务)
- **3D模型**: GLTF格式的机房模型
- **UI框架**: 自定义科技风格UI组件

### 当前问题分析

从`cursor_vue_3_click_logic_debugging.md`文档中，我看到之前遇到的主要问题是：

1. **点击事件处理复杂** - 多层嵌套的点击逻辑导致事件处理混乱
2. **视图切换问题** - 在不同视图间切换时状态管理不一致
3. **设备详情面板** - 显示/隐藏逻辑需要优化
4. **交互对象管理** - 可拾取对象的设置和更新机制需要改进

### 项目结构特点

1. **组件化设计** - 使用Composables模式管理复杂逻辑
2. **状态管理** - 通过reactive对象管理场景状态
3. **事件系统** - 自定义的交互事件处理系统
4. **模块化** - 将不同功能拆分到独立的composables中

### 主要文件说明

- `ServerRoomScene.vue` - 3D场景主组件
- `SmartServerRoom.vue` - 智慧机房主页面
- `useRackView.js` - 机架视图管理
- `useSceneInteractions.js` - 场景交互管理
- `useTooltip.js` - 工具提示管理

现在我对项目有了全面的了解，可以帮助您继续开发和优化。请告诉我您当前遇到的具体问题或需要实现的新功能，我会基于对项目的理解提供针对性的解决方案。

---

**User**

我来简单讲下当前的状况和需要解决的问题：
1. 当前我们在处理， multi-rack视图的一些问题
2. 问题1， multi-rack视图没有返回全景视图的按钮功能
3， 问题2，如图所示， 进入multi-rack视图后 见到的多机架的排列不对， 我需要的是  以用户角度查看到的景象。 比如一个人站在第一列机架前， 它看到的机架是  从左到右， 04号机架+03号机架 + 02号机架 + 01号机架， 当站在第二列机架面前的时候， 看到的机架是（也是从左往右） 从05机架依次到11号机架， 第一列是从大到小的排列， 第二列是从小到大的排列， 是因为是第一列和第二列机架的朝向相反的。  你能理解我说的 用户角度看的效果吗

---

**Cursor**

我完全理解您描述的问题！让我来分析一下：

## 问题理解

### 问题1：缺少返回按钮
Multi-rack视图没有返回全景视图的按钮功能。

### 问题2：机架排列顺序问题
从图片可以看到，当前的多机架视图显示的是垂直排列的机架。但您需要的是**用户视角**的排列效果：

**用户站在机架前的视角：**
- **第一列**（面向用户）：从左到右看到 04→03→02→01（大到小）
- **第二列**（背对用户）：从左到右看到 05→06→07→08→09→10→11（小到大）

这是因为第一列和第二列的机架朝向相反，所以编号顺序也相反。

## 解决方案

### 1. 添加返回按钮功能

首先在`ServerRoomScene.vue`中为multi-rack视图添加状态管理：

```vue:vueTest/src/components/three/ServerRoomScene.vue
// ... existing code ...
const sceneState = reactive({
  currentView: 'main', // 'main', 'single-rack', 'single-device', 'multi-rack'
  // ... existing code ...
  multiRackType: null, // 'row' 或 'column'
  multiRackId: null,   // 行号或列号
});
```

### 2. 修复机架排列逻辑

需要修改`useRackView.js`中的`createMultiRackScene`函数，根据列号和机架朝向来正确排列：

```javascript:vueTest/src/composables/three/useRackView.js
function createMultiRackScene(rackLayout, rackId, context) {
  // ... existing code ...
  
  // 4. 为每个机架找到其关联的设备并按正确顺序排列
  const sortedRacks = multiRacks.sort((a, b) => {
    // 提取机架编号
    const getNumber = (name) => {
      const match = name.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    };
    
    const numA = getNumber(a.name);
    const numB = getNumber(b.name);
    
    if (rackLayout === 'col') {
      // 根据列号决定排序方向
      const colNum = parseInt(rackId);
      if (colNum % 2 === 1) {
        // 奇数列（第1,3,5列）：从大到小（面向用户）
        return numB - numA;
      } else {
        // 偶数列（第2,4,6列）：从小到大（背对用户）
        return numA - numB;
      }
    }
    
    return numA - numB; // 行视图保持原有逻辑
  });
  
  // 5. 克隆机架和设备到新场景
  sortedRacks.forEach((rack, index) => {
    // 克隆机架
    const rackClone = rack.clone(true);
    
    // 设置位置 - 根据行/列类型排列
    if (rackLayout === 'col') {
      // 列视图: 将机架沿X轴水平排列（用户视角）
      rackClone.position.set(index * 2, 0, 0);
    } else {
      // 行视图: 将机架沿Z轴排列
      rackClone.position.set(0, 0, index * 2);
    }
    
    // ... rest of the code ...
  });
  
  // 6. 调整相机视角为用户视角
  if (rackLayout === 'col') {
    // 列视图：相机位置调整为面向机架正面
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    camera.position.set(
      center.x, 
      center.y + maxDim * 0.3,
      center.z + maxDim * 1.2  // 站在机架前方
    );
    
    controls.target.set(center.x, center.y, center.z);
    
    // 不需要旋转场景，保持机架原有朝向
    // sceneContainer.rotation.y = 0;
  }
  
  // ... existing code ...
}
```

### 3. 在SmartServerRoom.vue中添加返回按钮处理

```vue:vueTest/src/views/SmartServerRoom.vue
// 在模板中的返回按钮部分修改条件
<div class="back-to-main-button" v-if="currentSceneView !== 'main'" @click="switchToMainView">
  <i class="el-icon-back"></i> 返回全景视图
</div>

// 在script中添加multi-rack视图的处理
const onViewChanged = (data) => {
  console.log('视图变化:', data);
  
  // 更新当前视图状态
  currentSceneView.value = data.view;
  
  // 根据不同视图类型更新相关数据
  if (data.view === 'single-rack') {
    selectedRack.value = data.data;
  } else if (data.view === 'single-device') {
    selectedNetworkElement.value = data.data;
  } else if (data.view === 'multi-rack') {
    // 新增：处理多机架视图
    console.log('切换到多机架视图:', data.data);
  } else if (data.view === 'main') {
    // 重置选中状态
    selectedRack.value = null;
    selectedNetworkElement.value = null;
  }
};
```

### 4. 更新useRackView.js中的状态管理

```javascript:vueTest/src/composables/three/useRackView.js
function createMultiRackScene(rackLayout, rackId, context) {
  // ... existing code ...
  
  // 11. 更新状态
  if (context.sceneState) {
    context.sceneState.currentView = 'multi-rack';
    context.sceneState.multiRackType = rackLayout;
    context.sceneState.multiRackId = rackId;
  }
  
  // 12. 通知视图变化
  if (context.emitViewChanged) {
    context.emitViewChanged({
      view: 'multi-rack',
      data: { type: rackLayout, id: rackId }
    });
  }
  
  return true;
}
```

这样修改后：

1. **返回按钮**会在multi-rack视图中正常显示和工作
2. **机架排列**会按照用户视角正确显示：
   - 奇数列：从左到右 大→小（04→03→02→01）
   - 偶数列：从左到右 小→大（05→06→07→08→09→10→11）
3. **相机视角**会调整为站在机架前方的用户视角

您觉得这个解决方案符合您的需求吗？需要我进一步调整哪些部分？

```vue
// ... existing code ...
const sceneState = reactive({
  currentView: 'main', // 'main', 'single-rack', 'single-device', 'multi-rack'
  // ... existing code ...
  multiRackType: null, // 'row' 或 'column'
  multiRackId: null,   // 行号或列号
});
```

```javascript
function createMultiRackScene(rackLayout, rackId, context) {
  // ... existing code ...
  
  // 4. 为每个机架找到其关联的设备并按正确顺序排列
  const sortedRacks = multiRacks.sort((a, b) => {
    // 提取机架编号
    const getNumber = (name) => {
      const match = name.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    };
    
    const numA = getNumber(a.name);
    const numB = getNumber(b.name);
    
    if (rackLayout === 'col') {
      // 根据列号决定排序方向
      const colNum = parseInt(rackId);
      if (colNum % 2 === 1) {
        // 奇数列（第1,3,5列）：从大到小（面向用户）
        return numB - numA;
      } else {
        // 偶数列（第2,4,6列）：从小到大（背对用户）
        return numA - numB;
      }
    }
    
    return numA - numB; // 行视图保持原有逻辑
  });
  
  // 5. 克隆机架和设备到新场景
  sortedRacks.forEach((rack, index) => {
    // 克隆机架
    const rackClone = rack.clone(true);
    
    // 设置位置 - 根据行/列类型排列
    if (rackLayout === 'col') {
      // 列视图: 将机架沿X轴水平排列（用户视角）
      rackClone.position.set(index * 2, 0, 0);
    } else {
      // 行视图: 将机架沿Z轴排列
      rackClone.position.set(0, 0, index * 2);
    }
    
    // ... rest of the code ...
  });
  
  // 6. 调整相机视角为用户视角
  if (rackLayout === 'col') {
    // 列视图：相机位置调整为面向机架正面
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    camera.position.set(
      center.x, 
      center.y + maxDim * 0.3,
      center.z + maxDim * 1.2  // 站在机架前方
    );
    
    controls.target.set(center.x, center.y, center.z);
    
    // 不需要旋转场景，保持机架原有朝向
    // sceneContainer.rotation.y = 0;
  }
  
  // ... existing code ...
}
```

```vue
// 在模板中的返回按钮部分修改条件
<div class="back-to-main-button" v-if="currentSceneView !== 'main'" @click="switchToMainView">
  <i class="el-icon-back"></i> 返回全景视图
</div>

// 在script中添加multi-rack视图的处理
const onViewChanged = (data) => {
  console.log('视图变化:', data);
  
  // 更新当前视图状态
  currentSceneView.value = data.view;
  
  // 根据不同视图类型更新相关数据
  if (data.view === 'single-rack') {
    selectedRack.value = data.data;
  } else if (data.view === 'single-device') {
    selectedNetworkElement.value = data.data;
  } else if (data.view === 'multi-rack') {
    // 新增：处理多机架视图
    console.log('切换到多机架视图:', data.data);
  } else if (data.view === 'main') {
    // 重置选中状态
    selectedRack.value = null;
    selectedNetworkElement.value = null;
  }
};
```

```javascript
function createMultiRackScene(rackLayout, rackId, context) {
  // ... existing code ...
  
  // 11. 更新状态
  if (context.sceneState) {
    context.sceneState.currentView = 'multi-rack';
    context.sceneState.multiRackType = rackLayout;
    context.sceneState.multiRackId = rackId;
  }
  
  // 12. 通知视图变化
  if (context.emitViewChanged) {
    context.emitViewChanged({
      view: 'multi-rack',
      data: { type: rackLayout, id: rackId }
    });
  }
  
  return true;
}
```

---

**User**

尽管设置了 不等于 main视图的时候 显示返回全景视图的按钮， 但实际上没有， 你检查下 是否是 没有创建 multi-rack的视图状态。

---

**Cursor**

```javascript
   // 10. 更新状态
   if (context.sceneState) {
     context.sceneState.currentView = 'multi-rack';
     context.sceneState.multiRackType = rackLayout;
     context.sceneState.multiRackId = rackId;
   }
   
   // 11. 通知视图变化
   if (context.emitViewChanged) {
     context.emitViewChanged({
       view: 'multi-rack',
       data: { type: rackLayout, id: rackId }
     });
   }
```

```javascript
   } else if (data.view === 'multi-rack') {
     // 新增：处理多机架视图
     console.log('切换到多机架视图:', data.data);
   }
```

```javascript
   // 更新当前视图状态
   currentSceneView.value = data.view;
```

```plaintext

javascript
const sceneState` 定义中的 `multiRackLayout` 字段应该重命名为 `multiRackType`，以保持命名的准确性和一致性。

关键修复点包括：
1. 补充 `emitViewChanged` 到上下文参数
2. 更正 `sceneState` 中的字段名称
3. 审查 `createMultiRackScene` 的参数传递逻辑

需要仔细检查代码中的命名和参数传递，确保各个组件之间的一致性和正确性。
```

您说得对！我检查了代码，发现了问题所在。在`ServerRoomScene.vue`中的`createMultiRackScene`函数调用时，**缺少了`emitViewChanged`的传递**，导致视图状态变化无法通知到`SmartServerRoom.vue`。

## 问题分析

1. **缺少`emitViewChanged`传递** - 在`ServerRoomScene.vue`的`createMultiRackScene`中没有将`emitViewChanged`传递给context
2. **字段名不一致** - `sceneState`中使用的是`multiRackLayout`，但`useRackView.js`中使用的是`multiRackType`

## 解决方案

### 1. 修复ServerRoomScene.vue中的context传递

```vue:vueTest/src/components/three/ServerRoomScene.vue
// 在setup函数中修改createMultiRackScene函数定义
const createMultiRackScene = (rackData) => {
  if (!baseScene.value || !baseScene.value.model) {
    console.error('缺少基础场景或模型引用');
    return false;
  }
  
  // 从机架名称中提取行/列信息
  const rackLayout = extractRackLayout(rackData.name);
  const rackId = extractRackId(rackData.name);
  
  if (!rackLayout || !rackId) {
    console.error('无法从机架名称提取行/列信息:', rackData.name);
    return false;
  }
  
  // 构建上下文对象 - 添加缺少的emitViewChanged
  const context = {
    scene: baseScene.value.scene,
    camera: baseScene.value.camera,
    renderer: baseScene.value.renderer,
    controls: baseScene.value.controls,
    mainModel: baseScene.value.model,
    sceneState,
    deviceInteractionState,
    setPickableObjects,
    setObjectParentMap,
    // 添加这个关键的传递
    emitViewChanged: (data) => getCurrentInstance().emit('view-changed', data)
  };
  
  // 调用composable中的实现
  return _createMultiRackScene(rackLayout, rackId, context);
};
```

### 2. 修复sceneState中的字段名

```vue:vueTest/src/components/three/ServerRoomScene.vue
// 修改sceneState中的字段名，保持与useRackView.js一致
const sceneState = reactive({
  currentView: 'main', // 'main', 'single-rack', 'single-device', 'multi-rack'
  mainScene: null,
  singleRackScene: null,
  singleDeviceScene: null,
  selectedRack: null,
  selectedDevice: null,
  originalCameraPosition: null,
  originalControlsTarget: null,
  isFrontView: false,
  deviceAnimationStage: 0,
  animatingDevice: null,
  animatedDeviceParts: [],
  currentDevicePositions: new Map(),
  showTooltipInSingleRack: false,
  multiRackType: null, // 修改：从multiRackLayout改为multiRackType
  multiRackId: null,
});
```

### 3. 添加multi-rack视图的重置处理

还需要在`resetToMainScene`方法中添加对multi-rack视图的处理：

```vue:vueTest/src/components/three/ServerRoomScene.vue
// 在resetToMainScene方法中添加multi-rack的处理逻辑
resetToMainScene() {
  // ... existing code ...
  
  let result = false;
  
  // 根据当前视图类型，选择对应的重置方法
  if (this.sceneState.currentView === 'single-rack') {
    result = this.destroySingleRackScene(context);
    // ... existing code ...
  } else if (this.sceneState.currentView === 'single-device') {
    result = this.destroySingleDeviceScene(context);
  } else if (this.sceneState.currentView === 'multi-rack') {
    // 添加multi-rack视图的重置处理
    result = this.destroyMultiRackScene(context);
  }
  
  // ... rest of existing code ...
}
```

### 4. 在useRackView.js中添加destroyMultiRackScene函数

```javascript:vueTest/src/composables/three/useRackView.js
// 添加销毁多机架视图的函数
function destroyMultiRackScene(context) {
  const { scene, sceneState, mainModel, emitViewChanged, renderer, camera } = context;
  
  try {
    console.log('开始清理多机架视图');
    
    // 1. 找到并移除多机架容器
    const container = scene.getObjectByName("MultiRackSceneContainer");
    if (container && container.parent) {
      console.log('移除多机架容器');
      container.parent.remove(container);
    }
    
    // 2. 恢复主场景模型
    if (mainModel) {
      mainModel.visible = true;
      if (!scene.children.includes(mainModel)) {
        scene.add(mainModel);
      }
    }
    
    // 3. 更新状态
    if (sceneState) {
      sceneState.currentView = 'main';
      sceneState.multiRackType = null;
      sceneState.multiRackId = null;
    }
    
    // 4. 强制重绘场景
    if (renderer && camera) {
      renderer.render(scene, camera);
    }
    
    // 5. 通知父组件
    if (emitViewChanged) {
      emitViewChanged({
        view: 'main',
        data: null
      });
    }
    
    console.log('多机架视图清理完成');
    return true;
  } catch (error) {
    console.error('清理多机架视图时出错:', error);
    return false;
  }
}

// 在return中添加这个函数
return {
  rackViewState,
  createSingleRackScene,
  destroySingleRackScene,
  animateRackRotation,
  switchToFrontView,
  handleSingleRackViewClick,
  animateRackDevice,
  resetRackDeviceAnimation,
  createMultiRackScene,
  destroyMultiRackScene // 添加这个
};
```

### 5. 在ServerRoomScene.vue中导入并使用destroyMultiRackScene

```vue:vueTest/src/components/three/ServerRoomScene.vue
// 在setup中添加destroyMultiRackScene的导入
const { 
  rackViewState, 
  createSingleRackScene: _createSingleRackScene, 
  destroySingleRackScene,
  animateRackRotation: _animateRackRotation,
  switchToFrontView: _switchToFrontView,
  handleSingleRackViewClick: _handleSingleRackViewClick,
  animateRackDevice: _animateRackDevice,
  resetRackDeviceAnimation: _resetRackDeviceAnimation,
  findDeviceByName: _findDeviceByName,
  createMultiRackScene: _createMultiRackScene,
  destroyMultiRackScene: _destroyMultiRackScene // 添加这个
} = useRackView();

// 添加destroyMultiRackScene方法
const destroyMultiRackScene = (context) => {
  return _destroyMultiRackScene(context);
};

// 在return中添加
return {
  // ... existing returns ...
  createMultiRackScene,
  destroyMultiRackScene // 添加这个
};
```

这样修改后，当进入multi-rack视图时：

1. `createMultiRackScene`会正确调用`emitViewChanged`
2. `SmartServerRoom.vue`的`onViewChanged`会被触发
3. `currentSceneView.value`会被正确设置为`'multi-rack'`
4. 返回按钮的条件`v-if="currentSceneView !== 'main'"`会生效，按钮会显示出来

您可以测试一下这个修复是否解决了问题！

```vue
// 在setup函数中修改createMultiRackScene函数定义
const createMultiRackScene = (rackData) => {
  if (!baseScene.value || !baseScene.value.model) {
    console.error('缺少基础场景或模型引用');
    return false;
  }
  
  // 从机架名称中提取行/列信息
  const rackLayout = extractRackLayout(rackData.name);
  const rackId = extractRackId(rackData.name);
  
  if (!rackLayout || !rackId) {
    console.error('无法从机架名称提取行/列信息:', rackData.name);
    return false;
  }
  
  // 构建上下文对象 - 添加缺少的emitViewChanged
  const context = {
    scene: baseScene.value.scene,
    camera: baseScene.value.camera,
    renderer: baseScene.value.renderer,
    controls: baseScene.value.controls,
    mainModel: baseScene.value.model,
    sceneState,
    deviceInteractionState,
    setPickableObjects,
    setObjectParentMap,
    // 添加这个关键的传递
    emitViewChanged: (data) => getCurrentInstance().emit('view-changed', data)
  };
  
  // 调用composable中的实现
  return _createMultiRackScene(rackLayout, rackId, context);
};
```

```vue
// 修改sceneState中的字段名，保持与useRackView.js一致
const sceneState = reactive({
  currentView: 'main', // 'main', 'single-rack', 'single-device', 'multi-rack'
  mainScene: null,
  singleRackScene: null,
  singleDeviceScene: null,
  selectedRack: null,
  selectedDevice: null,
  originalCameraPosition: null,
  originalControlsTarget: null,
  isFrontView: false,
  deviceAnimationStage: 0,
  animatingDevice: null,
  animatedDeviceParts: [],
  currentDevicePositions: new Map(),
  showTooltipInSingleRack: false,
  multiRackType: null, // 修改：从multiRackLayout改为multiRackType
  multiRackId: null,
});
```

```vue
// 在resetToMainScene方法中添加multi-rack的处理逻辑
resetToMainScene() {
  // ... existing code ...
  
  let result = false;
  
  // 根据当前视图类型，选择对应的重置方法
  if (this.sceneState.currentView === 'single-rack') {
    result = this.destroySingleRackScene(context);
    // ... existing code ...
  } else if (this.sceneState.currentView === 'single-device') {
    result = this.destroySingleDeviceScene(context);
  } else if (this.sceneState.currentView === 'multi-rack') {
    // 添加multi-rack视图的重置处理
    result = this.destroyMultiRackScene(context);
  }
  
  // ... rest of existing code ...
}
```

```javascript
// 添加销毁多机架视图的函数
function destroyMultiRackScene(context) {
  const { scene, sceneState, mainModel, emitViewChanged, renderer, camera } = context;
  
  try {
    console.log('开始清理多机架视图');
    
    // 1. 找到并移除多机架容器
    const container = scene.getObjectByName("MultiRackSceneContainer");
    if (container && container.parent) {
      console.log('移除多机架容器');
      container.parent.remove(container);
    }
    
    // 2. 恢复主场景模型
    if (mainModel) {
      mainModel.visible = true;
      if (!scene.children.includes(mainModel)) {
        scene.add(mainModel);
      }
    }
    
    // 3. 更新状态
    if (sceneState) {
      sceneState.currentView = 'main';
      sceneState.multiRackType = null;
      sceneState.multiRackId = null;
    }
    
    // 4. 强制重绘场景
    if (renderer && camera) {
      renderer.render(scene, camera);
    }
    
    // 5. 通知父组件
    if (emitViewChanged) {
      emitViewChanged({
        view: 'main',
        data: null
      });
    }
    
    console.log('多机架视图清理完成');
    return true;
  } catch (error) {
    console.error('清理多机架视图时出错:', error);
    return false;
  }
}

// 在return中添加这个函数
return {
  rackViewState,
  createSingleRackScene,
  destroySingleRackScene,
  animateRackRotation,
  switchToFrontView,
  handleSingleRackViewClick,
  animateRackDevice,
  resetRackDeviceAnimation,
  createMultiRackScene,
  destroyMultiRackScene // 添加这个
};
```

```vue
// 在setup中添加destroyMultiRackScene的导入
const { 
  rackViewState, 
  createSingleRackScene: _createSingleRackScene, 
  destroySingleRackScene,
  animateRackRotation: _animateRackRotation,
  switchToFrontView: _switchToFrontView,
  handleSingleRackViewClick: _handleSingleRackViewClick,
  animateRackDevice: _animateRackDevice,
  resetRackDeviceAnimation: _resetRackDeviceAnimation,
  findDeviceByName: _findDeviceByName,
  createMultiRackScene: _createMultiRackScene,
  destroyMultiRackScene: _destroyMultiRackScene // 添加这个
} = useRackView();

// 添加destroyMultiRackScene方法
const destroyMultiRackScene = (context) => {
  return _destroyMultiRackScene(context);
};

// 在return中添加
return {
  // ... existing returns ...
  createMultiRackScene,
  destroyMultiRackScene // 添加这个
};
```

---

**User**

1. console 中有错误：创建多机架视图时出错: TypeError: Cannot read properties of null (reading 'emit')
    at Object.emitViewChanged (index.js??clonedRuleSet-40.use[0]!./node_modules/vue-loader/dist/index.js??ruleSet[0].use[0]!./src/components/three/ServerRoomScene.vue?vue&type=script&lang=js:512:91)
    at createMultiRackScene (useRackView.js:860:1)
    at createMultiRackScene (index.js??clonedRuleSet-40.use[0]!./node_modules/vue-loader/dist/index.js??ruleSet[0].use[0]!./src/components/three/ServerRoomScene.vue?vue&type=script&lang=js:516:14)
    at handleMenuSelect (index.js??clonedRuleSet-40.use[0]!./node_modules/vue-loader/dist/index.js??ruleSet[0].use[0]!./src/components/three/ServerRoomScene.vue?vue&type=script&lang=js:458:9)
    at callWithErrorHandling (runtime-core.esm-bundler.js:350:19)
    at callWithAsyncErrorHandling (runtime-core.esm-bundler.js:357:17)
    at emit (runtime-core.esm-bundler.js:6499:5)
    at $props.visible.onClick._cache.<computed>._cache.<computed> (index.js??clonedRuleSet-40.use[0]!./node_modules/vue-loader/dist/templateLoader.js??ruleSet[1].rules[3]!./node_modules/vue-loader/dist/index.js??ruleSet[0].use[0]!./src/components/ui/ContextMenu.vue?vue&type=template&id=0f447523&scoped=true:14:55)
    at callWithErrorHandling (runtime-core.esm-bundler.js:350:19)
    at callWithAsyncErrorHandling (runtime-core.esm-bundler.js:357:17)
2. 同时我发现  还有multiRackType存在，  我需要说明下：不应该有 multiRackType的定义， 应该是multiRackLayout ， 因为这是多机架的排列布局， 不是机架类型。哪些地方有 都修改过来

---

**Cursor**

您提到的两个问题我来帮您解决：

## 问题1：getCurrentInstance() 返回 null 的错误

这个错误是因为在某些情况下 `getCurrentInstance()` 可能返回 null。我们需要修改 `emitViewChanged` 的实现方式。

## 问题2：统一使用 `multiRackLayout` 而不是 `multiRackType`

您说得对，这应该是布局而不是类型。

## 解决方案

### 1. 修复 ServerRoomScene.vue 中的 emitViewChanged 错误

```vue:vueTest/src/components/three/ServerRoomScene.vue
// 在 setup() 函数的开始部分，获取当前实例引用
export default {
  name: 'ServerRoomScene',
  // ... props, emits 等 ...
  setup(props, { emit }) {
    // 使用传入的 emit 函数，更安全
    
    // ... 其他代码 ...
    
    // 修改 createMultiRackScene 函数
    const createMultiRackScene = (rackData) => {
      if (!baseScene.value || !baseScene.value.model) {
        console.error('缺少基础场景或模型引用');
        return false;
      }
      
      // 从机架名称中提取行/列信息
      const rackLayout = extractRackLayout(rackData.name);
      const rackId = extractRackId(rackData.name);
      
      if (!rackLayout || !rackId) {
        console.error('无法从机架名称提取行/列信息:', rackData.name);
        return false;
      }
      
      // 构建上下文对象 - 使用安全的 emit 传递
      const context = {
        scene: baseScene.value.scene,
        camera: baseScene.value.camera,
        renderer: baseScene.value.renderer,
        controls: baseScene.value.controls,
        mainModel: baseScene.value.model,
        sceneState,
        deviceInteractionState,
        setPickableObjects,
        setObjectParentMap,
        // 修改为使用传入的 emit 函数
        emitViewChanged: (data) => emit('view-changed', data)
      };
      
      // 调用composable中的实现
      return _createMultiRackScene(rackLayout, rackId, context);
    };
    
    // ... 其他代码 ...
  }
}
```

### 2. 在 useRackView.js 中将所有 multiRackType 改为 multiRackLayout

```javascript:vueTest/src/composables/three/useRackView.js
function createMultiRackScene(rackLayout, rackId, context) {
  // ... existing code ...
  
  // 10. 更新状态
  if (context.sceneState) {
    context.sceneState.currentView = 'multi-rack';
    context.sceneState.multiRackLayout = rackLayout; // 修改：从 multiRackType 改为 multiRackLayout
    context.sceneState.multiRackId = rackId;
  }
  
  // ... existing code ...
}

// 添加销毁多机架视图的函数
function destroyMultiRackScene(context) {
  const { scene, sceneState, mainModel, emitViewChanged, renderer, camera } = context;
  
  try {
    console.log('开始清理多机架视图');
    
    // ... existing code ...
    
    // 3. 更新状态
    if (sceneState) {
      sceneState.currentView = 'main';
      sceneState.multiRackLayout = null; // 修改：从 multiRackType 改为 multiRackLayout
      sceneState.multiRackId = null;
    }
    
    // ... existing code ...
  } catch (error) {
    console.error('清理多机架视图时出错:', error);
    return false;
  }
}
```

### 3. 修复 ServerRoomScene.vue 的 resetToMainScene 方法

由于这个方法是在 methods 中，需要确保它也能正确处理 multi-rack 视图：

```vue:vueTest/src/components/three/ServerRoomScene.vue
methods: {
  // ... existing methods ...
  
  // 重置到主视图
  resetToMainScene() {
    // 构建上下文对象
    const context = {
      scene: this.$refs.baseScene.scene,
      camera: this.$refs.baseScene.camera,
      renderer: this.$refs.baseScene.renderer,
      controls: this.$refs.baseScene.controls,
      mainModel: this.$refs.baseScene.model,
      sceneState: this.sceneState,
      emitViewChanged: (data) => this.$emit('view-changed', data)
    };

    // ... existing code ...
    
    let result = false;
    
    // 根据当前视图类型，选择对应的重置方法
    if (this.sceneState.currentView === 'single-rack') {
      result = this.destroySingleRackScene(context);
      // ... existing code ...
    } else if (this.sceneState.currentView === 'single-device') {
      result = this.destroySingleDeviceScene(context);
    } else if (this.sceneState.currentView === 'multi-rack') {
      // 添加multi-rack视图的重置处理
      result = this.destroyMultiRackScene(context);
    }

    // ... existing code ...
    
    // 更新当前视图
    this.sceneState.currentView = 'main';
    // 清理 multi-rack 状态
    this.sceneState.multiRackLayout = null;
    this.sceneState.multiRackId = null;
    
    // ... rest of existing code ...
    
    return result;
  },
  
  // 添加 destroyMultiRackScene 方法到 methods 中
  destroyMultiRackScene(context) {
    // 调用 composable 中的实现
    return this._destroyMultiRackScene ? this._destroyMultiRackScene(context) : false;
  }
}
```

### 4. 确保 ServerRoomScene.vue 正确导入和返回 destroyMultiRackScene

```vue:vueTest/src/components/three/ServerRoomScene.vue
// 在 setup() 函数中
const { 
  rackViewState, 
  createSingleRackScene: _createSingleRackScene, 
  destroySingleRackScene,
  animateRackRotation: _animateRackRotation,
  switchToFrontView: _switchToFrontView,
  handleSingleRackViewClick: _handleSingleRackViewClick,
  animateRackDevice: _animateRackDevice,
  resetRackDeviceAnimation: _resetRackDeviceAnimation,
  findDeviceByName: _findDeviceByName,
  createMultiRackScene: _createMultiRackScene,
  destroyMultiRackScene: _destroyMultiRackScene // 确保导入
} = useRackView();

// 在 return 中
return {
  // ... existing returns ...
  createMultiRackScene,
  _destroyMultiRackScene // 添加这个，方便在 methods 中使用
};
```

### 5. 检查 sceneState 的初始化确保字段名一致

确认 ServerRoomScene.vue 中的 sceneState 使用正确的字段名：

```vue:vueTest/src/components/three/ServerRoomScene.vue
// 场景状态 - 确认字段名正确
const sceneState = reactive({
  currentView: 'main', // 'main', 'single-rack', 'single-device', 'multi-rack'
  mainScene: null,
  singleRackScene: null,
  singleDeviceScene: null,
  selectedRack: null,
  selectedDevice: null,
  originalCameraPosition: null,
  originalControlsTarget: null,
  isFrontView: false,
  deviceAnimationStage: 0,
  animatingDevice: null,
  animatedDeviceParts: [],
  currentDevicePositions: new Map(),
  showTooltipInSingleRack: false,
  multiRackLayout: null, // ✓ 确认是 multiRackLayout
  multiRackId: null,
});
```

这样修改后：

1. **错误修复**：使用 setup 函数传入的 `emit` 参数，避免 `getCurrentInstance()` 返回 null 的问题
2. **命名统一**：所有地方都使用 `multiRackLayout` 而不是 `multiRackType`
3. **功能完整**：确保 multi-rack 视图的创建、销毁和状态管理都正确工作

返回按钮应该能正常显示和工作了！

```vue
// 在 setup() 函数的开始部分，获取当前实例引用
export default {
  name: 'ServerRoomScene',
  // ... props, emits 等 ...
  setup(props, { emit }) {
    // 使用传入的 emit 函数，更安全
    
    // ... 其他代码 ...
    
    // 修改 createMultiRackScene 函数
    const createMultiRackScene = (rackData) => {
      if (!baseScene.value || !baseScene.value.model) {
        console.error('缺少基础场景或模型引用');
        return false;
      }
      
      // 从机架名称中提取行/列信息
      const rackLayout = extractRackLayout(rackData.name);
      const rackId = extractRackId(rackData.name);
      
      if (!rackLayout || !rackId) {
        console.error('无法从机架名称提取行/列信息:', rackData.name);
        return false;
      }
      
      // 构建上下文对象 - 使用安全的 emit 传递
      const context = {
        scene: baseScene.value.scene,
        camera: baseScene.value.camera,
        renderer: baseScene.value.renderer,
        controls: baseScene.value.controls,
        mainModel: baseScene.value.model,
        sceneState,
        deviceInteractionState,
        setPickableObjects,
        setObjectParentMap,
        // 修改为使用传入的 emit 函数
        emitViewChanged: (data) => emit('view-changed', data)
      };
      
      // 调用composable中的实现
      return _createMultiRackScene(rackLayout, rackId, context);
    };
    
    // ... 其他代码 ...
  }
}
```

```javascript
function createMultiRackScene(rackLayout, rackId, context) {
  // ... existing code ...
  
  // 10. 更新状态
  if (context.sceneState) {
    context.sceneState.currentView = 'multi-rack';
    context.sceneState.multiRackLayout = rackLayout; // 修改：从 multiRackType 改为 multiRackLayout
    context.sceneState.multiRackId = rackId;
  }
  
  // ... existing code ...
}

// 添加销毁多机架视图的函数
function destroyMultiRackScene(context) {
  const { scene, sceneState, mainModel, emitViewChanged, renderer, camera } = context;
  
  try {
    console.log('开始清理多机架视图');
    
    // ... existing code ...
    
    // 3. 更新状态
    if (sceneState) {
      sceneState.currentView = 'main';
      sceneState.multiRackLayout = null; // 修改：从 multiRackType 改为 multiRackLayout
      sceneState.multiRackId = null;
    }
    
    // ... existing code ...
  } catch (error) {
    console.error('清理多机架视图时出错:', error);
    return false;
  }
}
```

```vue
methods: {
  // ... existing methods ...
  
  // 重置到主视图
  resetToMainScene() {
    // 构建上下文对象
    const context = {
      scene: this.$refs.baseScene.scene,
      camera: this.$refs.baseScene.camera,
      renderer: this.$refs.baseScene.renderer,
      controls: this.$refs.baseScene.controls,
      mainModel: this.$refs.baseScene.model,
      sceneState: this.sceneState,
      emitViewChanged: (data) => this.$emit('view-changed', data)
    };

    // ... existing code ...
    
    let result = false;
    
    // 根据当前视图类型，选择对应的重置方法
    if (this.sceneState.currentView === 'single-rack') {
      result = this.destroySingleRackScene(context);
      // ... existing code ...
    } else if (this.sceneState.currentView === 'single-device') {
      result = this.destroySingleDeviceScene(context);
    } else if (this.sceneState.currentView === 'multi-rack') {
      // 添加multi-rack视图的重置处理
      result = this.destroyMultiRackScene(context);
    }

    // ... existing code ...
    
    // 更新当前视图
    this.sceneState.currentView = 'main';
    // 清理 multi-rack 状态
    this.sceneState.multiRackLayout = null;
    this.sceneState.multiRackId = null;
    
    // ... rest of existing code ...
    
    return result;
  },
  
  // 添加 destroyMultiRackScene 方法到 methods 中
  destroyMultiRackScene(context) {
    // 调用 composable 中的实现
    return this._destroyMultiRackScene ? this._destroyMultiRackScene(context) : false;
  }
}
```

```vue
// 在 setup() 函数中
const { 
  rackViewState, 
  createSingleRackScene: _createSingleRackScene, 
  destroySingleRackScene,
  animateRackRotation: _animateRackRotation,
  switchToFrontView: _switchToFrontView,
  handleSingleRackViewClick: _handleSingleRackViewClick,
  animateRackDevice: _animateRackDevice,
  resetRackDeviceAnimation: _resetRackDeviceAnimation,
  findDeviceByName: _findDeviceByName,
  createMultiRackScene: _createMultiRackScene,
  destroyMultiRackScene: _destroyMultiRackScene // 确保导入
} = useRackView();

// 在 return 中
return {
  // ... existing returns ...
  createMultiRackScene,
  _destroyMultiRackScene // 添加这个，方便在 methods 中使用
};
```

```vue
// 场景状态 - 确认字段名正确
const sceneState = reactive({
  currentView: 'main', // 'main', 'single-rack', 'single-device', 'multi-rack'
  mainScene: null,
  singleRackScene: null,
  singleDeviceScene: null,
  selectedRack: null,
  selectedDevice: null,
  originalCameraPosition: null,
  originalControlsTarget: null,
  isFrontView: false,
  deviceAnimationStage: 0,
  animatingDevice: null,
  animatedDeviceParts: [],
  currentDevicePositions: new Map(),
  showTooltipInSingleRack: false,
  multiRackLayout: null, // ✓ 确认是 multiRackLayout
  multiRackId: null,
});
```

---

**User**

让我们来解决个问题： 当前 我点击第一列的机架或者网元设备或者其他设备，  进入single-rack或者signle-device视图的时候， 它一开始的朝向是如图一， 但现在我点击其他列（和它（left）相反方向朝向right）， 它一开始的朝向是如图二， 原因可能是   朝向的差异， 但对于模型是同一个处理方法（旋转角度）， 请你找出进入其他视图对应的旋转角度的代码位置， 并做出修改。

---

**Cursor**

我理解您的问题！不同列的机架朝向不同，但代码中使用了统一的处理方法，导致相机视角不正确。让我找到相关代码并修改。

## 问题分析

从您的描述和之前的多机架排列逻辑可以看出：
- **第一列**（奇数列）：机架朝向为面向用户方向
- **第二列及其他偶数列**：机架朝向背对用户方向

但在进入单机架视图时，代码没有考虑机架的实际朝向差异。

## 解决方案

需要修改 `useRackView.js` 中的相关函数，根据机架所属列号调整相机角度。

### 1. 修改 createSingleRackScene 函数

```javascript:vueTest/src/composables/three/useRackView.js
function createSingleRackScene(rackData, context) {
  const { scene, camera, renderer, controls, mainModel, sceneState, deviceInteractionState } = context;
  
  // ... existing code until camera positioning ...
  
  // 6. 设置相机位置 - 根据机架朝向调整
  const getRackColumn = (rackName) => {
    const colMatch = rackName.match(/col-(\d+)/);
    return colMatch ? parseInt(colMatch[1]) : 1; // 默认第一列
  };
  
  const rackColumn = getRackColumn(rackData.name);
  const isEvenColumn = rackColumn % 2 === 0; // 偶数列朝向相反
  
  // 计算相机位置
  const box = new THREE.Box3().setFromObject(sceneContainer);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  
  // 根据列号调整相机初始角度
  let cameraAngleOffset = 0;
  if (isEvenColumn) {
    // 偶数列：机架背对用户，需要从背面查看，所以相机要到对面
    cameraAngleOffset = Math.PI; // 180度
  }
  
  // 计算相机位置（考虑朝向差异）
  const distance = maxDim * 1.5;
  const cameraX = center.x + Math.sin(cameraAngleOffset) * distance;
  const cameraZ = center.z + Math.cos(cameraAngleOffset) * distance;
  
  camera.position.set(
    cameraX,
    center.y + maxDim * 0.3,
    cameraZ
  );
  
  controls.target.copy(center);
  controls.update();
  
  // 7. 存储原始相机状态时也要考虑朝向
  sceneState.originalCameraAngle = cameraAngleOffset;
  
  // ... rest of existing code ...
}
```

### 2. 修改 switchToFrontView 函数

```javascript:vueTest/src/composables/three/useRackView.js
function switchToFrontView(context) {
  const { camera, controls, sceneState } = context;
  
  if (sceneState.currentView !== 'single-rack' || !sceneState.singleRackScene) {
    console.warn('当前不在单机架视图，无法切换到正面视图');
    return false;
  }
  
  try {
    // 获取当前机架的列信息
    const currentRackName = sceneState.selectedRack?.name || '';
    const getRackColumn = (rackName) => {
      const colMatch = rackName.match(/col-(\d+)/);
      return colMatch ? parseInt(colMatch[1]) : 1;
    };
    
    const rackColumn = getRackColumn(currentRackName);
    const isEvenColumn = rackColumn % 2 === 0;
    
    // 计算场景边界
    const box = new THREE.Box3().setFromObject(sceneState.singleRackScene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // 根据机架朝向确定正面视图的角度
    let frontViewAngle = 0;
    if (isEvenColumn) {
      // 偶数列：机架背对用户，正面视图需要180度偏移
      frontViewAngle = Math.PI;
    }
    
    // 计算正面视图的相机位置
    const distance = maxDim * 1.2;
    const targetPosition = new THREE.Vector3(
      center.x + Math.sin(frontViewAngle) * distance,
      center.y + maxDim * 0.2,
      center.z + Math.cos(frontViewAngle) * distance
    );
    
    // 动画到正面视图
    return animateRackRotation(frontViewAngle, context);
    
  } catch (error) {
    console.error('切换到正面视图时出错:', error);
    return false;
  }
}
```

### 3. 修改 animateRackRotation 函数

```javascript:vueTest/src/composables/three/useRackView.js
function animateRackRotation(targetRotation, context) {
  const { camera, controls, sceneState } = context;
  
  if (sceneState.currentView !== 'single-rack' || !sceneState.singleRackScene) {
    console.warn('当前不在单机架视图，无法执行旋转动画');
    return false;
  }
  
  try {
    // 获取当前机架的列信息，用于调整旋转基准
    const currentRackName = sceneState.selectedRack?.name || '';
    const getRackColumn = (rackName) => {
      const colMatch = rackName.match(/col-(\d+)/);
      return colMatch ? parseInt(colMatch[1]) : 1;
    };
    
    const rackColumn = getRackColumn(currentRackName);
    const isEvenColumn = rackColumn % 2 === 0;
    
    // 根据机架朝向调整目标旋转角度
    const adjustedTargetRotation = isEvenColumn ? targetRotation + Math.PI : targetRotation;
    
    // 计算场景中心和尺寸
    const box = new THREE.Box3().setFromObject(sceneState.singleRackScene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // 记录当前位置
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    
    // 计算目标位置
    const distance = maxDim * 1.5;
    const targetPosition = new THREE.Vector3(
      center.x + Math.sin(adjustedTargetRotation) * distance,
      center.y + maxDim * 0.3,
      center.z + Math.cos(adjustedTargetRotation) * distance
    );
    
    // 执行动画
    const duration = 1000; // 1秒
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用缓动函数
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      // 插值计算当前位置
      camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
      controls.target.lerpVectors(startTarget, center, easeProgress);
      
      controls.update();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // 动画完成，更新状态
        rackViewState.isFrontView = (Math.abs(adjustedTargetRotation) < 0.1);
        console.log('机架旋转动画完成');
      }
    };
    
    animate();
    return true;
    
  } catch (error) {
    console.error('机架旋转动画执行失败:', error);
    return false;
  }
}
```

### 4. 在 sceneState 中添加朝向信息

```vue:vueTest/src/components/three/ServerRoomScene.vue
// 在 sceneState 中添加机架朝向信息
const sceneState = reactive({
  currentView: 'main',
  mainScene: null,
  singleRackScene: null,
  singleDeviceScene: null,
  selectedRack: null,
  selectedDevice: null,
  originalCameraPosition: null,
  originalControlsTarget: null,
  originalCameraAngle: 0, // 新增：原始相机角度
  isFrontView: false,
  deviceAnimationStage: 0,
  animatingDevice: null,
  animatedDeviceParts: [],
  currentDevicePositions: new Map(),
  showTooltipInSingleRack: false,
  multiRackLayout: null,
  multiRackId: null,
});
```

### 5. 添加辅助函数用于判断机架朝向

```javascript:vueTest/src/composables/three/useRackView.js
// 在 useRackView.js 开头添加辅助函数
function getRackOrientation(rackName) {
  const colMatch = rackName.match(/col-(\d+)/);
  if (colMatch) {
    const colNum = parseInt(colMatch[1]);
    return {
      column: colNum,
      isEvenColumn: colNum % 2 === 0,
      // 奇数列朝向用户，偶数列背对用户
      facingDirection: colNum % 2 === 0 ? 'away' : 'towards'
    };
  }
  
  // 默认返回第一列朝向
  return {
    column: 1,
    isEvenColumn: false,
    facingDirection: 'towards'
  };
}
```

这样修改后：

1. **自动检测机架朝向**：根据机架名称中的列号判断朝向
2. **调整初始相机位置**：偶数列机架相机位置会有180度偏移
3. **正确的正面视图**：根据机架实际朝向计算正面视图角度
4. **平滑的旋转动画**：考虑机架朝向差异的旋转动画

现在当您点击不同列的机架时，相机会根据机架的实际朝向正确定位，第一列和其他列都会显示正确的视角！

```javascript
function createSingleRackScene(rackData, context) {
  const { scene, camera, renderer, controls, mainModel, sceneState, deviceInteractionState } = context;
  
  // ... existing code until camera positioning ...
  
  // 6. 设置相机位置 - 根据机架朝向调整
  const getRackColumn = (rackName) => {
    const colMatch = rackName.match(/col-(\d+)/);
    return colMatch ? parseInt(colMatch[1]) : 1; // 默认第一列
  };
  
  const rackColumn = getRackColumn(rackData.name);
  const isEvenColumn = rackColumn % 2 === 0; // 偶数列朝向相反
  
  // 计算相机位置
  const box = new THREE.Box3().setFromObject(sceneContainer);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  
  // 根据列号调整相机初始角度
  let cameraAngleOffset = 0;
  if (isEvenColumn) {
    // 偶数列：机架背对用户，需要从背面查看，所以相机要到对面
    cameraAngleOffset = Math.PI; // 180度
  }
  
  // 计算相机位置（考虑朝向差异）
  const distance = maxDim * 1.5;
  const cameraX = center.x + Math.sin(cameraAngleOffset) * distance;
  const cameraZ = center.z + Math.cos(cameraAngleOffset) * distance;
  
  camera.position.set(
    cameraX,
    center.y + maxDim * 0.3,
    cameraZ
  );
  
  controls.target.copy(center);
  controls.update();
  
  // 7. 存储原始相机状态时也要考虑朝向
  sceneState.originalCameraAngle = cameraAngleOffset;
  
  // ... rest of existing code ...
}
```

```javascript
function switchToFrontView(context) {
  const { camera, controls, sceneState } = context;
  
  if (sceneState.currentView !== 'single-rack' || !sceneState.singleRackScene) {
    console.warn('当前不在单机架视图，无法切换到正面视图');
    return false;
  }
  
  try {
    // 获取当前机架的列信息
    const currentRackName = sceneState.selectedRack?.name || '';
    const getRackColumn = (rackName) => {
      const colMatch = rackName.match(/col-(\d+)/);
      return colMatch ? parseInt(colMatch[1]) : 1;
    };
    
    const rackColumn = getRackColumn(currentRackName);
    const isEvenColumn = rackColumn % 2 === 0;
    
    // 计算场景边界
    const box = new THREE.Box3().setFromObject(sceneState.singleRackScene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // 根据机架朝向确定正面视图的角度
    let frontViewAngle = 0;
    if (isEvenColumn) {
      // 偶数列：机架背对用户，正面视图需要180度偏移
      frontViewAngle = Math.PI;
    }
    
    // 计算正面视图的相机位置
    const distance = maxDim * 1.2;
    const targetPosition = new THREE.Vector3(
      center.x + Math.sin(frontViewAngle) * distance,
      center.y + maxDim * 0.2,
      center.z + Math.cos(frontViewAngle) * distance
    );
    
    // 动画到正面视图
    return animateRackRotation(frontViewAngle, context);
    
  } catch (error) {
    console.error('切换到正面视图时出错:', error);
    return false;
  }
}
```

```javascript
function animateRackRotation(targetRotation, context) {
  const { camera, controls, sceneState } = context;
  
  if (sceneState.currentView !== 'single-rack' || !sceneState.singleRackScene) {
    console.warn('当前不在单机架视图，无法执行旋转动画');
    return false;
  }
  
  try {
    // 获取当前机架的列信息，用于调整旋转基准
    const currentRackName = sceneState.selectedRack?.name || '';
    const getRackColumn = (rackName) => {
      const colMatch = rackName.match(/col-(\d+)/);
      return colMatch ? parseInt(colMatch[1]) : 1;
    };
    
    const rackColumn = getRackColumn(currentRackName);
    const isEvenColumn = rackColumn % 2 === 0;
    
    // 根据机架朝向调整目标旋转角度
    const adjustedTargetRotation = isEvenColumn ? targetRotation + Math.PI : targetRotation;
    
    // 计算场景中心和尺寸
    const box = new THREE.Box3().setFromObject(sceneState.singleRackScene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // 记录当前位置
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    
    // 计算目标位置
    const distance = maxDim * 1.5;
    const targetPosition = new THREE.Vector3(
      center.x + Math.sin(adjustedTargetRotation) * distance,
      center.y + maxDim * 0.3,
      center.z + Math.cos(adjustedTargetRotation) * distance
    );
    
    // 执行动画
    const duration = 1000; // 1秒
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用缓动函数
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      // 插值计算当前位置
      camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
      controls.target.lerpVectors(startTarget, center, easeProgress);
      
      controls.update();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // 动画完成，更新状态
        rackViewState.isFrontView = (Math.abs(adjustedTargetRotation) < 0.1);
        console.log('机架旋转动画完成');
      }
    };
    
    animate();
    return true;
    
  } catch (error) {
    console.error('机架旋转动画执行失败:', error);
    return false;
  }
}
```

```vue
// 在 sceneState 中添加机架朝向信息
const sceneState = reactive({
  currentView: 'main',
  mainScene: null,
  singleRackScene: null,
  singleDeviceScene: null,
  selectedRack: null,
  selectedDevice: null,
  originalCameraPosition: null,
  originalControlsTarget: null,
  originalCameraAngle: 0, // 新增：原始相机角度
  isFrontView: false,
  deviceAnimationStage: 0,
  animatingDevice: null,
  animatedDeviceParts: [],
  currentDevicePositions: new Map(),
  showTooltipInSingleRack: false,
  multiRackLayout: null,
  multiRackId: null,
});
```

```javascript
// 在 useRackView.js 开头添加辅助函数
function getRackOrientation(rackName) {
  const colMatch = rackName.match(/col-(\d+)/);
  if (colMatch) {
    const colNum = parseInt(colMatch[1]);
    return {
      column: colNum,
      isEvenColumn: colNum % 2 === 0,
      // 奇数列朝向用户，偶数列背对用户
      facingDirection: colNum % 2 === 0 ? 'away' : 'towards'
    };
  }
  
  // 默认返回第一列朝向
  return {
    column: 1,
    isEvenColumn: false,
    facingDirection: 'towards'
  };
}
```

---

**User**

你的修改中对于机架朝向的 是根据列号判断， 不够准确， 因为没有一定规律的（后续还有其他机房）， 因此 我给你推荐一个从 模型当中获取朝向， Layout_Marker_2_rrrrrrr_east_col_right  这是个layout_maker 的对象name， 我们可以从它这里获取朝向，  对于判断第几列的话（机架的 name： Rack-01_east_col-01， 其中col-01 代表第一列）， 而对于 Layout_Marker_2_rrrrrrr_east_col_right  ， 获取第几列 是可以这样做的： Layout_Marker_2 其中最后的 2 代表第几个，  而 col 代表列还是排， 从而获取到 col-2 , 然后就可以同机架相关联起来了。 （注意提取的转向逻辑代码到composables中  因为多个模块将用到此逻辑。 

---

**Cursor**

我理解了您的需求！您希望通过模型中的`Layout_Marker`对象获取更准确的朝向信息，而不是简单地根据列号判断。这是一个更灵活的方案，尤其是考虑到不同机房可能有不同的布局规则。

## 创建布局工具函数

首先，我们需要创建一个专门的工具函数来解析布局标记。

### 1. 创建新的 utils 文件

```javascript:vueTest/src/utils/layoutUtils.js
/**
 * 机房布局工具函数
 * 用于解析和处理机房布局相关信息
 */

/**
 * 解析布局标记信息
 * @param {string} markerName - 标记对象名称 (如 "Layout_Marker_2_rrrrrrr_east_col_right")
 * @returns {Object|null} 布局信息对象或null
 */
export function parseLayoutMarker(markerName) {
  if (!markerName || typeof markerName !== 'string') return null;
  
  try {
    // 提取标记序号
    const markerNumMatch = markerName.match(/Layout_Marker_(\d+)/i);
    const markerNum = markerNumMatch ? parseInt(markerNumMatch[1]) : null;
    
    // 提取方向信息 (east, west, north, south)
    const directionMatch = markerName.match(/(east|west|north|south)/i);
    const direction = directionMatch ? directionMatch[1].toLowerCase() : null;
    
    // 提取具体朝向 (left, right)
    const orientationMatch = markerName.match(/(left|right)/i);
    const orientation = orientationMatch ? orientationMatch[1].toLowerCase() : null;
    
    // 提取是列还是排
    const typeMatch = markerName.match(/(col|row)/i);
    const layoutType = typeMatch ? typeMatch[1].toLowerCase() : null;
    
    return {
      markerId: markerNum,
      direction, // east, west, north, south
      orientation, // left, right
      layoutType, // col, row
      original: markerName,
      // 合成列/排标识，如 "col-2"
      layoutKey: layoutType && markerNum ? `${layoutType}-${markerNum}` : null
    };
  } catch (error) {
    console.error('解析布局标记失败:', markerName, error);
    return null;
  }
}

/**
 * 查找场景中的所有布局标记
 * @param {THREE.Object3D} sceneModel - 场景模型
 * @returns {Map<string, Object>} 布局信息映射 (layoutKey -> 布局信息)
 */
export function findLayoutMarkers(sceneModel) {
  const layoutMarkers = new Map();
  
  if (!sceneModel) return layoutMarkers;
  
  sceneModel.traverse((obj) => {
    if (obj.name && obj.name.includes('Layout_Marker')) {
      const layoutInfo = parseLayoutMarker(obj.name);
      if (layoutInfo && layoutInfo.layoutKey) {
        layoutMarkers.set(layoutInfo.layoutKey, {
          ...layoutInfo,
          object: obj // 保存对象引用
        });
      }
    }
  });
  
  return layoutMarkers;
}

/**
 * 获取机架所属的布局标记信息
 * @param {string} rackName - 机架名称 (如 "Rack-01_east_col-01")
 * @param {Map<string, Object>} layoutMarkers - 布局标记映射
 * @returns {Object|null} 布局信息对象或null
 */
export function getRackLayoutInfo(rackName, layoutMarkers) {
  if (!rackName || !layoutMarkers || layoutMarkers.size === 0) return null;
  
  try {
    // 从机架名称中提取列/排信息
    const colMatch = rackName.match(/col-(\d+)/i);
    const rowMatch = rackName.match(/row-(\d+)/i);
    
    // 优先尝试列匹配
    if (colMatch) {
      const colNum = parseInt(colMatch[1]);
      const layoutKey = `col-${colNum}`;
      return layoutMarkers.get(layoutKey) || null;
    }
    
    // 其次尝试排匹配
    if (rowMatch) {
      const rowNum = parseInt(rowMatch[1]);
      const layoutKey = `row-${rowNum}`;
      return layoutMarkers.get(layoutKey) || null;
    }
    
    return null;
  } catch (error) {
    console.error('获取机架布局信息失败:', rackName, error);
    return null;
  }
}

/**
 * 获取机架朝向信息
 * @param {string} rackName - 机架名称
 * @param {Map<string, Object>} layoutMarkers - 布局标记映射
 * @returns {Object} 朝向信息
 */
export function getRackOrientation(rackName, layoutMarkers) {
  // 获取布局信息
  const layoutInfo = getRackLayoutInfo(rackName, layoutMarkers);
  
  // 默认朝向信息
  const defaultOrientation = {
    direction: 'east', // 默认朝东
    orientation: 'towards', // 默认朝向用户
    layoutType: 'col',
    markerId: null,
    layoutKey: null
  };
  
  if (!layoutInfo) return defaultOrientation;
  
  // 根据布局标记确定朝向
  const orientation = layoutInfo.orientation === 'right' ? 'away' : 'towards';
  
  return {
    direction: layoutInfo.direction || defaultOrientation.direction,
    orientation: orientation,
    layoutType: layoutInfo.layoutType || defaultOrientation.layoutType,
    markerId: layoutInfo.markerId,
    layoutKey: layoutInfo.layoutKey
  };
}
```

### 2. 集成到 useRackView.js 中

```javascript:vueTest/src/composables/three/useRackView.js
// src/composables/three/useRackView.js
import * as THREE from 'three';
import { reactive, ref } from 'vue';
import { animate, easeInOutCubic, easeOutCubic } from '@/utils/animations';
import { useSceneObjects } from '@/composables/three/useSceneObjects';
import { findLayoutMarkers, getRackOrientation } from '@/utils/layoutUtils';

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
    firstNetworkElementClick: true,
    layoutMarkers: new Map() // 存储布局标记
  });
  
  // ... 现有代码 ...
  
  /**
   * 初始化布局标记
   * @param {THREE.Object3D} model - 场景模型
   */
  function initLayoutMarkers(model) {
    if (!model) return;
    
    // 查找并存储所有布局标记
    rackViewState.layoutMarkers = findLayoutMarkers(model);
    console.log(`找到 ${rackViewState.layoutMarkers.size} 个布局标记`);
  }
  
  /**
   * 获取机架的初始旋转角度
   * @param {string} rackName - 机架名称
   * @returns {number} 旋转角度（弧度）
   */
  function getRackInitialRotation(rackName) {
    const orientationInfo = getRackOrientation(rackName, rackViewState.layoutMarkers);
    
    // 根据方向确定基础角度
    let baseAngle = 0;
    switch (orientationInfo.direction) {
      case 'north': baseAngle = Math.PI; break; // 朝北 = 180度
      case 'east': baseAngle = Math.PI / 2; break; // 朝东 = 90度
      case 'west': baseAngle = -Math.PI / 2; break; // 朝西 = -90度
      default: baseAngle = 0; // 朝南 = 0度
    }
    
    // 如果是背向用户，再旋转180度
    if (orientationInfo.orientation === 'away') {
      baseAngle += Math.PI;
    }
    
    return baseAngle;
  }
  
  // 修改 createSingleRackScene 函数
  function createSingleRackScene(rackData, context) {
    const { scene, camera, renderer, controls, mainModel } = context;
    
    // ... 现有代码 ...
    
    try {
      // 初始化布局标记（如果尚未初始化）
      if (rackViewState.layoutMarkers.size === 0 && mainModel) {
        initLayoutMarkers(mainModel);
      }
      
      // ... 克隆和处理机架的代码 ...
      
      // 根据机架朝向设置初始旋转角度
      const initialRotation = getRackInitialRotation(rackData.name);
      origin.rotation.y = initialRotation;
      
      if (sceneState) {
        sceneState.isFrontView = false;
        sceneState.rackInitialRotation = initialRotation; // 存储初始旋转
      }
      
      // ... 其他代码 ...
    }
    catch (error) {
      // ... 错误处理 ...
    }
  }
  
  // 修改 switchToFrontView 函数
  function switchToFrontView(context) {
    const { sceneState } = context;
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
    
    // 获取机架名称
    const rackName = sceneState.selectedRack?.name || '';
    
    // 计算正面视图角度 - 使用 π/2 表示正面
    const targetRotation = Math.PI / 2;
    
    // 将机架旋转到正面（π/2）
    animateRackRotation(targetRotation, context);
    rackViewState.isFrontView = true;
    if (sceneState) {
      sceneState.isFrontView = true;
    }
    
    return true;
  }
  
  // 修改 animateRackRotation 函数
  function animateRackRotation(targetRotation, context) {
    const { renderer, camera, sceneState, scene } = context;
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
  
  // 继续返回其他函数...
  
  return {
    rackViewState,
    createSingleRackScene,
    destroySingleRackScene,
    animateRackRotation,
    switchToFrontView,
    handleSingleRackViewClick,
    animateRackDevice,
    resetRackDeviceAnimation,
    createMultiRackScene,
    destroyMultiRackScene,
    initLayoutMarkers // 导出初始化函数
  };
}
```

### 3. 在 ServerRoomScene.vue 的 handleModelLoaded 中初始化布局标记

```vue:vueTest/src/components/three/ServerRoomScene.vue
// 在 handleModelLoaded 方法中添加布局标记初始化
handleModelLoaded(data) {
  // ... 现有代码 ...
  
  // 获取模型引用
  const model = this.$refs.baseScene.model;
  this.sceneState.mainScene = model;
  
  // 初始化布局标记
  if (this._createMultiRackScene) {
    // 直接初始化布局标记
    const initResult = this.initLayoutMarkers(model);
    console.log(`初始化布局标记: 找到 ${this.rackViewState.layoutMarkers.size} 个标记`);
  }
  
  // ... 继续现有处理逻辑 ...
}
```

### 4. 修改 sceneState 结构，添加机架朝向信息

```vue:vueTest/src/components/three/ServerRoomScene.vue
// 场景状态
const sceneState = reactive({
  currentView: 'main',
  mainScene: null,
  singleRackScene: null,
  singleDeviceScene: null,
  selectedRack: null,
  selectedDevice: null,
  originalCameraPosition: null,
  originalControlsTarget: null,
  isFrontView: false,
  rackInitialRotation: 0, // 机架初始旋转角度
  deviceAnimationStage: 0,
  animatingDevice: null,
  animatedDeviceParts: [],
  currentDevicePositions: new Map(),
  showTooltipInSingleRack: false,
  multiRackLayout: null,
  multiRackId: null,
});
```

### 5. 在 setup 函数中导出初始化方法

```vue:vueTest/src/components/three/ServerRoomScene.vue
// 从 useRackView 中导入初始化方法
const { 
  rackViewState, 
  createSingleRackScene: _createSingleRackScene, 
  destroySingleRackScene,
  animateRackRotation: _animateRackRotation,
  switchToFrontView: _switchToFrontView,
  handleSingleRackViewClick: _handleSingleRackViewClick,
  animateRackDevice: _animateRackDevice,
  resetRackDeviceAnimation: _resetRackDeviceAnimation,
  findDeviceByName: _findDeviceByName,
  createMultiRackScene: _createMultiRackScene,
  destroyMultiRackScene: _destroyMultiRackScene,
  initLayoutMarkers // 添加这一行
} = useRackView();

// 在 return 中导出
return {
  // ... 现有导出 ...
  initLayoutMarkers
};
```

## 完成的布局工具

这个实现有以下优点：

1. **灵活性更高**：不再硬编码朝向规则，而是从模型中提取
2. **统一处理**：将布局解析逻辑抽取为通用工具函数
3. **功能更完整**：支持解析多种方向和朝向信息
4. **可重用性**：不同组件可以共享相同的布局解析逻辑
5. **可扩展性**：未来添加新机房或新布局规则时更容易适配

这样，无论是第一列还是其他列的机架，都能根据其实际朝向正确地显示和旋转，而不是简单地基于列号判断。

```javascript
/**
 * 机房布局工具函数
 * 用于解析和处理机房布局相关信息
 */

/**
 * 解析布局标记信息
 * @param {string} markerName - 标记对象名称 (如 "Layout_Marker_2_rrrrrrr_east_col_right")
 * @returns {Object|null} 布局信息对象或null
 */
export function parseLayoutMarker(markerName) {
  if (!markerName || typeof markerName !== 'string') return null;
  
  try {
    // 提取标记序号
    const markerNumMatch = markerName.match(/Layout_Marker_(\d+)/i);
    const markerNum = markerNumMatch ? parseInt(markerNumMatch[1]) : null;
    
    // 提取方向信息 (east, west, north, south)
    const directionMatch = markerName.match(/(east|west|north|south)/i);
    const direction = directionMatch ? directionMatch[1].toLowerCase() : null;
    
    // 提取具体朝向 (left, right)
    const orientationMatch = markerName.match(/(left|right)/i);
    const orientation = orientationMatch ? orientationMatch[1].toLowerCase() : null;
    
    // 提取是列还是排
    const typeMatch = markerName.match(/(col|row)/i);
    const layoutType = typeMatch ? typeMatch[1].toLowerCase() : null;
    
    return {
      markerId: markerNum,
      direction, // east, west, north, south
      orientation, // left, right
      layoutType, // col, row
      original: markerName,
      // 合成列/排标识，如 "col-2"
      layoutKey: layoutType && markerNum ? `${layoutType}-${markerNum}` : null
    };
  } catch (error) {
    console.error('解析布局标记失败:', markerName, error);
    return null;
  }
}

/**
 * 查找场景中的所有布局标记
 * @param {THREE.Object3D} sceneModel - 场景模型
 * @returns {Map<string, Object>} 布局信息映射 (layoutKey -> 布局信息)
 */
export function findLayoutMarkers(sceneModel) {
  const layoutMarkers = new Map();
  
  if (!sceneModel) return layoutMarkers;
  
  sceneModel.traverse((obj) => {
    if (obj.name && obj.name.includes('Layout_Marker')) {
      const layoutInfo = parseLayoutMarker(obj.name);
      if (layoutInfo && layoutInfo.layoutKey) {
        layoutMarkers.set(layoutInfo.layoutKey, {
          ...layoutInfo,
          object: obj // 保存对象引用
        });
      }
    }
  });
  
  return layoutMarkers;
}

/**
 * 获取机架所属的布局标记信息
 * @param {string} rackName - 机架名称 (如 "Rack-01_east_col-01")
 * @param {Map<string, Object>} layoutMarkers - 布局标记映射
 * @returns {Object|null} 布局信息对象或null
 */
export function getRackLayoutInfo(rackName, layoutMarkers) {
  if (!rackName || !layoutMarkers || layoutMarkers.size === 0) return null;
  
  try {
    // 从机架名称中提取列/排信息
    const colMatch = rackName.match(/col-(\d+)/i);
    const rowMatch = rackName.match(/row-(\d+)/i);
    
    // 优先尝试列匹配
    if (colMatch) {
      const colNum = parseInt(colMatch[1]);
      const layoutKey = `col-${colNum}`;
      return layoutMarkers.get(layoutKey) || null;
    }
    
    // 其次尝试排匹配
    if (rowMatch) {
      const rowNum = parseInt(rowMatch[1]);
      const layoutKey = `row-${rowNum}`;
      return layoutMarkers.get(layoutKey) || null;
    }
    
    return null;
  } catch (error) {
    console.error('获取机架布局信息失败:', rackName, error);
    return null;
  }
}

/**
 * 获取机架朝向信息
 * @param {string} rackName - 机架名称
 * @param {Map<string, Object>} layoutMarkers - 布局标记映射
 * @returns {Object} 朝向信息
 */
export function getRackOrientation(rackName, layoutMarkers) {
  // 获取布局信息
  const layoutInfo = getRackLayoutInfo(rackName, layoutMarkers);
  
  // 默认朝向信息
  const defaultOrientation = {
    direction: 'east', // 默认朝东
    orientation: 'towards', // 默认朝向用户
    layoutType: 'col',
    markerId: null,
    layoutKey: null
  };
  
  if (!layoutInfo) return defaultOrientation;
  
  // 根据布局标记确定朝向
  const orientation = layoutInfo.orientation === 'right' ? 'away' : 'towards';
  
  return {
    direction: layoutInfo.direction || defaultOrientation.direction,
    orientation: orientation,
    layoutType: layoutInfo.layoutType || defaultOrientation.layoutType,
    markerId: layoutInfo.markerId,
    layoutKey: layoutInfo.layoutKey
  };
}
```

```javascript
// src/composables/three/useRackView.js
import * as THREE from 'three';
import { reactive, ref } from 'vue';
import { animate, easeInOutCubic, easeOutCubic } from '@/utils/animations';
import { useSceneObjects } from '@/composables/three/useSceneObjects';
import { findLayoutMarkers, getRackOrientation } from '@/utils/layoutUtils';

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
    firstNetworkElementClick: true,
    layoutMarkers: new Map() // 存储布局标记
  });
  
  // ... 现有代码 ...
  
  /**
   * 初始化布局标记
   * @param {THREE.Object3D} model - 场景模型
   */
  function initLayoutMarkers(model) {
    if (!model) return;
    
    // 查找并存储所有布局标记
    rackViewState.layoutMarkers = findLayoutMarkers(model);
    console.log(`找到 ${rackViewState.layoutMarkers.size} 个布局标记`);
  }
  
  /**
   * 获取机架的初始旋转角度
   * @param {string} rackName - 机架名称
   * @returns {number} 旋转角度（弧度）
   */
  function getRackInitialRotation(rackName) {
    const orientationInfo = getRackOrientation(rackName, rackViewState.layoutMarkers);
    
    // 根据方向确定基础角度
    let baseAngle = 0;
    switch (orientationInfo.direction) {
      case 'north': baseAngle = Math.PI; break; // 朝北 = 180度
      case 'east': baseAngle = Math.PI / 2; break; // 朝东 = 90度
      case 'west': baseAngle = -Math.PI / 2; break; // 朝西 = -90度
      default: baseAngle = 0; // 朝南 = 0度
    }
    
    // 如果是背向用户，再旋转180度
    if (orientationInfo.orientation === 'away') {
      baseAngle += Math.PI;
    }
    
    return baseAngle;
  }
  
  // 修改 createSingleRackScene 函数
  function createSingleRackScene(rackData, context) {
    const { scene, camera, renderer, controls, mainModel } = context;
    
    // ... 现有代码 ...
    
    try {
      // 初始化布局标记（如果尚未初始化）
      if (rackViewState.layoutMarkers.size === 0 && mainModel) {
        initLayoutMarkers(mainModel);
      }
      
      // ... 克隆和处理机架的代码 ...
      
      // 根据机架朝向设置初始旋转角度
      const initialRotation = getRackInitialRotation(rackData.name);
      origin.rotation.y = initialRotation;
      
      if (sceneState) {
        sceneState.isFrontView = false;
        sceneState.rackInitialRotation = initialRotation; // 存储初始旋转
      }
      
      // ... 其他代码 ...
    }
    catch (error) {
      // ... 错误处理 ...
    }
  }
  
  // 修改 switchToFrontView 函数
  function switchToFrontView(context) {
    const { sceneState } = context;
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
    
    // 获取机架名称
    const rackName = sceneState.selectedRack?.name || '';
    
    // 计算正面视图角度 - 使用 π/2 表示正面
    const targetRotation = Math.PI / 2;
    
    // 将机架旋转到正面（π/2）
    animateRackRotation(targetRotation, context);
    rackViewState.isFrontView = true;
    if (sceneState) {
      sceneState.isFrontView = true;
    }
    
    return true;
  }
  
  // 修改 animateRackRotation 函数
  function animateRackRotation(targetRotation, context) {
    const { renderer, camera, sceneState, scene } = context;
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
  
  // 继续返回其他函数...
  
  return {
    rackViewState,
    createSingleRackScene,
    destroySingleRackScene,
    animateRackRotation,
    switchToFrontView,
    handleSingleRackViewClick,
    animateRackDevice,
    resetRackDeviceAnimation,
    createMultiRackScene,
    destroyMultiRackScene,
    initLayoutMarkers // 导出初始化函数
  };
}
```

```vue
// 在 handleModelLoaded 方法中添加布局标记初始化
handleModelLoaded(data) {
  // ... 现有代码 ...
  
  // 获取模型引用
  const model = this.$refs.baseScene.model;
  this.sceneState.mainScene = model;
  
  // 初始化布局标记
  if (this._createMultiRackScene) {
    // 直接初始化布局标记
    const initResult = this.initLayoutMarkers(model);
    console.log(`初始化布局标记: 找到 ${this.rackViewState.layoutMarkers.size} 个标记`);
  }
  
  // ... 继续现有处理逻辑 ...
}
```

```vue
// 场景状态
const sceneState = reactive({
  currentView: 'main',
  mainScene: null,
  singleRackScene: null,
  singleDeviceScene: null,
  selectedRack: null,
  selectedDevice: null,
  originalCameraPosition: null,
  originalControlsTarget: null,
  isFrontView: false,
  rackInitialRotation: 0, // 机架初始旋转角度
  deviceAnimationStage: 0,
  animatingDevice: null,
  animatedDeviceParts: [],
  currentDevicePositions: new Map(),
  showTooltipInSingleRack: false,
  multiRackLayout: null,
  multiRackId: null,
});
```

```vue
// 从 useRackView 中导入初始化方法
const { 
  rackViewState, 
  createSingleRackScene: _createSingleRackScene, 
  destroySingleRackScene,
  animateRackRotation: _animateRackRotation,
  switchToFrontView: _switchToFrontView,
  handleSingleRackViewClick: _handleSingleRackViewClick,
  animateRackDevice: _animateRackDevice,
  resetRackDeviceAnimation: _resetRackDeviceAnimation,
  findDeviceByName: _findDeviceByName,
  createMultiRackScene: _createMultiRackScene,
  destroyMultiRackScene: _destroyMultiRackScene,
  initLayoutMarkers // 添加这一行
} = useRackView();

// 在 return 中导出
return {
  // ... 现有导出 ...
  initLayoutMarkers
};
```

---

**User**

你看， 原本 我的设计是 origin.rotation.y = Math.PI / 4;，  但你用getRackInitialRotation 来替代， 为何没有和之前的效果一样呢？

---

**Cursor**

```javascript
const initialRotation = getRackInitialRotation(rackData.name);
origin.rotation.y = initialRotation;   // 设置计算的初始旋转
origin.rotation.y = Math.PI / 4;       // 这行立即覆盖了上面的设置，固定为45度
```

我发现了问题！代码中有一个明显的错误：

```javascript
// 当前代码
const initialRotation = getRackInitialRotation(rackData.name);
origin.rotation.y = initialRotation;   // 先设置计算出的旋转角度
origin.rotation.y = Math.PI / 4;       // 然后立即用固定值覆盖了前一行的设置
```

第三行代码`origin.rotation.y = Math.PI / 4`直接覆盖了前一行设置的`initialRotation`值，导致无论`getRackInitialRotation`计算出什么值，最终机架的旋转角度都被固定为45度（π/4）。

需要删除第三行，只保留使用`initialRotation`的设置：

```javascript
// 修正后的代码
const initialRotation = getRackInitialRotation(rackData.name);
origin.rotation.y = initialRotation;   // 使用计算出的旋转角度
// 删除下面这行
// origin.rotation.y = Math.PI / 4;    // 这行会覆盖前面的设置
```

这样修改后，`getRackInitialRotation`计算的旋转角度才能正确应用到机架上，让不同朝向的机架有正确的初始视角。

```javascript
// 当前代码
const initialRotation = getRackInitialRotation(rackData.name);
origin.rotation.y = initialRotation;   // 先设置计算出的旋转角度
origin.rotation.y = Math.PI / 4;       // 然后立即用固定值覆盖了前一行的设置
```

```javascript
// 修正后的代码
const initialRotation = getRackInitialRotation(rackData.name);
origin.rotation.y = initialRotation;   // 使用计算出的旋转角度
// 删除下面这行
// origin.rotation.y = Math.PI / 4;    // 这行会覆盖前面的设置
```

---

**User**

我知道会覆盖之前的代码， 但是这个 origin.rotation.y = Math.PI / 4; 才是我想要的效果啊，  你的修改用getRackInitialRotation 替代， 初始旋转角度反而变了， 

---

**Cursor**

我明白了！您更希望保持原来的效果（固定的45度旋转角）。那我们需要调整代码，保留您想要的初始视角，同时还能利用布局标记信息来正确处理后续的旋转操作。

以下是解决方案：

```javascript
// 在useRackView.js中修改createSingleRackScene函数中的相关部分
// 保留原始45度旋转，但同时存储计算出的朝向信息供后续使用

// 计算真实朝向（供后续使用）
const initialRotation = getRackInitialRotation(rackData.name);

// 使用固定的45度角作为初始视图（保持您想要的效果）
origin.rotation.y = Math.PI / 4; 

// 存储真实朝向信息，但不立即应用
if (sceneState) {
  sceneState.isFrontView = false;
  sceneState.rackInitialRotation = initialRotation; // 存储真实朝向，供切换正面视图时使用
  sceneState.rackPreferredView = Math.PI / 4;      // 存储用户偏好的初始视图角度
}
```

然后在`switchToFrontView`函数中使用存储的真实朝向信息：

```javascript
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
  
  // 获取机架名称
  const rackName = sceneState.selectedRack?.name || '';
  
  // 使用存储的真实朝向信息来计算正面视图角度
  // 从当前角度(45度)旋转到正面视图
  // 对于东/西朝向，正面视图是90度或-90度
  let targetRotation = Math.PI / 2; // 默认正面视图(90度)
  
  // 如果存储了真实朝向，则基于当前角度计算旋转目标
  if (sceneState && sceneState.rackInitialRotation !== undefined) {
    // 根据真实朝向信息调整正面视图角度
    const orientation = getRackOrientation(rackName, rackViewState.layoutMarkers);
    
    if (orientation.direction === 'east') {
      targetRotation = Math.PI / 2; // 朝东的正面是90度
    } else if (orientation.direction === 'west') {
      targetRotation = -Math.PI / 2; // 朝西的正面是-90度
    } else if (orientation.direction === 'north') {
      targetRotation = Math.PI; // 朝北的正面是180度
    } else {
      targetRotation = 0; // 朝南的正面是0度
    }
    
    // 如果是背向用户，则进一步旋转180度
    if (orientation.orientation === 'away') {
      targetRotation += Math.PI;
    }
  }
  
  // 将机架旋转到计算出的正面视图角度
  animateRackRotation(targetRotation, context);
  rackViewState.isFrontView = true;
  if (sceneState) {
    sceneState.isFrontView = true;
  }
  
  return true;
}
```

这样修改后：
1. 初始视图保持您喜欢的45度角（Math.PI/4）
2. 但我们仍然获取并存储了机架的真实朝向信息
3. 当需要切换到"正面视图"时，会使用真实朝向信息计算正确的正面角度

这个解决方案既保留了您想要的初始效果，又利用了布局标记系统来正确处理后续的交互操作。

```javascript
// 在useRackView.js中修改createSingleRackScene函数中的相关部分
// 保留原始45度旋转，但同时存储计算出的朝向信息供后续使用

// 计算真实朝向（供后续使用）
const initialRotation = getRackInitialRotation(rackData.name);

// 使用固定的45度角作为初始视图（保持您想要的效果）
origin.rotation.y = Math.PI / 4; 

// 存储真实朝向信息，但不立即应用
if (sceneState) {
  sceneState.isFrontView = false;
  sceneState.rackInitialRotation = initialRotation; // 存储真实朝向，供切换正面视图时使用
  sceneState.rackPreferredView = Math.PI / 4;      // 存储用户偏好的初始视图角度
}
```

```javascript
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
  
  // 获取机架名称
  const rackName = sceneState.selectedRack?.name || '';
  
  // 使用存储的真实朝向信息来计算正面视图角度
  // 从当前角度(45度)旋转到正面视图
  // 对于东/西朝向，正面视图是90度或-90度
  let targetRotation = Math.PI / 2; // 默认正面视图(90度)
  
  // 如果存储了真实朝向，则基于当前角度计算旋转目标
  if (sceneState && sceneState.rackInitialRotation !== undefined) {
    // 根据真实朝向信息调整正面视图角度
    const orientation = getRackOrientation(rackName, rackViewState.layoutMarkers);
    
    if (orientation.direction === 'east') {
      targetRotation = Math.PI / 2; // 朝东的正面是90度
    } else if (orientation.direction === 'west') {
      targetRotation = -Math.PI / 2; // 朝西的正面是-90度
    } else if (orientation.direction === 'north') {
      targetRotation = Math.PI; // 朝北的正面是180度
    } else {
      targetRotation = 0; // 朝南的正面是0度
    }
    
    // 如果是背向用户，则进一步旋转180度
    if (orientation.orientation === 'away') {
      targetRotation += Math.PI;
    }
  }
  
  // 将机架旋转到计算出的正面视图角度
  animateRackRotation(targetRotation, context);
  rackViewState.isFrontView = true;
  if (sceneState) {
    sceneState.isFrontView = true;
  }
  
  return true;
}
```

---

**User**

怎么能固定的45度角呢， 你第一列是旋转45度， 但是其他列因为朝向问题， 你旋转45度后 肯定不对啊

---

**Cursor**

您说得对，我理解错了！确实不能简单地固定为45度，因为不同列的机架朝向不同，需要考虑其实际朝向。

让我重新设计正确的解决方案：

```javascript
// 在useRackView.js中修改createSingleRackScene函数

// 1. 计算基准朝向角度
const baseOrientation = getRackInitialRotation(rackData.name);

// 2. 在基准朝向上添加45度的"透视偏移"，让用户能看到机架侧面
const viewOffset = Math.PI / 4; // 45度偏移
const initialRotation = baseOrientation + viewOffset;

// 3. 应用计算后的角度
origin.rotation.y = initialRotation;

// 4. 存储相关信息
if (sceneState) {
  sceneState.isFrontView = false;
  sceneState.rackBaseOrientation = baseOrientation; // 存储基准朝向
  sceneState.rackViewOffset = viewOffset;          // 存储偏移量
}
```

然后在`switchToFrontView`函数中：

```javascript
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
  
  // 使用存储的基准朝向作为正面视图的目标角度
  // 即移除之前添加的偏移量
  const targetRotation = sceneState.rackBaseOrientation || 0;
  
  // 将机架旋转到正面角度
  animateRackRotation(targetRotation, context);
  rackViewState.isFrontView = true;
  if (sceneState) {
    sceneState.isFrontView = true;
  }
  
  return true;
}
```

这样设计的逻辑是：
1. 首先计算机架的真实基准朝向（基于布局标记）
2. 在基准朝向的基础上添加45度偏移，作为初始视角（让用户能看到机架侧面）
3. 切换到正面视图时，回到基准朝向（移除偏移量）

这样无论是第一列还是其他列的机架，都能根据其实际朝向正确显示初始视角和正面视图。

```javascript
// 在useRackView.js中修改createSingleRackScene函数

// 1. 计算基准朝向角度
const baseOrientation = getRackInitialRotation(rackData.name);

// 2. 在基准朝向上添加45度的"透视偏移"，让用户能看到机架侧面
const viewOffset = Math.PI / 4; // 45度偏移
const initialRotation = baseOrientation + viewOffset;

// 3. 应用计算后的角度
origin.rotation.y = initialRotation;

// 4. 存储相关信息
if (sceneState) {
  sceneState.isFrontView = false;
  sceneState.rackBaseOrientation = baseOrientation; // 存储基准朝向
  sceneState.rackViewOffset = viewOffset;          // 存储偏移量
}
```

```javascript
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
  
  // 使用存储的基准朝向作为正面视图的目标角度
  // 即移除之前添加的偏移量
  const targetRotation = sceneState.rackBaseOrientation || 0;
  
  // 将机架旋转到正面角度
  animateRackRotation(targetRotation, context);
  rackViewState.isFrontView = true;
  if (sceneState) {
    sceneState.isFrontView = true;
  }
  
  return true;
}
```

---

**User**

如图是当前的效果， 我要的是原本的  和这个相反的（朝向左边的侧面45度）

---

**Cursor**

```javascript
// 1. 计算基准朝向角度
const baseOrientation = getRackInitialRotation(rackData.name);

// 2. 在基准朝向上添加45度的"透视偏移"，让用户能看到机架侧面
const viewOffset = Math.PI / 4; // 45度偏移
const initialRotation = baseOrientation + viewOffset;

// 3. 应用计算后的角度
origin.rotation.y = initialRotation;
```

查看了代码和图片，我明白问题所在了。当前机架模型朝向右侧45度，您希望改成朝向左侧45度。

问题出在 `useRackView.js` 中的 `createSingleRackScene` 函数，视角偏移的设置方向需要调整：

```javascript:231-236:vueTest/src/composables/three/useRackView.js
// 1. 计算基准朝向角度
const baseOrientation = getRackInitialRotation(rackData.name);

// 2. 在基准朝向上添加45度的"透视偏移"，让用户能看到机架侧面
const viewOffset = -Math.PI / 4; // 改为负45度偏移，让机架朝向左侧
const initialRotation = baseOrientation + viewOffset;
```

只需要将 `viewOffset` 的值从 `Math.PI / 4` 改为 `-Math.PI / 4`，这样机架就会向左侧旋转45度，而不是向右侧。

```javascript
// 1. 计算基准朝向角度
const baseOrientation = getRackInitialRotation(rackData.name);

// 2. 在基准朝向上添加45度的"透视偏移"，让用户能看到机架侧面
const viewOffset = -Math.PI / 4; // 改为负45度偏移，让机架朝向左侧
const initialRotation = baseOrientation + viewOffset;
```

---

**User**

同样的， 机架上的设备， 也需要同样的处理：获取朝向再根据朝向得到初始旋转角度 

---

**Cursor**

我明白需求了，需要在单设备视图中也应用相同的朝向处理逻辑。让我们修改`useDeviceView.js`中的相机位置设置：

```javascript:vueTest/src/composables/three/useDeviceView.js
// 在createSingleDeviceScene函数中，找到计算相机位置的部分并修改为：

// 需要在开头引入layoutUtils工具
import { getRackOrientation } from '@/utils/layoutUtils';

// ...

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

// 获取设备所属机架的朝向信息
let deviceOrientation = null;
if (deviceObject.userData && deviceObject.userData.details && deviceObject.userData.details.rack) {
    const rackName = deviceObject.userData.details.rack;
    // 使用layoutUtils中的方法获取机架朝向
    if (context.layoutMarkers && context.layoutMarkers.size > 0) {
        deviceOrientation = getRackOrientation(rackName, context.layoutMarkers);
    }
}

// 修改相机位置 - 根据朝向设置观察角度
if (deviceOrientation && deviceOrientation.direction) {
    // 根据朝向决定相机位置
    switch (deviceOrientation.direction) {
        case 'east':
            // 东向(右侧)机架的设备需要从左前方观察
            camera.position.set(
                center.x - cameraDistance * 0.85,
                center.y + maxDim * 0.1,
                center.z + cameraDistance * 0.85
            );
            break;
        case 'west':
            // 西向(左侧)机架的设备需要从右前方观察
            camera.position.set(
                center.x + cameraDistance * 0.85,
                center.y + maxDim * 0.1,
                center.z + cameraDistance * 0.85
            );
            break;
        default:
            // 默认从左前方45度角观察设备（与机架视图保持一致）
            camera.position.set(
                center.x - cameraDistance * 0.85,
                center.y + maxDim * 0.1,
                center.z + cameraDistance * 0.85
            );
    }
} else {
    // 无法确定朝向时使用默认左前方45度角观察
    camera.position.set(
        center.x - cameraDistance * 0.85,
        center.y + maxDim * 0.1,
        center.z + cameraDistance * 0.85
    );
}
```

这个修改将使单设备视图的相机位置根据设备所属机架的朝向来确定，保持与机架视图一致的观察角度。为了实现这个功能，需要：

1. 确保在调用`createSingleDeviceScene`时传入`layoutMarkers`信息
2. 将`getRackOrientation`函数导入到`useDeviceView.js`

如果需要更精确的处理，我们还可以直接对设备模型应用旋转，但通常调整相机位置更简单直接。

```javascript
// 在createSingleDeviceScene函数中，找到计算相机位置的部分并修改为：

// 需要在开头引入layoutUtils工具
import { getRackOrientation } from '@/utils/layoutUtils';

// ...

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

// 获取设备所属机架的朝向信息
let deviceOrientation = null;
if (deviceObject.userData && deviceObject.userData.details && deviceObject.userData.details.rack) {
    const rackName = deviceObject.userData.details.rack;
    // 使用layoutUtils中的方法获取机架朝向
    if (context.layoutMarkers && context.layoutMarkers.size > 0) {
        deviceOrientation = getRackOrientation(rackName, context.layoutMarkers);
    }
}

// 修改相机位置 - 根据朝向设置观察角度
if (deviceOrientation && deviceOrientation.direction) {
    // 根据朝向决定相机位置
    switch (deviceOrientation.direction) {
        case 'east':
            // 东向(右侧)机架的设备需要从左前方观察
            camera.position.set(
                center.x - cameraDistance * 0.85,
                center.y + maxDim * 0.1,
                center.z + cameraDistance * 0.85
            );
            break;
        case 'west':
            // 西向(左侧)机架的设备需要从右前方观察
            camera.position.set(
                center.x + cameraDistance * 0.85,
                center.y + maxDim * 0.1,
                center.z + cameraDistance * 0.85
            );
            break;
        default:
            // 默认从左前方45度角观察设备（与机架视图保持一致）
            camera.position.set(
                center.x - cameraDistance * 0.85,
                center.y + maxDim * 0.1,
                center.z + cameraDistance * 0.85
            );
    }
} else {
    // 无法确定朝向时使用默认左前方45度角观察
    camera.position.set(
        center.x - cameraDistance * 0.85,
        center.y + maxDim * 0.1,
        center.z + cameraDistance * 0.85
    );
}
```

