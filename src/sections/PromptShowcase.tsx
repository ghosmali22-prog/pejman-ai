import { useGSAP } from '@gsap/react'
import { ArrowRight } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import photo900 from '../assets/hero/pejman-900.webp'
import { FadeIn } from '../components/motion/FadeIn'
import { PromptCarousel } from '../features/prompts/PromptCarousel'
import { gsap } from '../lib/motion'
import { useMotion } from '../providers/MotionProvider'
import { useSiteData } from '../providers/SiteDataProvider'

const INSET_START = 0.28

/** Home-page teaser: giant PRO[image]MPTS heading, a 3D carousel, and a link to the full library. */
export function PromptShowcase() {
  const { prompts, loading } = useSiteData()
  const { level } = useMotion()
  const headRef = useRef<HTMLDivElement>(null)
  const inset = prompts.find((p) => p.featured) ?? prompts[0]

  // The image inside the word grows from a sliver as you scroll and the letters make room.
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
      const img = q('.inset-img')
      tl.fromTo(box, { scale: INSET_START }, { scale: 1 }, 0)
        .fromTo(q('.inset-left'), { x: gap }, { x: 0 }, 0)
        .fromTo(q('.inset-right'), { x: () => -gap() }, { x: 0 }, 0)
      if (img.length) tl.fromTo(img, { scale: 1.5 }, { scale: 1 }, 0)
    },
    { scope: headRef, dependencies: [level, inset?.id, loading] },
  )

  return (
    <section id="prompts" data-theme="dark" className="relative overflow-hidden bg-ink py-24 text-paper md:py-36">
      <div aria-hidden="true" className="lime-glow pointer-events-none absolute inset-x-0 top-1/3 h-[60%] opacity-60" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <div ref={headRef}>
          <span className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-paper/70 md:mb-6">
            <span className="size-2 rounded-full bg-lime" />
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
              className="inset-box relative mx-[0.04em] inline-block h-[0.74em] w-[1.25em] overflow-hidden rounded-[0.12em] bg-ink-3 align-middle"
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
          <p className="mx-auto mt-4 max-w-xl text-center text-base text-paper/55 md:mt-6 md:text-lg">
            Every image comes with the exact prompt that made it. Tap one, copy the prompt, create your own.
          </p>
        </div>
      </div>

      <div className="relative mt-10 md:mt-14">
        {loading ? (
          <div className="mx-auto h-[min(118vw,560px)] max-w-7xl md:h-[620px]" />
        ) : prompts.length ? (
          <PromptCarousel prompts={prompts} />
        ) : (
          <p className="py-20 text-center text-paper/50">New prompts are coming soon.</p>
        )}
      </div>

      <FadeIn className="relative mt-8 flex justify-center px-4 md:mt-12">
        <Link
          to="/prompts"
          className="group inline-flex h-14 items-center gap-2 rounded-full bg-lime px-7 text-base font-semibold text-ink transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
        >
          Explore all prompts
          {prompts.length > 0 && <span className="rounded-full bg-ink/10 px-2 py-0.5 text-sm">{prompts.length}</span>}
          <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </FadeIn>
    </section>
  )
}
