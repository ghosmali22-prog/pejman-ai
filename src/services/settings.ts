import { defaultSettings } from '../config/site'
import { supabase } from '../lib/supabase'
import type { SiteSettings } from '../types'

type Plain = Record<string, unknown>
const isPlain = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Deep-merges saved settings over the defaults so new fields always have a value. */
export function mergeSettings<T>(base: T, override: unknown): T {
  if (!isPlain(base) || !isPlain(override)) return (override ?? base) as T
  const out: Plain = { ...base }
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = isPlain(out[k]) && isPlain(v) ? mergeSettings(out[k], v) : v
  }
  return out as T
}

export async function fetchSettings(): Promise<SiteSettings> {
  if (!supabase) return defaultSettings
  const { data, error } = await supabase.from('site_settings').select('data').eq('id', 1).maybeSingle()
  if (error || !data) return defaultSettings
  return mergeSettings(defaultSettings, data.data)
}
