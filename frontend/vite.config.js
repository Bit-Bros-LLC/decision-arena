import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth/profile': 'http://127.0.0.1:8000',
      '/rooms': 'http://127.0.0.1:8000',
      '/rounds': 'http://127.0.0.1:8000',
      '/policies': 'http://127.0.0.1:8000',
      '/policy-presets': 'http://127.0.0.1:8000',
      '/results': 'http://127.0.0.1:8000',
      '/leaderboard': 'http://127.0.0.1:8000',
      '/seasons': 'http://127.0.0.1:8000',
      '/lessons': 'http://127.0.0.1:8000',
      '/users': 'http://127.0.0.1:8000',
    },
  },
})
