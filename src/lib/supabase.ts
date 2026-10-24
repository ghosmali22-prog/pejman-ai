import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True once the Supabase URL + anon key are provided via .env / GitHub secrets. */
export const isSupabaseConfigured = Boolean(url && anonKey)

/** `null` while running in demo mode (no Supabase yet). */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

/** The only Google account allowed into /admin (also enforced by Row Level Security). */
export const ADMIN_EMAILS = ['ghosmali22@gmail.com']

export const isAdminEmail = (email?: string | null) => !!email && ADMIN_EMAILS.includes(email.toLowerCase())

export const IMAGE_BUCKET = 'images'
