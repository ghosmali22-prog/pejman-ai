import { ArrowRight, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { FadeIn } from '../components/motion/FadeIn'
import { PromptVideo } from '../features/prompts/PromptVideo'
import { useSiteData } from '../providers/SiteDataProvider'

const MAX_VIDEOS = 8

/**
 * Home-page section for video prompts, separate from the image carousel. Each card plays the
 * first seconds of its video while it is on screen; tapping opens the full video and prompt.
 */
export function VideoShowcase() {
  const { prompts, loading } = useSiteData()
  const videos = prompts.filter((p) => p.video_url)
  if (loading || !videos.length) return null

  return (
    <section id="videos" data-theme="dark" className="relative overflow-hidden bg-ink pb-24 text-paper md:pb-36">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <span className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-paper/70 md:mb-6">
          <span className="size-2 rounded-full bg-lime" />
          Video prompts
        </span>
        <h2 className="display text-[17vw] leading-[0.9] xl:text-[200px]">MOTION</h2>
        <p className="mt-4 max-w-xl text-base text-paper/55 md:mt-6 md:text-lg">
          Motion graphics and AI video, each with the exact prompt behind it.
        </p>
      </div>

      <div className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:px-6 md:mx-auto md:mt-14 md:grid md:max-w-7xl md:grid-cols-3 md:gap-6 md:overflow-visible md:px-8 lg:grid-cols-4">
        {videos.slice(0, MAX_VIDEOS).map((p) => (
          <Link
            key={p.id}
            to={`/p/${p.slug}`}
            data-cursor="view"
            aria-label={`View video prompt: ${p.title}`}
            className="group block w-[68vw] max-w-[300px] shrink-0 snap-center md:w-auto md:max-w-none"
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-[22px] bg-ink-3 ring-1 ring-white/10">
              <PromptVideo
                prompt={p}
                className="absolute inset-0 size-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <span className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-ink/70 backdrop-blur">
                <Play className="size-3.5 fill-current" />
              </span>
              <div className="absolute inset-x-4 bottom-4">
                <span className="mb-2 inline-flex rounded-full bg-lime px-2.5 py-1 text-[11px] font-semibold text-ink">
                  {p.model}
                </span>
                <p className="heading text-lg leading-tight md:text-xl">{p.title}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <FadeIn className="mt-8 flex justify-center px-4 md:mt-12">
        <Link
          to="/prompts?type=video"
          className="group inline-flex h-14 items-center gap-2 rounded-full bg-lime px-7 text-base font-semibold text-ink transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
        >
          All video prompts
          <span className="rounded-full bg-ink/10 px-2 py-0.5 text-sm">{videos.length}</span>
          <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </FadeIn>
    </section>
  )
}
