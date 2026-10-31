import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CodePlaceholder } from '../../features/code/CodeThumb'
import { languageLabel } from '../../lib/code'
import { useToast } from '../../providers/ToastProvider'
import type { CodeItemRow } from '../../types'
import { Badge, Button, Card, Empty, PageHeader, Spinner, cx, useConfirm } from '../components/ui'
import * as api from '../lib/api'
import { useI18n } from '../lib/i18n'
import { useLoad } from '../lib/useLoad'

type Filter = 'all' | 'published' | 'draft' | 'featured' | 'premium'

/** Admin list of code items — same layout and phone-friendly actions as the prompt list. */
export function CodeListPage() {
  const { t, n } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const { data, setData, reload } = useLoad(() => api.code.list())
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const rows = data ?? []
  const filtered = rows.filter((c) => {
    if (filter === 'published' && !c.is_published) return false
    if (filter === 'draft' && c.is_published) return false
    if (filter === 'featured' && !c.is_featured) return false
    if (filter === 'premium' && !c.is_premium) return false
    const s = q.trim().toLowerCase()
    return !s || `${c.title} ${c.short_description} ${c.category} ${c.language}`.toLowerCase().includes(s)
  })
  const reorderable = filter === 'all' && !q

  const patch = async (c: CodeItemRow, change: Partial<CodeItemRow>) => {
    setBusy(c.id)
    setData((d) => (d ? d.map((x) => (x.id === c.id ? { ...x, ...change } : x)) : d))
    try {
      await api.code.update(c.id, change)
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
    setData(next)
    try {
      await api.code.reorder(next)
      await reload()
    } catch {
      toast(t.error)
      reload()
    }
  }

  const remove = async (c: CodeItemRow) => {
    if (!(await confirm(t.confirmDeleteCode))) return
    setBusy(c.id)
    try {
      await api.code.remove(c)
      toast(t.deleted)
      await reload()
    } catch {
      toast(t.error)
    } finally {
      setBusy(null)
    }
  }

  const addButton = (label: string) => (
    <Link
      to="/admin/code/new"
      className="inline-flex h-11 items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-ink"
    >
      <Plus className="size-4" /> {label}
    </Link>
  )

  return (
    <div>
      <PageHeader
        title={t.code}
        subtitle={
          data
            ? `${n(rows.length)} · ${t.publishedOf(rows.filter((c) => c.is_published).length, rows.filter((c) => !c.is_published).length).replace(/\d+/g, (m) => n(Number(m)))}`
            : undefined
        }
        actions={addButton(t.addCode)}
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {(['all', 'published', 'draft', 'featured', 'premium'] as Filter[]).map((f) => (
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
        <Empty text={t.noCode} action={addButton(t.createFirstCode)} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((c) => {
            const index = rows.indexOf(c)
            const actions = (
              <Actions
                c={c}
                canUp={reorderable && index > 0}
                canDown={reorderable && index < rows.length - 1}
                onUp={() => move(index, -1)}
                onDown={() => move(index, 1)}
                onPatch={(ch) => patch(c, ch)}
                onDelete={() => remove(c)}
              />
            )
            return (
              <Card key={c.id} className={cx('p-3 transition-opacity md:p-3.5', busy === c.id && 'opacity-60')}>
                <div className="flex items-center gap-3 md:gap-4">
                  <Link to={`/admin/code/${c.id}`} className="shrink-0 overflow-hidden rounded-2xl">
                    {c.preview_image_url ? (
                      <img src={c.preview_image_url} alt="" loading="lazy" className="h-16 w-24 object-cover object-top md:h-[72px] md:w-28" />
                    ) : (
                      <div className="h-16 w-24 md:h-[72px] md:w-28 [&_p]:hidden">
                        <CodePlaceholder item={c} className="size-full !p-2.5" />
                      </div>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/code/${c.id}`} className="block truncate font-semibold" dir="auto">
                      {c.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-paper/45" dir="ltr">
                      {[c.category, languageLabel(c.language), c.files.length > 1 ? `${c.files.length} files` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone={c.is_published ? 'lime' : 'mute'}>{c.is_published ? t.published : t.draft}</Badge>
                      {c.is_featured && (
                        <Badge tone="white">
                          <Star className="size-3 fill-current" /> {t.featured}
                        </Badge>
                      )}
                      {c.is_premium && (
                        <Badge tone="mute">
                          <Lock className="size-3" /> {t.premium}
                        </Badge>
                      )}
                      {!c.is_premium && <span className="text-[11px] text-paper/40">{t.copyCount(n(c.copy_count))}</span>}
                    </div>
                  </div>
                  <div className="hidden items-center gap-1 md:flex">{actions}</div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-1 border-t border-white/[0.06] pt-3 md:hidden">
                  {actions}
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
  c,
  canUp,
  canDown,
  onUp,
  onDown,
  onPatch,
  onDelete,
}: {
  c: CodeItemRow
  canUp: boolean
  canDown: boolean
  onUp: () => void
  onDown: () => void
  onPatch: (ch: Partial<CodeItemRow>) => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  return (
    <>
      <Button size="icon" variant="ghost" onClick={onUp} disabled={!canUp} aria-label={t.moveUp} title={t.moveUp}>
        <ArrowUp className="size-[18px]" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onDown} disabled={!canDown} aria-label={t.moveDown} title={t.moveDown}>
        <ArrowDown className="size-[18px]" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => onPatch({ is_published: !c.is_published })}
        aria-label={c.is_published ? t.unpublish : t.publish}
        title={c.is_published ? t.unpublish : t.publish}
      >
        {c.is_published ? <Eye className="size-[18px] text-lime" /> : <EyeOff className="size-[18px]" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => onPatch({ is_featured: !c.is_featured })}
        aria-label={t.featured}
        title={t.featured}
      >
        <Star className={cx('size-[18px]', c.is_featured && 'fill-lime text-lime')} />
      </Button>
      <Link
        to={`/admin/code/${c.id}`}
        aria-label={t.edit}
        title={t.edit}
        className="inline-flex size-11 items-center justify-center rounded-full text-paper/70 hover:bg-white/[0.06] hover:text-paper"
      >
        <Pencil className="size-[18px]" />
      </Link>
      <Button size="icon" variant="ghost" onClick={onDelete} aria-label={t.delete} title={t.delete} className="hover:text-red-300">
        <Trash2 className="size-[18px]" />
      </Button>
    </>
  )
}
