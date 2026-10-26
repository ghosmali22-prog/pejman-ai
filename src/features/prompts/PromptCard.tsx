import { Link, useLocation } from 'react-router-dom'
import { Play } from 'lucide-react'
import type { Prompt } from '../../types'
import { PromptVideo } from './PromptVideo'

interface PromptCardProps {
  prompt: Prompt
  categoryName: string
}

/**
 * Gallery card. The image is grayscale by default and fades to color on hover
 * (or when centered on screen on touch devices). Two stacked <img> tags share the
 * same URL, so the browser downloads the file only once. Video prompts play in colour
 * while on screen.
 */
export function PromptCard({ prompt, categoryName }: PromptCardProps) {
  const location = useLocation()
  return (
    <Link
      to={`/p/${prompt.slug}`}
      state={{ modal: true, from: location.pathname }}
      data-cursor="view"
      className="prompt-card group block"
      aria-label={`View prompt: ${prompt.title}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-[20px] bg-paper-2 md:rounded-[24px]">
        <div className="absolute inset-0 transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]">
          <div className="prompt-parallax absolute -inset-y-[8%] inset-x-0">
            {prompt.video_url ? (
              <PromptVideo prompt={prompt} className="absolute inset-0 size-full object-cover" />
            ) : (
              <>
                <img
                  src={prompt.image_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 size-full object-cover grayscale"
                />
                <img
                  src={prompt.image_url}
                  alt={prompt.title}
                  loading="lazy"
                  decoding="async"
                  className="prompt-color absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-700 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              </>
            )}
          </div>
        </div>
        {prompt.video_url && (
          <span className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-ink/70 text-paper backdrop-blur md:right-4 md:top-4 md:size-8">
            <Play className="size-3.5 fill-current" aria-label="Video" />
          </span>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-paper/90 px-2.5 py-1 text-[11px] font-semibold text-ink backdrop-blur md:left-4 md:top-4 md:text-xs">
          {categoryName}
        </span>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3 px-0.5">
        <h3 className="text-[15px] font-semibold leading-tight tracking-tight text-ink md:text-lg">{prompt.title}</h3>
      </div>
      <p className="mt-1 px-0.5 text-[13px] text-ink/55 md:text-sm">{prompt.model}</p>
    </Link>
  )
}
