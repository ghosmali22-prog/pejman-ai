import { createServer } from 'vite'

// Checks the protected-demo builder (src/lib/demoBuild.ts) with the real obfuscator:
// readable source, comments and meaningful names must be gone, the watermark and the domain
// lock must be in. Usage: npm run test:demo
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { buildDemoDocument, loadObfuscator, WATERMARK } = await vite.ssrLoadModule('/src/lib/demoBuild.ts')
const obfuscate = await loadObfuscator()

let pass = 0, fail = 0
const check = (good, label) => { good ? pass++ : fail++; console.log(`${good ? 'PASS' : 'FAIL'}  ${label}`) }

const files = [
  {
    name: 'index.html',
    language: 'html',
    content:
      '<!doctype html><html><head><title>Card</title><link rel="stylesheet" href="style.css"></head><body><!-- secret note -->' +
      '<div class="glass-card" id="hero"><label for="email">Email</label><input id="email"><button class="cta-btn" id="go">Go</button></div>' +
      '<svg><linearGradient id="grad"></linearGradient><rect fill="url(#grad)"/></svg><script src="app.js"></script></body></html>',
  },
  {
    name: 'style.css',
    language: 'css',
    content: '/* css note */ .glass-card { color: #fff; } .glass-card:hover .cta-btn { color: red } @media (max-width: 600px) { #hero { padding: 4px } }',
  },
  {
    name: 'app.js',
    language: 'js',
    content: '// js note\nconst secretName = "MY_SECRET_VALUE"; document.getElementById("go").addEventListener("click", () => { document.body.dataset.clicked = secretName })',
  },
]
const out = buildDemoDocument(files, 'glass-card', obfuscate)

for (const s of ['secret note', 'css note', 'js note', 'MY_SECRET_VALUE', 'secretName', 'glass-card"', '.glass-card', 'cta-btn', 'id="hero"', '#hero{'])
  check(!out.includes(s), `"${s}" removed from the demo`)
check(out.includes('id="go"'), 'IDs used by scripts are kept (demo still works)')
check(/<label for="(_\w+)">[\s\S]*<input id="\1">/.test(out), 'renamed IDs stay linked (label for= → input id=)')
check(/fill="url\(#_\w+\)"/.test(out) && /linearGradient id="_\w+"/.test(out), 'SVG url(#id) references renamed together')
check(out.includes(WATERMARK), 'watermark text is in the demo')
check((out.match(/html::after|html::before/g) ?? []).length >= 2, 'watermark woven in through CSS badge + tiled overlay')
check(!/\n\s+\n/.test(out.replace(/<script>[\s\S]*?<\/script>/g, '')), 'markup is minified')
check(out.indexOf('<script>') < out.indexOf('</head>'), 'domain lock runs before the item’s own code')
check(out.length < 3 * 1024 * 1024, `demo fits the 3 MB bucket limit (${Math.round(out.length / 1024)} KB)`)

console.log(`\n${pass} passed, ${fail} failed`)
await vite.close()
if (fail > 0) process.exit(1)
