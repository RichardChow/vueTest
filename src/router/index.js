import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/views/Login.vue'
import Dashboard from '@/views/Dashboard.vue'
import VersionUpgrade from '@/views/VersionUpgrade.vue'
import ElementQuery from '@/views/ElementQuery.vue'
import TestReport from '@/views/TestReport.vue'
import UpdateVersionConfigPage from '../views/VersionUpdateConfigPage.vue'
import DeviceQuery from '../views/DeviceQuery.vue'
import CreateDevice from '../views/CreateDevice.vue'
import SmartServerRoom from '../views/SmartServerRoom.vue'
import SmartServerRoomNew from '../views/SmartServerRoomNew.vue'

const routes = [
  {
    path: "/",
    redirect: '/dashboard'
  },
  {
    path: "/login",
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
  {
    path: '/device-query',
    name: 'DeviceQuery',
    component: DeviceQuery
  },
  {
    path: '/create-device',
    name: 'CreateDevice',
    component: CreateDevice
  },
  {
    path: '/smart-server-room',
    name: 'SmartServerRoom',
    component: SmartServerRoom
  },
  {
    path: '/smart-server-room-new',
    name: 'SmartServerRoomNew',
    component: SmartServerRoomNew
  }
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated')
  if (to.path !== '/login' && !isAuthenticated) {
    next('/login')
  } else {
    next()
  }
})

export default router

console.log('路由配置已加载');
