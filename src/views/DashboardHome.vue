<template>
  <div class="dashboard-home">
    <h1>欢迎来到仪表板</h1>
    <p>请从左侧菜单选择一个功能。</p>
    <div class="quick-links">
      <router-link to="/dashboard/version-upgrade" class="quick-link">
        <i class="fas fa-upload"></i>
        <span>更新版本</span>
      </router-link>
      <router-link to="/dashboard/element-query" class="quick-link">
        <i class="fas fa-search"></i>
        <span>设备查询</span>
      </router-link>
      <router-link to="/dashboard/test-report" class="quick-link">
        <i class="fas fa-chart-bar"></i>
        <span>报告统计</span>
      </router-link>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DashboardHome'
}
</script>

<style scoped>
.dashboard-home {
  text-align: center;
  padding: 20px;
}
.quick-links {
  display: flex;
  justify-content: space-around;
  margin-top: 40px;
}
.quick-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: #333;
  padding: 20px;
  border-radius: 5px;
  transition: background-color 0.3s;
}
.quick-link:hover {
  background-color: #e0e0e0;
}
.quick-link i {
  font-size: 2em;
  margin-bottom: 10px;
}
</style>