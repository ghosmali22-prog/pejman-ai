import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap, hasFinePointer, ScrollTrigger } from '../../lib/motion'
import { useMotion } from '../../providers/MotionProvider'
import type { Prompt } from '../../types'

const MIN_CARDS = 14
const clamp = (min: number, max: number, v: number) => Math.min(max, Math.max(min, v))

/**
 * Endless 3D carousel of prompt images. Cards drift sideways on their own, curve away in
 * depth towards the edges, and the one in the middle is shown in colour. Scrolling the page
 * speeds it up, and it can be dragged/swiped. Tapping a card opens that prompt in the library.
 * Everything moves with transform/opacity only.
 */
export function PromptCarousel({ prompts }: { prompts: Prompt[] }) {
  const { level } = useMotion()
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<HTMLAnchorElement[]>([])

  // Repeat the list so the ring always looks full, even with only a few prompts.
  const items = useMemo(() => {
    if (!prompts.length) return []
    const out: Prompt[] = []
    while (out.length < MIN_CARDS) out.push(...prompts)
    return out
  }, [prompts])

  useEffect(() => {
    const stage = stageRef.current
    if (level === 'none' || !stage || !items.length) return
    const cards = cardRefs.current.slice(0, items.length)
    const colors = cards.map((c) => c.querySelector<HTMLElement>('.carousel-color'))
    const fine = hasFinePointer()

    let pos = 0
    let boost = 0
    let hover = false
    let visible = true
    let drag: { x: number; pos: number; lastX: number; lastT: number; v: number; moved: boolean } | null = null
    let suppressClick = false

    const layout = () => {
      const w = cards[0]?.offsetWidth ?? 280
      const spacing = w * 0.86
      const total = spacing * cards.length
      const half = stage.clientWidth / 2
      cards.forEach((card, i) => {
        const x = gsap.utils.wrap(-total / 2, total / 2, i * spacing - pos)
        const n = x / Math.max(half, w)
        const rot = clamp(-1, 1, n) * -40
        const z = -Math.min(Math.abs(n), 1.6) * 260
        card.style.transform = `translate3d(${x}px,0,${z}px) rotateY(${rot}deg)`
        card.style.opacity = String(clamp(0, 1, 1 - (Math.abs(n) - 1.05) * 2.2))
        card.style.zIndex = String(1000 - Math.round(Math.abs(x)))
        const c = colors[i]
        if (c) c.style.opacity = String(clamp(0, 1, 1 - Math.abs(x) / (spacing * 0.8)))
      })
    }

    const tick = (_t: number, delta: number) => {
      if (!visible) return
      if (!drag) {
        const base = (hover ? 14 : 46) * (level === 'lite' ? 0.8 : 1)
        pos += ((base + boost) * delta) / 1000
        boost *= 0.94
      }
      layout()
    }

    // Scrolling the page gives the ring a push.
    const st = ScrollTrigger.create({
      trigger: stage,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        boost = clamp(-600, 900, boost + self.getVelocity() * 0.12)
      },
      onToggle: (self) => {
        visible = self.isActive
      },
    })

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      drag = { x: e.clientX, pos, lastX: e.clientX, lastT: performance.now(), v: 0, moved: false }
      suppressClick = false
    }
    const move = (e: PointerEvent) => {
      if (!drag) return
      const dx = e.clientX - drag.x
      if (!drag.moved && Math.abs(dx) > 8) {
        drag.moved = true
        stage.setPointerCapture?.(e.pointerId)
      }
      if (!drag.moved) return
      const now = performance.now()
      drag.v = ((drag.lastX - e.clientX) / Math.max(1, now - drag.lastT)) * 1000
      drag.lastX = e.clientX
      drag.lastT = now
      pos = drag.pos - dx * 1.15
    }
    const up = () => {
      if (!drag) return
      if (drag.moved) {
        suppressClick = true
        boost = clamp(-1500, 1500, drag.v * 0.6)
      }
      drag = null
    }
    const click = (e: MouseEvent) => {
      if (suppressClick) {
        e.preventDefault()
        e.stopPropagation()
        suppressClick = false
      }
    }
    const enter = () => (hover = fine)
    const leave = () => (hover = false)

    stage.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    stage.addEventListener('click', click, true)
    stage.addEventListener('pointerenter', enter)
    stage.addEventListener('pointerleave', leave)
    window.addEventListener('resize', layout)

    layout()
    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
      st.kill()
      stage.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      stage.removeEventListener('click', click, true)
      stage.removeEventListener('pointerenter', enter)
      stage.removeEventListener('pointerleave', leave)
      window.removeEventListener('resize', layout)
    }
  }, [items, level])

  if (!items.length) return null

  // Reduced motion: a plain row you can swipe.
  if (level === 'none') {
    return (
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4">
        {prompts.map((p) => (
          <CarouselCard key={p.id} prompt={p} className="relative w-[62vw] max-w-[300px] shrink-0 snap-center" />
        ))}
      </div>
    )
  }

  return (
    <div
      ref={stageRef}
      className="relative h-[min(118vw,560px)] touch-pan-y select-none overflow-hidden md:h-[620px]"
      style={{
        perspective: '1400px',
        maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
      }}
    >
      <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
        {items.map((p, i) => (
          <CarouselCard
            key={`${p.id}-${i}`}
            prompt={p}
            ref={(el) => {
              if (el) cardRefs.current[i] = el
            }}
            className="absolute left-1/2 top-1/2 -ml-[min(29vw,150px)] -mt-[min(38.5vw,200px)] w-[min(58vw,300px)] will-change-transform md:-ml-[170px] md:-mt-[227px] md:w-[340px]"
          />
        ))}
      </div>
    </div>
  )
}

function CarouselCard({
  prompt,
  className,
  ref,
}: {
  prompt: Prompt
  className?: string
  ref?: React.Ref<HTMLAnchorElement>
}) {
  return (
    <Link
      ref={ref}
      to={`/p/${prompt.slug}`}
      data-cursor="view"
      draggable={false}
      aria-label={`View prompt: ${prompt.title}`}
      className={`group block ${className ?? ''}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-[26px] bg-ink-3 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)] ring-1 ring-white/10">
        <img
          src={prompt.image_url}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover grayscale"
        />
        <img
          src={prompt.image_url}
          alt={prompt.title}
          draggable={false}
          loading="lazy"
          decoding="async"
          className="carousel-color absolute inset-0 size-full object-cover opacity-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
        <div className="absolute inset-x-4 bottom-4">
          <span className="mb-2 inline-flex rounded-full bg-lime px-2.5 py-1 text-[11px] font-semibold text-ink">
            {prompt.model}
          </span>
          <p className="heading text-lg leading-tight text-paper md:text-xl">{prompt.title}</p>
        </div>
      </div>
    </Link>
  )
}
