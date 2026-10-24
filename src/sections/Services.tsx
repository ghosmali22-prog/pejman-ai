import { useGSAP } from '@gsap/react'
import { ArrowRight, Check } from 'lucide-react'
import { useRef } from 'react'
import { FadeIn } from '../components/motion/FadeIn'
import { RevealText } from '../components/motion/RevealText'
import { useSectionLink } from '../hooks/useSectionLink'
import { gsap, hasFinePointer } from '../lib/motion'
import { useMotion } from '../providers/MotionProvider'
import { useSiteData } from '../providers/SiteDataProvider'

export function Services() {
  const { settings } = useSiteData()
  const { level } = useMotion()
  const go = useSectionLink()
  const gridRef = useRef<HTMLDivElement>(null)
  const { heading, intro, items } = settings.services

  // Gentle 3D tilt that follows the cursor (desktop only).
  useGSAP(
    (_, contextSafe) => {
      if (level !== 'full' || !hasFinePointer() || !gridRef.current || !contextSafe) return
      const cleanups = gsap.utils.toArray<HTMLElement>('.service-card', gridRef.current).map((card) => {
        gsap.set(card, { transformPerspective: 900 })
        const rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' })
        const ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' })
        const move = contextSafe((e: PointerEvent) => {
          const r = card.getBoundingClientRect()
          ry(((e.clientX - r.left) / r.width - 0.5) * 8)
          rx(-((e.clientY - r.top) / r.height - 0.5) * 8)
        })
        const leave = contextSafe(() => {
          rx(0)
          ry(0)
        })
        card.addEventListener('pointermove', move)
        card.addEventListener('pointerleave', leave)
        return () => {
          card.removeEventListener('pointermove', move)
          card.removeEventListener('pointerleave', leave)
        }
      })
      return () => cleanups.forEach((c) => c())
    },
    { scope: gridRef, dependencies: [level, items.length] },
  )

  return (
    <section id="services" data-theme="dark" className="relative bg-ink py-28 text-paper md:py-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <span className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-paper/70">
              <span className="size-2 rounded-full bg-lime" />
              Services
            </span>
            <RevealText text={heading} className="heading text-[44px] sm:text-6xl lg:text-[80px]" />
          </div>
          <FadeIn className="md:col-span-5 md:pb-3">
            <p className="text-base leading-relaxed text-paper/60 md:text-lg">{intro}</p>
          </FadeIn>
        </div>

        <FadeIn stagger={0.12} className="mt-14 grid gap-4 md:mt-20 md:grid-cols-3 md:gap-5">
          {items.map((s, i) => {
            const highlight = i === 1
            return (
              <div key={s.title} className="h-full">
                <article
                  className={`service-card relative flex h-full flex-col overflow-hidden rounded-[28px] p-6 will-change-transform md:p-8 ${
                    highlight
                      ? 'bg-[linear-gradient(160deg,#d8ff5c_0%,#c6f432_45%,#9fce12_100%)] text-ink shadow-[0_30px_80px_-30px_rgb(198_244_50/0.55)]'
                      : 'bg-ink-2 text-paper ring-1 ring-white/8'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${highlight ? 'text-ink/70' : 'text-paper/50'}`}>
                      0{i + 1}
                    </span>
                    {highlight && (
                      <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-lime">
                        Most requested
                      </span>
                    )}
                  </div>
                  <h3 className="heading mt-10 text-4xl md:text-[44px]">{s.title}</h3>
                  <p className={`mt-3 text-[15px] leading-relaxed ${highlight ? 'text-ink/75' : 'text-paper/60'}`}>
                    {s.description}
                  </p>
                  <div className={`my-7 h-px ${highlight ? 'bg-ink/15' : 'bg-white/10'}`} />
                  <ul className="mb-10 flex flex-col gap-3">
                    {s.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-[15px]">
                        <span
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                            highlight ? 'bg-ink text-lime' : 'bg-lime text-ink'
                          }`}
                        >
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('pj:project-type', { detail: s.title }))
                      go('contact')
                    }}
                    className={`group mt-auto flex h-14 items-center justify-center gap-2 rounded-full text-base font-semibold transition-transform duration-300 active:scale-[0.98] ${
                      highlight ? 'bg-ink text-paper' : 'bg-paper text-ink'
                    }`}
                  >
                    Request a quote
                    <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-1" />
                  </button>
                </article>
              </div>
            )
          })}
        </FadeIn>
      </div>
    </section>
  )
}
