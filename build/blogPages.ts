import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import type { Post } from '../src/types/index.ts'

/**
 * Prerenders the blog for search engines. GitHub Pages can only serve static files, and the
 * rest of the site is a single-page app (unknown URLs get a 404 status and a JS redirect).
 * After the build this writes real HTML for /blog/ and every /blog/<slug>/, with the post in
 * the page, its own title, description, canonical URL, Open Graph tags and JSON-LD,
 * plus sitemap.xml and blog/rss.xml. Posts published later show on the site at once
 * (the app fetches them) and get their static page on the next build (hourly, see deploy.yml).
 */

const SITE_NAME = 'PEJMAN AI'
const AUTHOR = 'Pejman Ansaribarz'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** JSON that is safe inside a <script> tag. */
const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

async function loadPosts(supabaseUrl?: string, key?: string): Promise<Post[] | null> {
  if (!supabaseUrl || !key) {
    console.warn('[blog] Supabase is not configured: blog pages are built without posts.')
    return null
  }
  const headers: Record<string, string> = { apikey: key, Accept: 'application/json' }
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`
  try {
    const res = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/posts?select=*&published=is.true&order=published_at.desc`,
      { headers, signal: AbortSignal.timeout(20_000) },
    )
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    const rows = (await res.json()) as (Post & { content?: string; cover_path?: string })[]
    // The Markdown source and storage path are not needed on the public page.
    return rows.map(({ content: _content, cover_path: _path, ...p }) => ({ ...p, tags: p.tags ?? [] }))
  } catch (err) {
    // Never fail the deploy because of the blog (e.g. before 002_blog.sql has been run).
    console.warn(`[blog] Could not load posts, building the blog without them: ${String(err).slice(0, 200)}`)
    return null
  }
}

interface Meta {
  title: string
  description: string
  url: string
  image: string
  lang: string
  type: 'website' | 'article'
  extraHead: string
}

