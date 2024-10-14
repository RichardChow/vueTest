<template>
  <div class="dashboard">
    <div class="sidebar">
      <h2>Dashboard</h2>
      <nav>
        <router-link to="/dashboard" exact>
          <i class="fas fa-home"></i> 首页
        </router-link>
        <router-link to="/version-upgrade">
          <i class="fas fa-upload"></i> 更新版本
        </router-link>
        <router-link to="/element-query">
          <i class="fas fa-search"></i> 设备查询
        </router-link>
        <router-link to="/test-report">
          <i class="fas fa-chart-bar"></i> 报告统计
        </router-link>
      </nav>
    </div>
    <div class="main-content">
      <div class="image-slider">
        <!-- 这里可以添加图片滚动组件 -->
        <div class="placeholder">图片滚动区域</div>
      </div>
      <h2>欢迎来到仪表板</h2>
      <!-- 这里可以添加仪表板的主要内容 -->
    </div>
    <div class="toolbar">
      <button @click="logout">
        <i class="fas fa-sign-out-alt"></i> Log out
      </button>
      <button @click="toggleLanguage">
        <i class="fas fa-language"></i> {{ currentLanguage }}
      </button>
    </div>
  </div>
</template>

<script>
const CHINESE = '中文';
const ENGLISH = 'English';

export default {
  name: 'Dashboard',
  data() {
    return {
      currentLanguage: CHINESE,
    }
  },
  methods: {
    logout() {
      console.log('开始登出操作');
      this.$router.push('/');
      console.log('用户已成功登出，已跳转到首页');
    },
    toggleLanguage() {
      this.currentLanguage = this.currentLanguage === CHINESE ? ENGLISH : CHINESE;
      console.log('语言切换完成');
    }
  },
  mounted() {
    console.log('Dashboard 组件已加载');
    console.log('当前语言：', this.currentLanguage);
    console.log('应用正在运行于：', window.location.href);
  },
  created() {
    console.log('Dashboard 组件已创建');
    console.log('Vue 版本：', this.$vue.version);
  }
}
</script>

<style scoped>
.dashboard {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 200px;
  background-color: #f0f0f0;
  padding: 20px;
}

.sidebar h2 {
  margin-bottom: 20px;
}

.sidebar nav {
  display: flex;
  flex-direction: column;
}

.sidebar nav a {
  margin-bottom: 10px;
  text-decoration: none;
  color: #333;
  padding: 10px;
  border-radius: 5px;
  transition: background-color 0.3s;
}

.sidebar nav a:hover,
.sidebar nav a.router-link-active {
  background-color: #e0e0e0;
}

.sidebar nav a i {
  margin-right: 10px;
}

.main-content {
  flex-grow: 1;
  padding: 20px;
  overflow-y: auto;
  max-width: 800px;
  margin: 0 auto;
}

.image-slider {
  height: 200px;
  background-color: #e0e0e0;
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.placeholder {
  color: #666;
}

.toolbar {
  width: 100px;
  background-color: #f0f0f0;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.toolbar button {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toolbar button i {
  margin-right: 5px;
}
</style>