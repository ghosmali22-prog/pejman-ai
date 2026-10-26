import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Copy, Share2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useMatch, useNavigate } from 'react-router-dom'
import { copyText, promptUrl } from '../../lib/clipboard'
import { useMotion } from '../../providers/MotionProvider'
import { useSiteData } from '../../providers/SiteDataProvider'
import { useToast } from '../../providers/ToastProvider'
import { trackCopy } from '../../services/prompts'
import type { Prompt } from '../../types'

const EASE = [0.16, 1, 0.3, 1] as const
const DEFAULT_TITLE = document.title

/**
 * Prompt detail, shown as an overlay on top of the home page.
 * Every prompt has its own URL (/p/<slug>) so it can be shared on Instagram.
 */
export function PromptModal() {
  const match = useMatch('/p/:slug')
  const slug = match?.params.slug
  const { prompts, loading } = useSiteData()
  const navigate = useNavigate()
  const location = useLocation()
  const { lenis } = useMotion()

  const prompt = slug ? prompts.find((p) => p.slug === slug) : undefined
  const open = Boolean(slug)
  const notFound = open && !loading && !prompt

  const close = () => {
    if ((location.state as { modal?: boolean } | null)?.modal) navigate(-1)
    else navigate('/prompts', { replace: true })
  }

  useEffect(() => {
    if (!open) return
    lenis?.stop()
    document.body.style.overflow = 'hidden'
    return () => {
      lenis?.start()
      document.body.style.overflow = ''
    }
  }, [open, lenis])

  useEffect(() => {
    document.title = prompt ? `${prompt.title} — AI prompt · PEJMAN AI` : DEFAULT_TITLE
  }, [prompt])

  return (
    <AnimatePresence>
      {open && (prompt || notFound) && (
        <PromptDialog
          key={prompt?.id ?? 'missing'}
          prompt={prompt}
          onClose={close}
          goHome={() => navigate('/prompts', { replace: true })}
        />
      )}
    </AnimatePresence>
  )
}

