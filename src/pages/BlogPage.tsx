import { useGSAP } from '@gsap/react'
import { useEffect, useRef, useState } from 'react'
import { RevealText } from '../components/motion/RevealText'
import { blogUrl, readEmbedded } from '../features/blog/blog'
import { PostCard } from '../features/blog/PostCard'
import { usePageMeta } from '../hooks/usePageMeta'
import { gsap, ScrollTrigger } from '../lib/motion'
import { useMotion } from '../providers/MotionProvider'
import { fetchPosts } from '../services/posts'
import type { Post } from '../types'

const DESCRIPTION =
  'Notes from PEJMAN AI on AI images, motion, websites and automations: what works, with the prompts behind it.'

/** /blog — every published post, newest first. */
export function BlogPage() {
  const { level } = useMotion()
  const gridRef = useRef<HTMLDivElement>(null)
  const [posts, setPosts] = useState<Post[] | null>(() => readEmbedded<Post[]>('blog-posts'))
  const [error, setError] = useState(false)

  usePageMeta({ title: 'Blog · PEJMAN AI', description: DESCRIPTION, canonical: blogUrl() })

  useEffect(() => {
    let alive = true
    fetchPosts()
      .then((p) => alive && setPosts(p))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [])

  useGSAP(
    () => {
      if (level === 'none' || !gridRef.current) return
      const cards = gsap.utils.toArray<HTMLElement>('.post-card', gridRef.current)
      if (!cards.length) return
      gsap.set(cards, { autoAlpha: 0, y: 50 })
      ScrollTrigger.batch(cards, {
        start: 'top 95%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.08, ease: 'expo.out', overwrite: true }),
      })
      requestAnimationFrame(() => ScrollTrigger.refresh())
    },
    { scope: gridRef, dependencies: [level, posts?.map((p) => p.id).join(',')], revertOnUpdate: true },
  )

  const [first, ...rest] = posts ?? []

  return (
    <main className="min-h-svh bg-paper text-ink">
      <header className="relative overflow-hidden bg-ink pb-14 pt-32 text-paper md:pb-20 md:pt-44">
        <div aria-hidden="true" className="lime-glow pointer-events-none absolute inset-x-0 bottom-0 h-64" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          <span className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-paper/70">
            <span className="size-2 rounded-full bg-lime" />
            {posts ? `${posts.length} ${posts.length === 1 ? 'article' : 'articles'}` : 'Journal'}
          </span>
          <RevealText as="h1" text="Blog" className="display text-[30vw] md:text-[200px]" />
          <p className="mt-6 max-w-lg text-base text-paper/60 md:text-lg">{DESCRIPTION}</p>
        </div>
      </header>

      <div ref={gridRef} className="mx-auto max-w-7xl px-4 pb-28 pt-12 sm:px-6 md:px-8 md:pb-40 md:pt-20">
        {!posts && !error && (
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <div className="aspect-[16/11] animate-pulse rounded-[24px] bg-paper-2" />
                <div className="mt-5 h-4 w-32 animate-pulse rounded-full bg-paper-2" />
                <div className="mt-4 h-7 w-4/5 animate-pulse rounded-full bg-paper-2" />
              </div>
            ))}
          </div>
        )}
        {error && !posts && <p className="py-20 text-center text-ink/60">Could not load posts. Please refresh.</p>}
        {posts && posts.length === 0 && (
          <p className="heading py-24 text-center text-3xl text-ink/70">First posts are on the way.</p>
        )}
        {first && <PostCard post={first} large />}
        {rest.length > 0 && (
          <div className="mt-16 grid gap-x-8 gap-y-14 border-t border-ink/10 pt-14 sm:grid-cols-2 md:mt-24 md:pt-20 lg:grid-cols-3">
            {rest.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
