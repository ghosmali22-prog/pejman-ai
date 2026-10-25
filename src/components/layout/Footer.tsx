import { ArrowRight, Check, Loader2, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { contactLinks } from '../../config/site'
import { useSectionLink, type SectionId } from '../../hooks/useSectionLink'
import { useSiteData } from '../../providers/SiteDataProvider'
import { subscribeNewsletter } from '../../services/contact'
import { InstagramIcon, TelegramIcon, WhatsAppIcon } from '../ui/BrandIcons'

export function Footer() {
  const { settings, categories, prompts } = useSiteData()
  const go = useSectionLink()
  const links = contactLinks(settings.contact)
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  const onSubscribe = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email') ?? '')
    setState('sending')
    try {
      await subscribeNewsletter(email)
      setState('done')
    } catch {
      setState('error')
    }
  }

  const explore: { id: SectionId; label: string }[] = [
    { id: 'prompts', label: 'Prompts' },
    { id: 'blog', label: 'Blog' },
    { id: 'about', label: 'About' },
    { id: 'services', label: 'Services' },
    { id: 'contact', label: 'Contact' },
  ]
  const socials = [
    { label: 'Instagram', href: links.instagram, Icon: InstagramIcon },
    { label: 'WhatsApp', href: links.whatsapp, Icon: WhatsAppIcon },
    { label: 'Telegram', href: links.telegram, Icon: TelegramIcon },
    { label: 'Email', href: links.email, Icon: Mail },
  ]

  return (
    <footer data-theme="dark" className="relative overflow-hidden bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-24 sm:px-6 md:px-8 md:pt-32">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="heading text-[40px] sm:text-5xl lg:text-6xl">{settings.footer.newsletter}</p>
            {state === 'done' ? (
              <p className="mt-8 inline-flex items-center gap-2 rounded-full bg-lime px-5 py-3 font-semibold text-ink">
                <Check className="size-5" /> You're in. See you next week!
              </p>
            ) : (
              <form
                onSubmit={onSubscribe}
                className="mt-8 flex max-w-md gap-2 rounded-full bg-white/8 p-1.5 ring-1 ring-white/10 focus-within:ring-lime/60"
              >
                <label htmlFor="nl-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="nl-email"
                  name="email"
                  type="email"
                  required
                  placeholder="your@email.com"
                  className="min-w-0 flex-1 bg-transparent pl-4 text-[16px] text-paper outline-none placeholder:text-paper/35"
                />
                <button
                  type="submit"
                  disabled={state === 'sending'}
                  aria-label="Subscribe"
                  className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-ink"
                >
                  {state === 'sending' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowRight className="size-4" />
                  )}
                  <span className="hidden sm:inline">Subscribe</span>
                </button>
              </form>
            )}
            {state === 'error' && <p className="mt-3 text-sm text-red-400">Could not subscribe. Please try again.</p>}
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-6">
            <div>
              <p className="mb-4 text-sm text-paper/45">Explore</p>
              <ul className="flex flex-col gap-2.5">
                {explore.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => go(l.id)}
                      className="text-[15px] text-paper/85 transition-colors hover:text-lime"
                    >
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-4 text-sm text-paper/45">Categories</p>
              <ul className="flex flex-col gap-2.5">
                {categories
                  .filter((c) => !prompts.length || prompts.some((p) => p.category === c.slug))
                  .slice(0, 5)
                  .map((c) => (
                    <li key={c.slug}>
                      <Link
                        to={`/prompts?c=${c.slug}`}
                        className="text-[15px] text-paper/85 transition-colors hover:text-lime"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="mb-4 text-sm text-paper/45">Connect</p>
              <div className="flex gap-2">
                {socials.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target={label === 'Email' ? undefined : '_blank'}
                    rel="noreferrer"
                    aria-label={label}
                    className="flex size-11 items-center justify-center rounded-full bg-white/8 text-paper ring-1 ring-white/10 transition-colors duration-300 hover:bg-lime hover:text-ink"
                  >
                    <Icon className="size-[18px]" />
                  </a>
                ))}
              </div>
              <p className="mt-5 text-sm text-paper/50">{settings.hero.location}</p>
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="display mt-20 select-none text-center text-[21vw] leading-[0.8] text-white/[0.06] md:mt-28 xl:text-[280px]"
        >
          PEJMAN AI
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-sm text-paper/45 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} PEJMAN AI. All rights reserved.</p>
          <button type="button" onClick={() => go('top')} className="flex items-center gap-2 hover:text-paper">
            Back to top ↑
          </button>
        </div>
      </div>
    </footer>
  )
}
