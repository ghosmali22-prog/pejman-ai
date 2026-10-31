import { useGSAP } from '@gsap/react'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { FadeIn } from '../components/motion/FadeIn'
import { RevealText } from '../components/motion/RevealText'
import { CodeCard } from '../features/code/CodeCard'
import { useSectionLink } from '../hooks/useSectionLink'
import { gsap, ScrollTrigger } from '../lib/motion'
import { useMotion } from '../providers/MotionProvider'
import { useSiteData } from '../providers/SiteDataProvider'

/** Cards shown before "Show all". */
const FIRST = 6

/**
 * The top section of the home page: ready-made UI code with category chips.
 * Featured items come first (the database already sorts them that way).
 */
export function CodeShowcase() {
  const { codeItems: items, loading } = useSiteData()
  const { level } = useMotion()
  const go = useSectionLink()
  const gridRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState('all')
  const [expanded, setExpanded] = useState(false)

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    items.forEach((c) => c.category && counts.set(c.category, (counts.get(c.category) ?? 0) + 1))
    return [...counts.entries()]
  }, [items])
  const filtered = useMemo(
    () => (active === 'all' ? items : items.filter((c) => c.category === active)),
    [items, active],
  )
  const shown = expanded ? filtered : filtered.slice(0, FIRST)
  const filterKey = `${active}|${expanded}|${shown.map((c) => c.id).join(',')}`

  // Cards rise in a stagger as they enter, like the prompt library.
  useGSAP(
    () => {
      if (level === 'none' || !gridRef.current) return
      const cards = gsap.utils.toArray<HTMLElement>('.code-card', gridRef.current)
      if (!cards.length) return
      gsap.set(cards, { autoAlpha: 0, y: 50 })
      ScrollTrigger.batch(cards, {
        start: 'top 92%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.09, ease: 'expo.out', overwrite: true }),
      })
      requestAnimationFrame(() => ScrollTrigger.refresh())
    },
    { scope: gridRef, dependencies: [level, filterKey], revertOnUpdate: true },
  )

  return (
    <section id="code" data-theme="dark" className="relative overflow-hidden bg-ink pb-24 pt-8 text-paper md:pb-36 md:pt-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_0%,rgb(198_244_50/0.10),transparent_70%)]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.04)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(70%_50%_at_50%_10%,black,transparent)]"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-sm font-medium text-paper/75 ring-1 ring-white/10 md:mb-6">
          <span className="size-2 rounded-full bg-lime shadow-[0_0_10px_rgb(198_244_50/0.9)]" />
          Ready-made UI code
        </span>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h2 className="display text-[22vw] leading-[0.85] md:text-[180px] xl:text-[210px]" aria-label="Code">
            <span aria-hidden="true">
              CODE<span className="text-lime motion-safe:animate-pulse">_</span>
            </span>
          </h2>
          <RevealText
            as="p"
            text="Copy-and-paste dashboards, landing sections, glass UI and animations. Preview them live, copy in one tap — or let me build the whole site for you."
            className="max-w-md text-base leading-relaxed text-paper/60 md:pb-6 md:text-lg"
            stagger={0.015}
          />
        </div>

        {/* Category chips */}
        {categories.length > 1 && (
          <div className="no-scrollbar -mx-4 mt-10 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 md:mt-14" role="tablist" aria-label="Code categories">
            {[['all', items.length] as const, ...categories].map(([name, n]) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={active === name}
                onClick={() => {
                  setActive(name)
                  setExpanded(false)
                }}
                className={`h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors duration-300 ${
                  active === name
                    ? 'bg-lime text-ink'
                    : 'bg-white/[0.05] text-paper/70 ring-1 ring-white/10 backdrop-blur hover:bg-white/10 hover:text-paper'
                }`}
              >
                {name === 'all' ? 'All' : name}
                <span className="ms-1.5 opacity-50">{n}</span>
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div
          ref={gridRef}
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3 ${categories.length > 1 ? 'mt-6 md:mt-8' : 'mt-10 md:mt-14'}`}
        >
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[340px] animate-pulse rounded-[26px] bg-white/[0.04] ring-1 ring-white/[0.06]" />
            ))}
          {!loading && shown.map((c) => <CodeCard key={c.id} item={c} />)}
        </div>

        {!loading && items.length === 0 && (
          <div className="rounded-[26px] bg-white/[0.03] px-6 py-14 text-center ring-1 ring-white/[0.08]">
            <p className="heading text-3xl">First code drops are coming soon.</p>
            <p className="mx-auto mt-3 max-w-md text-paper/55">Need a website or a custom UI right now? I build those too.</p>
            <button
              type="button"
              onClick={() => go('contact')}
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-lime px-6 font-semibold text-ink"
            >
              Work with me <ArrowRight className="size-4" />
            </button>
          </div>
        )}

        {!loading && filtered.length > FIRST && !expanded && (
          <FadeIn className="mt-8 flex justify-center md:mt-12">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="group inline-flex h-14 items-center gap-2 rounded-full bg-white/[0.07] px-7 text-base font-semibold text-paper ring-1 ring-white/15 backdrop-blur transition-colors duration-300 hover:bg-white/[0.12]"
            >
              Show all code
              <span className="rounded-full bg-lime px-2 py-0.5 text-sm text-ink">{filtered.length}</span>
              <ArrowDown className="size-5 transition-transform duration-300 group-hover:translate-y-0.5" />
            </button>
          </FadeIn>
        )}
      </div>
    </section>
  )
}
