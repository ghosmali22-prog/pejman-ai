import { useGSAP } from '@gsap/react'
import { useRef, type ReactNode } from 'react'
import { gsap } from '../../lib/motion'
import { useMotion } from '../../providers/MotionProvider'

interface FadeInProps {
  children: ReactNode
  className?: string
  /** Animate direct children one after another instead of the wrapper as a whole. */
  stagger?: number
  y?: number
  delay?: number
  start?: string
}

/** Fade + rise on scroll. Content is visible by default; GSAP hides it only right before animating. */
export function FadeIn({ children, className, stagger, y = 40, delay = 0, start = 'top 88%' }: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { level } = useMotion()

  useGSAP(
    () => {
      if (level === 'none' || !ref.current) return
      const targets = stagger ? Array.from(ref.current.children) : ref.current
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          ease: 'expo.out',
          delay,
          stagger: stagger ?? 0,
          scrollTrigger: { trigger: ref.current, start, once: true },
        },
      )
    },
    { scope: ref, dependencies: [level] },
  )

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
