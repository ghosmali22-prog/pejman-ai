import {
  ArrowUpRight,
  Calendar,
  Image as ImageIcon,
  Inbox,
  MousePointerClick,
  Plus,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { DailyCopies } from '../../types'
import { AreaChart, DONUT_COLORS, Donut, Sparkline } from '../components/charts'
import { Badge, Card, Spinner, cx } from '../components/ui'
import * as api from '../lib/api'
import { useI18n } from '../lib/i18n'
import { useLoad } from '../lib/useLoad'

type Range = 'week' | 'month' | 'year'
const RANGE_DAYS: Record<Range, number> = { week: 7, month: 30, year: 365 }

/** Counts items per day for the last `n` days (for sparklines). */
function perDay(dates: string[], n = 14) {
  const out = Array<number>(n).fill(0)
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  for (const d of dates) {
    const diff = Math.floor((today.getTime() - new Date(d).getTime()) / 86_400_000)
    if (diff >= 0 && diff < n) out[n - 1 - diff]++
  }
  return out
}

/** Running total over the last `n` days — a calm growth line instead of daily spikes. */
function cumulative(dates: string[], n = 14) {
  const daily = perDay(dates, n)
  let total = dates.length - daily.reduce((a, b) => a + b, 0)
  return daily.map((d) => (total += d))
}

function trend(values: number[]) {
  const half = Math.floor(values.length / 2)
  const prev = values.slice(0, half).reduce((a, b) => a + b, 0)
  const cur = values.slice(half).reduce((a, b) => a + b, 0)
  if (!prev) return cur ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

export function DashboardPage() {
  const { t, n, date, lang } = useI18n()
  const [range, setRange] = useState<Range>('month')
  const [series, setSeries] = useState<DailyCopies[] | null>(null)
  const { data } = useLoad(() =>
    Promise.all([
      api.prompts.list(),
      api.messages.list(),
      api.subscribers.list(),
      api.categories.list(),
      api.dailyCopies(30),
    ]),
  )

  useEffect(() => {
    let alive = true
    setSeries(null)
    api
      .dailyCopies(RANGE_DAYS[range])
      .then((s) => alive && setSeries(s))
      .catch(() => alive && setSeries([]))
    return () => {
      alive = false
    }
  }, [range])

  const chart = useMemo(() => {
    if (!series) return []
    const locale = lang === 'fa' ? 'fa-IR-u-ca-persian' : 'en-GB'
    if (range !== 'year') {
      const f = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
      return series.map((d) => ({ label: f.format(new Date(d.day)), value: d.copies }))
    }
    // Year view: group by month.
    const f = new Intl.DateTimeFormat(locale, { month: 'short' })
    const groups = new Map<string, number>()
    series.forEach((d) => {
      const key = d.day.slice(0, 7)
      groups.set(key, (groups.get(key) ?? 0) + d.copies)
    })
    return [...groups].map(([k, v]) => ({ label: f.format(new Date(`${k}-15`)), value: v }))
  }, [series, range, lang])

  if (!data) return <Spinner />
  const [prompts, messages, subscribers, categories, last30] = data

  const published = prompts.filter((p) => p.published).length
  const totalCopies = prompts.reduce((s, p) => s + p.copy_count, 0)
  const copies30 = last30.map((d) => d.copies)
  const unread = messages.filter((m) => !m.is_read).length
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const subsThisMonth = subscribers.filter((s) => new Date(s.created_at) >= monthStart).length

  const hour = new Date().getHours()
  const greet =
    hour < 5
      ? t.goodNight
      : hour < 12
        ? t.goodMorning
        : hour < 17
          ? t.goodAfternoon
          : hour < 21
            ? t.goodEvening
            : t.goodNight

  const byCategory = categories
    .map((c) => ({
      label: c.name,
      value: prompts.filter((p) => p.category === c.slug).reduce((s, p) => s + p.copy_count, 0),
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
  const catTotal = byCategory.reduce((s, c) => s + c.value, 0)
  const top = [...prompts].sort((a, b) => b.copy_count - a.copy_count).slice(0, 5)
  const topMax = Math.max(1, top[0]?.copy_count ?? 1)
  const rangeTotal = (series ?? []).reduce((s, d) => s + d.copies, 0)

  return (
    <div className="flex flex-col gap-5">
      {/* Greeting */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm text-paper/45">
            <Calendar className="size-4" />
            {date(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-tight md:text-[34px]">
            {greet}
            {lang === 'fa' ? '، ' : ', '}
            <span className="text-lime">{t.dearName}</span>
          </h1>
          <p className="mt-1 text-sm text-paper/50">{t.overview}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin/messages"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white/[0.06] px-4 text-sm font-semibold ring-1 ring-white/10"
          >
            <Inbox className="size-4" /> {t.messages}
          </Link>
          <Link
            to="/admin/prompts/new"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-paper px-4 text-sm font-semibold text-ink"
          >
            <Plus className="size-4" /> {t.addPrompt}
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat
          icon={<ImageIcon className="size-5" />}
          tone="bg-paper text-ink"
          label={t.totalPrompts}
          value={n(prompts.length)}
          sub={t.publishedOf(published, prompts.length - published).replace(/\d+/g, (m) => n(Number(m)))}
          spark={cumulative(prompts.map((p) => p.created_at))}
        />
        <Stat
          icon={<MousePointerClick className="size-5" />}
          tone="bg-lime text-ink"
          label={t.totalCopies}
          value={n(totalCopies)}
          sub={t.copiesLast(n(copies30.reduce((a, b) => a + b, 0)))}
          spark={copies30.slice(-14)}
          change={trend(copies30.slice(-14))}
        />
        <Stat
          icon={<Inbox className="size-5" />}
          tone="bg-[#2b2f2d] text-lime"
          label={t.unread}
          value={n(unread)}
          sub={t.inboxTotal(n(messages.length))}
          spark={cumulative(messages.map((m) => m.created_at))}
          color="#ffffff"
        />
        <Stat
          icon={<Users className="size-5" />}
          tone="bg-[#2b2f2d] text-paper"
          label={t.subscribersCount}
          value={n(subscribers.length)}
          sub={t.thisMonth(n(subsThisMonth))}
          spark={cumulative(subscribers.map((s) => s.created_at))}
          change={trend(perDay(subscribers.map((s) => s.created_at)))}
          color="#8d928e"
        />
      </div>

      {/* Chart + donut */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{t.copiesOverTime}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {n(rangeTotal)} <span className="text-sm font-medium text-paper/45">{t.copies}</span>
              </p>
            </div>
            <div className="flex rounded-full bg-ink p-1 ring-1 ring-white/10">
              {(['week', 'month', 'year'] as Range[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={cx(
                    'h-8 rounded-full px-3.5 text-xs font-semibold transition-colors',
                    range === r ? 'bg-white/10 text-paper' : 'text-paper/45',
                  )}
                >
                  {t[r]}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            {series ? (
              <AreaChart data={chart} format={(v) => `${n(v)} ${t.copies}`} label={t.copiesOverTime} />
            ) : (
              <Spinner />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <p className="font-semibold">{t.byCategory}</p>
          <div className="mt-5">
            <Donut parts={byCategory} center={n(catTotal)} sub={t.copies} />
          </div>
          <ul className="mt-6 flex flex-col gap-3">
            {byCategory.slice(0, 5).map((c, i) => (
              <li key={c.label} className="flex items-center gap-3 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                <span className="flex-1">{c.label}</span>
                <span className="text-paper/45">{n(c.value)}</span>
                <span className="w-10 text-end font-semibold">
                  {n(Math.round((c.value / Math.max(1, catTotal)) * 100))}
                  {lang === 'fa' ? '٪' : '%'}
                </span>
              </li>
            ))}
            {byCategory.length === 0 && <li className="text-sm text-paper/40">{t.nothingYet}</li>}
          </ul>
        </Card>
      </div>

      {/* Top prompts + latest messages */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{t.topPrompts}</p>
            <Link to="/admin/prompts" className="text-xs text-paper/45 hover:text-lime">
              {t.seeAll}
            </Link>
          </div>
          <ul className="mt-4 flex flex-col gap-3">
            {top.map((p, i) => (
              <li key={p.id}>
                <Link to={`/admin/prompts/${p.id}`} className="flex items-center gap-3">
                  <span className="w-4 text-center text-xs text-paper/35">{n(i + 1)}</span>
                  <img src={p.image_url} alt="" className="size-11 shrink-0 rounded-xl object-cover" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" dir="auto">
                      {p.title}
                    </p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-lime"
                        style={{ width: `${(p.copy_count / topMax) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-12 text-end text-sm font-semibold">{n(p.copy_count)}</span>
                </Link>
              </li>
            ))}
            {top.length === 0 && <li className="text-sm text-paper/40">{t.nothingYet}</li>}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{t.latestMessages}</p>
            <Link to="/admin/messages" className="text-xs text-paper/45 hover:text-lime">
              {t.seeAll}
            </Link>
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {messages.slice(0, 4).map((m) => (
              <li key={m.id}>
                <Link to="/admin/messages" className="flex items-start gap-3 rounded-2xl p-2 hover:bg-white/[0.03]">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-sm font-bold">
                    {m.name[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold" dir="auto">
                        {m.name}
                      </p>
                      {!m.is_read && <span className="size-2 shrink-0 rounded-full bg-lime" />}
                      <span className="ms-auto shrink-0 text-[11px] text-paper/35">
                        {date(m.created_at, { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-paper/50" dir="auto">
                      {m.message}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
            {messages.length === 0 && <li className="text-sm text-paper/40">{t.noMessages}</li>}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Stat({
  icon,
  tone,
  label,
  value,
  sub,
  spark,
  change,
  color,
}: {
  icon: ReactNode
  tone: string
  label: string
  value: string
  sub: string
  spark: number[]
  change?: number
  color?: string
}) {
  const { n, lang } = useI18n()
  return (
    <Card className="flex flex-col gap-4 p-4 md:p-5">
      <div className="flex items-start justify-between">
        <span className={cx('flex size-10 items-center justify-center rounded-2xl', tone)}>{icon}</span>
        {change !== undefined && (
          <Badge tone={change >= 0 ? 'lime' : 'red'}>
            {change >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {n(Math.abs(change))}
            {lang === 'fa' ? '٪' : '%'}
          </Badge>
        )}
        {change === undefined && <ArrowUpRight className="size-4 text-paper/25" />}
      </div>
      <div>
        <p className="text-[13px] text-paper/55">{label}</p>
        <p className="mt-1 text-[28px] font-bold leading-none tracking-tight md:text-[32px]">{value}</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-[11px] leading-snug text-paper/40">{sub}</p>
        <Sparkline values={spark} color={color} />
      </div>
    </Card>
  )
}
