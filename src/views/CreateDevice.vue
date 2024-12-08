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
          placeholder="请输入设备类型名称"
          :style="{ width: '300px' }"
        ></el-input>
      </el-form-item>

      <el-form-item label="设备照片" prop="image">
        <el-upload
          class="device-uploader"
          action="#"
          :http-request="handleImageUpload"
          :show-file-list="false"
          accept="image/*"
        >
          <img v-if="imageUrl" :src="imageUrl" class="preview-image">
          <el-button v-else type="primary">上传设备照片</el-button>
        </el-upload>
        <el-button 
          type="primary" 
          :disabled="!imageUrl"
          @click="show3DPreview(deviceForm)"
          style="margin-left: 10px;"
        >生成3D预览</el-button>
      </el-form-item>

      <!-- 3D预览区域 -->
      <el-form-item label="3D预览">
        <div ref="previewContainer" class="preview-container"></div>
      </el-form-item>

      <!-- 设备参数调整 -->
      <el-form-item label="设备尺寸">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-input-number 
              v-model="deviceForm.width" 
              :min="1" 
              :max="10" 
              label="宽度"
              @change="updatePreview"
            ></el-input-number>
          </el-col>
          <el-col :span="8">
            <el-input-number 
              v-model="deviceForm.height" 
              :min="1" 
              :max="10" 
              label="高度"
              @change="updatePreview"
            ></el-input-number>
          </el-col>
          <el-col :span="8">
            <el-input-number 
              v-model="deviceForm.depth" 
              :min="1" 
              :max="10" 
              label="深度"
              @change="updatePreview"
            ></el-input-number>
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
        width: 2,
        height: 4,
        depth: 1
      },
      rules: {
        name: [
          { required: true, message: '请输入设备类型名称', trigger: 'blur' }
        ]
      },
      imageUrl: '',
      scene: null,
      camera: null,
      renderer: null,
      controls: null,
      deviceMesh: null,
      showPreview: false,
      imageAnalysisResult: null,
      showPreview3D: false,
      deviceImage: null,
      preview3DModel: null,
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
    // 初始化3D预览
    init3DScene() {
      this.scene = new THREE.Scene()
      this.scene.background = new THREE.Color(0xf5f7fa)

      this.camera = new THREE.PerspectiveCamera(
        45,
        this.$refs.previewContainer.clientWidth / this.$refs.previewContainer.clientHeight,
        0.1,
        1000
      )

      this.renderer = new THREE.WebGLRenderer({ antialias: true })
      this.renderer.setSize(this.$refs.previewContainer.clientWidth, this.$refs.previewContainer.clientHeight)
      this.$refs.previewContainer.appendChild(this.renderer.domElement)

      this.camera.position.set(5, 5, 5)
      this.camera.lookAt(0, 0, 0)

      this.controls = new OrbitControls(this.camera, this.renderer.domElement)
      this.controls.enableDamping = true
      this.controls.dampingFactor = 0.05

      // 添加光源
      const mainLight = new THREE.DirectionalLight(0xffffff, 1)
      mainLight.position.set(5, 5, 5)
      this.scene.add(mainLight)

      const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
      this.scene.add(ambientLight)

      // 创建初始模型
      this.updatePreview()

      // 动画循��
      this.animate()
    },

    // 动画循环
    animate() {
      requestAnimationFrame(this.animate)
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
    },

    // 处理图片上传
    async handleImageUpload(options) {
      const file = options.file
      this.imageUrl = URL.createObjectURL(file)
    },

    // 更新3D预览
    updatePreview() {
      if (this.deviceMesh) {
        this.scene.remove(this.deviceMesh)
      }

      const geometry = new THREE.BoxGeometry(
        this.deviceForm.width,
        this.deviceForm.height,
        this.deviceForm.depth
      )
      const material = new THREE.MeshPhongMaterial({
        color: 0x2c3e50,
        transparent: true,
        opacity: 0.9
      })
      this.deviceMesh = new THREE.Mesh(geometry, material)
      this.scene.add(this.deviceMesh)
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

    // 添加新方法：将图片URL转换为base64
    async getBase64FromUrl(url) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('转换片失败:', error);
        throw error;
      }
    },

    // 创建详细的3D模型
    createDetailed3DModel() {
      if (this.deviceMesh) {
        this.scene.remove(this.deviceMesh);
      }

      // 创建设备主体
      const geometry = new THREE.BoxGeometry(
        this.deviceForm.width,
        this.deviceForm.height,
        this.deviceForm.depth
      );

      // 创建材质
      const material = new THREE.MeshPhongMaterial({
        color: 0x2c3e50,
        transparent: true,
        opacity: 0.9,
        metalness: 0.5,
        roughness: 0.5
      });

      this.deviceMesh = new THREE.Mesh(geometry, material);

      // 添加细节特征（如果图像分析检测到）
      if (this.imageAnalysisResult.features) {
        this.addDeviceFeatures(this.imageAnalysisResult.features);
      }

      this.scene.add(this.deviceMesh);
      
      // 调整相机位置以更好地展示模型
      this.camera.position.set(
        this.deviceForm.width * 2,
        this.deviceForm.height * 1.5,
        this.deviceForm.depth * 2
      );
      this.camera.lookAt(0, 0, 0);
    },

    // 添加设备特征（端口、指示灯等）
    addDeviceFeatures(features) {
      features.forEach(feature => {
        switch (feature.type) {
          case 'port':
            this.addPort(feature.position);
            break;
          case 'led':
            this.addLED(feature.position, feature.color);
            break;
          case 'display':
            this.addDisplay(feature.position, feature.dimensions);
            break;
        }
      });
    },

    // 添加端口
    addPort(position) {
      const portGeometry = new THREE.CircleGeometry(0.05, 32);
      const portMaterial = new THREE.MeshPhongMaterial({ color: 0x7f8c8d });
      const port = new THREE.Mesh(portGeometry, portMaterial);
      port.position.set(position.x, position.y, position.z);
      this.deviceMesh.add(port);
    },

    // 添加LED指示灯
    addLED(position, color) {
      const ledGeometry = new THREE.SphereGeometry(0.03, 16, 16);
      const ledMaterial = new THREE.MeshPhongMaterial({ 
        color: color || 0x2ecc71,
        emissive: color || 0x2ecc71 
      });
      const led = new THREE.Mesh(ledGeometry, ledMaterial);
      led.position.set(position.x, position.y, position.z);
      this.deviceMesh.add(led);
    },

    // 获取设备列表
    async fetchDeviceList() {
      try {
        const response = await request.get('/api/devices/');
        this.deviceList = response.data;
      } catch (error) {
        Message.error('获取设备列表失败：' + error.message);
      }
    },

    // 显示3D预览
    async show3DPreview(device) {
      this.currentPreviewDevice = device;
      this.previewDialogVisible = true;
      
      // 等待DOM更新
      await this.$nextTick();
      
      // 初始化3D预览
      this.initPreviewScene();
      
      try {
        // 获取设备的3D模型数据
        const response = await request.get(`/api/devices/${device.id}/model/`);
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

.preview-container {
  width: 100%;
  height: 400px;
  background-color: #f5f7fa;
  border-radius: 4px;
  overflow: hidden;
}

.preview-image {
  width: 200px;
  height: 200px;
  object-fit: cover;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
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
</style> 