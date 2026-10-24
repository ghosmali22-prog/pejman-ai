import { useGSAP } from '@gsap/react'
import { useRef } from 'react'
import { FadeIn } from '../components/motion/FadeIn'
import { gsap } from '../lib/motion'
import { useMotion } from '../providers/MotionProvider'
import { useSiteData } from '../providers/SiteDataProvider'

export function About() {
  const ref = useRef<HTMLDivElement>(null)
  const { level } = useMotion()
  const { settings } = useSiteData()
  const words = settings.about.text.split(/\s+/).filter(Boolean)

  // Words go from light grey to black, linked to scroll position.
  useGSAP(
    () => {
      if (level === 'none' || !ref.current) return
      gsap.fromTo(
        ref.current.querySelectorAll('.about-word'),
        { opacity: 0.16 },
        {
          opacity: 1,
          ease: 'none',
          stagger: 0.1,
          scrollTrigger: { trigger: ref.current, start: 'top 80%', end: 'bottom 55%', scrub: 0.6 },
        },
      )
    },
    { scope: ref, dependencies: [level, settings.about.text] },
  )

  return (
    <section id="about" data-theme="light" className="bg-paper text-ink">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-28 sm:px-6 md:grid-cols-12 md:gap-6 md:px-8 md:py-44">
        <FadeIn className="md:col-span-3">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <span className="size-2 rounded-full bg-ink" />
            {settings.about.label}
          </span>
        </FadeIn>
        <div ref={ref} className="md:col-span-9">
          <p className="heading text-[30px] leading-[1.08] sm:text-[40px] lg:text-[54px]">
            {words.map((w, i) => (
              <span key={i} className="about-word">
                {w}{' '}
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  )
}
