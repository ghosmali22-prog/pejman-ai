import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CodePreview } from '../features/code/CodePreview'
import { buildPreviewDocument, canLivePreview, itemFiles } from '../lib/code'
import { useSiteData } from '../providers/SiteDataProvider'
import { loadDemo } from '../services/code'

type PremiumDemo = { slug: string; doc: string } | { slug: string; error: string }

/**
 * Full-screen live demo at /demo/?id=<slug> — no header or footer, so demos that need the whole
 * viewport (or the camera) get it. Premium demos only ever come from the protected demo-url function.
 */
export function DemoPage() {
  const [params] = useSearchParams()
  const slug = params.get('id')
  const { codeItems, loading } = useSiteData()
  const item = slug ? codeItems.find((c) => c.slug === slug) : undefined
  const [premium, setPremium] = useState<PremiumDemo | null>(null)

  const freeDoc = useMemo(
    () => (item && !item.is_premium && canLivePreview(item) ? buildPreviewDocument(itemFiles(item)) : null),
    [item],
  )

  const premiumSlug = item?.is_premium && item.has_demo ? item.slug : null
  useEffect(() => {
    if (!premiumSlug) return
    let cancelled = false
    loadDemo(premiumSlug).then(
      (doc) => !cancelled && setPremium({ slug: premiumSlug, doc }),
      (err) =>
        !cancelled &&
        setPremium({
          slug: premiumSlug,
          error: err instanceof Error && err.message.startsWith('Too many') ? err.message : 'Live demo unavailable — please try again later.',
        }),
    )
    return () => {
      cancelled = true
    }
  }, [premiumSlug])

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  useEffect(() => {
    if (!item) return
    const prev = document.title
    document.title = `${item.title} — live demo · PEJMAN AI`
    return () => {
      document.title = prev
    }
  }, [item])

  const current = premiumSlug && premium?.slug === premiumSlug ? premium : null
  const doc = premiumSlug ? (current && 'doc' in current ? current.doc : null) : freeDoc
  const busy = loading || (premiumSlug !== null && current === null)
  const message = !item
    ? "This demo doesn't exist."
    : current && 'error' in current
      ? current.error
      : 'This item has no live demo.'

  return (
    <main className="h-svh w-screen overflow-hidden bg-ink text-paper">
      <Link
        to="/"
        className="fixed left-4 top-4 z-50 inline-flex h-10 items-center gap-2 rounded-full bg-ink/80 px-4 text-sm font-semibold text-paper ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-lime hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Back to PEJMAN AI
      </Link>
      {busy ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="size-8 animate-spin text-lime" aria-label="Loading demo" />
        </div>
      ) : item && doc !== null ? (
        <CodePreview html={doc} title={`${item.title} (live demo)`} fill camera className="fixed inset-0" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <p className="text-lg text-paper">{message}</p>
          <Link
            to="/"
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-lime px-6 font-semibold text-ink"
          >
            Back to home <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </main>
  )
}
