import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
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
          `media-src 'self' blob: ${sb}`,
          "font-src 'self'",
          `connect-src 'self' ${sb} ${sb.replace(/^https/, 'wss')}`,
          // Code previews: only /sandbox.html, always embedded with sandbox="allow-scripts".
          "frame-src 'self'",
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

/**
 * Writes dist/admin/index.html: the same app, but with the admin web-app manifest in the
 * initial HTML. iPhone reads the manifest when the page loads, so "Add to Home Screen"
 * from /admin/ then opens the panel. GitHub Pages also serves it directly (no 404 redirect).
 */
function adminEntry(): Plugin {
  let outDir = 'dist'
  return {
    name: 'pejman-admin-entry',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    closeBundle() {
      const html = readFileSync(join(outDir, 'index.html'), 'utf8')
        .replace(/<title>[^<]*<\/title>/, '<title>Admin · PEJMAN AI</title>')
        .replace(/(<link rel="manifest" href="[^"]*)site\.webmanifest"/, '$1admin.webmanifest"')
        .replace(
          '<link rel="manifest"',
          [
            '<meta name="robots" content="noindex" />',
            '<meta name="apple-mobile-web-app-capable" content="yes" />',
            '<meta name="mobile-web-app-capable" content="yes" />',
            '<meta name="apple-mobile-web-app-title" content="PEJMAN Admin" />',
            '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
            '<link rel="manifest"',
          ].join('\n    '),
        )
      mkdirSync(join(outDir, 'admin'), { recursive: true })
      writeFileSync(join(outDir, 'admin', 'index.html'), html)
    },
  }
}

// The site is served from the root of https://pejiai.com.
// The deploy workflow passes VITE_BASE from GitHub Pages itself, so a build still works
// under /pejman-ai/ if the custom domain is ever removed.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    base: process.env.VITE_BASE || '/',
    plugins: [react(), tailwindcss(), contentSecurityPolicy(env.VITE_SUPABASE_URL), adminEntry()],
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
