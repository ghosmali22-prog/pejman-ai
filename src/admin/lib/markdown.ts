import { Marked, type Tokens } from 'marked'

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Only ordinary links survive: no javascript: or data: URLs. */
const safeUrl = (href: string) => (/^(https?:|mailto:|tel:|\/|#|\.{0,2}\/)/i.test(href.trim()) ? href.trim() : '#')

const isExternal = (href: string) => /^https?:/i.test(href) && !href.includes('ghosmali22-prog.github.io')

/** Turns heading text into an anchor id; Persian headings fall back to their position. */
const anchor = (text: string, index: number) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `section-${index}`

function createRenderer() {
  let headings = 0
  const used = new Set<string>()
  const md = new Marked({ gfm: true, breaks: true })
  md.use({
    renderer: {
      // Raw HTML in a post is shown as text, never run.
      html(token: Tokens.HTML | Tokens.Tag) {
        return 'block' in token && token.block ? `<p>${escape(token.text)}</p>\n` : escape(token.text)
      },
      // A picture on its own line becomes a <figure>, not a <figure> inside a <p>.
      paragraph({ tokens }: Tokens.Paragraph) {
        const inner = this.parser.parseInline(tokens)
        return tokens.length === 1 && tokens[0].type === 'image' ? `${inner}\n` : `<p>${inner}</p>\n`
      },
      heading({ tokens, depth }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens)
        let id = anchor(inner, ++headings)
        while (used.has(id)) id = `${id}-${headings}`
        used.add(id)
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`
      },
      link({ href, title, tokens }: Tokens.Link) {
        const url = safeUrl(href)
        const ext = isExternal(url) ? ' target="_blank" rel="noopener"' : ''
        const t = title ? ` title="${escape(title)}"` : ''
        return `<a href="${escape(url)}"${t}${ext}>${this.parser.parseInline(tokens)}</a>`
      },
      image({ href, title, text }: Tokens.Image) {
        const img = `<img src="${escape(safeUrl(href))}" alt="${escape(text)}" loading="lazy" decoding="async" />`
        return title ? `<figure>${img}<figcaption>${escape(title)}</figcaption></figure>` : img
      },
    },
  })
  return md
}

/** Markdown → safe HTML for the public post page (and the prerendered page Google reads). */
export function renderMarkdown(source: string): string {
  return createRenderer().parse(source, { async: false })
}

/** Rough reading time at 220 words a minute (Persian and English alike). */
export function readingMinutes(source: string): number {
  const words = source.replace(/[#*_>`~[\]()!-]/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
}