/** Swaps the home page's head tags in index.html for this page's. */
function withMeta(template: string, m: Meta) {
  const attr = (pattern: RegExp, value: string) => (html: string) =>
    html.replace(pattern, (_, before: string) => `${before}${esc(value)}"`)
  const steps = [
    (h: string) => h.replace(/<html lang="[^"]*"/, () => `<html lang="${m.lang}"`),
    (h: string) => h.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(m.title)}</title>`),
    attr(/(<meta name="description" content=")[^"]*"/, m.description),
    attr(/(<link rel="canonical" href=")[^"]*"/, m.url),
    attr(/(<meta property="og:type" content=")[^"]*"/, m.type),
    attr(/(<meta property="og:title" content=")[^"]*"/, m.title),
    attr(/(<meta property="og:description" content=")[^"]*"/, m.description),
    attr(/(<meta property="og:url" content=")[^"]*"/, m.url),
    attr(/(<meta property="og:image" content=")[^"]*"/, m.image),
    attr(/(<meta name="twitter:title" content=")[^"]*"/, m.title),
    attr(/(<meta name="twitter:description" content=")[^"]*"/, m.description),
    attr(/(<meta name="twitter:image" content=")[^"]*"/, m.image),
    // The home page's 1200×630 size no longer applies to a post's own cover.
    (h: string) =>
      m.type === 'article' ? h.replace(/\s*<meta property="og:image:(width|height)" content="[^"]*" \/>/g, '') : h,
    (h: string) => h.replace('</head>', () => `${m.extraHead}\n  </head>`),
  ]
  return steps.reduce((html, step) => step(html), template)
}

// Replacements go through functions, so a "$1" or "$&" in a post is never read as a pattern.
const withBody = (html: string, root: string, data: string) =>
  html.replace('<div id="root"></div>', () => `<div id="root">${root}</div>\n    ${data}`)

function write(outDir: string, path: string, html: string) {
  mkdirSync(join(outDir, path), { recursive: true })
  writeFileSync(join(outDir, path, 'index.html'), html)
}

export function blogPages(opts: { supabaseUrl?: string; supabaseKey?: string; origin?: string }): Plugin {
  let outDir = 'dist'
  let base = '/'
  return {
    name: 'pejman-blog-pages',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
      base = c.base
    },
    async closeBundle() {
      const origin = (opts.origin ?? 'https://ghosmali22-prog.github.io').replace(/\/$/, '')
      const site = `${origin}${base}`
      const blogUrl = `${site}blog/`
      const rssUrl = `${blogUrl}rss.xml`
      const defaultImage = `${site}og-image.jpg`
      const template = readFileSync(join(outDir, 'index.html'), 'utf8')
      const posts = await loadPosts(opts.supabaseUrl, opts.supabaseKey)
      const list = posts ?? []
      const rssLink = `    <link rel="alternate" type="application/rss+xml" title="${SITE_NAME} Blog" href="${rssUrl}" />`
      const ld = (data: unknown) => `    <script type="application/ld+json">${json(data)}</script>`
      const breadcrumb = (items: { name: string; url: string }[]) => ({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
      })

      // ------------------------------------------------------------ /blog/
      const blogDescription =
        'Notes from PEJMAN AI on AI images, motion, websites and automations: what works, with the prompts behind it.'
      const listHtml = list
        .map(
          (p) => `<li lang="${p.lang}" dir="${p.lang === 'fa' ? 'rtl' : 'ltr'}"><a href="${blogUrl}${p.slug}/"><h2>${esc(p.title)}</h2></a><p>${esc(p.excerpt)}</p></li>`,
        )
        .join('')
      const blogIndex = withMeta(template, {
        title: `Blog · ${SITE_NAME}`,
        description: blogDescription,
        url: blogUrl,
        image: defaultImage,
        lang: 'en',
        type: 'website',
        extraHead: [
          rssLink,
          ld({
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: `${SITE_NAME} Blog`,
            url: blogUrl,
            description: blogDescription,
            author: { '@type': 'Person', name: AUTHOR },
            blogPost: list.map((p) => ({
              '@type': 'BlogPosting',
              headline: p.title,
              url: `${blogUrl}${p.slug}/`,
              datePublished: p.published_at,
            })),
          }),
          ld(breadcrumb([{ name: SITE_NAME, url: site }, { name: 'Blog', url: blogUrl }])),
        ].join('\n'),
      })
      write(
        outDir,
        'blog',
        withBody(
          blogIndex,
          `<main class="min-h-svh bg-paper text-ink"><header class="bg-ink px-4 pb-14 pt-32 text-paper"><h1 class="display text-[30vw]">Blog</h1><p>${esc(blogDescription)}</p></header><ul class="mx-auto max-w-7xl px-4 py-12">${listHtml}</ul></main>`,
          posts
            ? `<script type="application/json" id="blog-posts">${json(list.map((p) => ({ ...p, content_html: '' })))}</script>`
            : '',
        ),
      )

      // ------------------------------------------------------------ /blog/<slug>/
      for (const p of list) {
        const url = `${blogUrl}${p.slug}/`
        const title = `${p.seo_title || p.title} · ${SITE_NAME}`
        const description = clip(p.seo_description || p.excerpt || p.title, 300)
        const image = p.cover_url || defaultImage
        const dir = p.lang === 'fa' ? 'rtl' : 'ltr'
        const html = withMeta(template, {
          title,
          description,
          url,
          image,
          lang: p.lang,
          type: 'article',
          extraHead: [
            `    <meta property="article:published_time" content="${esc(p.published_at ?? p.created_at)}" />`,
            p.updated_at ? `    <meta property="article:modified_time" content="${esc(p.updated_at)}" />` : '',
            `    <meta property="article:author" content="${AUTHOR}" />`,
            ...p.tags.map((t) => `    <meta property="article:tag" content="${esc(t)}" />`),
            rssLink,
            ld({
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              headline: clip(p.title, 110),
              description,
              image: p.cover_url ? [p.cover_url] : [defaultImage],
              datePublished: p.published_at ?? p.created_at,
              dateModified: p.updated_at ?? p.published_at ?? p.created_at,
              inLanguage: p.lang,
              keywords: p.tags.join(', '),
              mainEntityOfPage: { '@type': 'WebPage', '@id': url },
              author: { '@type': 'Person', name: AUTHOR, url: site },
              publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${site}icon-512.png` } },
            }),
            ld(
              breadcrumb([
                { name: SITE_NAME, url: site },
                { name: 'Blog', url: blogUrl },
                { name: p.title, url },
              ]),
            ),
          ]
            .filter(Boolean)
            .join('\n'),
        })
        const cover = p.cover_url
          ? `<img src="${esc(p.cover_url)}" alt="${esc(p.cover_alt || p.title)}"${p.cover_width ? ` width="${p.cover_width}" height="${p.cover_height}"` : ''} class="mx-auto block aspect-[16/9] w-full max-w-6xl rounded-[24px] object-cover" />`
          : ''
        write(
          outDir,
          `blog/${p.slug}`,
          withBody(
            html,
            `<main class="min-h-svh bg-paper text-ink"><header class="bg-ink px-4 pb-16 pt-32 text-paper"><div class="mx-auto max-w-4xl" dir="${dir}" lang="${p.lang}"><a href="${blogUrl}">All posts</a><h1 class="heading text-[40px]">${esc(p.title)}</h1><p>${esc(p.excerpt)}</p><p><time datetime="${esc(p.published_at ?? p.created_at)}">${esc((p.published_at ?? p.created_at).slice(0, 10))}</time> · ${AUTHOR}</p></div></header>${cover}<article dir="${dir}" lang="${p.lang}" class="post-body mx-auto max-w-[720px] px-5 pb-16 pt-14${p.lang === 'fa' ? ' fa-text' : ''}">${p.content_html}</article></main>`,
            `<script type="application/json" id="blog-post">${json(p)}</script>`,
          ),
        )
      }

      // ------------------------------------------------------------ sitemap + RSS
      const lastmod = (d?: string | null) => (d ? `<lastmod>${d.slice(0, 10)}</lastmod>` : '')
      const urls = [
        `<url><loc>${site}</loc><changefreq>weekly</changefreq></url>`,
        `<url><loc>${site}prompts</loc><changefreq>weekly</changefreq></url>`,
        `<url><loc>${blogUrl}</loc>${lastmod(list[0]?.published_at)}<changefreq>daily</changefreq></url>`,
        ...list.map((p) => `<url><loc>${blogUrl}${p.slug}/</loc>${lastmod(p.updated_at ?? p.published_at)}</url>`),
      ]
      writeFileSync(
        join(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls.join('\n  ')}\n</urlset>\n`,
      )
      const items = list
        .slice(0, 30)
        .map(
          (p) =>
            `<item><title>${esc(p.title)}</title><link>${blogUrl}${p.slug}/</link><guid isPermaLink="true">${blogUrl}${p.slug}/</guid><pubDate>${new Date(p.published_at ?? p.created_at).toUTCString()}</pubDate><description>${esc(p.excerpt)}</description>${p.tags.map((t) => `<category>${esc(t)}</category>`).join('')}</item>`,
        )
        .join('\n    ')
      writeFileSync(
        join(outDir, 'blog', 'rss.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>${SITE_NAME} Blog</title>\n    <link>${blogUrl}</link>\n    <description>${esc(blogDescription)}</description>\n    <atom:link href="${rssUrl}" rel="self" type="application/rss+xml" />\n    ${items}\n  </channel>\n</rss>\n`,
      )
      console.log(`[blog] Prerendered ${list.length} post${list.length === 1 ? '' : 's'}, sitemap.xml and blog/rss.xml`)
    },
  }
}
