<template>
  <div class="register">
    <div class="jenkins-container">
      <img src="@/assets/jenkins-logo.png" alt="BombBang Logo" class="jenkins-logo">
      <h1>Create a BombBang account</h1>
      <form @submit.prevent="register">
        <div class="form-group">
          <label for="username">Username</label>
          <input id="username" v-model="username" type="text" required>
        </div>
        <div class="form-group">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" required>
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input id="password" v-model="password" type="password" required>
        </div>
        <button type="submit" class="create-account-button">Create account</button>
      </form>
      <p>Already have an account? <router-link to="/">Sign in</router-link></p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Register',
  data() {
    return {
      username: '',
      email: '',
      password: ''
    }
  },
  methods: {
    register() {
      console.log('注册尝试:', this.username, this.email, this.password);
      // 模拟注册成功
      alert('注册成功！请登录');
      this.$router.push('/');
    }
  }
}
</script>

<style scoped>
.register {
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
  margin-bottom: 20px;
}
.form-group {
  margin-bottom: 15px;
  text-align: left;
}
label {
  display: block;
  margin-bottom: 5px;
  color: #4d4d4d;
}
input[type="text"],
input[type="email"],
input[type="password"] {
  width: 100%;
  padding: 5px;
  border: 1px solid #ccc;
  border-radius: 3px;
}
.create-account-button {
  background-color: #14b8a6;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 3px;
  cursor: pointer;
  font-weight: bold;
  width: 100%;
  margin-top: 10px;
}
.create-account-button:hover {
  background-color: #0d9488;
}
p {
  margin-top: 20px;
}
a {
  color: #069;
  text-decoration: none;
}
</style>