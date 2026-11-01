import '@fontsource-variable/geist'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// We handle scroll position ourselves (prompt overlays must not jump the page).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

// Anti-clickjacking: the site never runs inside another site's frame. (GitHub Pages can't send
// frame-ancestors; Cloudflare adds that header too — this is the fallback.)
let framed = true
try {
  framed = window.top !== window.self
} catch {
  /* cross-origin parent: framed */
}

if (framed) {
  document.getElementById('root')!.textContent = 'Open pejiai.com directly to view this page.'
  try {
    window.top!.location.href = window.location.href
  } catch {
    /* sandboxed frame: stay blank */
  }
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
