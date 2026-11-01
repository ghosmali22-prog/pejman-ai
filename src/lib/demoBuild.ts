import type { CodeFile } from '../types'
import { buildPreviewDocument } from './code'

/**
 * Builds the protected live demo of a premium item: ONE self-contained HTML file that is safe to
 * show to visitors, made from (but never containing) the readable source.
 *
 *  • every file inlined, comments stripped, HTML/CSS minified
 *  • every inline script heavily obfuscated (string encryption, control-flow flattening,
 *    dead-code injection, self-defending)
 *  • class names / IDs that no script uses are renamed to meaningless ones
 *  • "Preview · pejiai.com" woven in four places: title, a CSS badge, a tiled CSS overlay,
 *    and a script-kept badge in a closed shadow root that comes back if removed
 *  • domain lock: renders only inside a frame on pejiai.com; anywhere else it shows
 *    "View on pejiai.com" and stops loading the rest of the page
 *  • right-click, selection and dragging are blocked (except in form fields)
 *
 * All of this is a deterrent: code that runs in a visitor's browser can always be studied by a
 * determined person. The real protection is that the readable source never leaves the database.
 */

export const DEMO_ORIGINS = ['https://pejiai.com', 'https://www.pejiai.com']
export const WATERMARK = 'Preview · pejiai.com'

/** isolated: the only script and no onclick="" handlers, so its top-level names can be renamed too. */
export type Obfuscate = (code: string, opts: { module: boolean; isolated?: boolean }) => string

/** Options for javascript-obfuscator. Kept here so the admin panel and tests use the same settings. */
export const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  stringArray: true,
  stringArrayEncoding: ['rc4'],
  stringArrayThreshold: 1,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  splitStrings: true,
  splitStringsChunkLength: 6,
  selfDefending: true,
  numbersToExpressions: true,
  simplify: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false, // inline scripts and onclick="" handlers share globals (on when isolated)
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
} as const

const rand = () => '_' + Math.random().toString(36).slice(2, 7)
const NAME = /^[A-Za-z_-][\w-]*$/

type Part = { kind: 'html' | 'script' | 'style' | 'raw'; open: string; body: string; close: string }

