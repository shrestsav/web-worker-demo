import './assets/main.css'

import { createApp } from 'vue'
import router from './router'
import AppLayout from './components/AppLayout.vue'

// Create app with the layout component
const app = createApp(AppLayout)

app.use(router)
app.mount('#app')
