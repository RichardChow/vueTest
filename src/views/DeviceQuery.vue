<template>
  <div class="device-query">
    <!-- 顶部操作区域 -->
    <div class="header-actions">
      <el-button 
        type="primary" 
        icon="el-icon-back"
        @click="$router.push('/dashboard')"
      >
        返回首页
      </el-button>
      
      <!-- 添加新建设备按钮 -->
      <el-button
        type="success"
        icon="el-icon-plus"
        class="create-device-btn"
        @click="$router.push('/create-device')"
      >
        新建设备
      </el-button>
    </div>

    <!-- 搜索区域 -->
    <div class="search-section">
      <el-input
        v-model="searchQuery"
        placeholder="输入设备名称、IP地址或机架编号搜索"
        @input="handleSearch"
        clearable
      >
        <template #prefix>
          <i class="el-icon-search"></i>
        </template>
      </el-input>
    </div>

    <!-- 3D机房视图 -->
    <div class="datacenter-view">
      <div ref="threeContainer" class="three-container"></div>
    </div>

    <!-- 设备列表 -->
    <div class="device-list">
      <el-table :data="devices" style="width: 100%">
        <el-table-column prop="name" label="设备名称" />
        <el-table-column prop="ip_address" label="IP地址" />
        <el-table-column prop="device_type" label="设备类型" />
        <el-table-column prop="rack_number" label="机架编号" />
        <el-table-column prop="position" label="位置" />
        <el-table-column prop="status" label="状态">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ scope.row.status }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import request from '@/utils/request'
import { deviceTypes } from '@/config/deviceTypes'

