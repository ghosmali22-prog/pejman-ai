import { useGSAP } from '@gsap/react'
import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RevealText } from '../components/motion/RevealText'
import { PromptCard } from '../features/prompts/PromptCard'
import { PromptModal } from '../features/prompts/PromptModal'
import { gsap, hasFinePointer, ScrollTrigger } from '../lib/motion'
import { useMotion } from '../providers/MotionProvider'
import { useSiteData } from '../providers/SiteDataProvider'

/**
 * The prompt library: every prompt with category filters and search.
 * Also stays mounted underneath /p/:slug so a prompt opens as an overlay on top of it.
 */
export function PromptsPage() {
  const { prompts, categories, loading, error } = useSiteData()
  const { level } = useMotion()
  const gridRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const active = params.get('c') ?? 'all'

  const setActive = (slug: string) =>
    setParams(
      (p) => {
        if (slug === 'all') p.delete('c')
        else p.set('c', slug)
        return p
      },
      { replace: true, preventScrollReset: true },
    )

  useEffect(() => {
    document.title = 'Prompt library · PEJMAN AI'
    return () => {
      document.title = 'PEJMAN AI — AI photos, motion, websites & automations · AI prompts'
    }
  }, [])

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.slug, c.name])), [categories])
  // Only show chips for categories that actually have prompts.
  const usedCategories = useMemo(
    () => categories.filter((c) => prompts.some((p) => p.category === c.slug)),
    [categories, prompts],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return prompts.filter((p) => {
      if (active !== 'all' && p.category !== active) return false
      if (!q) return true
      return [p.title, p.prompt, p.model, p.category, ...(p.tags ?? [])].join(' ').toLowerCase().includes(q)
    })
  }, [prompts, active, query])
  const filterKey = `${active}|${query}|${filtered.map((p) => p.id).join(',')}`

  // Cards fade + rise in batches; images drift inside their frames.
  useGSAP(
    () => {
      if (!gridRef.current) return
      const cards = gsap.utils.toArray<HTMLElement>('.prompt-card', gridRef.current)
      if (!hasFinePointer()) {
        cards.forEach((card) =>
          ScrollTrigger.create({ trigger: card, start: 'top 65%', end: 'bottom 35%', toggleClass: 'is-active' }),
        )
      }
      if (level === 'none' || cards.length === 0) return
      gsap.set(cards, { autoAlpha: 0, y: 60 })
      ScrollTrigger.batch(cards, {
        start: 'top 95%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.08, ease: 'expo.out', overwrite: true }),
      })
      if (level === 'full') {
        cards.forEach((card) => {
          const inner = card.querySelector('.prompt-parallax')
          if (!inner) return
          gsap.fromTo(
            inner,
            { yPercent: -5 },
            {
              yPercent: 5,
              ease: 'none',
              scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true },
            },
          )
        })
      }
      requestAnimationFrame(() => ScrollTrigger.refresh())
    },
    { scope: gridRef, dependencies: [level, filterKey], revertOnUpdate: true },
  )

  return (
    <>
      <main className="min-h-svh bg-paper text-ink">
        {/* Header */}
        <header className="relative overflow-hidden bg-ink pb-14 pt-32 text-paper md:pb-20 md:pt-44">
          <div aria-hidden="true" className="lime-glow pointer-events-none absolute inset-x-0 bottom-0 h-64" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
            <span className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-paper/70">
              <span className="size-2 rounded-full bg-lime" />
              {loading ? 'Prompt library' : `${prompts.length} prompts · ${usedCategories.length} categories`}
            </span>
            <RevealText as="h1" text={'Prompt\nlibrary'} className="display text-[22vw] md:text-[180px]" />
            <p className="mt-6 max-w-lg text-base text-paper/60 md:text-lg">
              Pick an image, copy the exact prompt behind it and make it your own.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 pb-28 sm:px-6 md:px-8 md:pb-40">
          {/* Filters */}
          <div className="sticky top-[76px] z-20 -mx-4 bg-paper/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:mt-6 sm:rounded-full sm:px-2 md:top-[84px]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div
                className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
                role="tablist"
                aria-label="Categories"
              >
                {[{ slug: 'all', name: 'All' }, ...usedCategories].map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    role="tab"
                    aria-selected={active === c.slug}
                    onClick={() => setActive(c.slug)}
                    className={`h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors duration-300 ${
                      active === c.slug ? 'bg-ink text-paper' : 'bg-paper-2 text-ink/70 hover:text-ink'
                    }`}
                  >
                    {c.name}
                    {c.slug !== 'all' && (
                      <span className="ms-1.5 opacity-50">{prompts.filter((p) => p.category === c.slug).length}</span>
                    )}
                  </button>
                ))}
              </div>
              <label className="relative hidden h-11 items-center md:flex md:w-72">
                <SearchInput query={query} setQuery={setQuery} />
              </label>
            </div>
          </div>
          <label className="relative mt-2 flex h-11 items-center md:hidden">
            <SearchInput query={query} setQuery={setQuery} />
          </label>

          {/* Grid */}
          <div
            ref={gridRef}
            className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 md:mt-10 md:gap-x-6 md:gap-y-12 lg:grid-cols-3"
          >
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] animate-pulse rounded-[20px] bg-paper-2 md:rounded-[24px]" />
              ))}
            {!loading &&
              filtered.map((p) => (
                <PromptCard key={p.id} prompt={p} categoryName={categoryName.get(p.category) ?? p.category} />
              ))}
          </div>

          {!loading && filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="heading text-3xl">
                {error ?? (prompts.length === 0 ? 'New prompts are coming soon.' : 'No prompts found.')}
              </p>
              {!error && prompts.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActive('all')
                    setQuery('')
                  }}
                  className="mt-6 h-11 rounded-full bg-ink px-6 text-sm font-semibold text-paper"
                >
                  Show all prompts
                </button>
              )}
            </div>
          )}
        </div>
      </main>
      <PromptModal />
    </>
  )
}

function SearchInput({ query, setQuery }: { query: string; setQuery: (v: string) => void }) {
  return (
    <>
      <Search className="pointer-events-none absolute left-4 size-4 text-ink/40" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search prompts…"
        aria-label="Search prompts"
        className="size-full rounded-full bg-paper-2 pl-10 pr-10 text-[16px] text-ink outline-none ring-1 ring-transparent transition placeholder:text-ink/40 focus:ring-ink/20 md:text-sm"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery('')}
          aria-label="Clear search"
          className="absolute right-2 flex size-7 items-center justify-center rounded-full text-ink/50 hover:bg-ink/5"
        >
          <X className="size-4" />
        </button>
      )}
    </>
  )
}
