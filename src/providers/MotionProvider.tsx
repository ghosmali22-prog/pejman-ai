import Lenis from 'lenis'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { detectMotionLevel, gsap, ScrollTrigger, type MotionLevel } from '../lib/motion'

interface MotionContextValue {
  level: MotionLevel
  lenis: Lenis | null
  /** True once the intro overlay is gone (or skipped), so hero animations can start. */
  introDone: boolean
  setIntroDone: (v: boolean) => void
  scrollTo: (target: string | number | HTMLElement, opts?: { immediate?: boolean; offset?: number }) => void
}

const MotionContext = createContext<MotionContextValue | null>(null)

export function MotionProvider({ children }: { children: ReactNode }) {
  const [level] = useState<MotionLevel>(detectMotionLevel)
  const [lenis, setLenis] = useState<Lenis | null>(null)
  const [introDone, setIntroDone] = useState(false)
  // The admin panel scrolls natively (long forms and lists feel better that way).
  const inAdmin = useLocation().pathname.startsWith('/admin')

  useEffect(() => {
    document.documentElement.dataset.motion = inAdmin ? 'none' : level
    if (level !== 'full' || inAdmin) return

    const instance = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true })
    instance.on('scroll', ScrollTrigger.update)
    const raf = (time: number) => instance.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    setLenis(instance)

    return () => {
      gsap.ticker.remove(raf)
      instance.destroy()
      setLenis(null)
    }
  }, [level, inAdmin])

  const value = useMemo<MotionContextValue>(
    () => ({
      level,
      lenis,
      introDone,
      setIntroDone,
      scrollTo: (target, opts = {}) => {
        const offset = opts.offset ?? 0
        if (lenis) {
          lenis.scrollTo(target, { offset, immediate: opts.immediate, duration: 1.4 })
          return
        }
        const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
        const top = typeof el === 'number' ? el : el ? el.getBoundingClientRect().top + window.scrollY + offset : 0
        window.scrollTo({ top, behavior: opts.immediate || level === 'none' ? 'auto' : 'smooth' })
      },
    }),
    [level, lenis, introDone],
  )

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>
}

export function useMotion() {
  const ctx = useContext(MotionContext)
  if (!ctx) throw new Error('useMotion must be used inside <MotionProvider>')
  return ctx
}
