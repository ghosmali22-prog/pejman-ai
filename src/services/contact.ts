import { isSupabaseConfigured } from '../lib/config'
import { rest, RestError } from '../lib/rest'
import type { ContactMessageInput } from '../types'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Saves a contact-form message. In demo mode (no Supabase) it just pretends to succeed. */
export async function sendContactMessage(input: ContactMessageInput): Promise<void> {
  if (!isSupabaseConfigured) {
    await wait(700)
    return
  }
  await rest('messages', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      name: input.name.trim(),
      email: input.email.trim(),
      project_type: input.project_type,
      work_mode: input.work_mode || null,
      budget: input.budget || null,
      message: input.message.trim(),
    },
  })
}

/** Adds an email to the newsletter list. Duplicate emails count as success. */
export async function subscribeNewsletter(email: string): Promise<void> {
  if (!isSupabaseConfigured) {
    await wait(600)
    return
  }
  try {
    await rest('subscribers', { method: 'POST', prefer: 'return=minimal', body: { email: email.trim().toLowerCase() } })
  } catch (e) {
    if (e instanceof RestError && e.code === '23505') return
    throw e
  }
}
