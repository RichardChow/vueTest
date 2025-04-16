<template>
  <div class="dashboard">
    <el-container>
      <el-aside width="200px">
        <el-menu
          :default-active="$route.path"
          router
          class="el-menu-vertical"
        >
          <el-menu-item index="/version-upgrade">
            <i class="el-icon-upload"></i>
            <span>版本升级</span>
          </el-menu-item>
          <el-menu-item index="/device-query">
            <i class="el-icon-search"></i>
            <span>设备查询</span>
          </el-menu-item>
          <el-menu-item index="/test-report">
            <i class="el-icon-s-data"></i>
            <span>测试报告</span>
          </el-menu-item>
          <el-menu-item index="/smart-server-room">
            <i class="el-icon-monitor"></i>
            <span>智慧机房</span>
          </el-menu-item>
        </el-menu>
        
        <!-- 底部按钮区域 -->
        <div class="bottom-buttons">
          <el-button 
            type="text" 
            class="logout-btn"
            @click="handleLogout"
          >
            Log out
          </el-button>
          <el-button 
            type="text" 
            class="lang-btn"
            @click="toggleLanguage"
          >
            {{ currentLanguage }}
          </el-button>
        </div>
      </el-aside>
      <el-main>
        <!-- 如果当前是首页路径，显示3D机房 -->
        <ServerRoom v-if="$route.path === '/dashboard'" />
        <!-- 其他路由内容 -->
        <router-view v-else></router-view>
      </el-main>
    </el-container>
  </div>
</template>

<script>
import ServerRoom from '@/components/ServerRoom.vue'

export default {
  name: 'AppDashboard',
  components: {
    ServerRoom
  },
  data() {
    return {
      currentLanguage: '中文'
    }
  },
  methods: {
    handleLogout() {
      localStorage.removeItem('isAuthenticated')
      this.$router.push('/login')
      this.$message({
        message: '已成功登出',
        type: 'success'
      })
    },
    toggleLanguage() {
      this.currentLanguage = this.currentLanguage === '中文' ? 'English' : '中文'
      this.$message({
        message: `语言已切换为${this.currentLanguage}`,
        type: 'success'
      })
    }
  }
}
</script>

<style scoped>
.dashboard {
  height: 100vh;
}

.el-container {
  height: 100%;
}

.el-aside {
  background-color: #4f6073;
  color: #fff;
  position: relative;
  display: flex;
  flex-direction: column;
}

.el-menu {
  border-right: none;
  background-color: #4f6073;
  flex-grow: 1;
}

.el-menu-item {
  color: #fff;
}

.el-menu-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.el-menu-item.is-active {
  background-color: #1890ff;
}

.el-main {
  padding: 0;
  background-color: #f5f5f5;
  overflow: hidden;
}

/* 底部按钮样式 */
.bottom-buttons {
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.logout-btn,
.lang-btn {
  color: #fff;
  width: 100%;
  text-align: left;
  padding: 10px;
  transition: all 0.3s;
}

.logout-btn:hover,
.lang-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* 按钮图标样式 */
.logout-btn i,
.lang-btn i {
  margin-right: 5px;
}
</style>