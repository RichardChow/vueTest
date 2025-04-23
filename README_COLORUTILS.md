# 颜色管理工具模块使用说明

## 功能概述

本模块提供了一套完整的Three.js对象颜色管理解决方案，用于处理3D场景中对象的高亮、恢复和颜色特效等操作。该模块解决了之前项目中颜色管理混乱、代码重复、高亮效果不一致等问题。

## 主要功能

- **颜色保存与恢复**：安全地保存对象原始颜色并能够随时恢复
- **智能高亮处理**：根据对象类型自动应用合适的高亮颜色
- **批量颜色操作**：支持同时处理多个对象的颜色变更
- **动态颜色效果**：包括闪烁、脉冲等高级颜色动画效果
- **支持材质类型**：兼容单材质和多材质数组两种情况

## 核心API

### 颜色常量

```javascript
import { HIGHLIGHT_COLORS } from '@/utils/colorUtils';

// 可用的预定义颜色：
// HIGHLIGHT_COLORS.DEFAULT - 默认高亮颜色（青色）
// HIGHLIGHT_COLORS.HOVER - 悬停高亮颜色
// HIGHLIGHT_COLORS.SELECT - 选中高亮颜色
// HIGHLIGHT_COLORS.RACK - 机架高亮颜色
// HIGHLIGHT_COLORS.NETWORK - 网络设备高亮颜色
// HIGHLIGHT_COLORS.SERVER - 服务器高亮颜色
// HIGHLIGHT_COLORS.WARNING - 警告高亮颜色
// HIGHLIGHT_COLORS.ERROR - 错误高亮颜色
```

### 基础方法

```javascript
import { 
  createColorMap, 
  saveOriginalColor, 
  restoreOriginalColor, 
  setHighlightColor 
} from '@/utils/colorUtils';

// 创建一个颜色映射表
const colorMap = createColorMap();

// 保存对象原始颜色
saveOriginalColor(object, colorMap, recursive);

// 恢复对象原始颜色
restoreOriginalColor(object, colorMap, recursive, removeFromMap);

// 设置高亮颜色
setHighlightColor(object, color, recursive, colorMap);
```

### 特殊设备高亮

```javascript
import { setDeviceHighlight } from '@/utils/colorUtils';

// 根据设备类型自动选择合适的高亮颜色
setDeviceHighlight(deviceObject, deviceType, recursive, colorMap);
```

### 批量操作

```javascript
import { batchHighlight, batchRestoreColor } from '@/utils/colorUtils';

// 批量高亮一组对象
batchHighlight(objectsArray, color, colorMap);

// 批量恢复一组对象的颜色
batchRestoreColor(objectsArray, colorMap, removeFromMap);
```

### 动画效果

```javascript
import { flashHighlight, pulseHighlight } from '@/utils/colorUtils';

// 闪烁高亮效果
flashHighlight(object, color, colorMap, duration, frequency)
  .then(() => {
    console.log('闪烁效果完成');
  });

// 脉冲高亮效果（渐变强度）
pulseHighlight(object, color, colorMap, duration, speed)
  .then(() => {
    console.log('脉冲效果完成');
  });
```

## 使用示例

### 1. 在组件中初始化

```javascript
import { reactive } from 'vue';
import { createColorMap } from '@/utils/colorUtils';

export default {
  setup() {
    const state = reactive({
      colorMap: createColorMap()
    });
    
    return { state };
  }
}
```

### 2. 简单高亮与恢复

```javascript
import { 
  saveOriginalColor, 
  setHighlightColor, 
  restoreOriginalColor, 
  HIGHLIGHT_COLORS 
} from '@/utils/colorUtils';

// 高亮对象
function highlightObject(object) {
  // 保存原始颜色
  saveOriginalColor(object, this.colorMap);
  
  // 设置高亮颜色
  setHighlightColor(object, HIGHLIGHT_COLORS.HOVER, false, this.colorMap);
}

// 恢复对象颜色
function resetHighlight(object) {
  restoreOriginalColor(object, this.colorMap);
}
```

### 3. 根据设备类型高亮

```javascript
import { setDeviceHighlight } from '@/utils/colorUtils';
import { detectDevice } from '@/utils/deviceUtils';

function highlightDevice(object) {
  // 检测设备类型
  const deviceType = detectDevice(object);
  
  // 根据设备类型自动应用适合的高亮颜色
  setDeviceHighlight(object, deviceType, false, this.colorMap);
}
```

## 优化建议

1. **性能优化**：对于大型场景，考虑使用对象层级或包围盒来限制需要处理的对象数量

2. **整合交互系统**：将颜色管理与交互系统（如 useSceneInteractions）结合，实现更统一的用户体验

3. **状态管理**：考虑将高亮状态集成到Pinia/Vuex等状态管理中，便于跨组件协调

4. **着色器扩展**：对于更高级的效果（轮廓高亮、光晕等），考虑实现自定义着色器

5. **缓存优化**：对频繁高亮的对象实现材质缓存，减少克隆和创建开销

## 注意事项

- 确保在组件卸载前恢复所有对象的原始颜色，避免内存泄漏
- 对于复杂材质（如PBR材质），高亮可能需要调整更多参数而非仅仅是颜色
- 递归处理大型模型时要小心性能问题，可能需要限制递归深度
- 当对象包含大量子对象时，建议使用批量处理方法而非单独处理 