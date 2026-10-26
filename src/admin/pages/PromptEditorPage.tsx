import { ArrowLeft, ArrowRight, ExternalLink, Film, ImagePlus, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useToast } from '../../providers/ToastProvider'
import type { Category, PromptRow } from '../../types'
import { Button, Card, Field, Input, Select, Spinner, Textarea, Toggle, cx, useConfirm } from '../components/ui'
import * as api from '../lib/api'
import { useI18n } from '../lib/i18n'
import { compressImage, formatBytes, videoPoster, type CompressedImage } from '../lib/image'
import { slugify, uniqueSlug } from '../lib/slug'

const MODELS = [
  'Nano Banana Pro',
  'Nano Banana',
  'Midjourney v7',
  'GPT Image',
  'Flux 1.1 Pro',
  'Seedream',
  'Kling',
  'Veo 3',
  'Sora 2',
  'Runway Gen-4',
  'Seedance',
  'Hailuo',
  'Ideogram',
  'Leonardo',
]
const RATIOS = ['1:1', '4:5', '3:4', '2:3', '9:16', '16:9']
const MODEL_KEY = 'pj-admin-last-model'

/** The listed aspect ratio closest to a width × height. */
const nearestRatio = (w: number, h: number) =>
  RATIOS.reduce((best, r) => {
    const [a, b] = r.split(':').map(Number)
    const [c, d] = best.split(':').map(Number)
    return Math.abs(Math.log(a / b / (w / h))) < Math.abs(Math.log(c / d / (w / h))) ? r : best
  })

