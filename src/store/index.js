import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    user: null
  },
  mutations: {
    setUser(state, user) {
      state.user = user
    }
  },
  actions: {
    login({ commit }, user) {
      // 这里应该有实际的登录逻辑
      commit('setUser', user)
    },
    logout({ commit }) {
      commit('setUser', null)
    }
  },
  getters: {
    isLoggedIn: state => !!state.user
  }
})