<template>
  <div class="create-device">
    <div class="header">
      <el-button icon="el-icon-back" @click="$router.back()">返回</el-button>
      <h2>新建设备类型</h2>
    </div>

    <el-form ref="deviceForm" :model="deviceForm" :rules="rules" label-width="120px">
      <el-form-item label="设备类型名称" prop="name">
        <el-input 
          v-model="deviceForm.name" 
          placeholder="请输入设备类型名称，如NPT1800"
          :style="{ width: '300px' }"
        ></el-input>
      </el-form-item>

      <el-form-item label="设备照片" prop="image">
        <div class="image-upload-section">
          <el-upload
            class="device-uploader"
            action="#"
            :http-request="handleImageUpload"
            :show-file-list="false"
            :before-upload="beforeUpload"
            accept="image/*"
            multiple
          >
            <div class="upload-hint">
              <div class="required-views">
                <h4>需要的视图：</h4>
                <ul>
                  <li v-for="(view, index) in requiredViews" :key="index">
                    <span :class="{ required: view.required, recommended: view.recommended }">
                      {{ view.name }}
                      {{ view.required ? '(必需)' : '(建议)' }}
                    </span>
                  </li>
                </ul>
              </div>
              <div v-if="deviceImages.length < 4" class="upload-placeholder">
                <i class="el-icon-plus"></i>
                <div class="upload-text">点击上传设备照片</div>
                <div class="upload-tip">请上传不同角度的照片以提高3D建模精度</div>
              </div>
            </div>
          </el-upload>

          <div class="image-previews">
            <div v-for="(image, index) in imageUrls" :key="index" class="image-preview">
              <img :src="image.url" class="preview-image">
              <div class="image-info">
                <span>{{ image.view }}</span>
                <div class="image-actions">
                  <el-button size="small" type="danger" @click="removeImage(index)">删除</el-button>
                </div>
              </div>
            </div>
          </div>

          <el-button 
            type="primary" 
            :disabled="deviceImages.length < 2"
            @click="generate3DPreview"
            :loading="generating3D"
            style="margin-top: 10px;"
          >
            {{ generating3D ? '生成中...' : '生成3D预览' }}
          </el-button>
        </div>
      </el-form-item>

      <!-- 3D预览区域 -->
      <el-form-item label="3D预览">
        <div class="preview-wrapper">
          <div ref="previewContainer" class="preview-container"></div>
          <div v-if="showPreview" class="preview-controls">
            <el-button-group>
              <el-button size="small" @click="resetView">重置视角</el-button>
              <el-button size="small" @click="toggleWireframe">切换线框</el-button>
              <el-button size="small" @click="toggleAutoRotate">自动旋转</el-button>
            </el-button-group>
          </div>
        </div>
      </el-form-item>

      <!-- 设备参数调整 -->
      <el-form-item label="设备尺寸(U)">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="宽度">
              <el-input-number 
                v-model="deviceForm.width" 
                :min="1" 
                :max="10" 
                :precision="2"
                :step="0.5"
                @change="updatePreview"
              ></el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="高度">
              <el-input-number 
                v-model="deviceForm.height" 
                :min="1" 
                :max="10" 
                :precision="2"
                :step="0.5"
                @change="updatePreview"
              ></el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="深度">
              <el-input-number 
                v-model="deviceForm.depth" 
                :min="1" 
                :max="10" 
                :precision="2"
                :step="0.5"
                @change="updatePreview"
              ></el-input-number>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="handleSubmit">保存设备类型</el-button>
      </el-form-item>
    </el-form>

    <!-- 添加设备列表部分 -->
    <div class="device-list-section">
      <h3>已添加的设备</h3>
      <el-table :data="deviceList" style="width: 100%">
        <el-table-column prop="name" label="设备名称"></el-table-column>
        <el-table-column prop="device_type" label="设备类型"></el-table-column>
        <el-table-column label="3D预览" width="150">
          <template slot-scope="scope">
            <el-button 
              size="small" 
              type="primary"
              @click="show3DPreview(scope.row)"
            >查看3D预览</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 3D预览对话框 -->
    <el-dialog
      title="3D预览"
      :visible.sync="previewDialogVisible"
      width="70%"
      :before-close="handlePreviewClose"
    >
      <div ref="previewDialogContainer" class="preview-dialog-container"></div>
    </el-dialog>
  </div>
