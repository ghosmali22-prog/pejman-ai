/** Public Supabase connection values (safe to ship to the browser). */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '')
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True once the Supabase URL + publishable key are provided. Otherwise the site runs on demo data. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY)
