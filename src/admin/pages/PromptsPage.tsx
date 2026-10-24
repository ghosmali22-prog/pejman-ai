import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../../providers/ToastProvider'
import type { PromptRow } from '../../types'
import { Badge, Button, Card, Empty, PageHeader, Spinner, cx, useConfirm } from '../components/ui'
import * as api from '../lib/api'
import { useI18n } from '../lib/i18n'
import { useLoad } from '../lib/useLoad'

type Filter = 'all' | 'published' | 'draft' | 'featured'

export function PromptsPage() {
  const { t, n } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const { data, setData, reload } = useLoad(() => Promise.all([api.prompts.list(), api.categories.list()]))
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const rows = data?.[0] ?? []
  const catName = useMemo(() => new Map((data?.[1] ?? []).map((c) => [c.slug, c.name])), [data])
  const filtered = rows.filter((p) => {
    if (filter === 'published' && !p.published) return false
    if (filter === 'draft' && p.published) return false
    if (filter === 'featured' && !p.featured) return false
    const s = q.trim().toLowerCase()
    return !s || `${p.title} ${p.prompt} ${p.model} ${(p.tags ?? []).join(' ')}`.toLowerCase().includes(s)
  })
  const reorderable = filter === 'all' && !q

  const patch = async (p: PromptRow, change: Partial<PromptRow>) => {
    setBusy(p.id)
    // Optimistic update so toggles feel instant on the phone.
    setData((d) => (d ? [d[0].map((x) => (x.id === p.id ? { ...x, ...change } : x)), d[1]] : d))
    try {
      await api.prompts.update(p.id, change)
      toast(t.saved)
    } catch {
      toast(t.error)
      reload()
    } finally {
      setBusy(null)
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...rows]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    setData((d) => (d ? [next, d[1]] : d))
    try {
      await api.prompts.reorder(next)
      await reload()
    } catch {
      toast(t.error)
      reload()
    }
  }

  const remove = async (p: PromptRow) => {
    if (!(await confirm(t.confirmDeletePrompt))) return
    setBusy(p.id)
    try {
      await api.prompts.remove(p)
      toast(t.deleted)
      await reload()
    } catch {
      toast(t.error)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        title={t.prompts}
        subtitle={
          data
            ? `${n(rows.length)} · ${t.publishedOf(rows.filter((p) => p.published).length, rows.filter((p) => !p.published).length).replace(/\d+/g, (m) => n(Number(m)))}`
            : undefined
        }
        actions={
          <Link
            to="/admin/prompts/new"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-ink"
          >
            <Plus className="size-4" /> {t.addPrompt}
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {(['all', 'published', 'draft', 'featured'] as Filter[]).map((f) => (
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
        <Empty
          text={t.noPrompts}
          action={
            <Link
              to="/admin/prompts/new"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-ink"
            >
              <Plus className="size-4" /> {t.createFirst}
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((p) => {
            const index = rows.indexOf(p)
            return (
              <Card key={p.id} className={cx('p-3 transition-opacity md:p-3.5', busy === p.id && 'opacity-60')}>
                <div className="flex items-center gap-3 md:gap-4">
                  <Link to={`/admin/prompts/${p.id}`} className="shrink-0">
                    <img
                      src={p.image_url}
                      alt=""
                      loading="lazy"
                      className="size-16 rounded-2xl object-cover md:size-[72px]"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/prompts/${p.id}`} className="block truncate font-semibold" dir="auto">
                      {p.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-paper/45" dir="ltr">
                      {[catName.get(p.category) ?? p.category, p.model].filter(Boolean).join(' · ')}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone={p.published ? 'lime' : 'mute'}>{p.published ? t.published : t.draft}</Badge>
                      {p.featured && (
                        <Badge tone="white">
                          <Star className="size-3 fill-current" /> {t.featured}
                        </Badge>
                      )}
                      <span className="text-[11px] text-paper/40">{t.copyCount(n(p.copy_count))}</span>
                    </div>
                  </div>

                  {/* Desktop actions */}
                  <div className="hidden items-center gap-1 md:flex">
                    <Actions
                      p={p}
                      canUp={reorderable && index > 0}
                      canDown={reorderable && index < rows.length - 1}
                      onUp={() => move(index, -1)}
                      onDown={() => move(index, 1)}
                      onPatch={(c) => patch(p, c)}
                      onDelete={() => remove(p)}
                    />
                  </div>
                </div>
                {/* Mobile actions: big tap targets */}
                <div className="mt-3 flex items-center justify-between gap-1 border-t border-white/[0.06] pt-3 md:hidden">
                  <Actions
                    p={p}
                    canUp={reorderable && index > 0}
                    canDown={reorderable && index < rows.length - 1}
                    onUp={() => move(index, -1)}
                    onDown={() => move(index, 1)}
                    onPatch={(c) => patch(p, c)}
                    onDelete={() => remove(p)}
                  />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Actions({
  p,
  canUp,
  canDown,
  onUp,
  onDown,
  onPatch,
  onDelete,
}: {
  p: PromptRow
  canUp: boolean
  canDown: boolean
  onUp: () => void
  onDown: () => void
  onPatch: (c: Partial<PromptRow>) => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  return (
    <>
      <Button size="icon" variant="ghost" onClick={onUp} disabled={!canUp} aria-label={t.moveUp} title={t.moveUp}>
        <ArrowUp className="size-[18px]" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={onDown}
        disabled={!canDown}
        aria-label={t.moveDown}
        title={t.moveDown}
      >
        <ArrowDown className="size-[18px]" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => onPatch({ published: !p.published })}
        aria-label={p.published ? t.unpublish : t.publish}
        title={p.published ? t.unpublish : t.publish}
      >
        {p.published ? <Eye className="size-[18px] text-lime" /> : <EyeOff className="size-[18px]" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => onPatch({ featured: !p.featured })}
        aria-label={t.featured}
        title={t.featured}
      >
        <Star className={cx('size-[18px]', p.featured && 'fill-lime text-lime')} />
      </Button>
      <Link
        to={`/admin/prompts/${p.id}`}
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
