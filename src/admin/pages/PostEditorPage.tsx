import {
  ArrowLeft,
  ArrowRight,
  Bold,
  Code,
  ExternalLink,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  Loader2,
  Quote,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useToast } from '../../providers/ToastProvider'
import type { PostRow } from '../../types'
import { Button, Card, Field, Input, Spinner, Textarea, Toggle, cx, useConfirm } from '../components/ui'
import * as api from '../lib/api'
import { useI18n } from '../lib/i18n'
import { compressImage, formatBytes, type CompressedImage } from '../lib/image'
import { readingMinutes, renderMarkdown } from '../lib/markdown'
import { slugify, uniqueSlug } from '../lib/slug'

interface Form {
  title: string
  slug: string
  lang: 'en' | 'fa'
  excerpt: string
  content: string
  cover_alt: string
  tags: string[]
  seo_title: string
  seo_description: string
  published: boolean
}

const empty: Form = {
  title: '',
  slug: '',
  lang: 'en',
  excerpt: '',
  content: '',
  cover_alt: '',
  tags: [],
  seo_title: '',
  seo_description: '',
  published: false,
}

const SITE = 'ghosmali22-prog.github.io › pejman-ai › blog'

export function PostEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const { t, dir, n } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const [form, setForm] = useState<Form>(empty)
  const [row, setRow] = useState<PostRow | null>(null)
  const [all, setAll] = useState<PostRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [cover, setCover] = useState<CompressedImage | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [inlineBusy, setInlineBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const coverUpload = useRef<Promise<api.UploadedImage | null> | null>(null)
  const savedRef = useRef(false)
  const coverInput = useRef<HTMLInputElement>(null)
  const inlineInput = useRef<HTMLInputElement>(null)
  const editor = useRef<HTMLTextAreaElement>(null)

  // Leaving without saving: delete the cover that was uploaded in the background.
  useEffect(
    () => () => {
      if (!savedRef.current) coverUpload.current?.then(api.discardUpload)
    },
    [],
  )

  useEffect(() => {
    api.posts.list().then((ps) => {
      setAll(ps)
      const r = id ? (ps.find((p) => p.id === id) ?? null) : null
      setRow(r)
      if (r) {
        setForm({
          title: r.title,
          slug: r.slug,
          lang: r.lang,
          excerpt: r.excerpt,
          content: r.content,
          cover_alt: r.cover_alt,
          tags: r.tags ?? [],
          seo_title: r.seo_title ?? '',
          seo_description: r.seo_description ?? '',
          published: r.published,
        })
      }
      setLoaded(true)
    })
  }, [id])

  useEffect(() => () => (cover ? URL.revokeObjectURL(cover.previewUrl) : undefined), [cover])

  const taken = useMemo(() => new Set(all.filter((p) => p.id !== id).map((p) => p.slug)), [all, id])
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const html = useMemo(() => (tab === 'preview' ? renderMarkdown(form.content) : ''), [tab, form.content])

  const onTitle = (title: string) => {
    setForm((f) => {
      const base = slugify(title)
      return { ...f, title, slug: slugTouched || !base ? f.slug : uniqueSlug(base, taken) }
    })
  }

  // ---------------------------------------------------------------- Markdown toolbar
  /** Wraps the selection (or a placeholder) in `before`/`after` and keeps it selected. */
  const wrap = (before: string, after = before, placeholder = '') => {
    const el = editor.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b, value } = el
    const picked = value.slice(a, b) || placeholder
    const next = value.slice(0, a) + before + picked + after + value.slice(b)
    set('content', next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + before.length, a + before.length + picked.length)
    })
  }

  /** Adds `prefix` to the start of every selected line (headings, lists, quotes). */
  const prefixLines = (prefix: string) => {
    const el = editor.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b, value } = el
    const start = value.lastIndexOf('\n', a - 1) + 1
    const block = value.slice(start, b)
    const lines = block.split('\n').map((l) => prefix + l.replace(/^(#{1,6} |> |- )/, ''))
    const next = value.slice(0, start) + lines.join('\n') + value.slice(b)
    set('content', next)
    requestAnimationFrame(() => {
      el.focus()
      const end = start + lines.join('\n').length
      el.setSelectionRange(end, end)
    })
  }

  const insertLink = () => {
    const url = window.prompt(t.linkPrompt, 'https://')
    if (!url || url === 'https://') return
    wrap('[', `](${url.trim()})`, t.linkLabel)
  }

  const onInlineImage = async (file?: File) => {
    if (!file) return
    setInlineBusy(true)
    try {
      const img = await compressImage(file)
      URL.revokeObjectURL(img.previewUrl)
      const up = await api.uploadBlogImage(img)
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
      wrap(`\n![${alt}](${up.image_url})\n`, '', '')
    } catch (err) {
      console.error(err)
      toast(t.error)
    } finally {
      setInlineBusy(false)
      if (inlineInput.current) inlineInput.current.value = ''
    }
  }

  type Tool = 'h2' | 'h3' | 'bold' | 'italic' | 'link' | 'list' | 'quote' | 'code'
  const tools: { id: Tool; label: string; Icon: LucideIcon }[] = [
    { id: 'h2', label: t.heading2, Icon: Heading2 },
    { id: 'h3', label: t.heading3, Icon: Heading3 },
    { id: 'bold', label: t.bold, Icon: Bold },
    { id: 'italic', label: t.italic, Icon: Italic },
    { id: 'link', label: t.linkLabel, Icon: Link2 },
    { id: 'list', label: t.listLabel, Icon: List },
    { id: 'quote', label: t.quote, Icon: Quote },
    { id: 'code', label: t.code, Icon: Code },
  ]
  const runTool = (id: Tool) => {
    if (id === 'h2') prefixLines('## ')
    else if (id === 'h3') prefixLines('### ')
    else if (id === 'bold') wrap('**', '**', t.bold)
    else if (id === 'italic') wrap('*', '*', t.italic)
    else if (id === 'link') insertLink()
    else if (id === 'list') prefixLines('- ')
    else if (id === 'quote') prefixLines('> ')
    else wrap('`', '`', 'code')
  }

  // ---------------------------------------------------------------- cover + tags
  const onCover = async (file?: File) => {
    if (!file) return
    setCompressing(true)
    try {
      const img = await compressImage(file)
      setCover(img)
      coverUpload.current?.then(api.discardUpload) // a different photo was picked before
      coverUpload.current = api.uploadBlogImage(img).catch((err) => {
        console.error(err)
        return null
      })
    } catch {
      toast(t.error)
    } finally {
      setCompressing(false)
      if (coverInput.current) coverInput.current.value = ''
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

  // ---------------------------------------------------------------- save / delete
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return toast(t.needPostTitle)
    const slug = slugify(form.slug) || uniqueSlug(slugify(form.title) || 'post', taken)
    if (taken.has(slug)) return toast(t.slugTaken)

    setSaving(true)
    try {
      let uploaded: api.UploadedImage | null = null
      if (cover) {
        uploaded = (await coverUpload.current) ?? (await api.uploadBlogImage(cover))
        coverUpload.current = Promise.resolve(uploaded)
      }
      const tags = [...new Set([...form.tags, ...(tagInput.trim() ? [tagInput.trim().toLowerCase()] : [])])]
      await api.posts.save(
        {
          id: row?.id,
          slug,
          title: form.title.trim(),
          lang: form.lang,
          excerpt: form.excerpt.trim(),
          content: form.content,
          content_html: renderMarkdown(form.content),
          reading_minutes: readingMinutes(form.content),
          cover_alt: form.cover_alt.trim() || form.title.trim(),
          tags,
          seo_title: form.seo_title.trim() || null,
          seo_description: form.seo_description.trim() || null,
          published: form.published,
        },
        { cover: uploaded, existing: row },
      )
      savedRef.current = true
      toast(t.saved)
      navigate('/admin/blog')
    } catch (err) {
      console.error(err)
      toast(t.error)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!row || !(await confirm(t.confirmDeletePost))) return
    try {
      await api.posts.remove(row)
      toast(t.deleted)
      navigate('/admin/blog')
    } catch {
      toast(t.error)
    }
  }

  if (!loaded) return <Spinner />

  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft
  const preview = cover?.previewUrl ?? row?.cover_url
  const postDir = form.lang === 'fa' ? 'rtl' : 'ltr'
  const publicUrl = `${window.location.origin}${import.meta.env.BASE_URL}blog/${form.slug || '…'}/`
  const gTitle = form.seo_title.trim() || form.title.trim() || t.title
  const gDesc = form.seo_description.trim() || form.excerpt.trim()
  const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

  return (
    <form onSubmit={onSubmit} className="pb-28 lg:pb-0">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/admin/blog"
          aria-label={t.back}
          className="flex size-11 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10"
        >
          <Back className="size-5" />
        </Link>
        <h1 className="flex-1 text-[26px] font-bold tracking-tight md:text-[32px]">
          {isNew ? t.newPost : t.editPost}
        </h1>
        {row?.published && (
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        {/* Writing */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="flex flex-col gap-4 p-4 md:p-5">
            <Field label={t.title}>
              <Input
                dir={postDir}
                value={form.title}
                onChange={(e) => onTitle(e.target.value)}
                maxLength={160}
                className="h-14 text-lg font-semibold md:text-lg"
                required
              />
            </Field>
            <Field
              label={t.excerpt}
              hint={
                <span className="flex justify-between gap-3">
                  <span>{t.excerptHint}</span>
                  <span dir="ltr" className={cx('shrink-0', form.excerpt.length > 160 && 'text-red-300')}>
                    {t.chars(n(form.excerpt.length), n(160))}
                  </span>
                </span>
              }
            >
              <Textarea
                dir={postDir}
                value={form.excerpt}
                onChange={(e) => set('excerpt', e.target.value.slice(0, 320))}
                rows={2}
                className="min-h-0"
              />
            </Field>
          </Card>

          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] p-2">
              <div className="flex gap-1 rounded-full bg-ink p-1 ring-1 ring-white/10">
                {(['write', 'preview'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={cx(
                      'h-9 rounded-full px-4 text-[13px] font-semibold transition-colors',
                      tab === k ? 'bg-paper text-ink' : 'text-paper/60',
                    )}
                  >
                    {t[k]}
                  </button>
                ))}
              </div>
              {tab === 'write' && (
                <div className="no-scrollbar flex max-w-full gap-0.5 overflow-x-auto" dir="ltr">
                  {tools.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => runTool(id)}
                      title={label}
                      aria-label={label}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-paper/70 hover:bg-white/[0.06] hover:text-paper"
                    >
                      <Icon className="size-[18px]" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => inlineInput.current?.click()}
                    disabled={inlineBusy}
                    title={t.insertImage}
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-paper/70 hover:bg-white/[0.06] hover:text-paper"
                  >
                    {inlineBusy ? (
                      <Loader2 className="size-[18px] animate-spin text-lime" />
                    ) : (
                      <ImagePlus className="size-[18px]" />
                    )}
                    {t.insertImage}
                  </button>
                  <input
                    ref={inlineInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onInlineImage(e.target.files?.[0])}
                  />
                </div>
              )}
            </div>
            {tab === 'write' ? (
              <div className="p-2">
                <textarea
                  ref={editor}
                  dir={postDir}
                  value={form.content}
                  onChange={(e) => set('content', e.target.value)}
                  rows={22}
                  className={cx(
                    'min-h-[55svh] w-full resize-y rounded-2xl bg-ink px-4 py-4 text-[16px] leading-7 text-paper outline-none ring-1 ring-white/10 placeholder:text-paper/25 focus:ring-lime/60',
                    form.lang === 'fa' ? 'font-sans' : 'font-mono md:text-[14px]',
                  )}
                  placeholder={'## …\n\n…'}
                />
                <p className="px-2 pb-2 pt-3 text-xs text-paper/40">
                  {inlineBusy ? t.uploadingImage : t.contentHint} · {t.readMin(n(readingMinutes(form.content)))}
                </p>
              </div>
            ) : (
              <div
                dir={postDir}
                lang={form.lang}
                className={cx('post-body min-h-[55svh] px-5 py-6 md:px-8', form.lang === 'fa' && 'post-fa')}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )}
          </Card>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-4">
            <p className="mb-3 text-[13px] font-medium text-paper/70">{t.cover}</p>
            <button
              type="button"
              onClick={() => coverInput.current?.click()}
              className={cx(
                'relative flex w-full items-center justify-center overflow-hidden rounded-2xl bg-ink ring-1 ring-white/10 transition hover:ring-lime/50',
                preview ? '' : 'aspect-[16/9] border-2 border-dashed border-white/10',
              )}
            >
              {preview ? (
                <img src={preview} alt="" className="aspect-[16/9] w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-3 text-paper/50">
                  <span className="flex size-12 items-center justify-center rounded-full bg-lime text-ink">
                    <ImagePlus className="size-5" />
                  </span>
                  <span className="text-sm font-medium">{t.chooseCover}</span>
                </span>
              )}
              {compressing && (
                <span className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/70 text-sm">
                  <Loader2 className="size-5 animate-spin text-lime" /> {t.compressing}
                </span>
              )}
            </button>
            <input
              ref={coverInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onCover(e.target.files?.[0])}
            />
            <p className="mt-2 text-xs text-paper/40">
              {cover ? `WebP · ${cover.width}×${cover.height} · ${formatBytes(cover.blob.size)}` : t.imageHint}
            </p>
            <Field label={t.coverAlt} hint={t.coverAltHint} className="mt-4">
              <Input
                dir={postDir}
                value={form.cover_alt}
                maxLength={200}
                onChange={(e) => set('cover_alt', e.target.value)}
              />
            </Field>
          </Card>

          <Card className="flex flex-col gap-4 p-4">
            <div>
              <p className="mb-2 text-[13px] font-medium text-paper/70">{t.postLang}</p>
              <div className="grid grid-cols-2 gap-2">
                {(['en', 'fa'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => set('lang', l)}
                    className={cx(
                      'h-11 rounded-full text-sm font-semibold',
                      form.lang === l ? 'bg-lime text-ink' : 'bg-white/[0.05] text-paper/60 ring-1 ring-white/10',
                    )}
                  >
                    {l === 'en' ? t.langEn : t.langFa}
                  </button>
                ))}
              </div>
            </div>
            <Field
              label={t.slug}
              hint={
                <>
                  <span dir="ltr" className="block break-all">
                    {t.slugHint} {publicUrl}
                  </span>
                  {form.lang === 'fa' && <span className="mt-1 block">{t.slugLatin}</span>}
                </>
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
                placeholder="my-first-post"
              />
            </Field>
            <Field label={t.tags} hint={t.tagsHint}>
              <div
                className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-2xl bg-ink px-2 py-2 ring-1 ring-white/10 focus-within:ring-lime/60"
                dir={postDir}
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
                  className="h-8 min-w-24 flex-1 bg-transparent px-2 text-[16px] outline-none md:text-sm"
                />
              </div>
            </Field>
            <Toggle
              checked={form.published}
              onChange={(v) => set('published', v)}
              label={`${t.publishNow} — ${form.published ? t.published : t.draft}`}
            />
            <p className="text-xs leading-relaxed text-paper/40">{t.seoNote}</p>
          </Card>

          <Card className="flex flex-col gap-4 p-4">
            <p className="text-[13px] font-medium text-paper/70">{t.seo}</p>
            <Field label={t.seoTitle} hint={t.seoTitleHint}>
              <Input
                dir={postDir}
                value={form.seo_title}
                onChange={(e) => set('seo_title', e.target.value.slice(0, 120))}
                placeholder={form.title}
              />
            </Field>
            <Field label={t.seoDescription} hint={t.seoDescHint}>
              <Textarea
                dir={postDir}
                value={form.seo_description}
                onChange={(e) => set('seo_description', e.target.value.slice(0, 320))}
                placeholder={form.excerpt}
                rows={3}
                className="min-h-0"
              />
            </Field>
            <div>
              <p className="mb-2 text-xs text-paper/45">{t.googlePreview}</p>
              <div className="rounded-2xl bg-paper p-4 text-start" dir={postDir}>
                <p className="truncate text-xs text-[#4d5156]" dir="ltr">
                  {SITE} › {form.slug || '…'}
                </p>
                <p className="mt-1 text-[17px] leading-snug text-[#1a0dab]">{clip(gTitle, 60)} · PEJMAN AI</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#4d5156]">{clip(gDesc || '…', 160)}</p>
              </div>
            </div>
          </Card>

          {row && (
            <Button variant="danger" onClick={onDelete} className="self-start">
              <Trash2 className="size-4" /> {t.delete}
            </Button>
          )}
        </div>
      </div>

      <div
        className="fixed inset-x-3 bottom-3 z-40 lg:static lg:mt-6 lg:flex lg:justify-end"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
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
