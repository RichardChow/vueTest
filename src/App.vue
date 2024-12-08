<template>
  <div id="app">
    <router-view></router-view>
  </div>
</template>

<script>
export default {
  name: 'App',
  created() {
    // 检查登录状态
    const isAuthenticated = localStorage.getItem('isAuthenticated')
    if (isAuthenticated) {
      this.$store.commit('SET_AUTH', true)
    }
  }
}
</script>

<style>
#app {
  height: 100vh;
}
</style>