import { ArrowRight, ArrowUpRight, Check, Loader2, Mail } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { FadeIn } from '../components/motion/FadeIn'
import { RevealText } from '../components/motion/RevealText'
import { InstagramIcon, TelegramIcon, WhatsAppIcon } from '../components/ui/BrandIcons'
import { BUDGET_RANGES, contactLinks, PROJECT_TYPES, WORK_MODES } from '../config/site'
import { useSiteData } from '../providers/SiteDataProvider'
import { sendContactMessage } from '../services/contact'

type Status = 'idle' | 'sending' | 'sent' | 'error'

const field =
  'h-14 w-full rounded-2xl bg-paper-2 px-4 text-[16px] text-ink outline-none ring-1 ring-transparent transition placeholder:text-ink/35 focus:bg-paper focus:ring-ink/25'

export function Contact() {
  const { settings } = useSiteData()
  const c = settings.contact
  const links = contactLinks(c)
  const [status, setStatus] = useState<Status>('idle')
  const [projectType, setProjectType] = useState<string>(PROJECT_TYPES[0])
  const [workMode, setWorkMode] = useState<string>(WORK_MODES[0])

  // "Request a quote" buttons in Services pre-select the project type.
  useEffect(() => {
    const onType = (e: Event) => {
      const t = (e as CustomEvent<string>).detail
      if ((PROJECT_TYPES as readonly string[]).includes(t)) setProjectType(t)
    }
    window.addEventListener('pj:project-type', onType)
    return () => window.removeEventListener('pj:project-type', onType)
  }, [])

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    if (data.get('company')) return // honeypot: bots fill hidden fields
    setStatus('sending')
    try {
      await sendContactMessage({
        name: String(data.get('name') ?? ''),
        email: String(data.get('email') ?? ''),
        project_type: projectType,
        work_mode: workMode,
        budget: String(data.get('budget') ?? ''),
        message: String(data.get('message') ?? ''),
      })
      setStatus('sent')
      form.reset()
    } catch {
      setStatus('error')
    }
  }

  const direct = [
    { label: 'Email', value: c.email, href: links.email, Icon: Mail },
    { label: 'WhatsApp', value: c.whatsapp, href: links.whatsapp, Icon: WhatsAppIcon },
    { label: 'Telegram', value: `@${c.telegram.replace(/^@/, '')}`, href: links.telegram, Icon: TelegramIcon },
    { label: 'Instagram', value: `@${c.instagram.replace(/^@/, '')}`, href: links.instagram, Icon: InstagramIcon },
  ]

  return (
    <section id="contact" data-theme="light" className="bg-paper py-28 text-ink md:py-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <span className="mb-5 inline-flex items-center gap-2 text-sm font-medium">
          <span className="size-2 rounded-full bg-lime-2" />
          Work with me
        </span>
        <RevealText text={c.heading} className="heading max-w-4xl text-[48px] sm:text-7xl lg:text-[104px]" />
        <FadeIn>
          <p className="mt-6 max-w-lg text-base text-ink/60 md:text-lg">{c.intro}</p>
        </FadeIn>

        <div className="mt-14 grid gap-10 md:mt-20 lg:grid-cols-12 lg:gap-12">
          <FadeIn className="lg:col-span-7">
            {status === 'sent' ? (
              <div className="flex min-h-[420px] flex-col items-start justify-center rounded-[28px] bg-ink p-8 text-paper md:p-12">
                <span className="flex size-14 items-center justify-center rounded-full bg-lime text-ink">
                  <Check className="size-7" strokeWidth={3} />
                </span>
                <p className="heading mt-8 text-4xl md:text-5xl">Thanks — message received.</p>
                <p className="mt-3 text-paper/60">I'll get back to you within 24 hours.</p>
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="mt-8 h-12 rounded-full bg-white/10 px-6 text-sm font-semibold"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  name="company"
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden="true"
                />
                <label className="sr-only" htmlFor="cf-name">
                  Name
                </label>
                <input
                  id="cf-name"
                  name="name"
                  required
                  maxLength={120}
                  placeholder="Your name"
                  autoComplete="name"
                  className={field}
                />
                <label className="sr-only" htmlFor="cf-email">
                  Email
                </label>
                <input
                  id="cf-email"
                  name="email"
                  type="email"
                  required
                  maxLength={200}
                  placeholder="Email address"
                  autoComplete="email"
                  className={field}
                />

                <ChipGroup label="Project type" options={PROJECT_TYPES} value={projectType} onChange={setProjectType} />
                <ChipGroup label="Where" options={WORK_MODES} value={workMode} onChange={setWorkMode} />

                <label className="sr-only" htmlFor="cf-budget">
                  Budget (optional)
                </label>
                <select
                  id="cf-budget"
                  name="budget"
                  defaultValue=""
                  className={`${field} sm:col-span-2 mt-2 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%230B0D0C' stroke-width='2'%3E%3Cpath d='m6 8 4 4 4-4'/%3E%3C/svg%3E")] bg-[length:20px] bg-[right_1rem_center] bg-no-repeat`}
                >
                  <option value="">Budget range (optional)</option>
                  {BUDGET_RANGES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>

                <label className="sr-only" htmlFor="cf-message">
                  Message
                </label>
                <textarea
                  id="cf-message"
                  name="message"
                  required
                  maxLength={4000}
                  rows={5}
                  placeholder="Tell me about your project, goals and timeline…"
                  className={`${field} h-auto py-4 sm:col-span-2`}
                />

                <div className="mt-2 flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="group flex h-14 items-center justify-center gap-2 rounded-full bg-ink px-8 text-base font-semibold text-paper transition-transform duration-300 active:scale-[0.98] disabled:opacity-60"
                  >
                    {status === 'sending' ? <Loader2 className="size-5 animate-spin" /> : null}
                    {status === 'sending' ? 'Sending…' : 'Send message'}
                    {status !== 'sending' && (
                      <ArrowRight className="size-5 text-lime transition-transform duration-300 group-hover:translate-x-1" />
                    )}
                  </button>
                  {status === 'error' && (
                    <p className="text-sm text-red-600">
                      Something went wrong. Please try again or message me directly.
                    </p>
                  )}
                </div>
              </form>
            )}
          </FadeIn>

          <FadeIn stagger={0.08} className="flex flex-col gap-3 lg:col-span-5">
            {direct.map(({ label, value, href, Icon }) => (
              <a
                key={label}
                href={href}
                target={label === 'Email' ? undefined : '_blank'}
                rel="noreferrer"
                className="group flex items-center gap-4 rounded-[22px] bg-paper-2 p-4 transition-colors duration-300 hover:bg-ink hover:text-paper"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-lime transition-colors duration-300 group-hover:bg-lime group-hover:text-ink">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-current opacity-55">{label}</span>
                  <span className="block truncate text-base font-semibold">{value}</span>
                </span>
                <ArrowUpRight className="size-5 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            ))}
          </FadeIn>
        </div>
      </div>
    </section>
  )
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="sm:col-span-2">
      <p className="mb-2 mt-2 text-sm font-medium text-ink/60">{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={value === t}
            onClick={() => onChange(t)}
            className={`h-11 rounded-full px-4 text-sm font-medium transition-colors duration-300 ${
              value === t ? 'bg-ink text-paper' : 'bg-paper-2 text-ink/70 hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
