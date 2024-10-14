<template>
  <div class="test-report">
    <div class="back-button">
      <button @click="goBackToDashboard" class="btn-back">
        <i class="fas fa-arrow-left"></i> 返回仪表盘
      </button>
    </div>
    <h2>报告统计</h2>
    <!-- 在这里添加报告统计的内容 -->
  </div>
</template>

<script>
export default {
  name: 'TestReport',
  methods: {
    goBackToDashboard() {
      this.$router.push('/dashboard');
      console.log('返回仪表盘');
    }
  },
  mounted() {
    console.log('报告统计页面已加载');
  }
}
</script>

<style scoped>
.test-report {
  padding: 20px;
}

.back-button {
  margin-bottom: 20px;
}

.btn-back {
  background-color: #3498db; /* 蓝色 */
  color: white;
  border: none;
  padding: 10px 20px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-size: 16px;
  margin: 4px 2px;
  cursor: pointer;
  border-radius: 5px;
  transition: background-color 0.3s;
}

.btn-back:hover {
  background-color: #2980b9;
}

.btn-back i {
  margin-right: 5px;
}
</style>