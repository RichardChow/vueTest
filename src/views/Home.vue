<template>
  <div class="home">
    <div class="jenkins-container">
      <img src="@/assets/jenkins-logo.png" alt="BombBang Logo" class="jenkins-logo">
      <h1>Welcome to BombBang!</h1>
      <p>Please sign in below or <router-link to="/register">create an account</router-link>.</p>
      <Login />
    </div>
  </div>
</template>

<script>
import Login from '@/components/Login.vue'

export default {
  name: 'Home',
  components: {
    Login
  }
}
</script>

<style scoped>
.home {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f0f0;
}
.jenkins-container {
  background-color: white;
  padding: 30px;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  text-align: center;
}
.jenkins-logo {
  width: 100px;
  margin-bottom: 20px;
}
h1 {
  color: #333;
  margin-bottom: 10px;
}
p {
  margin-bottom: 20px;
}
a {
  color: #069;
  text-decoration: none;
}
</style>