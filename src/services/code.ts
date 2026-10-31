import { sampleCodeItems } from '../data/sampleCode'
import { isSupabaseConfigured } from '../lib/config'
import { rest } from '../lib/rest'
import type { CodeItem } from '../types'

/**
 * Published code items, featured first. Read through list_code_items(), which leaves out the
 * code of premium items, so it never reaches a visitor's browser.
 */
export async function fetchCodeItems(): Promise<CodeItem[]> {
  if (!isSupabaseConfigured) return sampleCodeItems
  const rows = await rest<CodeItem[]>('rpc/list_code_items')
  return rows.map((c) => ({ ...c, files: Array.isArray(c.files) ? c.files : [] }))
}

const copiedKey = (id: string) => `pj-code-copied-${id}`

/** True the first time this visitor copies an item in this session. */
export function isFirstCopy(item: CodeItem): boolean {
  try {
    return !sessionStorage.getItem(copiedKey(item.id))
  } catch {
    return true
  }
}

/** Adds 1 to an item's copy counter, once per visitor session (like prompts). */
export async function trackCodeCopy(item: CodeItem): Promise<void> {
  try {
    if (sessionStorage.getItem(copiedKey(item.id))) return
    sessionStorage.setItem(copiedKey(item.id), '1')
  } catch {
    /* storage blocked: still count */
  }
  if (!isSupabaseConfigured) return
  await rest('rpc/increment_code_copy', { method: 'POST', body: { p_id: item.id } })
}
