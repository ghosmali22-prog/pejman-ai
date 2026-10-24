import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The site is served from https://<user>.github.io/pejman-ai/ on GitHub Pages.
// Set VITE_BASE=/ if you later move to a custom domain.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/pejman-ai/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) return 'motion'
          if (id.includes('node_modules/@supabase')) return 'supabase'
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion')) return 'framer'
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react'
        },
      },
    },
  },
})
