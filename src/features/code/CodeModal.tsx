import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Copy, Download, Lock, Mail, Monitor, Share2, Smartphone, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { InstagramIcon, TelegramIcon, WhatsAppIcon } from '../../components/ui/BrandIcons'
import { contactLinks } from '../../config/site'
import { codeUrl, copyText } from '../../lib/clipboard'
import { canLivePreview, itemFiles, languageLabel } from '../../lib/code'
import { useMotion } from '../../providers/MotionProvider'
import { useSiteData } from '../../providers/SiteDataProvider'
import { useToast } from '../../providers/ToastProvider'
import { isFirstCopy, trackCodeCopy } from '../../services/code'
import type { CodeItem } from '../../types'
import type { Device } from './CodePreview'
import { CodeThumb } from './CodeThumb'
import { CodeViewer } from './CodeViewer'
import { downloadFiles } from './download'

const EASE = [0.16, 1, 0.3, 1] as const

/** Code detail overlay. Opens on any page with ?code=<slug>, so every item has a shareable link. */
export function CodeModal() {
  const [params, setParams] = useSearchParams()
  const slug = params.get('code')
  const { codeItems, loading } = useSiteData()
  const navigate = useNavigate()
  const location = useLocation()
  const { lenis } = useMotion()

  const item = slug ? codeItems.find((c) => c.slug === slug) : undefined
  const open = Boolean(slug) && !loading

  const close = () => {
    if ((location.state as { codeModal?: boolean } | null)?.codeModal) navigate(-1)
    else
      setParams(
        (p) => {
          p.delete('code')
          return p
        },
        { replace: true, preventScrollReset: true },
      )
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
    if (!item) return
    const prev = document.title
    document.title = `${item.title} — ready-made UI code · PEJMAN AI`
    return () => {
      document.title = prev
    }
  }, [item])

  return (
    <AnimatePresence>{open && <CodeDialog key={item?.id ?? 'missing'} item={item} onClose={close} />}</AnimatePresence>
  )
}

