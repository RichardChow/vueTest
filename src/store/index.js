import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    isAuthenticated: false,
    user: null
  },
  mutations: {
    SET_AUTH(state, auth) {
      state.isAuthenticated = auth
    },
    SET_USER(state, user) {
      state.user = user
    }
  },
  actions: {
    login({ commit }, userInfo) {
      return new Promise((resolve) => {
        // 模拟登录API调用
        setTimeout(() => {
          commit('SET_AUTH', true)
          commit('SET_USER', userInfo)
          localStorage.setItem('isAuthenticated', 'true')
          resolve()
        }, 1000)
      })
    },
    logout({ commit }) {
      return new Promise((resolve) => {
        commit('SET_AUTH', false)
        commit('SET_USER', null)
        localStorage.removeItem('isAuthenticated')
        resolve()
      })
    }
  },
  getters: {
    isAuthenticated: state => state.isAuthenticated,
    user: state => state.user
  }
})