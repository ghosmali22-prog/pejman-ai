import { useGSAP } from '@gsap/react'
import { useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/motion'
import { useMotion } from '../../providers/MotionProvider'

/**
 * A fixed white layer behind the page that fades in/out as light sections
 * (data-theme="light") cross the middle of the screen — giving a smooth
 * dark ↔ white background transition using only opacity.
 * Sections keep their own background when motion is off (see index.css).
 */
export function ThemeBackdrop({ deps }: { deps: unknown[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const { level } = useMotion()

  useGSAP(
    () => {
      if (level === 'none' || !ref.current) return
      const layer = ref.current
      const sections = gsap.utils.toArray<HTMLElement>('[data-theme="light"]')
      const set = (on: boolean) =>
        gsap.to(layer, { opacity: on ? 1 : 0, duration: 0.7, ease: 'power2.out', overwrite: true })
      const triggers = sections.map((section) =>
        ScrollTrigger.create({
          trigger: section,
          start: 'top 70%',
          end: 'bottom 30%',
          onToggle: (self) => set(self.isActive),
        }),
      )
      gsap.set(layer, { opacity: triggers.some((t) => t.isActive) ? 1 : 0 })
    },
    { dependencies: [level, ...deps] },
  )

  if (level === 'none') return null
  return <div ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-paper opacity-0" />
}
