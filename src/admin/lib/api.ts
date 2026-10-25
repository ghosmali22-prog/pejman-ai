import { defaultSettings } from '../../config/site'
import { sampleCategories, samplePosts, samplePrompts } from '../../data/samples'
import { IMAGE_BUCKET, supabase } from '../../lib/supabase'
import { mergeSettings } from '../../services/settings'
import type { Category, ContactMessage, DailyCopies, PostRow, PromptRow, SiteSettings, Subscriber } from '../../types'
import type { CompressedImage } from './image'

/**
 * Everything the admin panel reads or writes goes through here.
 * Without Supabase (demo mode) the same calls work on an in-memory copy of the sample data,
 * so the panel can be previewed and tested before the database exists.
 */

export type PromptDraft = Omit<PromptRow, 'id' | 'copy_count' | 'created_at' | 'position' | 'image_url'> & {
  id?: string
  image_url?: string
}

const demo = !supabase
const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const uid = () => crypto.randomUUID()

export type PostDraft = Omit<PostRow, 'id' | 'created_at' | 'published_at' | 'cover_url'> & {
  id?: string
  cover_url?: string
}

const store = {
  prompts: samplePrompts.map<PromptRow>((p, i) => ({ ...p, created_at: days(i * 3) })),
  posts: samplePosts.map<PostRow>((p) => ({ ...p, content: p.excerpt })),
  categories: [...sampleCategories],
  messages: [
    {
      id: uid(),
      name: 'Nina Park',
      email: 'nina@studio.co',
      project_type: 'Motion & Video',
      work_mode: 'Remote',
      budget: '$1,000 – $3,000',
      message: 'Hi Pejman! We need three short AI video ads for our skincare launch next month. Can you send a quote?',
      is_read: false,
      created_at: days(0.2),
    },
    {
      id: uid(),
      name: 'Somchai R.',
      email: 'somchai@cafe-bkk.com',
      project_type: 'Websites',
      work_mode: 'On-site in Bangkok',
      budget: '$300 – $1,000',
      message: 'Looking for a website for my café in Ari, with an online menu. Could we meet in person?',
      is_read: false,
      created_at: days(1.4),
    },
    {
      id: uid(),
      name: 'Leo',
      email: 'leo@brand.io',
      project_type: 'AI Automation',
      work_mode: 'Remote',
      budget: null,
      message: 'Can you automate our Instagram posting and DMs?',
      is_read: true,
      created_at: days(4),
    },
  ] as ContactMessage[],
  subscribers: Array.from({ length: 23 }, (_, i) => ({
    id: uid(),
    email: `fan${i + 1}@example.com`,
    created_at: days(i * 1.7),
  })) as Subscriber[],
  settings: {} as Partial<SiteSettings>,
}

function sb() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

async function run<T>(q: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await q
  if (error) throw error
  return data as T
}

