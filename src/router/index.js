import { createRouter, createWebHistory } from 'vue-router'
import App from '../App.vue'
import PsdViewer from '../pages/PsdViewer.vue'
import AppLayout from '../components/AppLayout.vue'
import WithWebWorker from '../pages/WithWebWorker.vue'
import WithoutWebWorker from '../pages/WithoutWebWorker.vue'
import WorkerLifecycle from '../pages/WorkerLifecycle.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: App
  },
  {
    path: '/psd-viewer',
    name: 'PsdViewer',
    component: PsdViewer
  },
  {
    path: '/with-web-worker',
    name: 'WithWebWorker',
    component: WithWebWorker
  },
  {
    path: '/without-web-worker',
    name: 'WithoutWebWorker',
    component: WithoutWebWorker
  },
  {
    path: '/worker-lifecycle',
    name: 'WorkerLifecycle',
    component: WorkerLifecycle
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
