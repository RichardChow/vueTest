<template>
  <div class="login-container">
    <div class="login-box">
      <img src="@/assets/BombBang-logo.png" alt="BombBang Logo" class="logo">
      <h2>Welcome to BombBang!</h2>
      <p>Please sign in below or <a href="#">create an account</a>.</p>
      <form @submit.prevent="login">
        <div class="input-group">
          <input type="text" id="username" v-model="username" placeholder="Username" required>
        </div>
        <div class="input-group">
          <input type="password" id="password" v-model="password" placeholder="Password" required>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="keep-signed-in" v-model="keepSignedIn">
          <label for="keep-signed-in">Keep me signed in</label>
        </div>
        <button type="submit" class="sign-in-button">Sign in</button>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Login',
  data() {
    return {
      username: '',
      password: '',
      keepSignedIn: false
    }
  },
  methods: {
    login() {
      console.log('尝试登录', this.username);
      // 这里添加登录逻辑
      // 假设登录成功，跳转到仪表板
      this.$router.push('/dashboard');
    }
  },
  mounted() {
    console.log('Login 组件已加载');
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f0f0;
}

.login-box {
  background-color: white;
  padding: 30px;
  border-radius: 5px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 300px;
  width: 100%;
}

.logo {
  width: 100px;
  margin-bottom: 20px;
}

h2 {
  margin-bottom: 10px;
  color: #333;
}

p {
  margin-bottom: 20px;
  color: #666;
}

.input-group {
  margin-bottom: 15px;
}

input[type="text"],
input[type="password"] {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 3px;
}

.checkbox-group {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 15px;
}

.checkbox-group label {
  margin-left: 5px;
  color: #666;
}

.sign-in-button {
  width: 100%;
  padding: 10px;
  background-color: #0077e6;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-weight: bold;
}

.sign-in-button:hover {
  background-color: #005bb8;
}

a {
  color: #0077e6;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
</style>