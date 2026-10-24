import { useId, useMemo, useState } from 'react'

/** Smooth path through points (Catmull-Rom → Bézier). */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`
  }
  return d
}

export function Sparkline({ values, color = '#c6f432' }: { values: number[]; color?: string }) {
  const id = useId()
  const w = 120
  const h = 40
  const max = Math.max(1, ...values)
  const pts = values.map<[number, number]>((v, i) => [
    (i / Math.max(1, values.length - 1)) * w,
    h - 4 - (v / max) * (h - 8),
  ])
  const line = smoothPath(pts)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-28" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {pts.length > 1 && (
        <>
          <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  )
}

export function AreaChart({
  data,
  format,
  label,
}: {
  data: { label: string; value: number }[]
  format: (v: number) => string
  label: string
}) {
  const id = useId()
  const [hover, setHover] = useState<number | null>(null)
  const w = 800
  const h = 260
  const pad = { t: 16, b: 28, l: 8, r: 8 }
  const max = Math.max(4, ...data.map((d) => d.value))
  const nice = Math.ceil(max / 4) * 4
  const x = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * (w - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / nice) * (h - pad.t - pad.b)
  const pts = data.map<[number, number]>((d, i) => [x(i), y(d.value)])
  const line = smoothPath(pts)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(nice * f))
  const every = Math.ceil(data.length / 7)

  return (
    <div className="relative" dir="ltr">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-56 w-full md:h-64"
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGElement).getBoundingClientRect()
          const i = Math.round(((e.clientX - r.left) / r.width) * (data.length - 1))
          setHover(Math.max(0, Math.min(data.length - 1, i)))
        }}
      >
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#c6f432" stopOpacity="0.32" />
            <stop offset="1" stopColor="#c6f432" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tk) => (
          <line
            key={tk}
            x1={pad.l}
            x2={w - pad.r}
            y1={y(tk)}
            y2={y(tk)}
            stroke="white"
            strokeOpacity="0.06"
            strokeDasharray="4 6"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {pts.length > 1 && (
          <>
            <path d={`${line} L${x(data.length - 1)},${h - pad.b} L${x(0)},${h - pad.b} Z`} fill={`url(#${id})`} />
            <path d={line} fill="none" stroke="#c6f432" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
          </>
        )}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.t}
            y2={h - pad.b}
            stroke="white"
            strokeOpacity="0.25"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-2 -translate-x-1/2 rounded-xl bg-paper px-3 py-1.5 text-center text-xs font-semibold text-ink shadow-lg"
          style={{ left: `${(x(hover) / w) * 100}%` }}
        >
          {format(data[hover].value)}
          <div className="text-[10px] font-medium text-ink/60">{data[hover].label}</div>
        </div>
      )}
      {hover !== null && data[hover] && (
        <span
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-lime"
          style={{ left: `${(x(hover) / w) * 100}%`, top: `${(y(data[hover].value) / h) * 100}%` }}
        />
      )}
      <div className="mt-1 flex justify-between px-1 text-[11px] text-paper/35">
        {data.map((d, i) => (i % every === 0 || i === data.length - 1 ? <span key={i}>{d.label}</span> : null))}
      </div>
    </div>
  )
}

export const DONUT_COLORS = ['#c6f432', '#ffffff', '#8d928e', '#7aa61a', '#e4ff8f', '#4b524e', '#b3e01f', '#d9dcd8']

export function Donut({
  parts,
  center,
  sub,
}: {
  parts: { label: string; value: number }[]
  center: string
  sub: string
}) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  const r = 70
  const c = 2 * Math.PI * r
  const segs = useMemo(() => {
    let acc = 0
    return parts.map((p, i) => {
      const len = total ? (p.value / total) * c : 0
      const seg = { ...p, len, offset: acc, color: DONUT_COLORS[i % DONUT_COLORS.length] }
      acc += len
      return seg
    })
  }, [parts, total, c])
  return (
    <div className="relative mx-auto size-48">
      <svg viewBox="0 0 180 180" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="90" cy="90" r={r} fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="18" />
        {segs.map((s) =>
          s.len > 0 ? (
            <circle
              key={s.label}
              cx="90"
              cy="90"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray={`${Math.max(0, s.len - 6)} ${c}`}
              strokeDashoffset={-s.offset}
            />
          ) : null,
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tracking-tight">{center}</span>
        <span className="text-xs text-paper/50">{sub}</span>
      </div>
    </div>
  )
}