</template>

<script>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import request from '@/utils/request'
import { Message } from 'element-ui'

export default {
  name: 'CreateDevice',
  data() {
    return {
      deviceForm: {
        name: '',
        width: 19, // 标准机架宽度（英寸）
        height: 1, // 默认1U高度
        depth: 20  // 标准深度（英寸）
      },
      rules: {
        name: [
          { required: true, message: '请输入设备类型名称', trigger: 'blur' }
        ]
      },
      imageUrl: '',
      deviceImages: [], // 存储多个角度的图片
      imageUrls: [], // 存储多个图片的预览URL
      requiredViews: [
        { name: '正面视图', required: true },
        { name: '侧面视图', required: true },
        { name: '俯视图', recommended: true },
        { name: '背面视图', recommended: true }
      ],
      scene: null,
      camera: null,
      renderer: null,
      controls: null,
      deviceMesh: null,
      generating3D: false,
      showPreview: false,
      wireframe: false,
      autoRotate: false,
      deviceList: [],
      previewDialogVisible: false,
      currentPreviewDevice: null,
      previewRenderer: null,
      previewScene: null,
      previewCamera: null,
      previewControls: null
    }
  },
  methods: {
    // 图片上传前的验证
    beforeUpload(file) {
      console.log('验证上传图片:', file.name)
      const isImage = file.type.startsWith('image/')
      const isLt5M = file.size / 1024 / 1024 < 5

      if (!isImage) {
        Message.error('只能上传图片文件!')
        return false
      }
      if (!isLt5M) {
        Message.error('图片大小不能超过 5MB!')
        return false
      }
      return true
    },

    // 处理图片上传
    async handleImageUpload({ file }) {
      console.log('开始上传图片:', file.name)
      try {
        // 检查已��传图片数量
        if (this.deviceImages.length >= 4) {
          Message.warning('最多上传4张不同角度的图片')
          return
        }

        // 压缩图片
        const compressedImage = await this.compressImage(file)
        
        // 创建预览
        const imageUrl = URL.createObjectURL(compressedImage)
        this.imageUrls.push({
          url: imageUrl,
          view: this.requiredViews[this.deviceImages.length].name
        })
        this.deviceImages.push(compressedImage)

        Message.success(`${this.requiredViews[this.deviceImages.length - 1].name}上传成功`)
        
        // 检查是否满足最低要求
        this.checkImageRequirements()
      } catch (error) {
        console.error('图片上传失败:', error)
        Message.error('图片上传失败：' + error.message)
      }
    },

    // 检查图片要求
    checkImageRequirements() {
      const requiredCount = this.requiredViews.filter(view => view.required).length
      if (this.deviceImages.length >= requiredCount) {
        Message.success('已满足基本视图要求，可以开始生成3D模型')
      } else {
        const nextRequired = this.requiredViews[this.deviceImages.length]
        if (nextRequired) {
          Message.info(`请继续上传${nextRequired.name}`)
        }
      }
    },

    // 移除指定图片
    removeImage(index) {
      URL.revokeObjectURL(this.imageUrls[index].url)
      this.imageUrls.splice(index, 1)
      this.deviceImages.splice(index, 1)
      this.checkImageRequirements()
    },

    // 图片压缩
    compressImage(file) {
      console.log('压缩图片:', file.name)
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            
            // 设置压缩后的尺寸
            const maxWidth = 1024
            const maxHeight = 1024
            let width = img.width
            let height = img.height
            
            if (width > height) {
              if (width > maxWidth) {
                height *= maxWidth / width
                width = maxWidth
              }
            } else {
              if (height > maxHeight) {
                width *= maxHeight / height
                height = maxHeight
              }
            }
            
            canvas.width = width
            canvas.height = height
            ctx.drawImage(img, 0, 0, width, height)
            
            canvas.toBlob((blob) => {
              resolve(blob)
            }, 'image/jpeg', 0.8)
          }
          img.onerror = reject
          img.src = e.target.result
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    },

    // 生成3D预览
    async generate3DPreview() {
      console.log('开始生成3D预览')
      const requiredCount = this.requiredViews.filter(view => view.required).length
      
      if (this.deviceImages.length < requiredCount) {
        Message.warning(`请至少上传${requiredCount}张不同角度的图片（正面和侧面是必需的）`)
        return
      }

      this.generating3D = true
      try {
        const formData = new FormData()
        this.deviceImages.forEach((image, index) => {
          formData.append(`image${index}`, image)
          formData.append(`view${index}`, this.imageUrls[index].view)
        })
        formData.append('device_type', this.deviceForm.name)
        formData.append('dimensions', JSON.stringify({
          width: this.deviceForm.width,
          height: this.deviceForm.height,
          depth: this.deviceForm.depth
        }))
        
        const response = await request.post('/api/device/generate3d', formData, {
          timeout: 60000,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })

        if (response.data.success) {
          this.create3DModel(response.data.model)
          this.showPreview = true
          Message.success('3D模型生成成功')
        } else {
          throw new Error(response.data.message)
        }
      } catch (error) {
        console.error('3D模型生成失败:', error)
        Message.error('3D模型生成失败：' + (error.response?.data?.error || error.message))
      } finally {
        this.generating3D = false
      }
    },

    // 创建3D模型
    create3DModel(modelData) {
      console.log('创建3D模型:', modelData)
      if (this.deviceMesh) {
        this.scene.remove(this.deviceMesh)
      }

      // 使用实际物理尺寸（转换为米）
      const width = this.deviceForm.width * 0.0254  // 英寸转米
      const height = this.deviceForm.height * 0.0445 // 1U = 44.45mm
      const depth = this.deviceForm.depth * 0.0254   // 英寸转米

      this.deviceMesh = new THREE.Group()

      // 1. 创建主体外壳（类似NPT-1800的黑色金属外壳）
      const mainGeometry = new THREE.BoxGeometry(width, height, depth)
      const mainMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x1a1a1a,      // 深黑色
        metalness: 0.9,       // 高金属感
        roughness: 0.2,       // 较光滑
        clearcoat: 0.5,       // 效果
        clearcoatRoughness: 0.1
      })
      const mainBody = new THREE.Mesh(mainGeometry, mainMaterial)
      this.deviceMesh.add(mainBody)

      // 2. 添加前面板装饰（类似NPT-1800的面板纹理）
      const frontPanelGeometry = new THREE.PlaneGeometry(width * 0.98, height * 0.95)
      const frontPanelMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x2a2a2a,
        metalness: 0.8,
        roughness: 0.3,
        clearcoat: 0.8
      })
      const frontPanel = new THREE.Mesh(frontPanelGeometry, frontPanelMaterial)
      frontPanel.position.z = depth/2 + 0.0001
      this.deviceMesh.add(frontPanel)

      // 3. 添加前面板装饰条（特征性的银色条纹）
      const stripGeometry = new THREE.BoxGeometry(width * 0.98, height * 0.05, 0.001)
      const stripMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x888888,
        metalness: 1.0,
        roughness: 0.1
      })
      const topStrip = new THREE.Mesh(stripGeometry, stripMaterial)
      topStrip.position.set(0, height * 0.4, depth/2 + 0.0002)
      this.deviceMesh.add(topStrip)

      // 4. 添加通风口（类似NPT-1800的通风设计）
      const ventGeometry = new THREE.PlaneGeometry(width * 0.8, height * 0.15)
      const ventMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x111111,
        metalness: 0.9,
        roughness: 0.6,
        transparent: true,
        opacity: 0.9
      })

      // 上下两排通风口
      const ventOffsets = [-0.25, 0.25];
      ventOffsets.forEach(yOffset => {
        const vent = new THREE.Mesh(ventGeometry, ventMaterial);
        vent.position.set(0, height * yOffset, depth/2 + 0.0002);
        this.deviceMesh.add(vent);
      });

      // 5. 添加接口区域（类似NPT-1800的端口布局）
      const portsGroup = new THREE.Group()
      const portConfigs = [
        { width: 0.04, height: 0.02, x: -0.15, type: 'usb' },
        { width: 0.04, height: 0.02, x: -0.05, type: 'usb' },
        { width: 0.06, height: 0.025, x: 0.1, type: 'network' },
        { width: 0.06, height: 0.025, x: 0.2, type: 'network' }
      ]

      portConfigs.forEach(config => {
        const portGeometry = new THREE.BoxGeometry(config.width, config.height, depth * 0.1)
        const portMaterial = new THREE.MeshPhysicalMaterial({
          color: config.type === 'usb' ? 0x2a2a2a : 0x3a3a3a,
          metalness: 0.9,
          roughness: 0.4
        })
        const port = new THREE.Mesh(portGeometry, portMaterial)
        port.position.set(config.x, -height * 0.3, depth/2 + 0.001)
        portsGroup.add(port)
      })
      this.deviceMesh.add(portsGroup)

      // 6. 添加LED指示
      const ledGeometry = new THREE.CircleGeometry(0.003, 32)
      const ledPositions = [
        { x: width * 0.4, y: height * 0.35, color: 0x00ff00 }, // 电源指示灯
        { x: width * 0.4, y: height * 0.3, color: 0xff0000 },  // 状态指示灯
        { x: width * 0.4, y: height * 0.25, color: 0x0000ff }  // 网络指示灯
      ]

      ledPositions.forEach(pos => {
        const ledMaterial = new THREE.MeshPhysicalMaterial({
          color: pos.color,
          emissive: pos.color,
          emissiveIntensity: 0.5,
          metalness: 0.9,
          roughness: 0.1
        })
        const led = new THREE.Mesh(ledGeometry, ledMaterial)
        led.position.set(pos.x, pos.y, depth/2 + 0.0003)
        this.deviceMesh.add(led)
      })

      // 7. 添加品牌Logo区域
      const logoGeometry = new THREE.PlaneGeometry(width * 0.15, height * 0.1)
      const logoMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 1.0,
        roughness: 0.1,
        clearcoat: 1.0
      })
      const logo = new THREE.Mesh(logoGeometry, logoMaterial)
      logo.position.set(-width * 0.35, height * 0.35, depth/2 + 0.0003)
      this.deviceMesh.add(logo)

      this.scene.add(this.deviceMesh)

      // 8. 更新光照效果
      this.updateLighting()
      this.resetView()
    },

    // 添加一个新的方法来处理场景中的光源
    removeAllLights() {
      if (!this.scene) return;
      const children = this.scene.children;
      if (!children) return;
      
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        if (child instanceof THREE.Light) {
          this.scene.remove(child);
        }
      }
    },

    // 然后修改 updateLighting 方法
    updateLighting() {
      // 移除现有光源
      this.removeAllLights();

      // 创建并添加主光源
      const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
      mainLight.position.set(2, 2, 5);
      mainLight.castShadow = true;
      this.scene.add(mainLight);

      // 创建并添加填充光
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
      fillLight.position.set(-2, 2, 3);
      this.scene.add(fillLight);

      // 创建并添加环境光
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      this.scene.add(ambientLight);

      // 创建并添加点光源
      this.addPointLight(2, 2, 2, 0.4);
      this.addPointLight(-2, -2, 2, 0.3);
      this.addPointLight(0, 0, 3, 0.5);
    },

    // 添加辅助方法来创建点光源
    addPointLight(x, y, z, intensity) {
      const pointLight = new THREE.PointLight(0xffffff, intensity);
      pointLight.position.set(x, y, z);
      this.scene.add(pointLight);
    },

    // 重置视角
    resetView() {
      const distance = Math.max(
        this.deviceForm.width,
        this.deviceForm.height,
        this.deviceForm.depth
      ) * 2
      this.camera.position.set(distance, distance, distance)
      this.camera.lookAt(0, 0, 0)
      this.controls.reset()
    },

    // 切换线框模式
    toggleWireframe() {
      if (this.deviceMesh) {
        this.wireframe = !this.wireframe
        this.deviceMesh.children.forEach(child => {
          if (child instanceof THREE.Mesh) {
            child.material.wireframe = this.wireframe
          }
        })
      }
    },

    // 切换自动旋转
    toggleAutoRotate() {
      this.autoRotate = !this.autoRotate
      this.controls.autoRotate = this.autoRotate
    },

    // 初始化3D场景
    init3DScene() {
      const container = this.$refs.previewContainer;
      const width = container ? container.clientWidth : 800;
      const height = container ? container.clientHeight : 600;

      // 创建场景
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xf5f7fa);

      // 创建相机
      this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      this.camera.position.set(5, 5, 5);
      this.camera.lookAt(0, 0, 0);

      // 创建渲染器
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(width, height);
      
      // 安全地添加到DOM
      if (container && this.renderer.domElement) {
        container.appendChild(this.renderer.domElement);
      }

      // 创建控制器
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;

      // 添加基础光源
      this.addBasicLights();

      // 创建初始模型
      this.updatePreview();

      // 启动动画循环
      this.animate();
    },

    // 添加基础光源
    addBasicLights() {
      const mainLight = new THREE.DirectionalLight(0xffffff, 1);
      mainLight.position.set(5, 5, 5);
      this.scene.add(mainLight);

      const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
      this.scene.add(ambientLight);
    },

    // 动画循环
    animate() {
      requestAnimationFrame(this.animate)
      if (this.controls) {
        this.controls.update()
      }
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera)
      }
    },

    // 保存设备类型
    async handleSubmit() {
      console.log('开始创建设备:', this.deviceForm);
      try {
        const response = await request.post('/api/device-types', {
          name: this.deviceForm.name,
          config: {
            width: this.deviceForm.width,
            height: this.deviceForm.height,
            depth: this.deviceForm.depth,
          }
        })
        Message({
          message: '设备类型保存成功',
          type: 'success'
        })
        this.$router.back()
        console.log('设备创建成功:', response);
      } catch (error) {
        Message({
          message: '保存失败：' + error.message,
          type: 'error'
        })
        console.error('设备创建失败:', error);
      }
    },

    // 获取设备列表
    async fetchDeviceList() {
      try {
        const response = await request.get('/api/devices');
        this.deviceList = response.data;
      } catch (error) {
        Message.error('获取设备列表失败：' + error.message);
      }
    },

    // 显示3D预览
    async show3DPreview(device) {
      this.currentPreviewDevice = device;
      this.previewDialogVisible = true;
      
      await this.$nextTick();
      this.initPreviewScene();
      
      try {
        const response = await request.get(`/api/devices/${device.id}/model`);
        this.load3DModel(response.data.model_data);
      } catch (error) {
        Message.error('加载3D模型失败：' + error.message);
      }
    },

    // 初始化预览场景
    initPreviewScene() {
      const container = this.$refs.previewDialogContainer;
      
      this.previewScene = new THREE.Scene();
      this.previewScene.background = new THREE.Color(0xf5f7fa);

      this.previewCamera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
      );

      this.previewRenderer = new THREE.WebGLRenderer({ antialias: true });
      this.previewRenderer.setSize(container.clientWidth, container.clientHeight);
      container.appendChild(this.previewRenderer.domElement);

      this.previewCamera.position.set(5, 5, 5);
      this.previewCamera.lookAt(0, 0, 0);

      this.previewControls = new OrbitControls(
        this.previewCamera,
        this.previewRenderer.domElement
      );

      // 添加光源
      const mainLight = new THREE.DirectionalLight(0xffffff, 1);
      mainLight.position.set(5, 5, 5);
      this.previewScene.add(mainLight);

      const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
      this.previewScene.add(ambientLight);

      this.animatePreview();
    },

    // 加载3D模型
    load3DModel(modelData) {
      // 清除现有模型
      while(this.previewScene.children.length > 0) { 
        this.previewScene.remove(this.previewScene.children[0]); 
      }

      // 根据modelData创建新的模型
      const geometry = new THREE.BoxGeometry(
        modelData.width,
        modelData.height,
        modelData.depth
      );
      const material = new THREE.MeshPhongMaterial({
        color: 0x2c3e50,
        transparent: true,
        opacity: 0.9
      });
      const mesh = new THREE.Mesh(geometry, material);
      this.previewScene.add(mesh);
    },

    // 预览动画循环
    animatePreview() {
      if (!this.previewDialogVisible) return;
      
      requestAnimationFrame(this.animatePreview);
      this.previewControls.update();
      this.previewRenderer.render(this.previewScene, this.previewCamera);
    },

    // 关闭预览对话框
    handlePreviewClose() {
      if (this.previewRenderer) {
        this.previewRenderer.dispose();
      }
      if (this.previewScene) {
        this.previewScene.clear();
      }
      this.previewDialogVisible = false;
      this.currentPreviewDevice = null;
    },

    // 添加 updatePreview 方法
    updatePreview() {
      console.log('更新3D预览')
      if (!this.scene) return
      
      // 移除现有模型
      if (this.deviceMesh) {
        this.scene.remove(this.deviceMesh)
      }

      // 创建新模型
      const width = this.deviceForm.width * 0.0254 // 转换英寸到米
      const height = this.deviceForm.height * 0.0445 // 1U = 44.45mm
      const depth = this.deviceForm.depth * 0.0254

      const geometry = new THREE.BoxGeometry(width, height, depth)
      const material = new THREE.MeshStandardMaterial({
        color: 0x2c3e50,
        wireframe: this.wireframe,
        metalness: 0.5,
        roughness: 0.5
      })

      this.deviceMesh = new THREE.Mesh(geometry, material)
      this.scene.add(this.deviceMesh)

      // 调整相机位置
      this.resetView()
    },

    addDeviceFeatures(features) {
      console.log('添加设备特征:', features)
      if (!features) {
        console.warn('没有设备特征数据')
        return
      }

      try {
        features.forEach(feature => {
          switch (feature.type) {
            case 'port':
              this.addPort(feature.position, feature.size)
              break
            case 'led':
              this.addLED(feature.position, feature.color)
              break
            case 'button':
              this.addButton(feature.position)
              break
            case 'display':
              this.addDisplay(feature.position, feature.size)
              break
            default:
              console.warn('未知的特征类型:', feature.type)
          }
        })
      } catch (error) {
        console.error('添加设备特征失败:', error)
      }
    },

    // 添加相关的辅助方法
    addLED(position, color) {
      console.log('添加LED:', { position, color })
      // 实现LED添��逻辑
      const geometry = new THREE.SphereGeometry(0.01) // 1cm直径的球体
      const material = new THREE.MeshStandardMaterial({
        color: color || 0xff0000,
        emissive: color || 0xff0000,
        emissiveIntensity: 0.5
      })
      const led = new THREE.Mesh(geometry, material)
      led.position.set(position.x, position.y, position.z)
      this.deviceMesh.add(led)
    },

    addButton(position) {
      console.log('添加按钮:', position)
      // 实现按钮添加逻辑
      const geometry = new THREE.CylinderGeometry(0.01, 0.01, 0.005) // 1cm直径，0.5cm高的圆柱
      const material = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.5,
        roughness: 0.7
      })
      const button = new THREE.Mesh(geometry, material)
      button.position.set(position.x, position.y, position.z)
      this.deviceMesh.add(button)
    },

    addDisplay(position, size) {
      console.log('添加显示屏:', { position, size })
      // 实现显示屏添加逻辑
      const geometry = new THREE.PlaneGeometry(size.width, size.height)
      const material = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0x222222,
        emissiveIntensity: 0.2
      })
      const display = new THREE.Mesh(geometry, material)
      display.position.set(position.x, position.y, position.z)
      this.deviceMesh.add(display)
    },

    addPort(position, size) {
      console.log('添加端口:', { position, size })
      // 实现端口添加逻辑
      const geometry = new THREE.BoxGeometry(size.width, size.height, 0.01) // 1mm深度的端口
      const material = new THREE.MeshStandardMaterial({
        color: 0x666666,
        metalness: 0.7,
        roughness: 0.3
      })
      const port = new THREE.Mesh(geometry, material)
      port.position.set(position.x, position.y, position.z)
      this.deviceMesh.add(port)
    },

    async initializeDevice(deviceData) {
      console.log('初始化设备数据:', deviceData)
      // 在这里添加设备初始化的逻辑
      if (!this.scene) {
        await this.init3DScene()
      }
      // 可以添加其他初始化逻辑
      return deviceData
    }
  },
  mounted() {
    // 恢复初始化3D场景
    this.init3DScene()
    this.fetchDeviceList();
  },
  beforeDestroy() {
    // 清理THREE.js资源
    if (this.renderer) {
      this.renderer.dispose()
    }
    if (this.scene) {
      this.scene.clear()
    }
    this.handlePreviewClose();
  }
}
</script>

