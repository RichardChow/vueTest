<template>
  <div id="app">
    <router-view></router-view>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useStore } from 'vuex'

const store = useStore()

onMounted(() => {
  // 检查登录状态
  const isAuthenticated = localStorage.getItem('isAuthenticated')
  if (isAuthenticated) {
    store.commit('SET_AUTH', true)
  }
})
</script>

<style>
#app {
  height: 100vh;
}
</style>