import { useGSAP } from '@gsap/react'
import { useEffect, useRef, useState } from 'react'
import { gsap } from '../../lib/motion'
import { useMotion } from '../../providers/MotionProvider'

const SEEN_KEY = 'pj-intro-seen'

function shouldPlay(level: string) {
  if (level === 'none') return false
  // Deep links (e.g. a prompt shared on Instagram) open straight away.
  const base = import.meta.env.BASE_URL
  const path = window.location.pathname
  if (path !== base && path !== base.replace(/\/$/, '')) return false
  try {
    return !sessionStorage.getItem(SEEN_KEY)
  } catch {
    return true
  }
}

/** Short logo reveal (~1.4s) on the first visit of a session. Click / tap / any key skips it. */
export function Intro() {
  const { level, setIntroDone, lenis } = useMotion()
  const [show] = useState(() => shouldPlay(level))
  const [gone, setGone] = useState(!show)
  const ref = useRef<HTMLDivElement>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)

  useEffect(() => {
    if (!show) setIntroDone(true)
  }, [show, setIntroDone])

  useEffect(() => {
    if (!show || gone) return
    lenis?.stop()
    return () => lenis?.start()
  }, [show, gone, lenis])

  useGSAP(
    () => {
      if (!show || !ref.current) return
      try {
        sessionStorage.setItem(SEEN_KEY, '1')
      } catch {
        /* ignore */
      }
      const finish = () => {
        setIntroDone(true)
        setGone(true)
      }
      tl.current = gsap
        .timeline({ onComplete: finish })
        .fromTo('.intro-char', { yPercent: 110 }, { yPercent: 0, duration: 0.7, stagger: 0.035, ease: 'expo.out' })
        .fromTo('.intro-line', { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'expo.inOut' }, 0.15)
        .call(() => setIntroDone(true), [], 0.95)
        .to(ref.current, { yPercent: -100, duration: 0.6, ease: 'expo.inOut' }, 0.8)
    },
    { scope: ref, dependencies: [show] },
  )

  useEffect(() => {
    if (!show || gone) return
    const skip = () => tl.current?.progress(1)
    window.addEventListener('keydown', skip)
    return () => window.removeEventListener('keydown', skip)
  }, [show, gone])

  if (gone) return null

  return (
    <div
      ref={ref}
      onClick={() => tl.current?.progress(1)}
      className="fixed inset-0 z-[300] flex cursor-pointer flex-col items-center justify-center bg-ink"
      aria-hidden="true"
    >
      <div className="display flex overflow-hidden text-[15vw] text-paper sm:text-[9vw]">
        {'PEJMAN AI'.split('').map((c, i) => (
          <span
            key={i}
            className={`intro-char inline-block ${c === ' ' ? 'w-[0.3em]' : ''} ${i > 6 ? 'text-lime' : ''}`}
          >
            {c}
          </span>
        ))}
      </div>
      <div className="intro-line mt-4 h-[3px] w-40 origin-left bg-lime sm:w-64" />
      <span className="absolute bottom-8 text-xs uppercase tracking-[0.2em] text-mute">Tap to skip</span>
    </div>
  )
}
