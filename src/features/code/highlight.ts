import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import scss from 'highlight.js/lib/languages/scss'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'

/**
 * Syntax highlighting, loaded only when a code viewer opens (kept out of the main bundle).
 * Only the languages the Code section uses are registered, which keeps it small.
 */
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('scss', scss)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('python', python)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('bash', bash)

const MAP: Record<string, string> = {
  html: 'xml',
  svg: 'xml',
  vue: 'xml',
  svelte: 'xml',
  css: 'css',
  scss: 'scss',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  py: 'python',
  md: 'markdown',
  sh: 'bash',
}

/** Very large files are shown as plain text so the page stays fast. */
const MAX_HIGHLIGHT = 200_000

/**
 * Returns highlighted HTML, or null when the language is unknown / the file is too big.
 * highlight.js escapes every character of the input, so the result is safe to insert as HTML:
 * uploaded code is only ever displayed as text, never run on the page.
 */
export function highlight(code: string, language: string): string | null {
  const lang = MAP[language]
  if (!lang || code.length > MAX_HIGHLIGHT) return null
  try {
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
  } catch {
    return null
  }
}
