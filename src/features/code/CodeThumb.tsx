import { Lock } from 'lucide-react'
import { canLivePreview, itemFiles, languageLabel } from '../../lib/code'
import type { CodeItem } from '../../types'
import { CodePreview, type Device } from './CodePreview'

/**
 * What a code item looks like: its screenshot, a live preview (plain HTML/CSS/JS),
 * or — for React/TSX and other code that can't run as is — a designed placeholder.
 */
export function CodeThumb({
  item,
  thumbnail,
  device,
  live = true,
  className = '',
}: {
  item: CodeItem
  thumbnail?: boolean
  device?: Device
  /** Prefer the live preview over the screenshot (the modal does). */
  live?: boolean
  className?: string
}) {
  const runnable = canLivePreview(item)
  const image = item.preview_image_url

  if (image && (!runnable || !live)) {
    return (
      <div className={`relative overflow-hidden bg-ink-3 ${className}`}>
        <img
          src={image}
          alt={thumbnail ? '' : `Preview of ${item.title}`}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover object-top transition-transform group-hover:scale-[1.04] duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)]"
        />
      </div>
    )
  }
  if (runnable) {
    return <CodePreview files={itemFiles(item)} title={item.title} device={device} thumbnail={thumbnail} className={className} />
  }
  return <CodePlaceholder item={item} className={className} />
}

/** Placeholder art for items without a screenshot: language, title and a few fake code lines. */
export function CodePlaceholder({ item, className = '' }: { item: Pick<CodeItem, 'title' | 'language' | 'is_premium'>; className?: string }) {
  const widths = ['w-[46%]', 'w-[72%]', 'w-[58%]', 'w-[34%]', 'w-[64%]']
  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden bg-[radial-gradient(120%_90%_at_0%_0%,rgb(198_244_50/0.16),transparent_55%),linear-gradient(160deg,#171b19,#0e1110)] p-5 ${className}`}
    >
      <div aria-hidden="true" className="absolute -right-10 -top-10 size-40 rounded-full bg-lime/10 blur-3xl" />
      <div className="relative flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="ms-auto rounded-full bg-lime px-2.5 py-1 font-mono text-[11px] font-semibold text-ink">
          {languageLabel(item.language)}
        </span>
      </div>
      <div className="relative flex flex-col gap-2" aria-hidden="true">
        {widths.map((w, i) => (
          <span key={i} className={`h-2 rounded-full ${w} ${i === 1 ? 'bg-lime/40' : 'bg-white/[0.09]'}`} style={{ marginLeft: `${(i % 3) * 10}%` }} />
        ))}
      </div>
      <p className="relative line-clamp-2 break-all font-mono text-lg font-semibold tracking-tight text-paper/90 md:text-xl">
        {item.is_premium && <Lock className="mb-1 me-2 inline size-5 text-lime" />}
        <span className="text-lime">&lt;</span>
        {tagName(item.title)}
        <span className="text-lime"> /&gt;</span>
      </p>
    </div>
  )
}

/** "Magnetic button" → "MagneticButton", drawn like a component tag on the placeholder. */
const tagName = (title: string) =>
  title
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') || 'Component'
