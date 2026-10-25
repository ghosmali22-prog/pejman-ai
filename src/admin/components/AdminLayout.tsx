import { AnimatePresence, motion } from 'framer-motion'
import {
  ExternalLink,
  Image as ImageIcon,
  Inbox,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  Plus,
  Settings,
  Tags,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Logo } from '../../components/layout/Navbar'
import * as api from '../lib/api'
import { useAdmin } from '../lib/context'
import { useI18n } from '../lib/i18n'
import { cx } from './ui'

interface Item {
  to: string
  label: string
  Icon: LucideIcon
  badge?: number
}

export function AdminLayout() {
  const { t, toggle, dir } = useI18n()
  const { unread, email } = useAdmin()
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  // Form pages have their own big Save button at the bottom, so the tab bar steps aside.
  const formPage = /^\/admin\/((prompts|blog)\/[^/]+|settings)\/?$/.test(location.pathname)

  useEffect(() => {
    setMoreOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])

  const main: Item[] = [
    { to: '/admin', label: t.dashboard, Icon: LayoutDashboard },
    { to: '/admin/prompts', label: t.prompts, Icon: ImageIcon },
    { to: '/admin/categories', label: t.categories, Icon: Tags },
    { to: '/admin/blog', label: t.blog, Icon: Newspaper },
  ]
  const manage: Item[] = [
    { to: '/admin/messages', label: t.messages, Icon: Inbox, badge: unread },
    { to: '/admin/subscribers', label: t.subscribers, Icon: Users },
    { to: '/admin/settings', label: t.settings, Icon: Settings },
  ]

  const navItem = (it: Item) => (
    <NavLink
      key={it.to}
      to={it.to}
      end={it.to === '/admin'}
      className={({ isActive }) =>
        cx(
          'group flex h-11 items-center gap-3 rounded-2xl px-3.5 text-sm font-medium transition-colors',
          isActive ? 'bg-white/[0.07] text-paper' : 'text-paper/55 hover:bg-white/[0.04] hover:text-paper',
        )
      }
    >
      {({ isActive }) => (
        <>
          <it.Icon className={cx('size-[18px]', isActive && 'text-lime')} />
          <span className="flex-1">{it.label}</span>
          {it.badge ? (
            <span className="min-w-6 rounded-full bg-lime px-1.5 py-0.5 text-center text-[11px] font-bold text-ink">
              {it.badge}
            </span>
          ) : null}
          {isActive ? <span className="h-5 w-1 rounded-full bg-lime ltr:-mr-3.5 rtl:-ml-3.5" /> : null}
        </>
      )}
    </NavLink>
  )

  return (
    <div className="min-h-svh lg:flex">
      {/* Desktop sidebar (sits on the right in Persian, left in English) */}
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-white/[0.07] px-4 py-6 lg:flex ltr:border-r rtl:border-l">
        <Link to="/admin" className="flex items-center gap-3 px-2" dir="ltr">
          <span className="flex size-10 items-center justify-center rounded-xl bg-paper text-lg font-black text-ink">
            P
          </span>
          <span className="flex flex-col">
            <Logo className="text-[17px]" />
            <span className="text-xs text-paper/45">{t.brand}</span>
          </span>
        </Link>
        <p className="mb-2 mt-8 px-3.5 text-xs text-paper/35">{t.main}</p>
        <nav className="flex flex-col gap-1">{main.map(navItem)}</nav>
        <p className="mb-2 mt-6 px-3.5 text-xs text-paper/35">{t.manage}</p>
        <nav className="flex flex-col gap-1">{manage.map(navItem)}</nav>

        <div className="relative mt-auto overflow-hidden rounded-3xl bg-ink-2 p-4 ring-1 ring-white/[0.07]">
          <div
            aria-hidden="true"
            className="absolute -top-10 size-32 rounded-full bg-lime/20 blur-3xl ltr:-right-10 rtl:-left-10"
          />
          <p className="relative text-sm font-semibold">PEJMAN AI</p>
          <p className="relative mt-1 text-xs text-paper/50">{t.overview}</p>
          <a
            href={import.meta.env.BASE_URL}
            target="_blank"
            rel="noreferrer"
            className="relative mt-3 flex h-10 items-center justify-center gap-2 rounded-full bg-paper text-[13px] font-semibold text-ink"
          >
            {t.viewSite} <ExternalLink className="size-3.5" />
          </a>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header
          className="sticky top-0 z-40 border-b border-white/[0.07] bg-ink/80 backdrop-blur-xl"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-8">
            <Link to="/admin" className="lg:hidden" dir="ltr">
              <Logo />
            </Link>
            <span className="hidden text-sm text-paper/45 lg:block">{email}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggle}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.06] px-3.5 text-[13px] font-medium text-paper/80 ring-1 ring-white/10"
              >
                <Languages className="size-4" /> {t.language}
              </button>
              <a
                href={import.meta.env.BASE_URL}
                target="_blank"
                rel="noreferrer"
                aria-label={t.viewSite}
                className="hidden size-10 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10 sm:flex"
              >
                <ExternalLink className="size-4" />
              </a>
              <button
                type="button"
                onClick={() => api.auth.signOut()}
                title={t.signOut}
                className="hidden h-10 items-center gap-2 rounded-full bg-white/[0.06] ps-1 pe-3 text-[13px] ring-1 ring-white/10 sm:flex"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-lime text-sm font-bold text-ink">
                  P
                </span>
                <LogOut className="size-4 text-paper/60" />
              </button>
            </div>
          </div>
          {api.auth.demo && (
            <div className="bg-lime/10 px-4 py-2 text-center text-xs font-medium text-lime">{t.demoBanner}</div>
          )}
        </header>

        <main
          className={cx('relative mx-auto max-w-6xl px-4 pt-6 md:px-8 md:pt-8 lg:pb-16', formPage ? 'pb-8' : 'pb-32')}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-24 -z-0 h-72 bg-[radial-gradient(50%_60%_at_50%_0%,rgb(198_244_50/0.07),transparent)]"
          />
          <div className="relative">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className={cx(
          'fixed inset-x-3 bottom-3 z-50 h-[68px] items-center justify-around rounded-[26px] bg-ink-2/90 px-2 ring-1 ring-white/10 backdrop-blur-xl lg:hidden',
          formPage ? 'hidden' : 'flex',
        )}
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Admin"
      >
        <BottomLink to="/admin" end Icon={LayoutDashboard} label={t.dashboard} />
        <BottomLink to="/admin/prompts" Icon={ImageIcon} label={t.prompts} />
        <Link
          to="/admin/prompts/new"
          aria-label={t.addPrompt}
          className="-mt-8 flex size-16 items-center justify-center rounded-full bg-lime text-ink shadow-[0_10px_30px_-6px_rgb(198_244_50/0.6)] ring-4 ring-ink"
        >
          <Plus className="size-7" strokeWidth={2.4} />
        </Link>
        <BottomLink to="/admin/messages" Icon={Inbox} label={t.messages} badge={unread} />
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex w-16 flex-col items-center gap-1 text-[11px] text-paper/55"
        >
          <Menu className="size-5" />
          {t.more}
        </button>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end bg-black/60 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMoreOpen(false)}
          >
            <motion.div
              dir={dir}
              className="w-full rounded-t-[28px] bg-ink-2 p-4 pb-8 ring-1 ring-white/10"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between px-2">
                <span className="text-sm text-paper/50" dir="ltr">
                  {email}
                </span>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="flex size-10 items-center justify-center rounded-full bg-white/[0.06]"
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[...main.slice(2), ...manage.slice(1)].map((it) => (
                  <Link
                    key={it.to}
                    to={it.to}
                    className="flex h-20 flex-col justify-center gap-2 rounded-2xl bg-white/[0.04] px-4 ring-1 ring-white/[0.07]"
                  >
                    <it.Icon className="size-5 text-lime" />
                    <span className="text-sm font-medium">{it.label}</span>
                  </Link>
                ))}
                <a
                  href={import.meta.env.BASE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-20 flex-col justify-center gap-2 rounded-2xl bg-white/[0.04] px-4 ring-1 ring-white/[0.07]"
                >
                  <ExternalLink className="size-5 text-lime" />
                  <span className="text-sm font-medium">{t.viewSite}</span>
                </a>
              </div>
              <button
                type="button"
                onClick={() => api.auth.signOut()}
                className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red-500/10 text-sm font-semibold text-red-300"
              >
                <LogOut className="size-4" /> {t.signOut}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BottomLink({
  to,
  Icon,
  label,
  badge,
  end,
}: {
  to: string
  Icon: LucideIcon
  label: string
  badge?: number
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx('relative flex w-16 flex-col items-center gap-1 text-[11px]', isActive ? 'text-lime' : 'text-paper/55')
      }
    >
      <Icon className="size-5" />
      <span className="max-w-full truncate">{label}</span>
      {badge ? (
        <span className="absolute -top-1.5 start-9 min-w-5 rounded-full bg-lime px-1 text-center text-[10px] font-bold text-ink">
          {badge}
        </span>
      ) : null}
    </NavLink>
  )
}