/** New prompts start with the model you used last time (Nano Banana Pro the first time). */
function lastModel() {
  try {
    return localStorage.getItem(MODEL_KEY) || 'Nano Banana Pro'
  } catch {
    return 'Nano Banana Pro'
  }
}

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
  model: 'Nano Banana Pro',
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
  const [aiBusy, setAiBusy] = useState(false)
  // Small copy of the chosen photo for the AI (max 512 px keeps it fast).
  const thumbRef = useRef<Blob | null>(null)
  // The photo starts uploading the moment it is picked, so "Save" only has to write the row.
  const uploadRef = useRef<Promise<api.UploadedImage | null> | null>(null)
  const savedRef = useRef(false)
  // Video: uploaded untouched in the background as well; its first frame becomes the cover.
  const [video, setVideo] = useState<{ file: File; url: string } | null>(null)
  const [videoRemoved, setVideoRemoved] = useState(false)
  const [videoBusy, setVideoBusy] = useState(false)
  const [videoUploading, setVideoUploading] = useState(false)
  const videoUploadRef = useRef<Promise<api.UploadedVideo | null> | null>(null)
  // Image and video prompts are separate; a video prompt needs no cover photo.
  const [kind, setKind] = useState<'image' | 'video'>('image')

  // Leaving without saving: delete the files that were uploaded in the background.
  useEffect(
    () => () => {
      if (savedRef.current) return
      uploadRef.current?.then(api.discardUpload)
      videoUploadRef.current?.then(api.discardVideo)
    },
    [],
  )
  useEffect(() => () => (video ? URL.revokeObjectURL(video.url) : undefined), [video])
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([api.prompts.list(), api.categories.list()]).then(([ps, cs]) => {
      setAll(ps)
      setCats(cs)
      const r = id ? (ps.find((p) => p.id === id) ?? null) : null
      setRow(r)
      setKind(r?.video_url ? 'video' : 'image')
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
        setForm((f) => ({
          ...f,
          model: lastModel(),
          category: cs[0]?.slug ?? '',
          settings: [{ k: 'Aspect ratio', v: '4:5' }],
        }))
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

  const runAi = async (opts: { auto?: boolean } = {}) => {
    if (aiBusy) return
    let thumb = thumbRef.current
    if (!thumb && row?.image_url) {
      // Editing an existing prompt: shrink the saved image once.
      try {
        const res = await fetch(row.image_url)
        const small = await compressImage(new File([await res.blob()], 'image'), 512, 0.8)
        URL.revokeObjectURL(small.previewUrl)
        thumb = thumbRef.current = small.blob
      } catch {
        thumb = null
      }
    }
    if (!thumb && !form.prompt.trim()) {
      if (!opts.auto) toast(t.aiNeedInput)
      return
    }
    setAiBusy(true)
    try {
      const s = await api.aiSuggest({
        prompt: form.prompt,
        thumbnail: thumb,
        categories: cats.map((c) => ({ slug: c.slug, name: c.name })),
      })
      setForm((f) => ({
        ...f,
        title: s.title || f.title,
        slug: slugTouched ? f.slug : uniqueSlug(slugify(s.title || f.title), taken),
        category: s.category || f.category,
        tags: [...new Set([...f.tags, ...s.tags])],
      }))
      toast(t.aiDone)
    } catch (err) {
      console.error(err)
      toast(t.aiFailed)
    } finally {
      setAiBusy(false)
    }
  }

  /** Shows a compressed cover and starts uploading it. */
  const applyImage = async (full: CompressedImage) => {
    const small = await compressImage(new File([full.blob], 'cover', { type: full.blob.type }), 512, 0.8)
    URL.revokeObjectURL(small.previewUrl)
    thumbRef.current = small.blob
    setImage(full)
    uploadRef.current?.then(api.discardUpload) // a different photo was picked before
    uploadRef.current = api.uploadPromptImage(full).catch((err) => {
      console.error(err)
      return null
    })
  }

  const onFile = async (file?: File) => {
    if (!file) return
    setCompressing(true)
    try {
      await applyImage(await compressImage(file))
    } catch {
      toast(t.error)
      return
    } finally {
      setCompressing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
    // New photo and no title yet → let the AI name it straight away.
    if (!form.title.trim()) runAi({ auto: true })
  }

  const onVideo = async (file?: File) => {
    if (videoRef.current) videoRef.current.value = ''
    if (!file) return
    if (file.size > api.MAX_VIDEO_BYTES) return toast(t.videoTooBig)
    setVideoBusy(true)
    try {
      // A frame is saved behind the scenes as a light placeholder while the video loads.
      const poster = await videoPoster(file)
      await applyImage(poster)
      setRatio(nearestRatio(poster.width, poster.height))
    } catch (err) {
      console.error(err)
      // The browser could not decode it (e.g. HEVC .mov): still upload; the site shows its first frame.
    } finally {
      setVideoBusy(false)
    }
    setVideo({ file, url: URL.createObjectURL(file) })
    setVideoRemoved(false)
    videoUploadRef.current?.then(api.discardVideo)
    setVideoUploading(true)
    const upload = api.uploadPromptVideo(file).catch((err) => {
      console.error(err)
      toast(t.videoFailed)
      return null
    })
    videoUploadRef.current = upload
    upload.finally(() => videoUploadRef.current === upload && setVideoUploading(false))
    if (!form.title.trim()) runAi({ auto: true })
  }

  const removeVideo = () => {
    videoUploadRef.current?.then(api.discardVideo)
    videoUploadRef.current = null
    setVideo(null)
    setVideoUploading(false)
    setVideoRemoved(true)
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
    if (kind === 'image' && !image && !row?.image_url) return toast(t.needImage)
    if (kind === 'video' && !video && (videoRemoved || !row?.video_url)) return toast(t.needVideo)
    const slug = slugify(form.slug) || uniqueSlug(slugify(form.title), taken)
    if (taken.has(slug)) return toast(t.slugTaken)

    setSaving(true)
    try {
      let uploaded: api.UploadedImage | null = null
      if (image) {
        // Usually already finished while you were typing; retry once if it failed.
        uploaded = (await uploadRef.current) ?? (await api.uploadPromptImage(image))
        uploadRef.current = Promise.resolve(uploaded)
      }
      let savedVideo: api.UploadedVideo | null = null
      if (video) {
        savedVideo = (await videoUploadRef.current) ?? (await api.uploadPromptVideo(video.file))
        videoUploadRef.current = Promise.resolve(savedVideo)
      } else if ((videoRemoved || kind === 'image') && row?.video_url) {
        savedVideo = { video_url: null, video_path: null }
      }
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
        {
          image: uploaded,
          video: savedVideo,
          existing: row,
          position: Math.min(0, ...all.map((p) => p.position)) - 1,
        },
      )
      savedRef.current = true
      try {
        localStorage.setItem(MODEL_KEY, form.model.trim())
      } catch {
        /* ignore */
      }
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
  const videoPreview = video?.url ?? (videoRemoved ? null : row?.video_url)
  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft
  const publicUrl = `${window.location.origin}${import.meta.env.BASE_URL}p/${form.slug || '…'}`

  return (
    <form onSubmit={onSubmit} className="pb-28 lg:pb-0">
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
        {/* Image or video */}
        <Card className="p-4 lg:sticky lg:top-24 lg:self-start">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-ink p-1 ring-1 ring-white/10">
            {(['image', 'video'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cx(
                  'h-10 rounded-full text-sm font-semibold transition-colors',
                  kind === k ? 'bg-lime text-ink' : 'text-paper/60',
                )}
              >
                {k === 'image' ? t.typeImage : t.typeVideo}
              </button>
            ))}
          </div>
          {kind === 'image' && (
            <>
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
            </>
          )}

          {kind === 'video' && (
            <div>
              <p className="mb-3 text-[13px] font-medium text-paper/70">{t.video}</p>
              {videoPreview ? (
                <div className="relative overflow-hidden rounded-2xl bg-ink ring-1 ring-white/10">
                  <video
                    src={videoPreview}
                    controls
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="max-h-[50vh] w-full"
                  />
                  {videoUploading && (
                    <span className="absolute start-2 top-2 flex items-center gap-1.5 rounded-full bg-ink/80 px-3 py-1.5 text-xs">
                      <Loader2 className="size-3.5 animate-spin text-lime" /> {t.videoUploading}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => videoRef.current?.click()}
                  className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/10 bg-ink text-sm font-medium text-paper/60 transition hover:border-lime/50"
                >
                  {videoBusy ? <Loader2 className="size-5 animate-spin text-lime" /> : <Film className="size-5" />}
                  {t.chooseVideo}
                </button>
              )}
              <input
                ref={videoRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => onVideo(e.target.files?.[0])}
              />
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-paper/40">
                  {video ? `${video.file.name} · ${formatBytes(video.file.size)}` : t.videoHint}
                </p>
                {videoPreview && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => videoRef.current?.click()} loading={videoBusy}>
                      {t.changeVideo}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={removeVideo} aria-label={t.removeVideo}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Fields */}
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4 p-4 md:p-5">
            <Field label={t.title} hint={aiBusy ? t.aiWorking : undefined}>
              <div className="flex gap-2">
                <Input
                  dir="ltr"
                  value={form.title}
                  onChange={(e) => onTitle(e.target.value)}
                  placeholder="Chrome Shades Studio Portrait"
                  required
                />
                <Button
                  variant="lime"
                  className="h-12 px-4"
                  loading={aiBusy}
                  onClick={() => runAi()}
                  aria-label={t.aiFill}
                  title={t.aiFill}
                >
                  {!aiBusy && <Sparkles className="size-4" />}
                  <span className="hidden sm:inline">{t.aiFill}</span>
                </Button>
              </div>
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
      {/* On phones the bottom nav is hidden on this page, so the save button sits at the very bottom. */}
      <div
        className="fixed inset-x-3 bottom-3 z-40 lg:static lg:mt-6 lg:flex lg:justify-end"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Button
          type="submit"
          variant="lime"
          size="lg"
          loading={saving || compressing || videoBusy}
          className="w-full shadow-[0_10px_30px_-8px_rgb(198_244_50/0.6)] lg:w-auto lg:px-10"
        >
          {saving ? t.saving : t.save}
        </Button>
      </div>
    </form>
  )
}
