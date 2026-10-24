import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Adds a strict Content-Security-Policy to the built index.html.
 * GitHub Pages cannot send security headers, so it goes in a <meta> tag.
 * Inline scripts are allowed only by their exact SHA-256 hash, and the page may
 * only talk to itself and to this project's Supabase.
 */
function contentSecurityPolicy(supabaseUrl?: string): Plugin {
  return {
    name: 'pejman-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          ([, code]) => `'sha256-${createHash('sha256').update(code).digest('base64')}'`,
        )
        const sb = supabaseUrl ? new URL(supabaseUrl).origin : ''
        const csp = [
          "default-src 'self'",
          `script-src 'self' ${hashes.join(' ')}`,
          "style-src 'self' 'unsafe-inline'",
          `img-src 'self' data: blob: ${sb}`,
          "font-src 'self'",
          `connect-src 'self' ${sb} ${sb.replace(/^https/, 'wss')}`,
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          'upgrade-insecure-requests',
        ]
          .map((d) => d.replace(/\s+/g, ' ').trim())
          .join('; ')
        return html.replace(
          /<meta charset="UTF-8" \/>/,
          `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`,
        )
      },
    },
  }
}

// The site is served from https://<user>.github.io/pejman-ai/ on GitHub Pages.
// Set VITE_BASE=/ if you later move to a custom domain.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    base: process.env.VITE_BASE ?? '/pejman-ai/',
    plugins: [react(), tailwindcss(), contentSecurityPolicy(env.VITE_SUPABASE_URL)],
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
  }
})
