import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useToast } from '../../providers/ToastProvider'
import type { Category } from '../../types'
import { Button, Card, Input, PageHeader, Spinner, useConfirm } from '../components/ui'
import * as api from '../lib/api'
import { useI18n } from '../lib/i18n'
import { slugify, uniqueSlug } from '../lib/slug'
import { useLoad } from '../lib/useLoad'

export function CategoriesPage() {
  const { t, n } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const { data, setData, reload } = useLoad(() => Promise.all([api.categories.list(), api.prompts.list()]))
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const cats = data?.[0] ?? []
  const counts = new Map<string, number>()
  data?.[1].forEach((p) => counts.set(p.category, (counts.get(p.category) ?? 0) + 1))
  const slugs = new Set(cats.map((c) => c.slug))

  const wrap = async (fn: () => Promise<unknown>, msg = t.saved) => {
    setBusy(true)
    try {
      await fn()
      toast(msg)
      await reload()
    } catch {
      toast(t.error)
    } finally {
      setBusy(false)
    }
  }

  const add = (e: FormEvent) => {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return
    wrap(async () => {
      await api.categories.create(clean, uniqueSlug(slugify(clean) || 'category', slugs))
      setName('')
    })
  }

  const rename = (c: Category) => {
    const clean = editing?.name.trim()
    setEditing(null)
    if (!clean || clean === c.name) return
    const others = new Set([...slugs].filter((s) => s !== c.slug))
    wrap(() => api.categories.update(c.id, { name: clean, slug: uniqueSlug(slugify(clean) || c.slug, others) }))
  }

  const move = (i: number, dir: -1 | 1) => {
    const next = [...cats]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setData((d) => (d ? [next, d[1]] : d))
    wrap(() => api.categories.reorder(next))
  }

  return (
    <div>
      <PageHeader title={t.categories} subtitle={data ? n(cats.length) : undefined} />

      <Card className="mb-4 p-3">
        <form onSubmit={add} className="flex gap-2">
          <Input
            dir="ltr"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.categoryName}
            aria-label={t.categoryName}
          />
          <Button type="submit" variant="lime" loading={busy} className="h-12 px-5">
            <Plus className="size-4" /> <span className="hidden sm:inline">{t.addCategory}</span>
          </Button>
        </form>
      </Card>

      {!data ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-2">
          {cats.map((c, i) => (
            <Card key={c.id} className="flex items-center gap-2 p-2 ps-4">
              {editing?.id === c.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    rename(c)
                  }}
                >
                  <Input
                    dir="ltr"
                    autoFocus
                    value={editing.name}
                    onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                  />
                  <Button type="submit" size="icon" variant="lime" aria-label={t.save}>
                    <Check className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={t.cancel} onClick={() => setEditing(null)}>
                    <X className="size-4" />
                  </Button>
                </form>
              ) : (
                <>
                  <div className="min-w-0 flex-1" dir="ltr">
                    <p className="truncate text-start font-semibold">{c.name}</p>
                    <p className="text-start text-xs text-paper/40">
                      /{c.slug} · {t.promptsCount(n(counts.get(c.slug) ?? 0))}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={t.moveUp}
                  >
                    <ArrowUp className="size-[18px]" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={i === cats.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={t.moveDown}
                  >
                    <ArrowDown className="size-[18px]" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditing({ id: c.id, name: c.name })}
                    aria-label={t.edit}
                  >
                    <Pencil className="size-[18px]" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="hover:text-red-300"
                    aria-label={t.delete}
                    onClick={async () =>
                      (await confirm(t.confirmDeleteCategory)) && wrap(() => api.categories.remove(c), t.deleted)
                    }
                  >
                    <Trash2 className="size-[18px]" />
                  </Button>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
