import { isSupabaseConfigured } from '../lib/config'
import { callFunction, rest } from '../lib/rest'
import type { ContactMessageInput } from '../types'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** A problem the visitor can fix or should know about (shown under the form). */
export class ContactError extends Error {}

/**
 * Sends a contact-form message through the "contact" Edge Function, which checks the honeypot,
 * Cloudflare Turnstile and every field again on the server, and rate-limits each visitor.
 * In demo mode (no Supabase) it just pretends to succeed.
 */
export async function sendContactMessage(input: ContactMessageInput): Promise<void> {
  if (!isSupabaseConfigured) {
    await wait(700)
    return
  }
  const res = await callFunction('contact', {
    name: input.name.trim(),
    email: input.email.trim(),
    project_type: input.project_type,
    work_mode: input.work_mode || '',
    budget: input.budget || '',
    message: input.message.trim(),
    company: input.company ?? '',
    turnstileToken: input.turnstileToken ?? '',
  })
  if (res.ok) return
  if (res.status === 429) throw new ContactError('Too many messages from your connection — please try again in an hour or message me directly.')
  if (res.status === 403) throw new ContactError('The human check failed. Please try again.')
  if (res.status === 400) throw new ContactError('Please check your name, email and message.')
  throw new Error(`Contact failed (${res.status})`)
}

/** Adds an email to the newsletter list (rate-limited on the server). Duplicate emails count as success. */
export async function subscribeNewsletter(email: string): Promise<void> {
  if (!isSupabaseConfigured) {
    await wait(600)
    return
  }
  await rest('rpc/subscribe_newsletter', { method: 'POST', body: { p_email: email.trim().toLowerCase() } })
}
