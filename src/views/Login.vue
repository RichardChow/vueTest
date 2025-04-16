<template>
  <div class="login-container">
    <div class="login-box">
      <div class="logo">
        <img src="@/assets/BombBang-logo.png" alt="BombBang Logo">
      </div>
      <h2>Welcome to BombBang!</h2>
      <p class="subtitle">Please sign in below or <a href="#" class="create-account">create an account</a></p>
      
      <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" class="login-form">
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="Username"
            class="custom-input"
          />
        </el-form-item>
        
        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="Password"
            class="custom-input"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <div class="remember-me">
          <el-checkbox v-model="loginForm.remember">Keep me signed in</el-checkbox>
        </div>

        <el-form-item>
          <el-button
            type="primary"
            :loading="loading"
            class="login-button"
            @click="handleLogin"
          >
            Sign in
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script>
export default {
  name: 'UserLogin'
}
</script>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'

const router = useRouter()
const store = useStore()
const loginFormRef = ref(null)
const loading = ref(false)

const loginForm = reactive({
  username: '',
  password: '',
  remember: false
})

const loginRules = {
  username: [{ required: true, message: 'Please input username', trigger: 'blur' }],
  password: [{ required: true, message: 'Please input password', trigger: 'blur' }]
}

const handleLogin = () => {
  if (!loginFormRef.value) return
  
  loginFormRef.value.validate((valid) => {
    if (valid) {
      loading.value = true
      store.dispatch('login', loginForm)
        .then(() => {
          loading.value = false
          router.push('/dashboard')
          ElMessage({
            message: 'Welcome back!',
            type: 'success'
          })
        })
        .catch(error => {
          loading.value = false
          ElMessage.error(error.message || 'Login failed')
        })
    }
  })
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #ffffff;
}

.login-box {
  width: 400px;
  padding: 40px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
  text-align: center;
}

.logo {
  margin-bottom: 20px;
}

.logo img {
  width: 80px;
  height: 80px;
  object-fit: contain;
}

h2 {
  color: #333;
  font-size: 24px;
  margin-bottom: 10px;
  font-weight: 500;
}

.subtitle {
  color: #666;
  margin-bottom: 30px;
}

.create-account {
  color: #007bff;
  text-decoration: none;
}

.create-account:hover {
  text-decoration: underline;
}

.login-form {
  text-align: left;
}

.custom-input {
  height: 40px;
}

.remember-me {
  margin: 10px 0 20px;
  color: #666;
}

.login-button {
  width: 100%;
  height: 40px;
  background-color: #007bff;
  border-color: #007bff;
  font-size: 16px;
}

.login-button:hover {
  background-color: #0056b3;
  border-color: #0056b3;
}

/* Element Plus 样式覆盖 */
:deep(.el-form-item) {
  margin-bottom: 20px;
}

:deep(.el-checkbox__label) {
  color: #666;
}

:deep(.el-input__inner) {
  background-color: #f8f9fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  height: 40px;
}

:deep(.el-input__inner:focus) {
  border-color: #007bff;
}

:deep(.el-button--primary) {
  background-color: #007bff;
  border-color: #007bff;
}

:deep(.el-button--primary:hover) {
  background-color: #0056b3;
  border-color: #0056b3;
}
</style>