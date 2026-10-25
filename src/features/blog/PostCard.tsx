import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Post } from '../../types'
import { langProps, postDate, postPath, readTime } from './blog'

/** Blog list card. `large` is the newest post, shown wide at the top of the list. */
export function PostCard({ post, large = false }: { post: Post; large?: boolean }) {
  const lp = langProps(post.lang)
  return (
    <Link
      to={postPath(post.slug)}
      className={`post-card group block ${large ? 'md:grid md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-center md:gap-10' : ''}`}
    >
      <div
        className={`relative overflow-hidden rounded-[24px] bg-paper-2 md:rounded-[28px] ${large ? 'aspect-[16/10]' : 'aspect-[16/11]'}`}
      >
        {post.cover_url ? (
          <img
            src={post.cover_url}
            alt={post.cover_alt || post.title}
            width={post.cover_width ?? undefined}
            height={post.cover_height ?? undefined}
            loading={large ? 'eager' : 'lazy'}
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-ink">
            <span className="display text-5xl text-lime">PEJMAN AI</span>
          </div>
        )}
        <span className="absolute right-4 top-4 flex size-11 translate-y-1 items-center justify-center rounded-full bg-lime text-ink opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight className="size-5" />
        </span>
      </div>
      <div dir={lp.dir} lang={lp.lang} className={`mt-5 ${large ? 'md:mt-0' : ''} ${lp.className}`}>
        <p className="flex flex-wrap items-center gap-x-2 text-[13px] font-medium text-ink/50">
          <span>{postDate(post)}</span>
          <span aria-hidden="true">·</span>
          <span>{readTime(post)}</span>
        </p>
        <h2
          className={`heading mt-3 text-ink transition-colors group-hover:text-ink/70 ${large ? 'text-[32px] md:text-[48px]' : 'text-[26px]'}`}
        >
          {post.title}
        </h2>
        {post.excerpt && (
          <p className={`mt-3 text-ink/60 ${large ? 'text-base md:text-lg' : 'line-clamp-3 text-[15px]'}`}>
            {post.excerpt}
          </p>
        )}
        {post.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {post.tags.slice(0, 3).map((tag) => (
              <li key={tag} dir="auto" className="rounded-full bg-ink/[0.06] px-3 py-1 text-xs font-medium text-ink/60">
                #{tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  )
}
