# 智慧机房 3D 可视化项目

## 项目简介

本项目是一个基于 Vue 3 和 Three.js 的智慧机房 3D 可视化系统，提供了机房设备的实时监控、状态查看和交互操作功能。

## 组件架构

项目采用组件化设计，Three.js 相关组件采用以下层次结构：

```
BaseThreeScene.vue (基础 Three.js 场景组件)
    ↑
ServerRoomScene.vue (服务器房间特定场景组件)
    ↑
ServerRoom.vue (服务器房间视图封装组件)
    ↑
SmartServerRoom.vue (智慧机房业务组件)
```

### 组件说明

1. **BaseThreeScene.vue**
   - 基础 Three.js 场景组件，处理通用的 3D 场景功能
   - 提供场景初始化、相机设置、光照、模型加载、交互处理等基础功能
   - 定义了统一的事件接口（object-clicked, object-hover, scene-ready, model-loaded）
   - 可通过多个 props 进行配置（modelPath, backgroundColor, cameraPosition 等）

2. **ServerRoomScene.vue**
   - 扩展 BaseThreeScene，添加服务器房间特定功能
   - 处理设备和机架的交互逻辑和视觉效果
   - 实现高亮显示、聚焦设备、重置视图等特定功能

3. **ServerRoom.vue**
   - 封装 ServerRoomScene，简化接口
   - 转发事件和方法调用
   - 为上层业务组件提供简洁的 API

4. **SmartServerRoom.vue**
   - 业务组件，实现智慧机房的完整功能
   - 包含状态栏、设备详情面板、提示框、底部导航等 UI 元素
   - 处理业务逻辑，如设备状态监控、告警、统计等

## 使用方法

### 基础 Three.js 场景

```vue
<template>
  <base-three-scene
    model-path="/path/to/your/model.gltf"
    background-color="#000714"
    :camera-position="{ x: 0, y: 2, z: 5 }"
    @object-clicked="handleObjectClick"
    @scene-ready="handleSceneReady"
  />
</template>

<script>
import BaseThreeScene from '@/components/three/BaseThreeScene.vue';

export default {
  components: { BaseThreeScene },
  methods: {
    handleObjectClick(data) {
      console.log('Clicked object:', data);
    },
    handleSceneReady() {
      console.log('Scene is ready');
    }
  }
}
</script>
```

### 服务器房间场景

```vue
<template>
  <server-room
    model-path="/models/server_room.gltf"
    @object-clicked="handleObjectClick"
  />
</template>

<script>
import ServerRoom from '@/components/ServerRoom.vue';

export default {
  components: { ServerRoom },
  methods: {
    handleObjectClick(data) {
      console.log('Clicked device:', data);
    }
  }
}
</script>
```

## 扩展建议

1. **创建新的特定场景**
   - 继承 BaseThreeScene.vue 创建新的场景组件
   - 实现特定的交互逻辑和视觉效果
   - 封装为业务组件供页面使用

2. **添加新功能**
   - 可以扩展现有组件，添加新的交互方式
   - 实现更多的特效，如粒子效果、过渡动画等
   - 添加数据可视化功能，如热力图、图表等

3. **性能优化**
   - 使用模型 LOD (Level of Detail) 技术
   - 实现模型的延迟加载和卸载
   - 优化渲染循环和事件处理
   - 考虑使用 Web Worker 进行复杂计算

## 注意事项

1. 在使用 Three.js 组件时，务必在组件销毁前正确清理资源，避免内存泄漏
2. 大型 3D 模型加载可能较慢，建议添加加载进度提示
3. 移动端支持需要考虑触摸事件和性能优化
4. WebGL 兼容性问题需要添加相应的检测和降级处理

## 开发流程

1. 确定需求和交互方式
2. 准备 3D 模型（推荐使用 .gltf 格式）
3. 基于基础组件开发特定场景组件
4. 实现业务逻辑和 UI 界面
5. 测试和优化

## 技术栈
- Vue 3（组合式API）
- Three.js（3D渲染）
- SCSS（样式管理）

## 项目结构说明
```
src/
├── assets/          # 静态资源
├── components/      # 组件
│   ├── device/      # 设备相关组件
│   ├── layout/      # 布局组件
│   ├── scene/       # 场景组件
│   └── ui/          # 通用UI组件
├── composables/     # 组合式API
│   ├── three/       # Three.js相关
│   └── ui/          # UI相关
├── styles/          # 全局样式
│   ├── variables.scss  # 样式变量
│   └── mixins.scss     # 样式混合
├── utils/           # 工具函数
└── views/           # 页面视图
```

## 重构说明

### 重构目标
1. 将大型组件分解为更小、更可维护的组件
2. 使用组合式API提高代码复用性
3. 引入SCSS变量和混合器统一样式管理
4. 优化性能和交互体验

### 已实现组件
- **基础UI组件**
  - `BasePanel`: 可拖拽面板组件
  
- **布局组件**
  - `TopStatusBar`: 顶部状态栏
  - `BottomNavBar`: 底部导航栏
  
- **设备组件**
  - `DeviceDetailPanel`: 设备详情面板
  - `DeviceTooltip`: 设备悬浮提示
  
- **场景组件**
  - `SceneContainer`: 3D场景容器

### 组合式API
- `useDraggable`: 提供拖拽功能
- `useEventListener`: 事件监听管理
- `useFormatters`: 格式化工具函数
- `useWindowResize`: 窗口大小变化处理
- `useThemeVariables`: 主题变量管理

## 最近更新记录

### 2023-11-28: Composition API 迁移
- 将 ServerRoom.vue 组件从 Options API 完全转换为 Composition API
- 修复了 BaseThreeScene.vue 中的生命周期钩子，使用 onBeforeUnmount 替代 beforeUnmount
- 确保所有 Three.js 相关组件正确使用 Vue 3 的 Composition API 生命周期钩子
- 重新设计了 ServerRoom.vue 的公共接口，保持与原有 API 兼容
- 增强了资源清理功能，防止内存泄漏

### 2023-11-27: 生命周期钩子修复
- 修复了组件生命周期钩子不一致的问题
- 将ServerRoom组件中的beforeDestroy更新为Vue 3中的beforeUnmount
- 确保所有组件正确使用Vue 3的生命周期钩子命名规范

## 使用指南

### 开发环境启动
```bash
npm install
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 组件使用示例

#### BasePanel 基础面板
```vue
<BasePanel
  :visible="true"
  :initial-x="20"
  :initial-y="20"
  :width="280"
>
  <template #header>面板标题</template>
  面板内容
  <template #footer>面板底部</template>
</BasePanel>
```

#### DeviceDetailPanel 设备详情面板
```vue
<DeviceDetailPanel
  :visible="true"
  :device-data="deviceData"
  @close="closePanel"
  @refresh="refreshData"
/>
```

## 后续改进计划
1. 引入状态管理，使用Pinia管理设备数据和应用状态
2. 优化3D渲染性能
3. 添加动画效果和过渡
4. 实现更多交互功能
5. 完善错误处理和边缘情况

## 注意事项
1. 开发时请保持组件单一职责原则
2. 使用SCSS变量保持样式一致性
3. 使用组合式API复用功能逻辑
4. 修改Three.js相关逻辑时需注意性能影响