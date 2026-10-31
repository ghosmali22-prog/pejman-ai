import { AlertTriangle, ArrowLeft, ArrowRight, ExternalLink, FileCode2, ImagePlus, Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CodePreview } from '../../features/code/CodePreview'
import {
  extForLanguage,
  guessLanguage,
  languageFromName,
  languageLabel,
  LANGUAGES,
  MAX_FILE_BYTES,
  MAX_PROJECT_BYTES,
  runsInBrowser,
  titleFromFileName,
} from '../../lib/code'
import { useToast } from '../../providers/ToastProvider'
import type { CodeFile, CodeItemRow } from '../../types'
import { Button, Card, Field, Input, Select, Spinner, Textarea, Toggle, cx, useConfirm } from '../components/ui'
import * as api from '../lib/api'
import { ACCEPT, CodeFileError, readCodeUpload } from '../lib/codeFiles'
import { useI18n } from '../lib/i18n'
import { compressImage, formatBytes, type CompressedImage } from '../lib/image'
import { slugify, uniqueSlug } from '../lib/slug'

const CATEGORIES = ['Dashboard', 'Landing section', 'Glass UI', 'Animation', 'Component', 'Full page', 'Form', 'Navbar', 'Card']
const bytes = (s: string) => new TextEncoder().encode(s).length

interface Form {
  title: string
  slug: string
  short_description: string
  category: string
  is_published: boolean
  is_featured: boolean
  is_premium: boolean
  live_preview_enabled: boolean
}

const empty: Form = {
  title: '',
  slug: '',
  short_description: '',
  category: '',
  is_published: true,
  is_featured: false,
  is_premium: false,
  live_preview_enabled: true,
}

const blankFile = (): CodeFile => ({ name: 'index.html', language: 'html', content: '' })

