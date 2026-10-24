import { sampleCategories, samplePrompts } from '../data/samples'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Category, Prompt } from '../types'

/** Published prompts, ordered the way the admin arranged them. */
export async function fetchPrompts(): Promise<Prompt[]> {
  if (!supabase) return samplePrompts
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('published', true)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Prompt[]
}

export async function fetchCategories(): Promise<Category[]> {
  if (!supabase) return sampleCategories
  const { data, error } = await supabase.from('categories').select('*').order('position', { ascending: true })
  if (error) throw error
  return (data ?? []) as Category[]
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
  if (!isSupabaseConfigured || !supabase) return
  await supabase.rpc('increment_copy_count', { prompt_id: prompt.id })
}
