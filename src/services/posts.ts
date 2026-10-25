import { samplePosts } from '../data/samples'
import { isSupabaseConfigured } from '../lib/config'
import { rest, RestError } from '../lib/rest'
import type { Post } from '../types'

const LIST_FIELDS =
  'id,slug,title,excerpt,lang,cover_url,cover_width,cover_height,cover_alt,tags,reading_minutes,published,published_at,created_at'

const normalize = <T extends Partial<Post>>(p: T) => ({ ...p, tags: p.tags ?? [] })

/** Published posts, newest first (without the body, to keep the list light). */
export async function fetchPosts(): Promise<Post[]> {
  if (!isSupabaseConfigured) return samplePosts
  try {
    const rows = await rest<Post[]>(`posts?select=${LIST_FIELDS}&published=is.true&order=published_at.desc`)
    return rows.map((p) => normalize({ ...p, content_html: '' }))
  } catch (err) {
    // The posts table does not exist yet (002_blog.sql not run): show an empty blog, not an error.
    if (err instanceof RestError && err.status === 404) return []
    throw err
  }
}

/** One published post with its body, or null if it does not exist (or is a draft). */
export async function fetchPost(slug: string): Promise<Post | null> {
  if (!isSupabaseConfigured) return samplePosts.find((p) => p.slug === slug) ?? null
  const rows = await rest<Post[]>(`posts?select=*&published=is.true&slug=eq.${encodeURIComponent(slug)}&limit=1`)
  return rows[0] ? normalize(rows[0]) : null
}
