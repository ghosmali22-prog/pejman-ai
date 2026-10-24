import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { contactLinks } from '../../config/site'
import { useSectionLink, type SectionId } from '../../hooks/useSectionLink'
import { useMotion } from '../../providers/MotionProvider'
import { useSiteData } from '../../providers/SiteDataProvider'
import { InstagramIcon, TelegramIcon, WhatsAppIcon } from '../ui/BrandIcons'

const LINKS: { id: SectionId; label: string }[] = [
  { id: 'prompts', label: 'Prompts' },
  { id: 'about', label: 'About' },
  { id: 'services', label: 'Services' },
  { id: 'contact', label: 'Contact' },
]

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`heading inline-flex items-center gap-1.5 text-[19px] ${className}`}>
      <span className="inline-block size-2.5 rounded-full bg-lime shadow-[0_0_12px_rgb(198_244_50/0.8)]" />
      PEJMAN<span className="text-lime">AI</span>
    </span>
  )
}

export function Navbar() {
  const go = useSectionLink()
  const { lenis } = useMotion()
  const { settings } = useSiteData()
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 24)
      setHidden(y > 400 && y > last + 2)
      if (y < last - 2) setHidden(false)
      last = y
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    lenis?.stop()
    document.body.style.overflow = 'hidden'
    return () => {
      lenis?.start()
      document.body.style.overflow = ''
    }
  }, [open, lenis])

  const handle = (id: SectionId) => {
    setOpen(false)
    // wait one frame so the menu can start closing before scrolling
    requestAnimationFrame(() => go(id))
  }
  const links = contactLinks(settings.contact)

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[100] px-3 pt-3 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-5 sm:pt-4 ${
          hidden && !open ? '-translate-y-[120%]' : 'translate-y-0'
        }`}
      >
        <nav
          aria-label="Main"
          className={`mx-auto flex h-14 max-w-7xl items-center justify-between rounded-full pl-5 pr-2 transition-[background-color,box-shadow,backdrop-filter] duration-500 ${
            scrolled || open
              ? 'bg-ink/75 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.5)] ring-1 ring-white/10 backdrop-blur-xl'
              : 'bg-transparent'
          }`}
        >
          <button
            type="button"
            onClick={() => handle('top')}
            className="text-paper"
            aria-label="PEJMAN AI — back to top"
          >
            <Logo />
          </button>

          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => handle(l.id)}
                  className="rounded-full px-4 py-2 text-sm font-medium text-paper/75 transition-colors hover:text-paper"
                >
                  {l.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handle('contact')}
              className="group hidden h-10 items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-ink transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] sm:inline-flex"
            >
              Work with me
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-paper md:hidden"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[90] flex flex-col bg-ink px-6 pb-10 pt-28 md:hidden"
          >
            <ul className="flex flex-col gap-1">
              {LINKS.map((l, i) => (
                <li key={l.id} className="overflow-hidden">
                  <motion.button
                    type="button"
                    onClick={() => handle(l.id)}
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ duration: 0.7, delay: 0.05 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    className="heading block py-1 text-left text-[15vw] text-paper"
                  >
                    {l.label}
                  </motion.button>
                </li>
              ))}
            </ul>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mt-auto flex flex-col gap-6"
            >
              <button
                type="button"
                onClick={() => handle('contact')}
                className="flex h-14 items-center justify-center gap-2 rounded-full bg-lime text-base font-semibold text-ink"
              >
                Work with me <ArrowRight className="size-5" />
              </button>
              <div className="flex justify-center gap-3">
                {[
                  { href: links.instagram, label: 'Instagram', Icon: InstagramIcon },
                  { href: links.whatsapp, label: 'WhatsApp', Icon: WhatsAppIcon },
                  { href: links.telegram, label: 'Telegram', Icon: TelegramIcon },
                ].map(({ href, label, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="flex size-12 items-center justify-center rounded-full bg-white/10 text-paper"
                  >
                    <Icon className="size-5" />
                  </a>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
