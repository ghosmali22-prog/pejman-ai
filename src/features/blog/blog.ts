import '@fontsource-variable/vazirmatn'
import type { Post } from '../../types'

/** Absolute address of a post (with the trailing slash its prerendered page lives at). */
export const postUrl = (slug: string) =>
  new URL(`blog/${slug}/`, window.location.origin + import.meta.env.BASE_URL).toString()

export const blogUrl = () => new URL('blog/', window.location.origin + import.meta.env.BASE_URL).toString()

export const postPath = (slug: string) => `/blog/${slug}/`

/** "Oct 20, 2026" for English posts, Persian calendar and digits for Persian ones. */
export function postDate(post: Pick<Post, 'lang' | 'published_at' | 'created_at'>) {
  const locale = post.lang === 'fa' ? 'fa-IR-u-ca-persian' : 'en-US'
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(post.published_at ?? post.created_at),
  )
}

export const readTime = (post: Pick<Post, 'lang' | 'reading_minutes'>) =>
  post.lang === 'fa'
    ? `${new Intl.NumberFormat('fa-IR').format(post.reading_minutes)} دقیقه مطالعه`
    : `${post.reading_minutes} min read`

/** Text direction and font props for anything written in the post's language. */
export const langProps = (lang: Post['lang']) =>
  lang === 'fa' ? { dir: 'rtl' as const, lang: 'fa', className: 'fa-text' } : { dir: 'ltr' as const, lang: 'en', className: '' }

/**
 * Prerendered blog pages carry their data in a JSON <script> (see build/blogPages.ts),
 * so the first paint needs no network request. Returns null on other pages.
 */
export function readEmbedded<T>(id: 'blog-posts' | 'blog-post'): T | null {
  try {
    const el = document.getElementById(id)
    return el?.textContent ? (JSON.parse(el.textContent) as T) : null
  } catch {
    return null
  }
}
