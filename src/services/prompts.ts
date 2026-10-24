import { sampleCategories, samplePrompts } from '../data/samples'
import { isSupabaseConfigured } from '../lib/config'
import { rest } from '../lib/rest'
import type { Category, Prompt } from '../types'

/** Published prompts, ordered the way the admin arranged them. */
export async function fetchPrompts(): Promise<Prompt[]> {
  if (!isSupabaseConfigured) return samplePrompts
  const rows = await rest<Prompt[]>('prompts?select=*&published=is.true&order=position.asc,created_at.desc')
  return rows.map((p) => ({ ...p, category: p.category ?? '', tags: p.tags ?? [] }))
}

export async function fetchCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured) return sampleCategories
  return rest<Category[]>('categories?select=*&order=position.asc')
}

const copiedKey = (id: string) => `pj-copied-${id}`

/**
 * Adds 1 to a prompt's copy counter (once per visitor session, so spamming
 * the button does not inflate the stats). Runs through a secure database function.
 */
export async function trackCopy(prompt: Prompt): Promise<void> {
  try {
    if (sessionStorage.getItem(copiedKey(prompt.id))) return
    sessionStorage.setItem(copiedKey(prompt.id), '1')
  } catch {
    /* storage blocked: still count */
  }
  if (!isSupabaseConfigured) return
  await rest('rpc/increment_copy_count', { method: 'POST', body: { p_id: prompt.id } })
}
