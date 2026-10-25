import { ExternalLink, Eye, EyeOff, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../../providers/ToastProvider'
import type { PostRow } from '../../types'
import { Badge, Button, Card, Empty, PageHeader, Spinner, cx, useConfirm } from '../components/ui'
import * as api from '../lib/api'
import { useI18n } from '../lib/i18n'
import { useLoad } from '../lib/useLoad'

type Filter = 'all' | 'published' | 'draft'

const NewPostLink = ({ label }: { label: string }) => (
  <Link
    to="/admin/blog/new"
    className="inline-flex h-11 items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-ink"
  >
    <Plus className="size-4" /> {label}
  </Link>
)

export function PostsPage() {
  const { t, n, date } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const { data, setData, reload } = useLoad(() => api.posts.list())
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const rows = data ?? []
  const filtered = rows.filter((p) => {
    if (filter === 'published' && !p.published) return false
    if (filter === 'draft' && p.published) return false
    const s = q.trim().toLowerCase()
    return !s || `${p.title} ${p.excerpt} ${p.tags.join(' ')}`.toLowerCase().includes(s)
  })

  const togglePublished = async (p: PostRow) => {
    setBusy(p.id)
    const change = { published: !p.published }
    setData((d) => d?.map((x) => (x.id === p.id ? { ...x, ...change } : x)) ?? d)
    try {
      await api.posts.update(p.id, change)
      toast(t.saved)
      reload()
    } catch {
      toast(t.error)
      reload()
    } finally {
      setBusy(null)
    }
  }

  const remove = async (p: PostRow) => {
    if (!(await confirm(t.confirmDeletePost))) return
    setBusy(p.id)
    try {
      await api.posts.remove(p)
      toast(t.deleted)
      await reload()
    } catch {
      toast(t.error)
    } finally {
      setBusy(null)
    }
  }

  const published = rows.filter((p) => p.published).length

  return (
    <div>
      <PageHeader
        title={t.blog}
        subtitle={
          data
            ? `${n(rows.length)} · ${t.publishedOf(published, rows.length - published).replace(/\d+/g, (m) => n(Number(m)))}`
            : undefined
        }
        actions={<NewPostLink label={t.addPost} />}
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {(['all', 'published', 'draft'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cx(
                'h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors',
                filter === f ? 'bg-paper text-ink' : 'bg-white/[0.05] text-paper/60 ring-1 ring-white/[0.07]',
              )}
            >
              {t[f]}
            </button>
          ))}
        </div>
        <label className="relative flex h-11 items-center md:w-72">
          <Search className="pointer-events-none absolute start-4 size-4 text-paper/35" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
            className="size-full rounded-full bg-ink-2 pe-4 ps-11 text-[16px] outline-none ring-1 ring-white/10 placeholder:text-paper/30 focus:ring-lime/50 md:text-sm"
          />
        </label>
      </div>

      {!data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Empty text={t.noPosts} action={<NewPostLink label={t.createFirstPost} />} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((p) => (
            <Card key={p.id} className={cx('p-3 transition-opacity md:p-3.5', busy === p.id && 'opacity-60')}>
              <div className="flex items-center gap-3 md:gap-4">
                <Link to={`/admin/blog/${p.id}`} className="shrink-0">
                  {p.cover_url ? (
                    <img
                      src={p.cover_url}
                      alt=""
                      loading="lazy"
                      className="h-16 w-24 rounded-2xl object-cover md:h-[72px] md:w-28"
                    />
                  ) : (
                    <span className="flex h-16 w-24 items-center justify-center rounded-2xl bg-white/[0.05] md:h-[72px] md:w-28">
                      <FileText className="size-6 text-paper/30" />
                    </span>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/admin/blog/${p.id}`}
                    className="block truncate font-semibold"
                    dir={p.lang === 'fa' ? 'rtl' : 'ltr'}
                  >
                    {p.title}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-paper/45">
                    {[
                      p.published_at ? date(p.published_at) : date(p.created_at),
                      t.readMin(n(p.reading_minutes)),
                      p.lang === 'fa' ? t.langFa : t.langEn,
                    ].join(' · ')}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone={p.published ? 'lime' : 'mute'}>{p.published ? t.published : t.draft}</Badge>
                  </div>
                </div>
                <div className="hidden items-center gap-1 md:flex">
                  <Actions p={p} onToggle={() => togglePublished(p)} onDelete={() => remove(p)} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-1 border-t border-white/[0.06] pt-3 md:hidden">
                <Actions p={p} onToggle={() => togglePublished(p)} onDelete={() => remove(p)} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function Actions({ p, onToggle, onDelete }: { p: PostRow; onToggle: () => void; onDelete: () => void }) {
  const { t } = useI18n()
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        onClick={onToggle}
        aria-label={p.published ? t.unpublish : t.publish}
        title={p.published ? t.unpublish : t.publish}
      >
        {p.published ? <Eye className="size-[18px] text-lime" /> : <EyeOff className="size-[18px]" />}
      </Button>
      {p.published && (
        <a
          href={`${import.meta.env.BASE_URL}blog/${p.slug}/`}
          target="_blank"
          rel="noreferrer"
          aria-label={t.viewSite}
          title={t.viewSite}
          className="inline-flex size-11 items-center justify-center rounded-full text-paper/70 hover:bg-white/[0.06] hover:text-paper"
        >
          <ExternalLink className="size-[18px]" />
        </a>
      )}
      <Link
        to={`/admin/blog/${p.id}`}
        aria-label={t.edit}
        title={t.edit}
        className="inline-flex size-11 items-center justify-center rounded-full text-paper/70 hover:bg-white/[0.06] hover:text-paper"
      >
        <Pencil className="size-[18px]" />
      </Link>
      <Button
        size="icon"
        variant="ghost"
        onClick={onDelete}
        aria-label={t.delete}
        title={t.delete}
        className="hover:text-red-300"
      >
        <Trash2 className="size-[18px]" />
      </Button>
    </>
  )
}
