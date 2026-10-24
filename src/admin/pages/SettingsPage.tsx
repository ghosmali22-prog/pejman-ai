import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { defaultSettings } from '../../config/site'
import { useToast } from '../../providers/ToastProvider'
import type { ServiceItem, SiteSettings } from '../../types'
import { Button, Card, Field, Input, PageHeader, Spinner, Textarea, Toggle, useConfirm } from '../components/ui'
import * as api from '../lib/api'
import { useI18n } from '../lib/i18n'

const lines = (v: string) =>
  v
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-4 md:p-6">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  )
}

export function SettingsPage() {
  const { t } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const [s, setS] = useState<SiteSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.settings.get().then(setS)
  }, [])

  if (!s) return <Spinner />

  /** Immutable update helper: up('hero', 'headline', value) */
  const up = <K extends keyof SiteSettings>(section: K, key: keyof SiteSettings[K], value: unknown) =>
    setS((prev) => (prev ? { ...prev, [section]: { ...prev[section], [key]: value } } : prev))

  const setService = (i: number, patch: Partial<ServiceItem>) =>
    up(
      'services',
      'items',
      s.services.items.map((it, j) =>
        j === i ? { ...it, ...patch } : patch.highlighted ? { ...it, highlighted: false } : it,
      ),
    )

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.settings.save(s)
      toast(t.saved)
    } catch {
      toast(t.error)
    } finally {
      setSaving(false)
    }
  }

  // Text fields hold English website copy, so they are always left-to-right.
  const txt = (section: keyof SiteSettings, key: string, label: string, multiline = false) => {
    const value = (s[section] as unknown as Record<string, string>)[key] ?? ''
    return (
      <Field label={label}>
        {multiline ? (
          <Textarea
            dir="ltr"
            rows={key === 'text' ? 7 : 3}
            value={value}
            onChange={(e) => up(section, key as never, e.target.value)}
          />
        ) : (
          <Input dir="ltr" value={value} onChange={(e) => up(section, key as never, e.target.value)} />
        )}
      </Field>
    )
  }

  return (
    <form onSubmit={onSubmit} className="pb-44 lg:pb-0">
      <PageHeader
        title={t.settings}
        subtitle={t.settingsHint}
        actions={
          <Button
            onClick={async () => {
              if (await confirm(t.confirmReset, { danger: false, confirmLabel: t.resetDefaults }))
                setS(structuredClone(defaultSettings))
            }}
          >
            <RotateCcw className="size-4" /> {t.resetDefaults}
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <Section title={t.hero}>
          {txt('hero', 'headline', t.headline, true)}
          {txt('hero', 'subline', t.subline, true)}
          <div className="grid gap-4 sm:grid-cols-2">
            {txt('hero', 'availability', t.availability)}
            {txt('hero', 'location', t.location)}
          </div>
          <Field label={t.tools}>
            <Textarea
              dir="ltr"
              rows={4}
              value={s.hero.tools.join('\n')}
              onChange={(e) => up('hero', 'tools', lines(e.target.value))}
            />
          </Field>
        </Section>

        <Section title={t.about}>
          {txt('about', 'label', t.label)}
          {txt('about', 'text', t.text, true)}
        </Section>

        <Section title={t.services}>
          {txt('services', 'heading', t.heading)}
          {txt('services', 'intro', t.intro, true)}
          {s.services.items.map((it, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-2xl bg-ink p-4 ring-1 ring-white/[0.07]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-lime">0{i + 1}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="hover:text-red-300"
                  onClick={() =>
                    up(
                      'services',
                      'items',
                      s.services.items.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Trash2 className="size-4" /> {t.removeService}
                </Button>
              </div>
              <Field label={t.serviceTitle}>
                <Input dir="ltr" value={it.title} onChange={(e) => setService(i, { title: e.target.value })} />
              </Field>
              <Field label={t.description}>
                <Textarea
                  dir="ltr"
                  rows={2}
                  className="min-h-0"
                  value={it.description}
                  onChange={(e) => setService(i, { description: e.target.value })}
                />
              </Field>
              <Field label={t.features}>
                <Textarea
                  dir="ltr"
                  rows={4}
                  value={it.features.join('\n')}
                  onChange={(e) => setService(i, { features: lines(e.target.value) })}
                />
              </Field>
              <Toggle
                checked={!!it.highlighted}
                onChange={(v) => setService(i, { highlighted: v })}
                label={t.highlighted}
              />
            </div>
          ))}
          <Button
            className="self-start"
            onClick={() =>
              up('services', 'items', [...s.services.items, { title: 'New service', description: '', features: [] }])
            }
          >
            <Plus className="size-4" /> {t.addService}
          </Button>
        </Section>

        <Section title={t.contact}>
          {txt('contact', 'heading', t.heading)}
          {txt('contact', 'intro', t.intro, true)}
          <div className="grid gap-4 sm:grid-cols-2">
            {txt('contact', 'email', t.email)}
            {txt('contact', 'whatsapp', t.whatsapp)}
            {txt('contact', 'telegram', t.telegram)}
            {txt('contact', 'instagram', t.instagram)}
          </div>
        </Section>

        <Section title={t.footer}>{txt('footer', 'newsletter', t.newsletter)}</Section>
      </div>

      <div className="fixed inset-x-3 bottom-[92px] z-40 lg:static lg:mt-6 lg:flex lg:justify-end">
        <Button
          type="submit"
          variant="lime"
          size="lg"
          loading={saving}
          className="w-full shadow-[0_10px_30px_-8px_rgb(198_244_50/0.6)] lg:w-auto lg:px-10"
        >
          {saving ? t.saving : t.save}
        </Button>
      </div>
    </form>
  )
}
