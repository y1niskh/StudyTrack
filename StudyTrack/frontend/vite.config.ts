import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Développement avec le vrai backend : mettre VITE_API_URL=/api dans .env.development.local ;
    // les appels /api sont alors renvoyés vers Express (port 5000) sans configuration CORS.
    proxy: { '/api': 'http://localhost:5000' },
  },
})
