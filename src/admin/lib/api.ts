import { defaultSettings } from '../../config/site'
import { sampleCategories, samplePrompts } from '../../data/samples'
import { IMAGE_BUCKET, supabase } from '../../lib/supabase'
import { mergeSettings } from '../../services/settings'
import type { Category, ContactMessage, DailyCopies, PromptRow, SiteSettings, Subscriber } from '../../types'
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

const store = {
  prompts: samplePrompts.map<PromptRow>((p, i) => ({ ...p, created_at: days(i * 3) })),
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
async function uploadImage(img: CompressedImage) {
  const path = `prompts/${uid()}.${img.ext}`
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

  /** Creates or updates a prompt; uploads the new image first and deletes the replaced one. */
  async save(draft: PromptDraft, image?: CompressedImage | null): Promise<PromptRow> {
    const existing = draft.id ? await prompts.get(draft.id) : null
    let imageFields: Partial<PromptRow> = {}
    if (image) {
      imageFields = demo
        ? {
            image_url: URL.createObjectURL(image.blob),
            image_path: null,
            image_width: image.width,
            image_height: image.height,
          }
        : await uploadImage(image)
    }
    const { id, ...fields } = draft
    const row = { ...fields, ...imageFields }

    if (demo) {
      if (existing) {
        Object.assign(existing, row)
        return existing
      }
      const created: PromptRow = {
        ...(row as PromptRow),
        id: uid(),
        copy_count: 0,
        created_at: new Date().toISOString(),
        position: Math.min(0, ...store.prompts.map((p) => p.position)) - 1,
      }
      store.prompts.push(created)
      return created
    }

    if (existing && id) {
      const saved = await run<PromptRow>(sb().from('prompts').update(row).eq('id', id).select().single())
      if (image && existing.image_path && existing.image_path !== saved.image_path) {
        await removeImage(existing.image_path).catch(() => {})
      }
      return saved
    }
    const { data: first } = await sb().from('prompts').select('position').order('position').limit(1).maybeSingle()
    const position = Math.min(0, (first?.position as number | undefined) ?? 0) - 1
    try {
      return await run<PromptRow>(
        sb()
          .from('prompts')
          .insert({ ...row, position })
          .select()
          .single(),
      )
    } catch (e) {
      // Don't leave an orphaned upload behind if the row could not be saved.
      if (imageFields.image_path) await removeImage(imageFields.image_path).catch(() => {})
      throw e
    }
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
