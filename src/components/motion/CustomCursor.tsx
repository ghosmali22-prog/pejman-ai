import { useEffect, useRef, useState } from 'react'
import { gsap, hasFinePointer } from '../../lib/motion'
import { useMotion } from '../../providers/MotionProvider'

/**
 * Desktop-only cursor: a small lime dot that follows the mouse and grows into a
 * white "View Prompt" circle over elements marked with data-cursor="view".
 */
export function CustomCursor() {
  const { level } = useMotion()
  const dotRef = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState<string | null>(null)
  const enabled = level === 'full' && hasFinePointer()

  useEffect(() => {
    if (!enabled || !dotRef.current) return
    const el = dotRef.current
    document.documentElement.classList.add('has-custom-cursor')
    const xTo = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' })
    let visible = false

    const onMove = (e: PointerEvent) => {
      if (!visible) {
        gsap.set(el, { x: e.clientX, y: e.clientY })
        gsap.to(el, { autoAlpha: 1, duration: 0.3 })
        visible = true
      }
      xTo(e.clientX)
      yTo(e.clientY)
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-cursor]')
      setLabel(target ? (target.dataset.cursorLabel ?? 'View Prompt') : null)
    }
    const onLeave = () => {
      visible = false
      gsap.to(el, { autoAlpha: 0, duration: 0.3 })
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      document.documentElement.classList.remove('has-custom-cursor')
    }
  }, [enabled])

  if (!enabled) return null
  const active = label !== null

  return (
    <div ref={dotRef} aria-hidden="true" className="pointer-events-none invisible fixed left-0 top-0 z-[200] opacity-0">
      <div
        className={`flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          active ? 'size-28 scale-100 bg-paper' : 'size-28 scale-[0.09] bg-lime'
        }`}
      >
        <span
          className={`text-[13px] font-semibold tracking-tight text-ink transition-opacity duration-300 ${
            active ? 'opacity-100 delay-100' : 'opacity-0'
          }`}
        >
          {label ?? 'View Prompt'}
        </span>
      </div>
    </div>
  )
}
