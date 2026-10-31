import { ArrowUpRight, Lock, Star } from 'lucide-react'
import type { PointerEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { languageLabel } from '../../lib/code'
import type { CodeItem } from '../../types'
import { CodeThumb } from './CodeThumb'

/** Sets the pointer position for the glass glow (see .code-card in index.css). */
const trackGlow = (e: PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}

/**
 * Glass card for one code item. Cards show the screenshot when there is one (lightest),
 * otherwise a live sandboxed preview, otherwise placeholder art. Opens the detail at ?code=<slug>.
 */
export function CodeCard({ item }: { item: CodeItem }) {
  const location = useLocation()
  const featured = item.is_featured
  return (
    <Link
      to={{ pathname: location.pathname, search: `?code=${item.slug}` }}
      state={{ codeModal: true }}
      preventScrollReset
      data-cursor="view"
      data-cursor-label="View code"
      onPointerMove={trackGlow}
      aria-label={`View code: ${item.title}`}
      className={`code-card group relative flex flex-col overflow-hidden rounded-[26px] p-2 backdrop-blur-xl transition-[transform,box-shadow,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 ${
        featured
          ? 'bg-lime/[0.07] shadow-[0_0_0_1px_rgb(198_244_50/0.35),0_30px_80px_-40px_rgb(198_244_50/0.55)] hover:shadow-[0_0_0_1px_rgb(198_244_50/0.6),0_40px_90px_-40px_rgb(198_244_50/0.7)]'
          : 'bg-white/[0.035] shadow-[0_0_0_1px_rgb(255_255_255/0.08)] hover:bg-white/[0.06] hover:shadow-[0_0_0_1px_rgb(255_255_255/0.16),0_30px_70px_-40px_rgb(0_0_0/0.8)]'
      }`}
    >
      <div className="relative overflow-hidden rounded-[20px]">
        <CodeThumb item={item} thumbnail live={false} className="aspect-[16/10] w-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-wrap gap-1.5">
            {featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-lime px-2.5 py-1 text-[11px] font-semibold text-ink">
                <Star className="size-3 fill-current" /> Featured
              </span>
            )}
            {item.is_premium && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-semibold text-lime ring-1 ring-lime/30 backdrop-blur">
                <Lock className="size-3" /> Premium
              </span>
            )}
          </div>
          <span className="flex size-9 translate-y-1 items-center justify-center rounded-full bg-ink/80 text-paper opacity-0 ring-1 ring-white/15 backdrop-blur transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col px-3 pb-3 pt-4">
        <h3 className="text-[17px] font-semibold leading-tight tracking-tight text-paper md:text-lg">{item.title}</h3>
        {item.short_description && (
          <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-paper/55">{item.short_description}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
          {item.category && (
            <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-paper/80 ring-1 ring-white/10">
              {item.category}
            </span>
          )}
          <span className="rounded-full px-2.5 py-1 font-mono text-[11px] font-medium text-lime ring-1 ring-lime/25">
            {languageLabel(item.language)}
          </span>
        </div>
      </div>
    </Link>
  )
}
