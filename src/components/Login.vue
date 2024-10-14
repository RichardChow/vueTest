<template>
  <div class="login">
    <form @submit.prevent="login">
      <div class="form-group">
        <label for="username">Username</label>
        <input id="username" v-model="username" type="text" required>
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" required>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" v-model="keepSignedIn">
          Keep me signed in
        </label>
      </div>
      <button type="submit" class="sign-in-button">Sign in</button>
    </form>
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
      console.log('登录尝试:', this.username, this.password, this.keepSignedIn);
      // 模拟登录成功
      this.$router.push('/dashboard');
    }
  }
}
</script>

<style scoped>
.login form {
  display: flex;
  flex-direction: column;
  align-items: stretch;
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
input[type="password"] {
  width: 100%;
  padding: 5px;
  border: 1px solid #ccc;
  border-radius: 3px;
}
.sign-in-button {
  background-color: #14b8a6;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 3px;
  cursor: pointer;
  font-weight: bold;
}
.sign-in-button:hover {
  background-color: #0d9488;
}
</style>