function PromptDialog({ prompt, onClose, goHome }: { prompt?: Prompt; onClose: () => void; goHome: () => void }) {
  const { categories } = useSiteData()
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [count, setCount] = useState(prompt?.copy_count ?? 0)
  const closeRef = useRef<HTMLButtonElement>(null)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onCopy = async () => {
    if (!prompt) return
    const ok = await copyText(prompt.prompt)
    if (!ok) {
      toast('Could not copy — please select the text')
      return
    }
    setCopied(true)
    toast('Copied!')
    window.setTimeout(() => setCopied(false), 2000)
    let first = true
    try {
      first = !sessionStorage.getItem(`pj-copied-${prompt.id}`)
    } catch {
      /* ignore */
    }
    if (first) setCount((c) => c + 1)
    trackCopy(prompt).catch(() => {})
  }

  const onShare = async () => {
    if (!prompt) return
    const url = promptUrl(prompt.slug)
    if (navigator.share) {
      try {
        await navigator.share({ title: `${prompt.title} — AI prompt`, url })
        return
      } catch {
        /* cancelled — fall through to copying the link */
      }
    }
    if (await copyText(url)) toast('Link copied!')
  }

  const category = categories.find((c) => c.slug === prompt?.category)?.name ?? prompt?.category
  const settings = Object.entries(prompt?.settings ?? {}).filter(([, v]) => v)

  return (
    <motion.div
      className="fixed inset-0 z-[150] flex items-end justify-center md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={prompt?.title ?? 'Prompt not found'}
      initial="hidden"
      animate="show"
      exit="hidden"
    >
      <motion.div
        className="absolute inset-0 bg-ink/80 backdrop-blur-md"
        onClick={onClose}
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
        transition={{ duration: 0.5, ease: EASE }}
      />

      <motion.div
        data-lenis-prevent
        className="relative max-h-[94svh] w-full max-w-6xl overflow-y-auto overscroll-contain rounded-t-[28px] bg-paper text-ink md:max-h-[90vh] md:rounded-[32px]"
        variants={{ hidden: { opacity: 0, y: 80 }, show: { opacity: 1, y: 0 } }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sticky left-full top-3 z-10 mr-3 mt-3 flex size-11 items-center justify-center rounded-full bg-ink text-paper transition-transform duration-300 hover:rotate-90"
        >
          <X className="size-5" />
        </button>

        {!prompt ? (
          <div className="-mt-14 px-6 pb-14 pt-16 text-center">
            <p className="heading text-4xl">Prompt not found</p>
            <p className="mt-3 text-ink/60">It may have been removed or renamed.</p>
            <button
              type="button"
              onClick={goHome}
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-lime px-6 font-semibold"
            >
              Browse all prompts <ArrowRight className="size-4" />
            </button>
          </div>
        ) : (
          <div className="-mt-14 grid md:grid-cols-[1.05fr_1fr]">
            <div className="bg-paper-2 p-3 md:p-4">
              {prompt.video_url ? (
                <video
                  src={prompt.video_url}
                  poster={prompt.image_url}
                  width={prompt.image_width ?? undefined}
                  height={prompt.image_height ?? undefined}
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                  preload="auto"
                  aria-label={prompt.title}
                  className="w-full rounded-[22px] bg-ink object-cover md:sticky md:top-4 md:max-h-[calc(90vh-2rem)] md:object-contain"
                />
              ) : (
                <img
                  src={prompt.image_url}
                  alt={prompt.title}
                  width={prompt.image_width ?? undefined}
                  height={prompt.image_height ?? undefined}
                  className="w-full rounded-[22px] object-cover md:sticky md:top-4 md:max-h-[calc(90vh-2rem)] md:object-contain"
                />
              )}
            </div>

            <div className="flex flex-col gap-6 p-5 pb-8 sm:p-8 md:p-10">
              <div className="pr-12">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  {category && <span className="rounded-full bg-lime px-3 py-1.5">{category}</span>}
                  <span className="rounded-full bg-paper-2 px-3 py-1.5">{prompt.model}</span>
                </div>
                <h2 className="heading mt-4 text-4xl md:text-5xl">{prompt.title}</h2>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold">Prompt</span>
                  <span className="text-ink/50">{count.toLocaleString()} copies</span>
                </div>
                <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl bg-ink p-5 font-mono text-[13.5px] leading-relaxed text-paper/90">
                  {prompt.prompt}
                </pre>
              </div>

              {prompt.negative_prompt && (
                <div>
                  <p className="mb-2 text-sm font-semibold">Negative prompt</p>
                  <pre className="whitespace-pre-wrap break-words rounded-2xl bg-paper-2 p-4 font-mono text-[13px] leading-relaxed text-ink/80">
                    {prompt.negative_prompt}
                  </pre>
                </div>
              )}

              {settings.length > 0 && (
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {settings.map(([k, v]) => (
                    <div key={k} className="rounded-2xl bg-paper-2 px-4 py-3">
                      <dt className="text-xs text-ink/50">{k}</dt>
                      <dd className="mt-0.5 text-sm font-semibold">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {prompt.tags?.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {prompt.tags.map((t) => (
                    <li key={t} className="rounded-full px-3 py-1 text-xs text-ink/60 ring-1 ring-ink/10">
                      #{t}
                    </li>
                  ))}
                </ul>
              )}

              <div className="sticky bottom-0 -mx-5 mt-auto flex gap-2 bg-gradient-to-t from-paper from-70% to-transparent px-5 pb-1 pt-4 sm:-mx-8 sm:px-8 md:static md:mx-0 md:bg-none md:p-0">
                <button
                  type="button"
                  onClick={onCopy}
                  className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-lime text-base font-semibold text-ink transition-transform duration-300 active:scale-[0.98] md:hover:scale-[1.02]"
                >
                  {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
                  {copied ? 'Copied!' : 'Copy prompt'}
                </button>
                <button
                  type="button"
                  onClick={onShare}
                  className="flex h-14 items-center justify-center gap-2 rounded-full bg-ink px-6 text-base font-semibold text-paper"
                  aria-label="Share this prompt"
                >
                  <Share2 className="size-5" />
                  <span className="hidden sm:inline">Share</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
