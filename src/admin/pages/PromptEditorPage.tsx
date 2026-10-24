import { ArrowLeft, ArrowRight, ExternalLink, ImagePlus, Loader2, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useToast } from '../../providers/ToastProvider'
import type { Category, PromptRow } from '../../types'
import { Button, Card, Field, Input, Select, Spinner, Textarea, Toggle, cx, useConfirm } from '../components/ui'
import * as api from '../lib/api'
import { useI18n } from '../lib/i18n'
import { compressImage, formatBytes, type CompressedImage } from '../lib/image'
import { slugify, uniqueSlug } from '../lib/slug'

const MODELS = [
  'Midjourney v7',
  'Nano Banana',
  'GPT Image',
  'Flux 1.1 Pro',
  'Seedream',
  'Kling',
  'Veo',
  'Ideogram',
  'Leonardo',
]
const RATIOS = ['1:1', '4:5', '3:4', '2:3', '9:16', '16:9']

interface Form {
  title: string
  slug: string
  category: string
  model: string
  prompt: string
  negative_prompt: string
  settings: { k: string; v: string }[]
  tags: string[]
  featured: boolean
  published: boolean
}

const empty: Form = {
  title: '',
  slug: '',
  category: '',
  model: 'Midjourney v7',
  prompt: '',
  negative_prompt: '',
  settings: [],
  tags: [],
  featured: false,
  published: true,
}