// ---------------------------------------------------------------- auth
export const auth = {
  demo,
  async email(): Promise<string | null> {
    if (demo) return 'ghosmali22@gmail.com'
    const { data } = await sb().auth.getSession()
    return data.session?.user.email ?? null
  },
  onChange(cb: (email: string | null) => void) {
    if (demo) return () => {}
    const { data } = sb().auth.onAuthStateChange((_e, session) => cb(session?.user.email ?? null))
    return () => data.subscription.unsubscribe()
  },
  async signIn() {
    if (demo) return
    await sb().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}admin/`,
        queryParams: { prompt: 'select_account' },
      },
    })
  },
  async signOut() {
    if (demo) return
    await sb().auth.signOut()
  },
}

// ---------------------------------------------------------------- storage
export type UploadedImage = Pick<PromptRow, 'image_url' | 'image_path' | 'image_width' | 'image_height'>

/** Uploads a compressed prompt image to Storage and returns the fields to store on the prompt. */
export async function uploadPromptImage(img: CompressedImage): Promise<UploadedImage> {
  if (demo) {
    return {
      image_url: URL.createObjectURL(img.blob),
      image_path: null,
      image_width: img.width,
      image_height: img.height,
    }
  }
  return uploadImage(img, 'prompts')
}

/** Uploads a compressed blog image (cover or inline picture) and returns its public URL and size. */
export async function uploadBlogImage(img: CompressedImage): Promise<UploadedImage> {
  if (demo) return uploadPromptImage(img)
  return uploadImage(img, 'blog')
}

/** Removes an uploaded image that ended up unused (photo replaced, or editor left without saving). */
export function discardUpload(img?: UploadedImage | null) {
  if (img?.image_path) removeImage(img.image_path).catch(() => {})
}

async function uploadImage(img: CompressedImage, folder: 'prompts' | 'blog'): Promise<UploadedImage> {
  const path = `${folder}/${uid()}.${img.ext}`
  const { error } = await sb()
    .storage.from(IMAGE_BUCKET)
    .upload(path, img.blob, { contentType: img.blob.type, cacheControl: '31536000', upsert: false })
  if (error) throw error
  const { data } = sb().storage.from(IMAGE_BUCKET).getPublicUrl(path)
  return { image_url: data.publicUrl, image_path: path, image_width: img.width, image_height: img.height }
}

async function removeImage(path?: string | null) {
  if (!path || demo) return
  await sb().storage.from(IMAGE_BUCKET).remove([path])
}

// ---------------------------------------------------------------- prompts
export const prompts = {
  async list(): Promise<PromptRow[]> {
    if (demo) return [...store.prompts].sort((a, b) => a.position - b.position)
    return run(
      sb().from('prompts').select('*').order('position', { ascending: true }).order('created_at', { ascending: false }),
    )
  },

  async get(id: string): Promise<PromptRow | null> {
    if (demo) return store.prompts.find((p) => p.id === id) ?? null
    return run(sb().from('prompts').select('*').eq('id', id).maybeSingle())
  },

  /**
   * Creates or updates a prompt. The image is uploaded beforehand (see `uploadPromptImage`,
   * which the editor starts as soon as a photo is picked), so saving is one quick database call.
   * Deletes the replaced image file after a successful update.
   */
  async save(
    draft: PromptDraft,
    opts: { image?: UploadedImage | null; existing?: PromptRow | null; position?: number } = {},
  ): Promise<PromptRow> {
    const { image, existing } = opts
    const { id, ...fields } = draft
    const row = { ...fields, ...(image ?? {}) }

    if (demo) {
      const current = id ? store.prompts.find((p) => p.id === id) : null
      if (current) return Object.assign(current, row)
      const created: PromptRow = {
        ...(row as PromptRow),
        id: uid(),
        copy_count: 0,
        created_at: new Date().toISOString(),
        position: opts.position ?? Math.min(0, ...store.prompts.map((p) => p.position)) - 1,
      }
      store.prompts.push(created)
      return created
    }

    if (id) {
      const saved = await run<PromptRow>(sb().from('prompts').update(row).eq('id', id).select().single())
      if (image && existing?.image_path && existing.image_path !== saved.image_path) {
        removeImage(existing.image_path).catch(() => {})
      }
      return saved
    }
    return run<PromptRow>(
      sb()
        .from('prompts')
        .insert({ ...row, position: opts.position ?? -Date.now() / 1000 })
        .select()
        .single(),
    )
  },

  async update(id: string, patch: Partial<PromptRow>) {
    if (demo) {
      Object.assign(store.prompts.find((p) => p.id === id) ?? {}, patch)
      return
    }
    await run(sb().from('prompts').update(patch).eq('id', id))
  },

  async remove(row: PromptRow) {
    if (demo) {
      store.prompts = store.prompts.filter((p) => p.id !== row.id)
      return
    }
    await run(sb().from('prompts').delete().eq('id', row.id))
    await removeImage(row.image_path).catch(() => {})
  },

  /** Saves a new order: position = index in the given list. */
  async reorder(rows: { id: string; position: number }[]) {
    const changed = rows.map((r, i) => ({ ...r, next: i })).filter((r) => r.position !== r.next)
    if (demo) {
      changed.forEach((r) => Object.assign(store.prompts.find((p) => p.id === r.id) ?? {}, { position: r.next }))
      return
    }
    await Promise.all(changed.map((r) => run(sb().from('prompts').update({ position: r.next }).eq('id', r.id))))
  },
}

// ---------------------------------------------------------------- blog posts
export const posts = {
  async list(): Promise<PostRow[]> {
    if (demo) return [...store.posts].sort((a, b) => b.created_at.localeCompare(a.created_at))
    return run(sb().from('posts').select('*').order('created_at', { ascending: false }))
  },

  /** Creates or updates a post. The cover is uploaded beforehand; a replaced cover file is deleted. */
  async save(draft: PostDraft, opts: { cover?: UploadedImage | null; existing?: PostRow | null } = {}) {
    const { cover, existing } = opts
    const { id, ...fields } = draft
    const row = {
      ...fields,
      ...(cover
        ? {
            cover_url: cover.image_url,
            cover_path: cover.image_path,
            cover_width: cover.image_width,
            cover_height: cover.image_height,
          }
        : {}),
    }

    if (demo) {
      const current = id ? store.posts.find((p) => p.id === id) : null
      if (current) {
        if (row.published && !current.published_at) current.published_at = new Date().toISOString()
        return Object.assign(current, row)
      }
      const now = new Date().toISOString()
      const created = { cover_url: '', ...row, id: uid(), created_at: now, published_at: row.published ? now : null }
      store.posts.push(created as PostRow)
      return created as PostRow
    }

    if (id) {
      const saved = await run<PostRow>(sb().from('posts').update(row).eq('id', id).select().single())
      if (cover && existing?.cover_path && existing.cover_path !== saved.cover_path) {
        removeImage(existing.cover_path).catch(() => {})
      }
      return saved
    }
    return run<PostRow>(sb().from('posts').insert(row).select().single())
  },

  async update(id: string, patch: Partial<PostRow>) {
    if (demo) {
      const p = store.posts.find((x) => x.id === id)
      if (p && patch.published && !p.published_at) p.published_at = new Date().toISOString()
      Object.assign(p ?? {}, patch)
      return
    }
    await run(sb().from('posts').update(patch).eq('id', id))
  },

  async remove(row: PostRow) {
    if (demo) {
      store.posts = store.posts.filter((p) => p.id !== row.id)
      return
    }
    await run(sb().from('posts').delete().eq('id', row.id))
    await removeImage(row.cover_path).catch(() => {})
  },
}

// ---------------------------------------------------------------- categories
export const categories = {
  async list(): Promise<Category[]> {
    if (demo) return [...store.categories].sort((a, b) => a.position - b.position)
    return run(sb().from('categories').select('*').order('position'))
  },
  async create(name: string, slug: string) {
    const position = Math.max(0, ...(await categories.list()).map((c) => c.position)) + 1
    if (demo) {
      store.categories.push({ id: uid(), name, slug, position })
      return
    }
    await run(sb().from('categories').insert({ name, slug, position }))
  },
  async update(id: string, patch: Partial<Category>) {
    if (demo) {
      const c = store.categories.find((x) => x.id === id)
      if (c && patch.slug && patch.slug !== c.slug) {
        store.prompts.forEach((p) => p.category === c.slug && (p.category = patch.slug!))
      }
      Object.assign(c ?? {}, patch)
      return
    }
    await run(sb().from('categories').update(patch).eq('id', id))
  },
  async remove(c: Category) {
    if (demo) {
      store.categories = store.categories.filter((x) => x.id !== c.id)
      store.prompts.forEach((p) => p.category === c.slug && (p.category = ''))
      return
    }
    await run(sb().from('categories').delete().eq('id', c.id))
  },
  async reorder(rows: Category[]) {
    const changed = rows.map((r, i) => ({ ...r, next: i + 1 })).filter((r) => r.position !== r.next)
    if (demo) {
      changed.forEach((r) => Object.assign(store.categories.find((c) => c.id === r.id) ?? {}, { position: r.next }))
      return
    }
    await Promise.all(changed.map((r) => run(sb().from('categories').update({ position: r.next }).eq('id', r.id))))
  },
}

// ---------------------------------------------------------------- messages
export const messages = {
  async list(): Promise<ContactMessage[]> {
    if (demo) return [...store.messages].sort((a, b) => b.created_at.localeCompare(a.created_at))
    return run(sb().from('messages').select('*').order('created_at', { ascending: false }))
  },
  async setRead(id: string, is_read: boolean) {
    if (demo) {
      Object.assign(store.messages.find((m) => m.id === id) ?? {}, { is_read })
      return
    }
    await run(sb().from('messages').update({ is_read }).eq('id', id))
  },
  async remove(id: string) {
    if (demo) {
      store.messages = store.messages.filter((m) => m.id !== id)
      return
    }
    await run(sb().from('messages').delete().eq('id', id))
  },
  async unreadCount(): Promise<number> {
    if (demo) return store.messages.filter((m) => !m.is_read).length
    const { count, error } = await sb()
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)
    if (error) throw error
    return count ?? 0
  },
}

// ---------------------------------------------------------------- subscribers
export const subscribers = {
  async list(): Promise<Subscriber[]> {
    if (demo) return [...store.subscribers]
    return run(sb().from('subscribers').select('*').order('created_at', { ascending: false }))
  },
  async remove(id: string) {
    if (demo) {
      store.subscribers = store.subscribers.filter((s) => s.id !== id)
      return
    }
    await run(sb().from('subscribers').delete().eq('id', id))
  },
}

// ---------------------------------------------------------------- site settings
export const settings = {
  async get(): Promise<SiteSettings> {
    if (demo) return mergeSettings(defaultSettings, store.settings)
    const row = await run<{ data: Partial<SiteSettings> } | null>(
      sb().from('site_settings').select('data').eq('id', 1).maybeSingle(),
    )
    return mergeSettings(defaultSettings, row?.data ?? {})
  },
  async save(data: SiteSettings) {
    if (demo) {
      store.settings = structuredClone(data)
      return
    }
    await run(sb().from('site_settings').upsert({ id: 1, data }))
  },
}

// ---------------------------------------------------------------- stats
export async function dailyCopies(n: number): Promise<DailyCopies[]> {
  if (demo) {
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(Date.now() - (n - 1 - i) * 86_400_000)
      const wave = Math.sin(i / 3) * 6 + Math.sin(i / 11) * 9
      return { day: d.toISOString().slice(0, 10), copies: Math.max(0, Math.round(18 + i * 0.35 + wave)) }
    })
  }
  const rows = await run<{ day: string; copies: number | string }[]>(sb().rpc('admin_daily_copies', { p_days: n }))
  return rows.map((r) => ({ day: String(r.day).slice(0, 10), copies: Number(r.copies) }))
}

// ---------------------------------------------------------------- AI suggestions
export interface AiSuggestion {
  title: string
  category: string
  tags: string[]
}

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = reject
    r.readAsDataURL(blob)
  })

const STOP = new Set([
  'a',
  'an',
  'the',
  'of',
  'in',
  'on',
  'with',
  'and',
  'for',
  'to',
  'at',
  'by',
  'from',
  'shot',
  'photo',
  'image',
])

/** Offline guess used in demo mode (no Supabase / no AI key). */
function demoSuggest(prompt: string, cats: { slug: string; name: string }[]): AiSuggestion {
  const words = prompt
    .toLowerCase()
    .replace(/--\w+\s+\S+/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
  const title = words
    .slice(0, 3)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
  const category = matchCategory('', words, cats)
  return { title: title || 'Untitled Prompt', category, tags: [...new Set(words)].slice(0, 6) }
}

/**
 * Asks the `ai-suggest` Edge Function (Gemini) for a title, category and tags.
 * The thumbnail is sent small (max 512 px) to keep it fast.
 */
export async function aiSuggest(input: {
  prompt: string
  thumbnail?: Blob | null
  categories: { slug: string; name: string }[]
}): Promise<AiSuggestion> {
  if (demo) {
    await new Promise((r) => setTimeout(r, 700))
    return demoSuggest(input.prompt, input.categories)
  }
  const body = {
    prompt: input.prompt,
    image: input.thumbnail ? await blobToBase64(input.thumbnail) : undefined,
    mimeType: input.thumbnail?.type,
    categories: input.categories,
  }
  const { data, error } = await sb().functions.invoke<AiSuggestion & { error?: string }>('ai-suggest', { body })
  if (error) throw error
  if (!data || data.error) throw new Error(data?.error ?? 'No answer')
  return { ...data, category: matchCategory(data.category, [data.title, ...(data.tags ?? [])], input.categories) }
}

/**
 * Makes sure the category is one of yours: accepts "Portrait", "portrait (Portrait)" or a plural,
 * and if the AI left it empty, picks the first category mentioned in the tags or title.
 */
export function matchCategory(raw: string, hints: string[], cats: { slug: string; name: string }[]): string {
  const norm = (v: string) =>
    v
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  const same = (a: string, b: string) => a === b || a === `${b}s` || `${a}s` === b
  const find = (v: string) => {
    const n = norm(v)
    return cats.find((c) => same(n, norm(c.slug)) || same(n, norm(c.name)))?.slug
  }
  const direct = raw ? find(raw) : undefined
  if (direct) return direct
  for (const h of hints) {
    const whole = find(h)
    if (whole) return whole
    for (const word of norm(h).split(' ')) {
      const hit = find(word)
      if (hit) return hit
    }
  }
  return ''
}
