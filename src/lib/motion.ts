import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/** Calm, premium defaults for every tween on the site. */
gsap.defaults({ ease: 'expo.out', duration: 1 })

export { gsap, ScrollTrigger }

/**
 * full — every effect on.
 * lite — low-power phones: reveals stay, parallax/cursor/tilt/smooth-scroll are off.
 * none — prefers-reduced-motion: no animation at all, content is simply shown.
 */
export type MotionLevel = 'full' | 'lite' | 'none'

export function detectMotionLevel(): MotionLevel {
  if (typeof window === 'undefined') return 'none'
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'none'
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  const lowCpu = (nav.hardwareConcurrency ?? 8) <= 4
  const lowMem = (nav.deviceMemory ?? 8) <= 3
  const saveData = nav.connection?.saveData === true
  const coarse = window.matchMedia('(pointer: coarse)').matches
  if (saveData || lowMem || (coarse && lowCpu)) return 'lite'
  return 'full'
}

export const hasFinePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
