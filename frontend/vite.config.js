import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8000',
      '/rooms': 'http://localhost:8000',
      '/rounds': 'http://localhost:8000',
      '/policies': 'http://localhost:8000',
      '/policy-presets': 'http://localhost:8000',
      '/results': 'http://localhost:8000',
      '/leaderboard': 'http://localhost:8000',
      '/seasons': 'http://localhost:8000',
      '/lessons': 'http://localhost:8000',
      '/lessons': 'http://localhost:8000',
    },
  },
})