export function PromptEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const { t, dir } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const [form, setForm] = useState<Form>(empty)
  const [row, setRow] = useState<PromptRow | null>(null)
  const [all, setAll] = useState<PromptRow[]>([])
  const [cats, setCats] = useState<Category[]>([])
  const [loaded, setLoaded] = useState(false)
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [image, setImage] = useState<CompressedImage | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([api.prompts.list(), api.categories.list()]).then(([ps, cs]) => {
      setAll(ps)
      setCats(cs)
      const r = id ? (ps.find((p) => p.id === id) ?? null) : null
      setRow(r)
      if (r) {
        setForm({
          title: r.title,
          slug: r.slug,
          category: r.category ?? '',
          model: r.model,
          prompt: r.prompt,
          negative_prompt: r.negative_prompt ?? '',
          settings: Object.entries(r.settings ?? {}).map(([k, v]) => ({ k, v: String(v) })),
          tags: r.tags ?? [],
          featured: r.featured,
          published: r.published,
        })
      } else {
        setForm((f) => ({ ...f, category: cs[0]?.slug ?? '', settings: [{ k: 'Aspect ratio', v: '4:5' }] }))
      }
      setLoaded(true)
    })
  }, [id])

  // Free the preview blob URL when it is replaced.
  useEffect(() => () => (image ? URL.revokeObjectURL(image.previewUrl) : undefined), [image])

  const taken = useMemo(() => new Set(all.filter((p) => p.id !== id).map((p) => p.slug)), [all, id])
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const onTitle = (title: string) => {
    setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : uniqueSlug(slugify(title), taken) }))
  }

  const onFile = async (file?: File) => {
    if (!file) return
    setCompressing(true)
    try {
      setImage(await compressImage(file))
    } catch {
      toast(t.error)
    } finally {
      setCompressing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const addTag = (raw: string) => {
    const parts = raw
      .split(/[,،\n]/)
      .map((s) => s.trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean)
    if (parts.length) setForm((f) => ({ ...f, tags: [...new Set([...f.tags, ...parts])] }))
    setTagInput('')
  }
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && !tagInput && form.tags.length) {
      set('tags', form.tags.slice(0, -1))
    }
  }

  const ratio = form.settings.find((s) => s.k.toLowerCase() === 'aspect ratio')?.v
  const setRatio = (v: string) => {
    const rest = form.settings.filter((s) => s.k.toLowerCase() !== 'aspect ratio')
    set('settings', [{ k: 'Aspect ratio', v }, ...rest])
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (tagInput.trim()) addTag(tagInput)
    if (!form.title.trim() || !form.prompt.trim()) return toast(t.needTitle)
    if (!image && !row?.image_url) return toast(t.needImage)
    const slug = slugify(form.slug) || uniqueSlug(slugify(form.title), taken)
    if (taken.has(slug)) return toast(t.slugTaken)

    setSaving(true)
    try {
      const settings = Object.fromEntries(
        form.settings.filter((s) => s.k.trim() && s.v.trim()).map((s) => [s.k.trim(), s.v.trim()]),
      )
      await api.prompts.save(
        {
          id: row?.id,
          slug,
          title: form.title.trim(),
          category: form.category || (null as unknown as string),
          model: form.model.trim(),
          prompt: form.prompt.trim(),
          negative_prompt: form.negative_prompt.trim() || null,
          settings,
          tags: [...new Set([...form.tags, ...(tagInput.trim() ? [tagInput.trim().toLowerCase()] : [])])],
          featured: form.featured,
          published: form.published,
        },
        image,
      )
      toast(t.saved)
      navigate('/admin/prompts')
    } catch (err) {
      console.error(err)
      toast(t.error)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!row || !(await confirm(t.confirmDeletePrompt))) return
    try {
      await api.prompts.remove(row)
      toast(t.deleted)
      navigate('/admin/prompts')
    } catch {
      toast(t.error)
    }
  }

  if (!loaded) return <Spinner />

  const preview = image?.previewUrl ?? row?.image_url
  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft
  const publicUrl = `${window.location.origin}${import.meta.env.BASE_URL}p/${form.slug || '…'}`

  return (
    <form onSubmit={onSubmit} className="pb-44 lg:pb-0">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/admin/prompts"
          aria-label={t.back}
          className="flex size-11 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10"
        >
          <Back className="size-5" />
        </Link>
        <h1 className="flex-1 text-[26px] font-bold tracking-tight md:text-[32px]">
          {isNew ? t.newPrompt : t.editPrompt}
        </h1>
        {row && row.published && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden h-11 items-center gap-2 rounded-full bg-white/[0.06] px-4 text-sm ring-1 ring-white/10 sm:inline-flex"
          >
            <ExternalLink className="size-4" /> {t.viewSite}
          </a>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Image */}
        <Card className="p-4 lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-[13px] font-medium text-paper/70">{t.image}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cx(
              'relative flex w-full items-center justify-center overflow-hidden rounded-2xl bg-ink ring-1 ring-white/10 transition hover:ring-lime/50',
              preview ? '' : 'aspect-[4/5] border-2 border-dashed border-white/10',
            )}
          >
            {preview ? (
              <img src={preview} alt="" className="max-h-[60vh] w-full object-contain" />
            ) : (
              <span className="flex flex-col items-center gap-3 text-paper/50">
                <span className="flex size-14 items-center justify-center rounded-full bg-lime text-ink">
                  <ImagePlus className="size-6" />
                </span>
                <span className="text-sm font-medium">{t.chooseImage}</span>
              </span>
            )}
            {compressing && (
              <span className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/70 text-sm">
                <Loader2 className="size-5 animate-spin text-lime" /> {t.compressing}
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-paper/40">
              {image ? `WebP · ${image.width}×${image.height} · ${formatBytes(image.blob.size)}` : t.imageHint}
            </p>
            {preview && (
              <Button size="sm" onClick={() => fileRef.current?.click()}>
                {t.changeImage}
              </Button>
            )}
          </div>
        </Card>

        {/* Fields */}
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4 p-4 md:p-5">
            <Field label={t.title}>
              <Input
                dir="ltr"
                value={form.title}
                onChange={(e) => onTitle(e.target.value)}
                placeholder="Chrome Shades Studio Portrait"
                required
              />
            </Field>
            <Field
              label={t.slug}
              hint={
                <span dir="ltr" className="break-all">
                  {t.slugHint} {publicUrl}
                </span>
              }
            >
              <Input
                dir="ltr"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  set('slug', slugify(e.target.value.replace(/\s/g, '-')) + (e.target.value.endsWith('-') ? '-' : ''))
                }}
                onBlur={() => set('slug', slugify(form.slug))}
                placeholder="chrome-shades-studio-portrait"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.category}>
                <Select value={form.category} onChange={(e) => set('category', e.target.value)} dir="ltr">
                  <option value="">{t.noCategory}</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.model}>
                <Input dir="ltr" list="pj-models" value={form.model} onChange={(e) => set('model', e.target.value)} />
                <datalist id="pj-models">
                  {MODELS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-4 md:p-5">
            <Field label={t.promptText}>
              <Textarea
                dir="ltr"
                value={form.prompt}
                onChange={(e) => set('prompt', e.target.value)}
                rows={7}
                className="font-mono text-[13.5px]"
                required
              />
            </Field>
            <Field label={t.negativePrompt}>
              <Textarea
                dir="ltr"
                value={form.negative_prompt}
                onChange={(e) => set('negative_prompt', e.target.value)}
                rows={2}
                className="min-h-0 font-mono text-[13.5px]"
              />
            </Field>
          </Card>

          <Card className="flex flex-col gap-4 p-4 md:p-5">
            <div>
              <p className="mb-2 text-[13px] font-medium text-paper/70">{t.aspectRatio}</p>
              <div className="flex flex-wrap gap-2" dir="ltr">
                {RATIOS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRatio(r)}
                    className={cx(
                      'h-10 rounded-full px-4 text-sm font-medium',
                      ratio === r ? 'bg-lime text-ink' : 'bg-white/[0.05] text-paper/60 ring-1 ring-white/10',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-paper/70">{t.settingsKV}</p>
              <div className="flex flex-col gap-2">
                {form.settings.map((s, i) => (
                  <div key={i} className="flex gap-2" dir="ltr">
                    <Input
                      value={s.k}
                      placeholder={t.settingName}
                      onChange={(e) =>
                        set(
                          'settings',
                          form.settings.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      value={s.v}
                      placeholder={t.settingValue}
                      onChange={(e) =>
                        set(
                          'settings',
                          form.settings.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)),
                        )
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t.delete}
                      onClick={() =>
                        set(
                          'settings',
                          form.settings.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  className="self-start"
                  onClick={() => set('settings', [...form.settings, { k: '', v: '' }])}
                >
                  <Plus className="size-4" /> {t.addSetting}
                </Button>
              </div>
            </div>

            <Field label={t.tags} hint={t.tagsHint}>
              <div
                className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-2xl bg-ink px-2 py-2 ring-1 ring-white/10 focus-within:ring-lime/60"
                dir="ltr"
              >
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] py-1 pe-1 ps-3 text-xs"
                  >
                    #{tag}
                    <button
                      type="button"
                      aria-label={`${t.delete} ${tag}`}
                      onClick={() =>
                        set(
                          'tags',
                          form.tags.filter((x) => x !== tag),
                        )
                      }
                      className="flex size-6 items-center justify-center rounded-full hover:bg-white/10"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={(e) =>
                    e.target.value.includes(',') ? addTag(e.target.value) : setTagInput(e.target.value)
                  }
                  onKeyDown={onTagKey}
                  onBlur={() => tagInput && addTag(tagInput)}
                  placeholder="portrait, studio…"
                  className="h-8 min-w-24 flex-1 bg-transparent px-2 text-[16px] outline-none placeholder:text-paper/25 md:text-sm"
                />
              </div>
            </Field>
          </Card>

          <Card className="flex flex-col gap-2 p-4 md:p-5">
            <Toggle
              checked={form.published}
              onChange={(v) => set('published', v)}
              label={`${t.publishNow} — ${form.published ? t.published : t.draft}`}
            />
            <Toggle checked={form.featured} onChange={(v) => set('featured', v)} label={t.markFeatured} />
          </Card>

          {row && (
            <Button variant="danger" onClick={onDelete} className="self-start">
              <Trash2 className="size-4" /> {t.delete}
            </Button>
          )}
        </div>
      </div>

      {/* Save bar: sticky above the phone's bottom nav */}
      <div className="fixed inset-x-3 bottom-[92px] z-40 lg:static lg:mt-6 lg:flex lg:justify-end">
        <Button
          type="submit"
          variant="lime"
          size="lg"
          loading={saving || compressing}
          className="w-full shadow-[0_10px_30px_-8px_rgb(198_244_50/0.6)] lg:w-auto lg:px-10"
        >
          {saving ? t.saving : t.save}
        </Button>
      </div>
    </form>
  )
}
