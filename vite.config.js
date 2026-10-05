import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Allow temporary Cloudflare tunnel hostnames (for testing on a phone).
const allowedHosts = ['.trycloudflare.com']

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, allowedHosts },
  preview: { port: 4173, allowedHosts },
})
