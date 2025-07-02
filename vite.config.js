import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  worker: {
    format: 'es', // Use ES modules in workers
    plugins: [] // Worker-specific plugins if needed
  },
  optimizeDeps: {
    // Make sure psd.js is properly included for both main thread and worker
    include: ['psd.js']
  }
})