export default {
  name: 'DeviceQuery',
  setup() {
    const searchQuery = ref('')
    const devices = ref([])
    const threeContainer = ref(null)
    let scene, camera, renderer, controls

    // 获取状态标签类型
    const getStatusType = (status) => {
      const statusMap = {
        'online': 'success',
        'offline': 'danger',
        'maintenance': 'warning'
      }
      return statusMap[status] || 'info'
    }

    // 初始化3D场景
    const init3DScene = () => {
      scene = new THREE.Scene()
      scene.background = new THREE.Color(0xf0f0f0)

      camera = new THREE.PerspectiveCamera(
        45,
        threeContainer.value.clientWidth / threeContainer.value.clientHeight,
        0.1,
        1000
      )
      
      renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(threeContainer.value.clientWidth, threeContainer.value.clientHeight)
      renderer.shadowMap.enabled = true
      threeContainer.value.appendChild(renderer.domElement)

      // 调整相机位置以获得更好的视角
      camera.position.set(10, 8, 15)
      camera.lookAt(0, 2, 0)  // 看向设备中心

      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.minDistance = 5
      controls.maxDistance = 30
      controls.maxPolarAngle = Math.PI / 2.2  // 限制俯视角度

      createRacks()
      animate()

      window.addEventListener('resize', onWindowResize, false)
    }

    // 窗口大小改变处理
    const onWindowResize = () => {
      camera.aspect = threeContainer.value.clientWidth / threeContainer.value.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(threeContainer.value.clientWidth, threeContainer.value.clientHeight)
    }

    // 添加组件创建函数
    const createLED = (config) => {
      const ledGeometry = new THREE.CircleGeometry(0.05, 32)
      const ledMaterial = new THREE.MeshPhongMaterial({ 
        color: parseInt(config.color) 
      })
      const led = new THREE.Mesh(ledGeometry, ledMaterial)
      led.position.set(config.position.x, config.position.y, config.position.z)
      return led
    }

    const createPorts = (config) => {
      const portGroup = new THREE.Group()
      const portGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.05)
      const portMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x7f8c8d 
      })

      for (let i = 0; i < config.count; i++) {
        const port = new THREE.Mesh(portGeometry, portMaterial)
        port.position.set(
          config.startX + (i * config.spacing),
          0,
          config.position?.z || 0
        )
        portGroup.add(port)
      }
      return portGroup
    }

    const createDisplay = (config) => {
      const displayGeometry = new THREE.PlaneGeometry(config.width, config.height)
      const displayMaterial = new THREE.MeshPhongMaterial({
        color: 0x2c3e50,
        emissive: 0x34495e
      })
      const display = new THREE.Mesh(displayGeometry, displayMaterial)
      return display
    }

    // 修改组件创建逻辑
    const createDeviceUnit = (deviceType) => {
      const config = deviceTypes[deviceType]
      if (!config) return null

      const unitGroup = new THREE.Group()
      const { width, height, depth } = config.model
      const { materials, panels } = config.model

      // 创建设备主体
      const mainGeometry = new THREE.BoxGeometry(width, height, depth)
      const mainMaterial = new THREE.MeshPhongMaterial({
        color: parseInt(materials.main.color),
        transparent: true,
        opacity: materials.main.opacity
      })
      const mainBody = new THREE.Mesh(mainGeometry, mainMaterial)
      unitGroup.add(mainBody)

      // 创建面板和组件
      panels.forEach(panel => {
        panel.components.forEach(component => {
          let componentMesh
          switch (component.type) {
            case 'led':
              componentMesh = createLED(component)
              break
            case 'ports':
              componentMesh = createPorts(component)
              break
            case 'display':
              componentMesh = createDisplay(component)
              break
            default:
              return
          }
          if (componentMesh) {
            unitGroup.add(componentMesh)
          }
        })
      })

      return unitGroup
    }

    // 创建机架布局
    const createRacks = () => {
      // 添加地板网格
      const gridHelper = new THREE.GridHelper(20, 20, 0x666666, 0x444444)
      scene.add(gridHelper)

      // 创建机架组
      const rackGroup = new THREE.Group()
      
      // 机架配置
      const rackConfig = {
        positions: [
          { position: 0, deviceType: 'TYPE_1' },
          { position: 1, deviceType: 'TYPE_2' },
          { position: 2, deviceType: 'TYPE_1' },
          { position: 3, deviceType: 'TYPE_2' }
        ]
      }

      // 根据配置创建设备
      rackConfig.positions.forEach(config => {
        const device = createDeviceUnit(config.deviceType)
        if (device) {
          // 调整设备位置
          device.position.set(
            config.position * 3 - 4.5,  // 调整水平间距
            2,                          // 抬高设备
            0                          // 保持在中心线上
          )
          rackGroup.add(device)
        }
      })

      scene.add(rackGroup)

      // 添加主光源
      const mainLight = new THREE.DirectionalLight(0xffffff, 1)
      mainLight.position.set(5, 10, 7.5)
      scene.add(mainLight)

      // 添加环境光
      const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
      scene.add(ambientLight)
    }

    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }

    // 搜索设备
    const handleSearch = async () => {
      try {
        const response = await request.get(`/devices/?search=${searchQuery.value}`)
        devices.value = response
      } catch (error) {
        console.error('Error fetching devices:', error)
      }
    }

    onMounted(() => {
      init3DScene()
      handleSearch()
    })

    return {
      searchQuery,
      devices,
      threeContainer,
      handleSearch,
      getStatusType
    }
  }
}
</script>

<style scoped>
.device-query {
  padding: 20px;
}

.search-section {
  margin-bottom: 20px;
}

.three-container {
  width: 100%;
  height: 600px;  /* 增加高度以获得更好��视觉效果 */
  margin-bottom: 20px;
  background-color: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 0 10px rgba(0,0,0,0.1);
}

.device-list {
  margin-top: 20px;
}

/* 添加一些动画效果 */
.el-table {
  transition: all 0.3s ease;
}

.el-table:hover {
  box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
}

/* 添加返回按钮样式 */
.header-actions {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
}

.el-button {
  padding: 10px 20px;
}

.create-device-btn {
  margin-left: auto;  /* 将按钮推到右侧 */
}
</style> 