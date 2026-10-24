import { useGSAP } from '@gsap/react'
import { ArrowRight } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import photo1600 from '../assets/hero/pejman-1600.webp'
import photo900 from '../assets/hero/pejman-900.webp'
import { RevealText } from '../components/motion/RevealText'
import { useSectionLink } from '../hooks/useSectionLink'
import { gsap } from '../lib/motion'
import { useMotion } from '../providers/MotionProvider'
import { useSiteData } from '../providers/SiteDataProvider'

const NAME = 'PEJMAN AI'
const BARS = [38, 52, 44, 66, 58, 80, 72, 96]

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { level, introDone } = useMotion()
  const { settings, prompts } = useSiteData()
  const go = useSectionLink()
  const featured = prompts.find((p) => p.featured) ?? prompts[0]
  const count = prompts.length

  // Entrance: name letters rise, photo settles, cards float in with a stagger.
  useGSAP(
    () => {
      if (level === 'none') return
      const q = gsap.utils.selector(ref)
      if (!introDone) {
        gsap.set(q('.hero-char'), { yPercent: 105 })
        gsap.set(q('.hero-photo'), { autoAlpha: 0, y: 60, scale: 1.04 })
        gsap.set(q('.hero-fade'), { autoAlpha: 0, y: 24 })
        gsap.set(q('.hero-card'), { autoAlpha: 0, y: 80 })
        return
      }
      gsap
        .timeline({ defaults: { ease: 'expo.out' } })
        .to(q('.hero-char'), { yPercent: 0, duration: 1.2, stagger: 0.045 })
        .to(q('.hero-photo'), { autoAlpha: 1, y: 0, scale: 1, duration: 1.4 }, 0.15)
        .to(q('.hero-fade'), { autoAlpha: 1, y: 0, duration: 1, stagger: 0.08 }, 0.55)
        .to(q('.hero-card'), { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.08 }, 0.65)
    },
    { scope: ref, dependencies: [level, introDone] },
  )

  // Scroll parallax: the name drifts slower than the photo for a sense of depth.
  useGSAP(
    () => {
      if (level !== 'full') return
      const q = gsap.utils.selector(ref)
      const stage = q('.hero-stage')[0]
      gsap.to(q('.hero-name'), {
        yPercent: 35,
        ease: 'none',
        scrollTrigger: { trigger: stage, start: 'top top', end: 'bottom top', scrub: true },
      })
      gsap.to(q('.hero-photo-wrap'), {
        yPercent: 10,
        ease: 'none',
        scrollTrigger: { trigger: stage, start: 'top top', end: 'bottom top', scrub: true },
      })
      q('.hero-card-wrap').forEach((card, i) => {
        gsap.to(card, {
          y: -(20 + (i % 3) * 18),
          ease: 'none',
          scrollTrigger: { trigger: q('.hero-cards')[0], start: 'top bottom', end: 'bottom top', scrub: true },
        })
      })
    },
    { scope: ref, dependencies: [level] },
  )

  return (
    <section ref={ref} id="top" data-theme="dark" className="relative overflow-hidden bg-ink text-paper">
      <div className="relative">
        {/* Stage: giant name behind, photo in front */}
        <div className="hero-stage relative h-[68svh] min-h-[460px] sm:h-[80svh] md:h-[100svh] md:min-h-[640px]">
          <div
            aria-hidden="true"
            className="hero-name pointer-events-none absolute inset-x-0 top-[19%] flex select-none justify-center sm:top-[18%] md:top-[16%]"
          >
            <span className="display flex whitespace-nowrap text-[17.5vw] text-paper md:text-[17vw]">
              {NAME.split('').map((c, i) => (
                <span key={i} className="reveal-mask">
                  <span
                    className={`hero-char inline-block ${c === ' ' ? 'w-[0.22em]' : ''} ${i > 6 ? 'text-lime' : ''}`}
                  >
                    {c === ' ' ? ' ' : c}
                  </span>
                </span>
              ))}
            </span>
          </div>

          <div className="hero-photo-wrap absolute inset-x-0 bottom-0 flex h-[76%] justify-center sm:h-[80%] md:h-[86%]">
            <img
              className="hero-photo h-full w-auto max-w-none select-none object-contain object-bottom"
              src={photo1600}
              srcSet={`${photo900} 900w, ${photo1600} 1600w`}
              sizes="(max-width: 768px) 140vw, 75vw"
              width={1600}
              height={1183}
              alt="Pejman Ansaribarz, founder of PEJMAN AI, in black sunglasses and a black puffer jacket"
              fetchPriority="high"
              decoding="async"
              draggable={false}
            />
          </div>

          {/* Blend the bottom edge of the photo into the page */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-ink via-ink/70 to-transparent" />
        </div>

        {/* Copy: flows below the photo on phones, sits on the dark jacket at the bottom of the stage on desktop */}
        <div className="relative -mt-6 md:absolute md:inset-x-0 md:bottom-10 md:mt-0">
          <HeroCopy
            headline={settings.hero.headline}
            subline={settings.hero.subline}
            play={introDone}
            onWork={() => go('contact')}
            onBrowse={() => go('prompts')}
          />
        </div>
      </div>

      {/* Bento row */}
      <div className="hero-cards relative z-10 mx-auto mt-12 max-w-7xl pb-24 md:mt-16 md:pb-32">
        <div className="no-scrollbar flex snap-x snap-mandatory items-end gap-3 overflow-x-auto px-4 pb-2 sm:px-6 md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:px-8">
          {/* Featured image */}
          <div className="hero-card-wrap w-[64vw] shrink-0 snap-start sm:w-[40vw] md:w-auto">
            <Link
              to={featured ? `/p/${featured.slug}` : '/'}
              state={{ modal: true }}
              data-cursor="view"
              className="hero-card group relative block h-[300px] overflow-hidden rounded-[28px] bg-ink-3 md:h-[340px]"
            >
              {featured && (
                <img
                  src={featured.image_url}
                  alt={featured.title}
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover grayscale transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute inset-x-4 bottom-4">
                <span className="mb-2 inline-flex rounded-full bg-lime px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink">
                  Featured prompt
                </span>
                <p className="heading text-xl text-paper">{featured?.title ?? 'Prompts'}</p>
              </div>
            </Link>
          </div>

          {/* Stat */}
          <div className="hero-card-wrap w-[52vw] shrink-0 snap-start sm:w-[32vw] md:w-auto">
            <div className="hero-card flex h-[230px] flex-col justify-between rounded-[28px] bg-lime p-5 text-ink md:h-[250px]">
              <span className="text-sm font-medium">Prompt library</span>
              <div>
                <p className="display text-[64px] leading-none">{count}+</p>
                <p className="mt-2 text-sm font-medium">prompts, ready to copy</p>
              </div>
            </div>
          </div>

          {/* Tools */}
          <div className="hero-card-wrap w-[60vw] shrink-0 snap-start sm:w-[36vw] md:w-auto">
            <div className="hero-card flex h-[270px] flex-col justify-between rounded-[28px] bg-ink-2 p-5 ring-1 ring-white/8 md:h-[300px]">
              <span className="text-sm text-mute">Tools I use</span>
              <ul className="flex flex-wrap gap-1.5">
                {settings.hero.tools.map((t) => (
                  <li
                    key={t}
                    className="rounded-full bg-white/8 px-3 py-1.5 text-[13px] font-medium text-paper ring-1 ring-white/10"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Chart */}
          <div className="hero-card-wrap w-[52vw] shrink-0 snap-start sm:w-[32vw] md:w-auto">
            <div className="hero-card flex h-[220px] flex-col justify-between rounded-[28px] bg-ink-2 p-5 ring-1 ring-white/8 md:h-[236px]">
              <div className="flex items-center justify-between text-sm">
                <span className="text-mute">New every week</span>
                <span className="font-semibold text-lime">↑</span>
              </div>
              <div className="flex h-24 items-end gap-1.5">
                {BARS.map((h, i) => (
                  <span
                    key={i}
                    className={`block flex-1 origin-bottom rounded-t-md ${i === BARS.length - 1 ? 'bg-lime' : 'bg-lime/35'}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Availability */}
          <div className="hero-card-wrap w-[60vw] shrink-0 snap-start sm:w-[36vw] md:w-auto">
            <div className="hero-card relative flex h-[260px] flex-col justify-between overflow-hidden rounded-[28px] bg-paper p-5 text-ink md:h-[284px]">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime-2 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-lime-2" />
                </span>
                {settings.hero.availability}
              </div>
              <div>
                <p className="display text-[56px] leading-none">7/7</p>
                <ul className="mt-3 flex gap-1" aria-label="Monday to Sunday">
                  {DAYS.map((d, i) => (
                    <li
                      key={i}
                      className="flex size-6 items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-lime"
                    >
                      {d}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm font-medium text-ink/70">{settings.hero.location}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div aria-hidden="true" className="lime-glow pointer-events-none absolute inset-x-0 bottom-0 h-72" />
    </section>
  )
}

function HeroCopy({
  headline,
  subline,
  play,
  onBrowse,
  onWork,
}: {
  headline: string
  subline: string
  play: boolean
  onBrowse: () => void
  onWork: () => void
}) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 sm:px-6 md:flex-row md:items-end md:justify-between md:px-8">
      <div className="max-w-xl">
        <RevealText
          as="h1"
          text={headline}
          mode="manual"
          play={play}
          delay={0.35}
          className="heading text-[40px] text-paper sm:text-5xl lg:text-[56px]"
        />
        <p className="hero-fade mt-4 max-w-md text-[15px] leading-relaxed text-paper/65 md:text-base">{subline}</p>
      </div>
      <div className="hero-fade flex flex-col gap-3 sm:flex-row md:shrink-0">
        <button
          type="button"
          onClick={onBrowse}
          className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-lime px-7 text-base font-semibold text-ink transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
        >
          Browse prompts
          <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-1" />
        </button>
        <button
          type="button"
          onClick={onWork}
          className="inline-flex h-14 items-center justify-center rounded-full bg-white/8 px-7 text-base font-semibold text-paper ring-1 ring-white/15 backdrop-blur transition-colors duration-300 hover:bg-white/15"
        >
          Work with me
        </button>
      </div>
    </div>
  )
}
