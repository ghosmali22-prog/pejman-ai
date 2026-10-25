import { useImperativeHandle, useRef, type Ref } from 'react'
import type { HudHandle } from './ParticlePortrait'

/** Tracking points on the portrait, in % of the photo box (forehead, lenses, nose, chin). */
const POINTS = [
  { x: 50, y: 21, side: 'left' },
  { x: 38, y: 41, side: 'left' },
  { x: 62, y: 41, side: 'right' },
  { x: 49, y: 55, side: 'right' },
  { x: 50, y: 67, side: 'left' },
] as const

const LINES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [1, 2],
  [3, 4],
]

const fmt = (n: number) => `${n < 0 ? '−' : '+'}${Math.abs(n).toFixed(2)}`

/**
 * Thin tracking lines and live coordinates over the particle portrait.
 * Values are written straight to the DOM by the particle loop (no React renders).
 */
export function PortraitHud({ ref }: { ref: Ref<HudHandle> }) {
  const root = useRef<HTMLDivElement>(null)
  const labels = useRef<(HTMLSpanElement | null)[]>([])
  const count = useRef<HTMLSpanElement>(null)
  const scatter = useRef<HTMLSpanElement>(null)

  useImperativeHandle(ref, () => ({
    update(progress, tilt, total, intro) {
      // Fades in as the dust gathers, out as it scatters.
      const opacity = Math.min(Math.max(0, intro * 1.4 - 0.4), 1 - progress * 2.4)
      if (root.current) root.current.style.opacity = String(Math.max(0, opacity))
      POINTS.forEach((p, i) => {
        const el = labels.current[i]
        if (!el) return
        const x = (p.x / 50 - 1) * 0.9 + tilt.x * 0.12
        const y = (1 - p.y / 50) * 0.9 - tilt.y * 0.12
        const z = 0.08 + progress * 1.6 - tilt.x * (p.x / 50 - 1) * 0.2
        el.textContent = `${fmt(x)} ${fmt(y)} ${fmt(z)}`
      })
      if (count.current) count.current.textContent = total.toLocaleString('en-US')
      if (scatter.current) scatter.current.textContent = progress.toFixed(3)
    },
  }))

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden select-none opacity-0 md:block"
    >
      <div className="absolute inset-0 font-mono text-[10px] leading-none tracking-wider text-paper/45">
        <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          {LINES.map(([a, b]) => (
            <line
              key={`${a}-${b}`}
              x1={POINTS[a].x}
              y1={POINTS[a].y}
              x2={POINTS[b].x}
              y2={POINTS[b].y}
              stroke="currentColor"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              opacity={0.5}
            />
          ))}
          <line
            x1={POINTS[2].x}
            y1={POINTS[2].y}
            x2={92}
            y2={POINTS[2].y - 14}
            stroke="currentColor"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            opacity={0.35}
          />
        </svg>

        {POINTS.map((p, i) => (
          <div key={i} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            <span className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-lime/80" />
            <span
              ref={(el) => {
                labels.current[i] = el
              }}
              className={`absolute top-2 whitespace-nowrap ${p.side === 'left' ? 'right-2' : 'left-2'}`}
            />
          </div>
        ))}

        <div className="absolute flex flex-col gap-1.5" style={{ left: '92%', top: `${POINTS[2].y - 14}%` }}>
          <span className="text-lime/80">POINT CLOUD</span>
          <span>
            PTS <span ref={count}>0</span>
          </span>
          <span>
            SCATTER <span ref={scatter}>0.000</span>
          </span>
        </div>
      </div>
    </div>
  )
}