export function CodeEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const { t, dir, n } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const [form, setForm] = useState<Form>(empty)
  const [files, setFiles] = useState<CodeFile[]>([blankFile()])
  const [tab, setTab] = useState(0)
  const [row, setRow] = useState<CodeItemRow | null>(null)
  const [all, setAll] = useState<CodeItemRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  // Pasted code with the default file name gets its language (and extension) guessed once.
  const autoNamed = useRef(true)

  // Screenshot: compressed and uploaded in the background as soon as it is picked.
  const [image, setImage] = useState<CompressedImage | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const uploadRef = useRef<Promise<api.UploadedPreview | null> | null>(null)
  const savedRef = useRef(false)
  const codeInput = useRef<HTMLInputElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)

  useEffect(
    () => () => {
      if (!savedRef.current) uploadRef.current?.then(api.discardCodePreview)
    },
    [],
  )
  useEffect(() => () => (image ? URL.revokeObjectURL(image.previewUrl) : undefined), [image])

  useEffect(() => {
    api.code.list().then((list) => {
      setAll(list)
      const r = id ? (list.find((c) => c.id === id) ?? null) : null
      setRow(r)
      if (r) {
        autoNamed.current = false
        setForm({
          title: r.title,
          slug: r.slug,
          short_description: r.short_description,
          category: r.category,
          is_published: r.is_published,
          is_featured: r.is_featured,
          is_premium: r.is_premium,
          live_preview_enabled: r.live_preview_enabled,
        })
        setFiles(
          r.files.length
            ? r.files
            : [{ name: `${r.slug}.${extForLanguage(r.language)}`, language: r.language, content: r.code }],
        )
      }
      setLoaded(true)
    })
  }, [id])

  const taken = useMemo(() => new Set(all.filter((c) => c.id !== id).map((c) => c.slug)), [all, id])
  const categories = useMemo(() => [...new Set([...CATEGORIES, ...all.map((c) => c.category).filter(Boolean)])], [all])
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const onTitle = (title: string) =>
    setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : uniqueSlug(slugify(title), taken) }))

  const file = files[tab] ?? files[0]
  const hasCode = files.some((f) => f.content.trim())
  const browserReady = runsInBrowser(files.filter((f) => f.content.trim()))
  const preview = imageRemoved ? null : (image?.previewUrl ?? row?.preview_image_url ?? null)

  const updateFile = (i: number, change: Partial<CodeFile>) =>
    setFiles((fs) => fs.map((f, j) => (j === i ? { ...f, ...change } : f)))

  const onContent = (content: string) => {
    // First paste into a fresh item: guess the language and give the file a matching name.
    if (autoNamed.current && files.length === 1 && !file.content.trim() && content.trim()) {
      const language = guessLanguage(content)
      autoNamed.current = false
      const name = language === 'html' ? 'index.html' : `${language === 'jsx' || language === 'tsx' ? 'Component' : 'code'}.${extForLanguage(language)}`
      updateFile(tab, { content, language, name })
      return
    }
    updateFile(tab, { content })
  }

  const onUpload = async (picked?: File) => {
    if (codeInput.current) codeInput.current.value = ''
    if (!picked) return
    if (hasCode && !(await confirm(t.replaceCode, { danger: false, confirmLabel: t.replace }))) return
    setReading(true)
    try {
      const res = await readCodeUpload(picked)
      autoNamed.current = false
      setFiles(res.files)
      setTab(0)
      if (!form.title.trim()) onTitle(titleFromFileName(res.files.length > 1 ? res.sourceName.replace(/\.zip$/i, '') : res.sourceName))
      toast(res.files.length > 1 ? t.filesFromZip(n(res.files.length), n(res.skipped)) : t.filledFromFile(picked.name))
    } catch (err) {
      toast(err instanceof CodeFileError ? t[err.kind] : t.error)
    } finally {
      setReading(false)
    }
  }

  const onImage = async (picked?: File) => {
    if (imageInput.current) imageInput.current.value = ''
    if (!picked) return
    setCompressing(true)
    try {
      const full = await compressImage(picked)
      setImage(full)
      setImageRemoved(false)
      uploadRef.current?.then(api.discardCodePreview)
      uploadRef.current = api.uploadCodePreview(full).catch((err) => {
        console.error(err)
        return null
      })
    } catch {
      toast(t.error)
    } finally {
      setCompressing(false)
    }
  }

  const removeImage = () => {
    uploadRef.current?.then(api.discardCodePreview)
    uploadRef.current = null
    setImage(null)
    setImageRemoved(true)
  }

  const addFile = () => {
    const used = new Set(files.map((f) => f.name))
    const name = ['style.css', 'script.js', 'index.html'].find((x) => !used.has(x)) ?? `file-${files.length + 1}.js`
    setFiles((fs) => [...fs, { name, language: languageFromName(name), content: '' }])
    setTab(files.length)
    autoNamed.current = false
  }

  const removeFile = async (i: number) => {
    if (files[i].content.trim() && !(await confirm(t.confirmRemoveFile))) return
    setFiles((fs) => (fs.length > 1 ? fs.filter((_, j) => j !== i) : [blankFile()]))
    setTab((x) => Math.max(0, Math.min(x, files.length - 2)))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const kept = files
      .map((f) => ({ ...f, name: f.name.trim() || `file.${extForLanguage(f.language)}` }))
      .filter((f) => f.content.trim())
    if (!form.title.trim() || !kept.length) return toast(t.needCodeTitle)
    if (bytes(kept[0].content) > MAX_FILE_BYTES || kept.reduce((s, f) => s + bytes(f.content), 0) > MAX_PROJECT_BYTES) {
      return toast(t.codeTooLongTotal)
    }
    const slug = slugify(form.slug) || uniqueSlug(slugify(form.title), taken)
    if (taken.has(slug)) return toast(t.slugTaken)

    setSaving(true)
    try {
      let shot: api.UploadedPreview | null = null
      if (image) {
        // Usually finished while you were typing; retry once if it failed.
        shot = (await uploadRef.current) ?? (await api.uploadCodePreview(image))
        uploadRef.current = Promise.resolve(shot)
      } else if (imageRemoved) {
        shot = { preview_image_url: null, preview_image_path: null }
      }
      await api.code.save(
        {
          id: row?.id,
          slug,
          title: form.title.trim(),
          short_description: form.short_description.trim(),
          category: form.category.trim(),
          language: kept[0].language || 'text',
          code: kept[0].content,
          files: kept.length > 1 ? kept : [],
          live_preview_enabled: form.live_preview_enabled,
          is_featured: form.is_featured,
          is_published: form.is_published,
          is_premium: form.is_premium,
          ...(shot ?? (row ? {} : { preview_image_url: null, preview_image_path: null })),
        } as api.CodeDraft,
        { existing: row, sortOrder: Math.min(0, ...all.map((c) => c.sort_order)) - 1 },
      )
      savedRef.current = true
      toast(t.saved)
      navigate('/admin/code')
    } catch (err) {
      console.error(err)
      toast(t.error)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!row || !(await confirm(t.confirmDeleteCode))) return
    try {
      await api.code.remove(row)
      toast(t.deleted)
      navigate('/admin/code')
    } catch {
      toast(t.error)
    }
  }

  if (!loaded) return <Spinner />

  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft
  const publicUrl = `${window.location.origin}${import.meta.env.BASE_URL}?code=${form.slug || '…'}`
  const lineCount = file.content ? file.content.split('\n').length : 0

  return (
    <form onSubmit={onSubmit} className="pb-28 lg:pb-0">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/admin/code"
          aria-label={t.back}
          className="flex size-11 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10"
        >
          <Back className="size-5" />
        </Link>
        <h1 className="flex-1 text-[26px] font-bold tracking-tight md:text-[32px]">{isNew ? t.newCode : t.editCode}</h1>
        {row?.is_published && (
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* Code (min-w-0: long lines scroll inside the code box instead of widening the page) */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="p-4 md:p-5">
            <button
              type="button"
              onClick={() => codeInput.current?.click()}
              disabled={reading}
              className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-lime/30 bg-lime/[0.04] px-4 py-5 text-center transition hover:border-lime/60 disabled:opacity-60"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-lime text-ink">
                {reading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
              </span>
              <span className="text-[15px] font-semibold">{t.uploadCode}</span>
              <span className="max-w-md text-xs leading-relaxed text-paper/45">{t.uploadCodeHint}</span>
            </button>
            <input ref={codeInput} type="file" accept={ACCEPT} className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />

            {/* File tabs */}
            <div className="mb-2 mt-5 flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-paper/70">{t.files}</span>
              <Button size="sm" onClick={addFile}>
                <Plus className="size-4" /> {t.addFile}
              </Button>
            </div>
            <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1" dir="ltr">
              {files.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTab(i)}
                  className={cx(
                    'flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-mono text-xs font-medium',
                    i === tab ? 'bg-paper text-ink' : 'bg-white/[0.05] text-paper/60 ring-1 ring-white/10',
                  )}
                >
                  <FileCode2 className="size-3.5" /> {f.name || '…'}
                </button>
              ))}
            </div>

            <div className="mb-3 grid grid-cols-[1fr_auto_auto] gap-2" dir="ltr">
              <Input
                aria-label={t.fileName}
                value={file.name}
                onChange={(e) => {
                  autoNamed.current = false
                  const name = e.target.value
                  updateFile(tab, { name, language: languageFromName(name) || file.language })
                }}
                className="font-mono"
              />
              <Select
                aria-label={t.codeLanguage}
                value={file.language}
                onChange={(e) => {
                  autoNamed.current = false
                  const language = e.target.value
                  updateFile(tab, { language, name: file.name.replace(/(\.[a-z0-9]+)?$/i, `.${extForLanguage(language)}`) })
                }}
                className="w-auto pe-8"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {languageLabel(l)}
                  </option>
                ))}
              </Select>
              <Button size="icon" variant="ghost" onClick={() => removeFile(tab)} aria-label={t.removeFile} title={t.removeFile}>
                <X className="size-4" />
              </Button>
            </div>

            <Textarea
              dir="ltr"
              value={file.content}
              onChange={(e) => onContent(e.target.value)}
              placeholder={t.orPaste}
              rows={14}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              wrap="off"
              className="min-h-72 whitespace-pre font-mono leading-relaxed md:text-[13px]"
            />
            <p className="mt-2 text-xs text-paper/40" dir="ltr">
              {languageLabel(file.language)} · {t.lines(n(lineCount))} · {formatBytes(bytes(file.content))}
            </p>
          </Card>

          {/* Live preview */}
          {browserReady && (
            <Card className="p-4 md:p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-paper/70">{t.livePreview}</p>
                <Button size="sm" variant={showPreview ? 'dark' : 'lime'} onClick={() => setShowPreview((v) => !v)}>
                  {showPreview ? t.hidePreview : t.showPreview}
                </Button>
              </div>
              {showPreview && (
                <CodePreview
                  files={files.filter((f) => f.content.trim())}
                  title={form.title || 'Preview'}
                  className="mt-3 aspect-[4/3] w-full rounded-2xl ring-1 ring-white/10"
                />
              )}
            </Card>
          )}
        </div>

        {/* Details */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="flex flex-col gap-4 p-4 md:p-5">
            <Field label={t.title}>
              <Input dir="ltr" value={form.title} onChange={(e) => onTitle(e.target.value)} placeholder="Glass Pricing Card" required />
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
                placeholder="glass-pricing-card"
              />
            </Field>
            <Field label={t.shortDescription}>
              <Textarea
                dir="ltr"
                value={form.short_description}
                onChange={(e) => set('short_description', e.target.value.slice(0, 400))}
                rows={3}
                className="min-h-0"
                placeholder="Frosted-glass pricing card with a glowing background."
              />
            </Field>
            <Field label={t.codeCategory}>
              <Input dir="ltr" list="pj-code-categories" value={form.category} onChange={(e) => set('category', e.target.value.slice(0, 60))} />
              <datalist id="pj-code-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <div className="no-scrollbar -mx-1 -mt-2 flex gap-1.5 overflow-x-auto px-1" dir="ltr">
              {CATEGORIES.slice(0, 6).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('category', c)}
                  className={cx(
                    'h-9 shrink-0 rounded-full px-3 text-xs font-medium',
                    form.category === c ? 'bg-lime text-ink' : 'bg-white/[0.05] text-paper/60 ring-1 ring-white/10',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </Card>

          {/* Screenshot */}
          <Card className="p-4 md:p-5">
            <p className="mb-3 text-[13px] font-medium text-paper/70">{t.previewImage}</p>
            {hasCode && !browserReady && !preview && (
              <p className="mb-3 flex gap-2 rounded-2xl bg-amber-400/10 px-3.5 py-3 text-[13px] leading-relaxed text-amber-200 ring-1 ring-amber-400/20">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {t.needScreenshot}
              </p>
            )}
            <button
              type="button"
              onClick={() => imageInput.current?.click()}
              className={cx(
                'relative flex w-full items-center justify-center overflow-hidden rounded-2xl bg-ink ring-1 ring-white/10 transition hover:ring-lime/50',
                preview ? '' : 'h-28 border-2 border-dashed border-white/10',
              )}
            >
              {preview ? (
                <img src={preview} alt="" className="max-h-72 w-full object-contain" />
              ) : (
                <span className="flex items-center gap-3 text-sm font-medium text-paper/55">
                  <ImagePlus className="size-5 text-lime" /> {t.choosePreview}
                </span>
              )}
              {compressing && (
                <span className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/70 text-sm">
                  <Loader2 className="size-5 animate-spin text-lime" /> {t.compressing}
                </span>
              )}
            </button>
            <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(e) => onImage(e.target.files?.[0])} />
            {preview && (
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" onClick={() => imageInput.current?.click()}>
                  {t.changePreview}
                </Button>
                <Button size="sm" variant="ghost" onClick={removeImage} aria-label={t.removePreview}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-2 p-4 md:p-5">
            <Toggle
              checked={form.is_published}
              onChange={(v) => set('is_published', v)}
              label={`${t.publishNow} — ${form.is_published ? t.published : t.draft}`}
            />
            <Toggle checked={form.is_featured} onChange={(v) => set('is_featured', v)} label={t.markFeatured} />
            <Toggle checked={form.is_premium} onChange={(v) => set('is_premium', v)} label={t.markPremium} />
            <Toggle
              checked={form.live_preview_enabled}
              onChange={(v) => set('live_preview_enabled', v)}
              label={t.livePreview}
            />
            {hasCode && !browserReady && form.live_preview_enabled && (
              <p className="px-1 text-xs text-paper/40">{t.livePreviewOff}</p>
            )}
          </Card>

          {row && (
            <Button variant="danger" onClick={onDelete} className="self-start">
              <Trash2 className="size-4" /> {t.delete}
            </Button>
          )}
        </div>
      </div>

      {/* On phones the bottom nav is hidden on this page, so the save button sits at the very bottom. */}
      <div
        className="fixed inset-x-3 bottom-3 z-40 lg:static lg:mt-6 lg:flex lg:justify-end"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Button
          type="submit"
          variant="lime"
          size="lg"
          loading={saving || compressing || reading}
          className="w-full shadow-[0_10px_30px_-8px_rgb(198_244_50/0.6)] lg:w-auto lg:px-10"
        >
          {saving ? t.saving : t.save}
        </Button>
      </div>
    </form>
  )
}
