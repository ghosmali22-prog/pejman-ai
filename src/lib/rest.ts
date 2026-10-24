import { SUPABASE_KEY, SUPABASE_URL } from './config'

/**
 * Tiny Supabase REST client for the public website.
 * Visitors never sign in, so plain `fetch` is enough: it is much lighter than supabase-js
 * (which only the admin panel loads) and cannot get stuck waiting on an auth session.
 * Every request gives up after `timeout` ms instead of spinning forever.
 */
export class RestError extends Error {
  status: number
  code?: string
  constructor(status: number, code: string | undefined, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function rest<T = unknown>(
  path: string,
  {
    method = 'GET',
    body,
    prefer,
    timeout = 12_000,
  }: { method?: string; body?: unknown; prefer?: string; timeout?: number } = {},
): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase is not configured')
  const headers: Record<string, string> = { apikey: SUPABASE_KEY, Accept: 'application/json' }
  // Legacy JWT keys also go in Authorization; new sb_publishable_ keys must not.
  if (SUPABASE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_KEY}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (prefer) headers.Prefer = prefer

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { code?: string; message?: string }
      throw new RestError(res.status, err.code, err.message ?? res.statusText)
    }
    if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T
    const text = await res.text()
    return (text ? JSON.parse(text) : undefined) as T
  } finally {
    window.clearTimeout(timer)
  }
}
