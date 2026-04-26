import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        // target: 'ws://13.232.161.29:8080',
        ws: true,
      },
    },
  },
})
