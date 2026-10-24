import { supabase } from '../lib/supabase'
import type { ContactMessageInput } from '../types'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Saves a contact-form message. In demo mode (no Supabase) it just pretends to succeed. */
export async function sendContactMessage(input: ContactMessageInput): Promise<void> {
  if (!supabase) {
    await wait(700)
    return
  }
  const { error } = await supabase.from('messages').insert({
    name: input.name.trim(),
    email: input.email.trim(),
    project_type: input.project_type,
    work_mode: input.work_mode || null,
    budget: input.budget || null,
    message: input.message.trim(),
  })
  if (error) throw error
}

/** Adds an email to the newsletter list. Duplicate emails count as success. */
export async function subscribeNewsletter(email: string): Promise<void> {
  if (!supabase) {
    await wait(600)
    return
  }
  const { error } = await supabase.from('subscribers').insert({ email: email.trim().toLowerCase() })
  if (error && error.code !== '23505') throw error
}
