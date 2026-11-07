import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    rollupOptions: {
      input: {
        sidepanel: 'index.html',
        options: 'options.html',
        permission: 'permission.html',
      },
    },
  },
  server: {
    port: 4173,
  },
})
