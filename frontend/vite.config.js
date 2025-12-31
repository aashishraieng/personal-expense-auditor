import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // This line was causing the crash

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})