/** Splits a document into markup and the bodies of <script>, <style>, <pre> and <textarea>. */
function split(doc: string): Part[] {
  const parts: Part[] = []
  const re = /(<(script|style|pre|textarea)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi
  let last = 0
  for (let m = re.exec(doc); m; m = re.exec(doc)) {
    if (m.index > last) parts.push({ kind: 'html', open: '', body: doc.slice(last, m.index), close: '' })
    const tag = m[2].toLowerCase()
    parts.push({ kind: tag === 'script' ? 'script' : tag === 'style' ? 'style' : 'raw', open: m[1], body: m[3], close: m[4] })
    last = m.index + m[0].length
  }
  if (last < doc.length) parts.push({ kind: 'html', open: '', body: doc.slice(last), close: '' })
  return parts
}

const isJsScript = (open: string) => {
  const type = open.match(/\btype\s*=\s*["']?([^"'\s>]+)/i)?.[1]?.toLowerCase()
  return !type || type === 'module' || type === 'text/javascript' || type === 'application/javascript'
}

export function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim()
}

const minifyMarkup = (html: string) =>
  html
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '> <')

/** Renames `.class` and `#id` in CSS selectors (not in declarations, so colors like #fff are safe). */
function renameInCss(css: string, cls: Map<string, string>, ids: Map<string, string>): string {
  const sel = (s: string) =>
    s
      .replace(/\.([A-Za-z_-][\w-]*)/g, (m, n: string) => (cls.has(n) ? '.' + cls.get(n) : m))
      .replace(/#([A-Za-z_-][\w-]*)/g, (m, n: string) => (ids.has(n) ? '#' + ids.get(n) : m))
  let out = ''
  let buf = ''
  let inDecl = false // inside a rule's { declarations }
  for (const ch of css) {
    if (ch === '{') {
      const atRule = /^\s*@/.test(buf) // @media / @supports / @keyframes preludes are left alone
      out += (atRule ? buf : sel(buf)) + '{'
      inDecl = !atRule
      buf = ''
    } else if (ch === '}') {
      out += renameUrls(buf, ids) + '}'
      inDecl = false
      buf = ''
    } else if (ch === ';') {
      out += (inDecl ? renameUrls(buf, ids) : buf) + ';' // declaration, or a statement like @import …;
      buf = ''
    } else buf += ch
  }
  return out + buf
}

const renameUrls = (s: string, ids: Map<string, string>) =>
  s.replace(/url\(\s*(['"]?)#([\w-]+)\1\s*\)/g, (m, q: string, n: string) => (ids.has(n) ? `url(${q}#${ids.get(n)}${q})` : m))

function renameInMarkup(html: string, cls: Map<string, string>, ids: Map<string, string>): string {
  return html.replace(/(\s)([\w:-]+)(\s*=\s*)(["'])([\s\S]*?)\4/g, (_m, sp: string, attr: string, eq: string, q: string, val: string) => {
    const a = attr.toLowerCase()
    let v = val
    if (a === 'class') v = val.split(/\s+/).map((c) => cls.get(c) ?? c).join(' ')
    else if (a === 'id' || a === 'for' || a === 'aria-labelledby' || a === 'aria-describedby' || a === 'aria-controls' || a === 'list')
      v = val.split(/\s+/).map((c) => ids.get(c) ?? c).join(' ')
    else if (a === 'href' || a === 'xlink:href') v = val.replace(/^#([\w-]+)$/, (h, n: string) => (ids.has(n) ? '#' + ids.get(n) : h))
    else if (a === 'style') v = renameUrls(val, ids)
    else v = renameUrls(val, ids) // fill="url(#grad)", mask, clip-path…
    return `${sp}${attr}${eq}${q}${v}${q}`
  })
}

/** The domain lock + watermark keeper. Runs first, before any of the item's own code. */
function guardScript(slug: string): string {
  const back = `https://pejiai.com/?code=${encodeURIComponent(slug)}`
  const badgeId = rand()
  return `(function(){
var A=${JSON.stringify(DEMO_ORIGINS)},W=${JSON.stringify(WATERMARK)};
function host(){try{var o=location.ancestorOrigins;if(o&&o.length)return o[o.length-1];if(document.referrer)return new URL(document.referrer).origin}catch(e){}return""}
function ok(){var f=false;try{f=window.top!==window.self}catch(e){f=true}return f&&A.indexOf(host())>=0}
if(!ok()){document.write('<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:#0b0d0c;color:#fff;font:600 18px system-ui,sans-serif;text-align:center;padding:24px"><div>This preview only works on pejiai.com</div><a href="${back}" target="_blank" rel="noopener" style="color:#0b0d0c;background:#c6f432;padding:12px 22px;border-radius:999px;text-decoration:none">View on pejiai.com</a></div><plaintext style="display:none">');document.addEventListener("DOMContentLoaded",function(){var p=document.querySelector("plaintext");if(p)p.remove()});return}
document.title=W+(document.title?" · "+document.title:"");
function stop(e){var t=e.target;if(t&&t.closest&&t.closest("input,textarea,select,[contenteditable]"))return;e.preventDefault()}
["contextmenu","selectstart","dragstart","copy","cut"].forEach(function(n){document.addEventListener(n,stop,true)});
function badge(){if(!document.body)return;var h=document.getElementById("${badgeId}");if(h&&h.isConnected)return;h=document.createElement("div");h.id="${badgeId}";
h.setAttribute("style","all:initial;position:fixed;left:10px;top:10px;z-index:2147483647;pointer-events:none");var r=h.attachShadow({mode:"closed"});
r.innerHTML='<span style="font:600 11px system-ui,sans-serif;color:#fff;background:rgba(11,13,12,.72);padding:5px 9px;border-radius:999px;letter-spacing:.02em">'+W+'</span>';document.documentElement.appendChild(h)}
var id;function keep(){if(!ok()){document.documentElement.innerHTML="";clearInterval(id);return}badge();
if(!document.querySelector("style[data-pjw]")&&document.head){var s=document.createElement("style");s.setAttribute("data-pjw","");s.textContent=CSS;document.head.appendChild(s)}}
var CSS=${JSON.stringify(watermarkCss())};
document.addEventListener("DOMContentLoaded",keep);id=setInterval(keep,1500);
})();`
}

function watermarkCss(): string {
  const tile = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="160"><text x="10" y="90" transform="rotate(-24 130 80)" font-family="system-ui,sans-serif" font-size="15" font-weight="600" fill="rgba(128,128,128,0.16)">${WATERMARK}</text></svg>`,
  )
  return minifyCss(`
    html::after{content:"${WATERMARK}"!important;position:fixed!important;right:10px!important;bottom:10px!important;z-index:2147483647!important;
      font:600 11px system-ui,sans-serif!important;color:#fff!important;background:rgba(11,13,12,.72)!important;padding:5px 9px!important;
      border-radius:999px!important;pointer-events:none!important;display:block!important;opacity:1!important}
    html::before{content:""!important;position:fixed!important;inset:0!important;z-index:2147483646!important;pointer-events:none!important;
      background:url("data:image/svg+xml,${tile}") repeat!important;display:block!important;opacity:1!important}
    *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
    input,textarea,select,[contenteditable]{-webkit-user-select:text;user-select:text}
  `)
}

/** Builds the demo file. `obfuscate` is javascript-obfuscator (loaded only where it's needed). */
export function buildDemoDocument(files: CodeFile[], slug: string, obfuscate: Obfuscate): string {
  const parts = split(buildPreviewDocument(files))
  const scripts = parts.filter((p) => p.kind === 'script')
  const jsText = scripts.map((p) => p.body).join('\n') + parts.map((p) => (p.kind === 'html' ? p.body.match(/\son\w+\s*=\s*(["'])[\s\S]*?\1/g)?.join(' ') ?? '' : '')).join(' ')
  const hasExternalScript = scripts.some((p) => /\bsrc\s*=/.test(p.open))
  const markupText = parts.filter((p) => p.kind === 'html').map((p) => p.body).join(' ')
  const isolated =
    scripts.filter((p) => isJsScript(p.open) && p.body.trim()).length === 1 && !hasExternalScript && !/\son\w+\s*=/i.test(markupText)

  // Rename class names / IDs that no script could look up (and only when no outside script can either).
  const cls = new Map<string, string>()
  const ids = new Map<string, string>()
  if (!hasExternalScript) {
    const markup = parts.filter((p) => p.kind === 'html').map((p) => p.body).join(' ')
    for (const [, v] of markup.matchAll(/\sclass\s*=\s*["']([^"']*)["']/gi))
      for (const c of v.split(/\s+/)) if (c && NAME.test(c) && !jsText.includes(c)) cls.set(c, rand())
    for (const [, v] of markup.matchAll(/\sid\s*=\s*["']([^"']*)["']/gi))
      if (v && NAME.test(v) && !jsText.includes(v)) ids.set(v, rand())
  }

  const out = parts.map((p) => {
    if (p.kind === 'html') return minifyMarkup(renameInMarkup(p.body, cls, ids))
    if (p.kind === 'style') return renameInMarkup(p.open, cls, ids) + minifyCss(renameInCss(p.body, cls, ids)) + p.close
    if (p.kind === 'script') {
      if (!isJsScript(p.open) || !p.body.trim()) return p.open + p.body + p.close
      const module = /type\s*=\s*["']?module/i.test(p.open)
      return p.open + obfuscate(p.body, { module, isolated }).replace(/<\/(script)/gi, '<\\/$1') + p.close
    }
    return renameInMarkup(p.open, cls, ids) + p.body + p.close
  })
  let doc = out.join('')

  const guard = `<script>${obfuscate(guardScript(slug), { module: false }).replace(/<\/(script)/gi, '<\\/$1')}</script>`
  const css = `<style data-pjw>${watermarkCss()}</style>`
  doc = /<head[^>]*>/i.test(doc) ? doc.replace(/<head[^>]*>/i, (h) => `${h}${guard}`) : guard + doc
  doc = /<\/head>/i.test(doc) ? doc.replace(/<\/head>/i, `${css}</head>`) : doc + css
  if (!/<meta[^>]+name=["']robots/i.test(doc)) doc = doc.replace(/<head[^>]*>/i, (h) => `${h}<meta name="robots" content="noindex">`)
  return doc
}

/** Loads javascript-obfuscator on demand and returns a ready `obfuscate` function. */
export async function loadObfuscator(): Promise<Obfuscate> {
  const mod = await import('javascript-obfuscator')
  const JO = (mod as unknown as { default?: typeof mod }).default ?? mod
  return (code, { isolated }) =>
    JO.obfuscate(code, {
      ...OBFUSCATOR_OPTIONS,
      stringArrayEncoding: [...OBFUSCATOR_OPTIONS.stringArrayEncoding],
      renameGlobals: Boolean(isolated),
    }).getObfuscatedCode()
}
