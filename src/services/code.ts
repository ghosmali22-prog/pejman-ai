import { sampleCodeItems, sampleDemoSource } from '../data/sampleCode'
import { isSupabaseConfigured, SUPABASE_URL } from '../lib/config'
import { callFunction, rest } from '../lib/rest'
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

/**
 * The protected live demo of a premium item, as one HTML document for the sandboxed preview.
 * The demo-url function returns a signed link that expires within minutes; the document behind it
 * is an obfuscated, watermarked build — never the item's source.
 */
export async function loadDemo(slug: string): Promise<string> {
  if (!isSupabaseConfigured) {
    // Demo mode (local preview / tests): build the sample demo the same way the admin panel does.
    const { buildDemoDocument, loadObfuscator } = await import('../lib/demoBuild')
    return buildDemoDocument(sampleDemoSource(), slug, await loadObfuscator())
  }
  const res = await callFunction('demo-url', { slug })
  if (res.status === 429) throw new Error('Too many demo requests — please try again in a little while')
  if (!res.ok) throw new Error('Demo unavailable')
  const { url } = (await res.json()) as { url: string }
  if (!url?.startsWith(`${SUPABASE_URL}/storage/v1/object/sign/demos/`)) throw new Error('Demo unavailable')
  const doc = await fetch(url, { cache: 'no-store', referrerPolicy: 'no-referrer' })
  if (!doc.ok) throw new Error('Demo unavailable')
  return doc.text()
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
