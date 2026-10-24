import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { isSupabaseConfigured, SUPABASE_KEY, SUPABASE_URL } from './config'

export { isSupabaseConfigured }

/**
 * Full Supabase client (auth, storage). Only the admin panel imports this file,
 * so public visitors never download supabase-js. `null` in demo mode.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_KEY!, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

/** The only Google account allowed into /admin (also enforced by Row Level Security). */
export const ADMIN_EMAILS = ['ghosmali22@gmail.com']

export const isAdminEmail = (email?: string | null) => !!email && ADMIN_EMAILS.includes(email.toLowerCase())

export const IMAGE_BUCKET = 'images'
