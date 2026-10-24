import { useGSAP } from '@gsap/react'
import { useRef } from 'react'
import { useSectionLink } from '../hooks/useSectionLink'
import { gsap, ScrollTrigger } from '../lib/motion'
import { useMotion } from '../providers/MotionProvider'

const PHRASE = "Let's Work Together"

function Track({ dark }: { dark?: boolean }) {
  const items = Array.from({ length: 6 })
  return (
    <div className="marquee-track flex w-max will-change-transform">
      {[0, 1].map((half) => (
        <div key={half} className="flex shrink-0" aria-hidden={half === 1}>
          {items.map((_, i) => (
            <span key={i} className="heading flex items-center gap-6 whitespace-nowrap px-6 text-[34px] md:text-[56px]">
              {PHRASE}
              <span className={dark ? 'text-lime' : 'text-ink'}>✳</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Two tilted ribbons crossing each other, scrolling in opposite directions; faster when you scroll faster. */
export function Marquee() {
  const ref = useRef<HTMLDivElement>(null)
  const { level } = useMotion()
  const go = useSectionLink()

  useGSAP(
    () => {
      if (level === 'none' || !ref.current) return
      const tracks = gsap.utils.toArray<HTMLElement>('.marquee-track', ref.current)
      const dirs = [-1, 1]
      const pos = [0, 0]
      let boost = 0
      const st = ScrollTrigger.create({
        trigger: ref.current,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          boost = Math.min(Math.abs(self.getVelocity()) / 400, 4)
        },
      })
      const tick = (_t: number, delta: number) => {
        boost *= 0.94
        const speed = (0.045 + boost * 0.05) * delta
        tracks.forEach((track, i) => {
          const half = track.scrollWidth / 2
          pos[i] = (pos[i] + dirs[i] * speed) % half
          if (pos[i] > 0) pos[i] -= half
          gsap.set(track, { x: pos[i] })
        })
      }
      gsap.ticker.add(tick)
      return () => {
        gsap.ticker.remove(tick)
        st.kill()
      }
    },
    { scope: ref, dependencies: [level] },
  )

  return (
    <section data-theme="light" aria-label="Let's work together" className="overflow-hidden bg-paper py-24 md:py-32">
      <div ref={ref} className="relative h-[180px] md:h-[260px]">
        <button
          type="button"
          onClick={() => go('contact')}
          className="absolute left-[-5%] top-1/2 w-[110%] -translate-y-1/2 rotate-[-5deg] bg-lime py-4 text-ink md:py-6"
          aria-label="Let's work together — go to contact form"
        >
          <Track />
        </button>
        <div
          className="absolute left-[-5%] top-1/2 w-[110%] -translate-y-1/2 rotate-[4deg] bg-ink py-4 text-paper md:py-6"
          aria-hidden="true"
        >
          <Track dark />
        </div>
      </div>
    </section>
  )
}
