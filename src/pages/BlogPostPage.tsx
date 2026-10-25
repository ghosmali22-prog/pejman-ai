import { ArrowLeft, ArrowRight, Check, Link2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { TelegramIcon, WhatsAppIcon } from '../components/ui/BrandIcons'
import { langProps, postDate, postUrl, readEmbedded, readTime } from '../features/blog/blog'
import { PostCard } from '../features/blog/PostCard'
import { useSectionLink } from '../hooks/useSectionLink'
import { usePageMeta } from '../hooks/usePageMeta'
import { copyText } from '../lib/clipboard'
import { fetchPost, fetchPosts } from '../services/posts'
import type { Post } from '../types'

/** The post that came embedded in a prerendered page, if it is the one being opened. */
const embeddedPost = (slug?: string) => {
  const p = readEmbedded<Post>('blog-post')
  return p && p.slug === slug ? p : null
}

/** /blog/:slug — one article. */
export function BlogPostPage() {
  const { slug } = useParams()
  const go = useSectionLink()
  const [post, setPost] = useState<Post | null | undefined>(() => embeddedPost(slug) ?? undefined)
  const [more, setMore] = useState<Post[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!slug) return
    // SiteLayout remounts the page for every new path, so state starts fresh for each post.
    let alive = true
    fetchPost(slug)
      .then((p) => alive && setPost(p))
      .catch(() => alive && setPost((cur) => cur ?? null))
    fetchPosts()
      .then((ps) => alive && setMore(ps.filter((p) => p.slug !== slug).slice(0, 3)))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [slug])

  usePageMeta(
    post
      ? {
          title: `${post.seo_title || post.title} · PEJMAN AI`,
          description: post.seo_description || post.excerpt,
          canonical: postUrl(post.slug),
        }
      : null,
  )

  if (post === null) return <Missing />
  if (!post) return <Loading />

  const lp = langProps(post.lang)
  const url = postUrl(post.slug)
  const share = [
    { label: 'WhatsApp', Icon: WhatsAppIcon, href: `https://wa.me/?text=${encodeURIComponent(`${post.title} ${url}`)}` },
    {
      label: 'Telegram',
      Icon: TelegramIcon,
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}`,
    },
  ]
  const onCopy = async () => {
    if (await copyText(url)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <main className="min-h-svh bg-paper text-ink">
      <header className="relative overflow-hidden bg-ink pb-40 pt-32 text-paper md:pb-56 md:pt-44">
        <div aria-hidden="true" className="lime-glow pointer-events-none absolute inset-x-0 bottom-0 h-64 opacity-60" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 md:px-8">
          <Link
            to="/blog"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-paper/60 transition-colors hover:text-lime"
          >
            <ArrowLeft className="size-4" /> All posts
          </Link>
          <div dir={lp.dir} lang={lp.lang} className={lp.className}>
            {post.tags.length > 0 && (
              <ul className="mb-6 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <li key={tag} dir="auto" className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-paper/75">
                    #{tag}
                  </li>
                ))}
              </ul>
            )}
            <h1 className="heading text-[40px] sm:text-[52px] md:text-[72px]">{post.title}</h1>
            {post.excerpt && <p className="mt-6 max-w-2xl text-lg text-paper/60 md:text-xl">{post.excerpt}</p>}
            <div className="mt-8 flex items-center gap-3 text-sm">
              <span className="flex size-10 items-center justify-center rounded-full bg-lime font-bold text-ink" dir="ltr">
                P
              </span>
              <span className="flex flex-col">
                <span className="font-semibold text-paper">{post.lang === 'fa' ? 'پژمان انصاری‌برز' : 'Pejman Ansaribarz'}</span>
                <span className="text-paper/50">
                  <time dateTime={post.published_at ?? post.created_at}>{postDate(post)}</time> · {readTime(post)}
                </span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="relative mx-auto -mt-28 max-w-6xl px-4 sm:px-6 md:-mt-40 md:px-8">
        {post.cover_url && (
          <img
            src={post.cover_url}
            alt={post.cover_alt || post.title}
            width={post.cover_width ?? undefined}
            height={post.cover_height ?? undefined}
            fetchPriority="high"
            className="aspect-[16/9] w-full rounded-[24px] bg-paper-2 object-cover shadow-[0_30px_80px_-30px_rgb(0_0_0/0.45)] md:rounded-[36px]"
          />
        )}
      </div>

      <article
        dir={lp.dir}
        lang={lp.lang}
        className={`post-body mx-auto max-w-[720px] px-5 pb-16 pt-14 md:pt-20 ${lp.className}`}
        dangerouslySetInnerHTML={{ __html: post.content_html }}
      />

      <div className="mx-auto max-w-[720px] px-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-ink/10 py-6">
          <p className="text-sm font-medium text-ink/55">Share this post</p>
          <div className="flex gap-2">
            {share.map(({ label, Icon, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={`Share on ${label}`}
                className="flex size-11 items-center justify-center rounded-full bg-ink/[0.06] text-ink transition-colors hover:bg-lime"
              >
                <Icon className="size-[18px]" />
              </a>
            ))}
            <button
              type="button"
              onClick={onCopy}
              className="flex h-11 items-center gap-2 rounded-full bg-ink/[0.06] px-4 text-sm font-semibold transition-colors hover:bg-lime"
            >
              {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>

        <div className="relative mt-14 overflow-hidden rounded-[28px] bg-ink p-8 text-paper md:p-10">
          <div aria-hidden="true" className="lime-glow pointer-events-none absolute inset-x-0 bottom-0 h-40 opacity-70" />
          <p className="heading relative text-[32px] md:text-[40px]">Want this for your brand?</p>
          <p className="relative mt-3 max-w-md text-paper/60">
            AI photos, motion videos, websites and automations — on-site in Bangkok or remote.
          </p>
          <button
            type="button"
            onClick={() => go('contact')}
            className="group relative mt-6 inline-flex h-13 items-center gap-2 rounded-full bg-lime px-6 font-semibold text-ink"
          >
            Work with me <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>

      {more.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-28 pt-24 sm:px-6 md:px-8 md:pb-40">
          <h2 className="heading mb-10 text-[36px] md:text-[48px]">More posts</h2>
          <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
      {more.length === 0 && <div className="pb-28" />}
    </main>
  )
}

function Loading() {
  return (
    <main className="min-h-svh bg-paper" aria-busy="true">
      <div className="bg-ink pb-40 pt-44">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 md:px-8">
          <div className="h-14 w-4/5 animate-pulse rounded-full bg-white/10" />
          <div className="mt-6 h-5 w-2/3 animate-pulse rounded-full bg-white/10" />
        </div>
      </div>
    </main>
  )
}

function Missing() {
  return (
    <main className="flex min-h-[80svh] flex-col items-center justify-center px-6 pt-24 text-center">
      <p className="heading text-4xl md:text-5xl">This post doesn't exist.</p>
      <Link
        to="/blog"
        className="mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-lime px-7 font-semibold text-ink"
      >
        All posts <ArrowRight className="size-5" />
      </Link>
    </main>
  )
}
