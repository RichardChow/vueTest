import Vue from 'vue'
import VueRouter from 'vue-router'
import Login from '@/views/Login.vue'
import Dashboard from '@/views/Dashboard.vue'
import VersionUpgrade from '@/views/VersionUpgrade.vue'
import ElementQuery from '@/views/ElementQuery.vue'
import TestReport from '@/views/TestReport.vue'
import UpdateVersionConfigPage from '../views/VersionUpdateConfigPage.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: "/",
    name: "Login",
    component: Login,
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: Dashboard,
  },
  {
    path: "/version-upgrade",
    name: "VersionUpgrade",
    component: VersionUpgrade,
  },
  {
    path: "/element-query",
    name: "ElementQuery",
    component: ElementQuery,
  },
  {
    path: "/test-report",
    name: "TestReport",
    component: TestReport,
  },
  {
    path: "/version-update-config",
    name: "VersionUpdateConfigPage",
    component: UpdateVersionConfigPage,
  },
];

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

export default router

console.log('路由配置已加载');
