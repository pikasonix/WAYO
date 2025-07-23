import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_DEV_PORT) || 3000,
    host: true
  },
  define: {
    // Expose environment variables to the client
    'import.meta.env.VITE_TRACK_ASIA_API_KEY': JSON.stringify(process.env.VITE_TRACK_ASIA_API_KEY),
    'import.meta.env.VITE_MAPBOX_ACCESS_TOKEN': JSON.stringify(process.env.VITE_MAPBOX_ACCESS_TOKEN),
  }
})