function CodeDialog({ item, onClose }: { item?: CodeItem; onClose: () => void }) {
  const toast = useToast()
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onShare = async () => {
    if (!item) return
    const url = codeUrl(item.slug)
    if (navigator.share) {
      try {
        await navigator.share({ title: `${item.title} — UI code`, url })
        return
      } catch {
        /* cancelled — fall through to copying the link */
      }
    }
    if (await copyText(url)) toast('Link copied!')
  }

  return (
    <motion.div
      className="fixed inset-0 z-[150] flex items-end justify-center md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={item?.title ?? 'Code not found'}
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
        className="relative max-h-[94svh] w-full max-w-6xl overflow-y-auto overscroll-contain rounded-t-[28px] bg-ink-2 text-paper ring-1 ring-white/10 md:max-h-[92vh] md:rounded-[32px]"
        variants={{ hidden: { opacity: 0, y: 80 }, show: { opacity: 1, y: 0 } }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sticky left-full top-3 z-20 mr-3 mt-3 flex size-11 items-center justify-center rounded-full bg-paper text-ink transition-transform duration-300 hover:rotate-90"
        >
          <X className="size-5" />
        </button>
        {item ? (
          <CodeDetail item={item} onShare={onShare} />
        ) : (
          <div className="-mt-14 px-6 pb-14 pt-16 text-center">
            <p className="heading text-4xl">Code not found</p>
            <p className="mt-3 text-paper/60">It may have been removed or renamed.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-lime px-6 font-semibold text-ink"
            >
              Browse all code <ArrowRight className="size-4" />
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

function CodeDetail({ item, onShare }: { item: CodeItem; onShare: () => void }) {
  const toast = useToast()
  const files = itemFiles(item)
  const live = canLivePreview(item)
  const [device, setDevice] = useState<Device>('desktop')
  const [tab, setTab] = useState(0)
  const [copied, setCopied] = useState(false)
  const [count, setCount] = useState(item.copy_count)
  const file = files[tab] ?? files[0]

  const onCopy = async () => {
    if (!file) return
    if (!(await copyText(file.content))) {
      toast('Could not copy — please select the code')
      return
    }
    setCopied(true)
    toast(files.length > 1 ? `Copied ${file.name}` : 'Code copied!')
    window.setTimeout(() => setCopied(false), 2000)
    if (isFirstCopy(item)) setCount((c) => c + 1)
    trackCodeCopy(item).catch(() => {})
  }

  const onDownload = () =>
    downloadFiles(files, item.slug).catch(() => toast('Download failed — please try again'))

  return (
    <div className="-mt-14">
      {/* Header */}
      <div className="px-5 pb-5 pt-6 pr-16 sm:px-8 md:px-10 md:pt-9">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {item.category && <span className="rounded-full bg-lime px-3 py-1.5 text-ink">{item.category}</span>}
          <span className="rounded-full px-3 py-1.5 font-mono text-lime ring-1 ring-lime/30">
            {languageLabel(item.language)}
          </span>
          {item.is_premium && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] px-3 py-1.5 text-paper ring-1 ring-white/10">
              <Lock className="size-3" /> Premium
            </span>
          )}
        </div>
        <h2 className="heading mt-4 text-[34px] md:text-5xl">{item.title}</h2>
        {item.short_description && (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-paper/60 md:text-base">{item.short_description}</p>
        )}
      </div>

      {/* Preview */}
      <div className="px-3 sm:px-5 md:px-6">
        <div className="overflow-hidden rounded-[22px] bg-ink ring-1 ring-white/[0.08]">
          {live && (
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2">
              <span className="flex items-center gap-2 ps-1 text-xs font-medium text-paper/50">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-lime" />
                </span>
                Live preview
              </span>
              <div className="flex rounded-full bg-white/[0.05] p-1 ring-1 ring-white/10" role="tablist" aria-label="Preview size">
                {(
                  [
                    ['desktop', Monitor, 'Desktop'],
                    ['mobile', Smartphone, 'Mobile'],
                  ] as const
                ).map(([d, Icon, label]) => (
                  <button
                    key={d}
                    type="button"
                    role="tab"
                    aria-selected={device === d}
                    onClick={() => setDevice(d)}
                    className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors duration-300 ${
                      device === d ? 'bg-paper text-ink' : 'text-paper/60 hover:text-paper'
                    }`}
                  >
                    <Icon className="size-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {live && device === 'mobile' ? (
            <div className="flex justify-center bg-[radial-gradient(60%_80%_at_50%_0%,rgb(198_244_50/0.08),transparent)] px-4 py-6">
              <div className="w-full max-w-[390px] overflow-hidden rounded-[34px] p-2 ring-1 ring-white/15">
                <CodeThumb item={item} device="mobile" className="aspect-[390/760] w-full rounded-[26px]" />
              </div>
            </div>
          ) : (
            <CodeThumb item={item} device="desktop" className="aspect-[4/3] w-full sm:aspect-[16/10] md:max-h-[62vh]" />
          )}
        </div>
      </div>

      {item.is_premium ? (
        <PremiumPanel item={item} onShare={onShare} />
      ) : (
        <div className="px-3 pb-6 pt-5 sm:px-5 md:px-6 md:pb-8">
          {/* File tabs */}
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Files">
              {files.map((f, i) => (
                <button
                  key={f.name}
                  type="button"
                  role="tab"
                  aria-selected={i === tab}
                  onClick={() => setTab(i)}
                  className={`h-9 shrink-0 rounded-full px-3.5 font-mono text-xs font-medium transition-colors duration-300 ${
                    i === tab ? 'bg-paper text-ink' : 'bg-white/[0.05] text-paper/60 ring-1 ring-white/10 hover:text-paper'
                  }`}
                >
                  {f.name.split('/').pop()}
                </button>
              ))}
            </div>
            <span className="shrink-0 text-xs text-paper/45">{count.toLocaleString()} copies</span>
          </div>
          {file && <CodeViewer key={file.name} code={file.content} language={file.language} className="max-h-[52vh]" />}

          {/* Actions */}
          <div className="sticky bottom-0 -mx-3 mt-4 flex gap-2 bg-gradient-to-t from-ink-2 from-70% to-transparent px-3 pb-1 pt-4 sm:-mx-5 sm:px-5 md:static md:mx-0 md:bg-none md:p-0">
            <button
              type="button"
              onClick={onCopy}
              className="relative flex h-14 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full bg-lime text-base font-semibold text-ink transition-transform duration-300 active:scale-[0.98] md:hover:scale-[1.02]"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={copied ? 'done' : 'idle'}
                  initial={{ y: 14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -14, opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="flex items-center gap-2"
                >
                  {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
                  {copied ? 'Copied!' : files.length > 1 ? `Copy ${file?.name.split('/').pop()}` : 'Copy code'}
                </motion.span>
              </AnimatePresence>
            </button>
            <button
              type="button"
              onClick={onDownload}
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-paper px-5 text-base font-semibold text-ink transition-transform duration-300 active:scale-[0.98] sm:px-6 md:hover:scale-[1.02]"
              aria-label={files.length > 1 ? 'Download all files as .zip' : 'Download file'}
            >
              <Download className="size-5" />
              <span className="hidden sm:inline">{files.length > 1 ? 'Download .zip' : 'Download'}</span>
            </button>
            <button
              type="button"
              onClick={onShare}
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-paper ring-1 ring-white/10"
              aria-label="Share this code"
            >
              <Share2 className="size-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Premium items: no code in the browser — a "Get this code" button opens the contact options. */
function PremiumPanel({ item, onShare }: { item: CodeItem; onShare: () => void }) {
  const { settings } = useSiteData()
  const [open, setOpen] = useState(false)
  const links = contactLinks(settings.contact)
  const message = `Hi Pejman! I'd like to get the code for "${item.title}" (${codeUrl(item.slug)}).`
  const options = [
    { label: 'WhatsApp', href: `${links.whatsapp}?text=${encodeURIComponent(message)}`, Icon: WhatsAppIcon },
    { label: 'Telegram', href: links.telegram, Icon: TelegramIcon },
    { label: 'Instagram', href: links.instagram, Icon: InstagramIcon },
    {
      label: 'Email',
      href: `${links.email}?subject=${encodeURIComponent(`Code: ${item.title}`)}&body=${encodeURIComponent(message)}`,
      Icon: Mail,
    },
  ]

  return (
    <div className="px-3 pb-6 pt-5 sm:px-5 md:px-6 md:pb-8">
      <div className="relative overflow-hidden rounded-[22px] bg-lime/[0.06] p-5 ring-1 ring-lime/25 md:p-7">
        <div aria-hidden="true" className="absolute -right-16 -top-16 size-48 rounded-full bg-lime/15 blur-3xl" />
        <p className="relative flex items-center gap-2 text-sm font-semibold text-lime">
          <Lock className="size-4" /> Premium code
        </p>
        <p className="relative mt-2 max-w-xl text-[15px] leading-relaxed text-paper/70">
          This one isn&apos;t free to copy. Message me and I&apos;ll send you the full source — or build a custom version for
          your brand.
        </p>
        <AnimatePresence initial={false} mode="wait">
          {open ? (
            <motion.div
              key="options"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {options.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white/[0.07] text-sm font-semibold text-paper ring-1 ring-white/10 transition-colors hover:bg-white/[0.12]"
                >
                  <Icon className="size-5" /> {label}
                </a>
              ))}
            </motion.div>
          ) : (
            <motion.div key="cta" exit={{ opacity: 0 }} className="relative mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="group flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-lime text-base font-semibold text-ink transition-transform duration-300 active:scale-[0.98] sm:flex-none sm:px-8 md:hover:scale-[1.02]"
              >
                Get this code
                <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
              <button
                type="button"
                onClick={onShare}
                className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-paper ring-1 ring-white/10"
                aria-label="Share this code"
              >
                <Share2 className="size-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
