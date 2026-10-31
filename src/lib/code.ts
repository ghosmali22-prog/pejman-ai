import type { CodeFile, CodeItem } from '../types'

/**
 * Helpers shared by the public Code section and the admin editor:
 * language detection, file lists, and building the live-preview document.
 */

/** Upload limits (the database refuses anything larger, see 004_code_items.sql). */
export const MAX_FILE_BYTES = 1024 * 1024 // one code file: 1 MB
export const MAX_ZIP_BYTES = 5 * 1024 * 1024 // a .zip project: 5 MB
export const MAX_PROJECT_BYTES = 2.5 * 1024 * 1024 // all text files of a project together
export const MAX_PROJECT_FILES = 40

const EXT_LANG: Record<string, string> = {
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  jsx: 'jsx',
  ts: 'ts',
  tsx: 'tsx',
  json: 'json',
  py: 'py',
  md: 'md',
  svg: 'svg',
  vue: 'vue',
  svelte: 'svelte',
  sh: 'sh',
  txt: 'text',
}

export const LANGUAGES = ['html', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'py', 'scss', 'vue', 'svelte', 'md', 'svg', 'sh', 'text']

/** Human label for a language id, e.g. "tsx" → "TSX", "js" → "JavaScript". */
export function languageLabel(lang: string): string {
  const labels: Record<string, string> = {
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    js: 'JavaScript',
    jsx: 'React JSX',
    ts: 'TypeScript',
    tsx: 'React TSX',
    json: 'JSON',
    py: 'Python',
    md: 'Markdown',
    svg: 'SVG',
    vue: 'Vue',
    svelte: 'Svelte',
    sh: 'Shell',
    text: 'Text',
  }
  return labels[lang] ?? lang.toUpperCase()
}

export const extOf = (name: string) => name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? ''

/** Language from a file name, or '' when the extension is unknown. */
export const languageFromName = (name: string) => EXT_LANG[extOf(name)] ?? ''

/** File extension to use when downloading a file of this language. */
export function extForLanguage(lang: string): string {
  const map: Record<string, string> = { text: 'txt', md: 'md', sh: 'sh' }
  return map[lang] ?? lang
}

/** Best guess for pasted code without a file name. */
export function guessLanguage(code: string): string {
  const s = code.trim()
  if (!s) return 'html'
  if (/^<!doctype html|^<html|^<(div|section|main|body|head|header|nav|style|script)\b/i.test(s)) return 'html'
  if (/^<svg\b/i.test(s)) return 'svg'
  if (/^[[{]/.test(s)) {
    try {
      JSON.parse(s)
      return 'json'
    } catch {
      /* not JSON */
    }
  }
  const jsx = /return\s*\(?\s*<[A-Za-z]|<\/[A-Za-z]+>|className=/.test(s)
  const ts = /:\s*(string|number|boolean|React\.\w+)\b|interface\s+\w+\s*\{|type\s+\w+\s*=|<\w+>\(/.test(s)
  if (jsx) return ts ? 'tsx' : 'jsx'
  if (/^\s*(def |class \w+(\(.*\))?:|from \w+ import |import \w+\s*$)/m.test(s) && !/[;{}]\s*$/m.test(s)) return 'py'
  if (ts) return 'ts'
  if (/^[^{}]*[.#:\w-][^{}]*\{[^}]*:[^}]*\}/m.test(s) && !/\b(function|const|let|=>)\b/.test(s)) return 'css'
  if (/<[a-z][\s\S]*>/i.test(s)) return 'html'
  return 'js'
}

/** "glass-dashboard_v2.html" → "Glass Dashboard V2" */
export function titleFromFileName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .split('/')
    .pop()!
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Every file of an item: the files list for projects, or the main code as one file. */
export function itemFiles(item: Pick<CodeItem, 'files' | 'code' | 'language' | 'slug'>): CodeFile[] {
  if (item.files?.length) return item.files
  if (!item.code) return []
  return [{ name: `${item.slug || 'code'}.${extForLanguage(item.language)}`, language: item.language, content: item.code }]
}

const PREVIEWABLE = new Set(['html', 'css', 'js', 'svg'])

/** Plain HTML / CSS / JS / SVG runs in the browser as is; React, TypeScript, Python… need a build step. */
export const runsInBrowser = (files: CodeFile[]) =>
  files.length > 0 &&
  files.every((f) => PREVIEWABLE.has(f.language)) &&
  files.some((f) => f.language === 'html' || f.language === 'svg' || f.language === 'js')

/** True when the item can show a live preview. */
export function canLivePreview(item: Pick<CodeItem, 'files' | 'code' | 'language' | 'slug' | 'live_preview_enabled'>): boolean {
  return item.live_preview_enabled && runsInBrowser(itemFiles(item))
}

/** Keeps inlined code from closing the tag it was placed in. */
const safeInline = (code: string, tag: 'script' | 'style') => code.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1')

/**
 * Builds one HTML document from an item's files: the HTML file (index.html first), with its
 * linked .css/.js files written inline, plus any other CSS/JS added at the end. Runs only inside
 * the sandboxed preview frame.
 */
export function buildPreviewDocument(files: CodeFile[]): string {
  const base = (n: string) => n.split('/').pop()!.toLowerCase()
  const html =
    files.find((f) => f.language === 'html' && /(^|\/)index\.html?$/i.test(f.name)) ??
    files.find((f) => f.language === 'html') ??
    files.find((f) => f.language === 'svg')
  const used = new Set<CodeFile>(html ? [html] : [])
  const byName = (ref: string) => {
    const want = base(ref.split(/[?#]/)[0])
    const hit = files.find((f) => base(f.name) === want)
    if (hit) used.add(hit)
    return hit
  }

  let doc = html?.content ?? ''
  doc = doc.replace(/<link\b[^>]*href=["']([^"']+\.css)["'][^>]*>/gi, (tag, href: string) => {
    const f = byName(href)
    return f ? `<style>${safeInline(f.content, 'style')}</style>` : tag
  })
  doc = doc.replace(/<script\b([^>]*)\bsrc=["']([^"']+\.m?js)["']([^>]*)>\s*<\/script>/gi, (tag, a: string, src: string, b: string) => {
    const f = byName(src)
    return f ? `<script${a}${b}>${safeInline(f.content, 'script')}</script>` : tag
  })

  const css = files.filter((f) => !used.has(f) && f.language === 'css')
  const js = files.filter((f) => !used.has(f) && f.language === 'js')
  const styles = css.map((f) => `<style>${safeInline(f.content, 'style')}</style>`).join('\n')
  const scripts = js.map((f) => `<script>${safeInline(f.content, 'script')}</script>`).join('\n')

  if (!/<html[\s>]/i.test(doc)) {
    doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${doc}</body></html>`
  }
  if (styles) doc = /<\/head>/i.test(doc) ? doc.replace(/<\/head>/i, `${styles}</head>`) : styles + doc
  if (scripts) doc = /<\/body>/i.test(doc) ? doc.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${scripts}</body>`) : doc + scripts
  return doc
}