<style scoped>
.create-device {
  padding: 20px;
}

.header {
  display: flex;
  align-items: center;
  margin-bottom: 30px;
}

.header h2 {
  margin-left: 20px;
}

.preview-wrapper {
  position: relative;
}

.preview-container {
  width: 100%;
  height: 400px;
  background-color: #f5f7fa;
  border-radius: 4px;
  overflow: hidden;
}

.preview-controls {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 8px;
  border-radius: 4px;
}

.image-preview {
  position: relative;
  width: 200px;
  height: 200px;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.image-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 8px;
  display: flex;
  justify-content: space-around;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 200px;
  height: 200px;
  border: 1px dashed #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
}

.upload-placeholder:hover {
  border-color: #409EFF;
}

.upload-text {
  margin-top: 8px;
  color: #606266;
}

.upload-tip {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.device-uploader {
  display: flex;
  justify-content: center;
}

/* 输入框样式优化 */
.el-input-number {
  width: 100%;
}

/* 表单项间距 */
.el-form-item {
  margin-bottom: 25px;
}

.device-list-section {
  margin-top: 30px;
  padding: 20px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
}

.preview-dialog-container {
  width: 100%;
  height: 500px;
  background-color: #f5f7fa;
  border-radius: 4px;
  overflow: hidden;
}

.image-upload-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.image-previews {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-top: 20px;
}

.image-preview {
  position: relative;
  width: 200px;
  height: 200px;
}

.image-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px;
}

.required {
  color: #f56c6c;
  font-weight: bold;
}

.recommended {
  color: #409EFF;
}

.required-views {
  margin-bottom: 15px;
}

.required-views ul {
  list-style: none;
  padding: 0;
}

.required-views li {
  margin: 5px 0;
}
</style> 