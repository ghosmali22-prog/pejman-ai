import { useGSAP } from '@gsap/react'
import { Search, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import photo900 from '../assets/hero/pejman-900.webp'
import { PromptCard } from '../features/prompts/PromptCard'
import { gsap, hasFinePointer, ScrollTrigger } from '../lib/motion'
import { useMotion } from '../providers/MotionProvider'
import { useSiteData } from '../providers/SiteDataProvider'

const INSET_START = 0.28

export function Prompts() {
  const { prompts, categories, loading, error } = useSiteData()
  const { level } = useMotion()
  const headRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState('all')
  const [query, setQuery] = useState('')

  const inset = prompts.find((p) => p.featured) ?? prompts[0]
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

  // Giant "PRO[image]MPTS": the image grows from a sliver as you scroll and the letters make room.
  useGSAP(
    () => {
      if (level === 'none' || !headRef.current) return
      const q = gsap.utils.selector(headRef)
      const box = q('.inset-box')[0] as HTMLElement | undefined
      if (!box) return
      const gap = () => (box.offsetWidth * (1 - INSET_START)) / 2
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: headRef.current,
          start: 'top 85%',
          end: 'top 25%',
          scrub: level === 'full' ? 0.8 : true,
          invalidateOnRefresh: true,
        },
        defaults: { ease: 'none' },
      })
      tl.fromTo(box, { scale: INSET_START }, { scale: 1 }, 0)
        .fromTo(q('.inset-left'), { x: gap }, { x: 0 }, 0)
        .fromTo(q('.inset-right'), { x: () => -gap() }, { x: 0 }, 0)
        .fromTo(q('.inset-img'), { scale: 1.5 }, { scale: 1 }, 0)
    },
    { scope: headRef, dependencies: [level, inset?.id] },
  )

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
      if (level === 'none') return
      gsap.set(cards, { autoAlpha: 0, y: 60 })
      ScrollTrigger.batch(cards, {
        start: 'top 92%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.09, ease: 'expo.out', overwrite: true }),
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
    <section id="prompts" data-theme="light" className="bg-paper pb-28 text-ink md:pb-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        {/* Giant heading with image inset */}
        <div ref={headRef} className="pt-6 md:pt-10">
          <span className="mb-4 inline-flex items-center gap-2 text-sm font-medium md:mb-6">
            <span className="size-2 rounded-full bg-lime-2" />
            Prompt library
          </span>
          <h2
            className="display flex items-center justify-center whitespace-nowrap text-[17.5vw] xl:text-[232px]"
            aria-label="Prompts"
          >
            <span className="inset-left inline-block" aria-hidden="true">
              PRO
            </span>
            <span
              className="inset-box relative mx-[0.04em] inline-block h-[0.74em] w-[1.25em] overflow-hidden rounded-[0.12em] bg-paper-2 align-middle"
              aria-hidden="true"
            >
              {!loading && (
                <img
                  src={inset?.image_url ?? photo900}
                  alt=""
                  loading="lazy"
                  className="inset-img absolute inset-0 size-full object-cover grayscale"
                />
              )}
            </span>
            <span className="inset-right inline-block" aria-hidden="true">
              MPTS
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-base text-ink/60 md:mt-6 md:text-lg">
            Every image comes with the exact prompt that made it. Tap a card, copy the prompt, create your own.
          </p>
        </div>

        {/* Filters */}
        <div className="relative z-20 mt-10 py-3 md:sticky md:top-[84px] md:mt-14 md:rounded-full md:bg-paper/85 md:px-2 md:backdrop-blur-md">
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
                </button>
              ))}
            </div>
            <label className="relative flex h-11 items-center md:w-72">
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
            </label>
          </div>
        </div>

        {/* Grid */}
        <div
          ref={gridRef}
          className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 md:mt-10 md:gap-x-6 md:gap-y-12 lg:grid-cols-3"
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
    </section>
  )
}
