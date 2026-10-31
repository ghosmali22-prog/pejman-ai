import type { CodeItem } from '../types'

/** Demo code items, shown ONLY while Supabase is not connected (local preview / tests). */
const base = { live_preview_enabled: true, is_featured: false, is_premium: false, copy_count: 0, preview_image_url: null }

const glassCard = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Glass card</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main class="scene">
    <article class="card">
      <span class="pill">Pro plan</span>
      <h1>$24<small>/mo</small></h1>
      <p>Everything you need to launch a beautiful product page.</p>
      <button id="cta">Start free trial</button>
    </article>
  </main>
  <script src="app.js"></script>
</body>
</html>`

const glassCss = `* { box-sizing: border-box; margin: 0; }
body { font-family: system-ui, sans-serif; min-height: 100vh; display: grid; place-items: center;
  background: radial-gradient(circle at 20% 20%, #c6f432 0, transparent 35%),
              radial-gradient(circle at 80% 70%, #4f46e5 0, transparent 40%), #0b0d0c; }
.card { width: min(340px, 86vw); padding: 32px; border-radius: 28px; color: #fff;
  background: rgb(255 255 255 / 0.08); border: 1px solid rgb(255 255 255 / 0.18);
  backdrop-filter: blur(24px); box-shadow: 0 30px 80px -30px rgb(0 0 0 / 0.6); }
.pill { display: inline-block; padding: 6px 12px; border-radius: 99px; background: #c6f432; color: #0b0d0c; font-size: 12px; font-weight: 700; }
h1 { font-size: 56px; margin: 20px 0 8px; letter-spacing: -0.04em; }
h1 small { font-size: 16px; opacity: 0.6; }
p { opacity: 0.7; line-height: 1.5; }
button { margin-top: 24px; width: 100%; height: 52px; border: 0; border-radius: 99px; background: #fff; font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.3s; }
button:hover { transform: scale(1.03); }`

const glassJs = `document.getElementById('cta').addEventListener('click', (e) => {
  e.target.textContent = 'You are in ✓'
})`

const statTile = `<div class="tile">
  <p class="label">Revenue</p>
  <p class="value">$48,920</p>
  <p class="delta">▲ 12.4% this month</p>
</div>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f3f4f1; font-family: system-ui, sans-serif; }
  .tile { padding: 24px 28px; border-radius: 24px; background: #fff; box-shadow: 0 20px 50px -25px rgb(0 0 0 / 0.25); min-width: 240px; }
  .label { margin: 0; color: #8d928e; font-size: 14px; }
  .value { margin: 8px 0; font-size: 40px; font-weight: 700; letter-spacing: -0.03em; }
  .delta { margin: 0; color: #4d7c0f; font-weight: 600; font-size: 14px; }
</style>`

const reactButton = `import { useState } from 'react'

export function MagneticButton({ label = 'Hover me' }: { label?: string }) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  return (
    <button
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        setPos({ x: (e.clientX - r.left - r.width / 2) / 4, y: (e.clientY - r.top - r.height / 2) / 4 })
      }}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      style={{ transform: \`translate(\${pos.x}px, \${pos.y}px)\` }}
      className="rounded-full bg-lime-300 px-8 py-4 font-semibold transition-transform"
    >
      {label}
    </button>
  )
}`

export const sampleCodeItems: CodeItem[] = [
  {
    ...base,
    id: 'code-1',
    slug: 'glass-pricing-card',
    title: 'Glass Pricing Card',
    short_description: 'Frosted-glass pricing card with a glowing gradient background and a hover CTA.',
    category: 'Glass UI',
    language: 'html',
    code: glassCard,
    files: [
      { name: 'index.html', language: 'html', content: glassCard },
      { name: 'style.css', language: 'css', content: glassCss },
      { name: 'app.js', language: 'js', content: glassJs },
    ],
    is_featured: true,
    sort_order: 0,
    created_at: '2026-10-30T10:00:00Z',
  },
  {
    ...base,
    id: 'code-2',
    slug: 'dashboard-stat-tile',
    title: 'Dashboard Stat Tile',
    short_description: 'Clean KPI tile for admin dashboards — one HTML file, no libraries.',
    category: 'Dashboard',
    language: 'html',
    code: statTile,
    files: [],
    sort_order: 1,
    created_at: '2026-10-29T10:00:00Z',
  },
  {
    ...base,
    id: 'code-3',
    slug: 'magnetic-button',
    title: 'Magnetic Button',
    short_description: 'React button that follows the cursor with a soft magnetic pull.',
    category: 'Animation',
    language: 'tsx',
    code: reactButton,
    files: [],
    sort_order: 2,
    created_at: '2026-10-28T10:00:00Z',
  },
  {
    ...base,
    id: 'code-4',
    slug: 'saas-landing-hero',
    title: 'SaaS Landing Hero',
    short_description: 'Full landing hero with animated headline and glass navbar. Available on request.',
    category: 'Landing section',
    language: 'tsx',
    code: '',
    files: [],
    is_premium: true,
    live_preview_enabled: false,
    sort_order: 3,
    created_at: '2026-10-27T10:00:00Z',
  },
]
