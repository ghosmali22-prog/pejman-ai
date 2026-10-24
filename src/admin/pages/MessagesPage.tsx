import { Mail, MailOpen, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { WhatsAppIcon } from '../../components/ui/BrandIcons'
import { useToast } from '../../providers/ToastProvider'
import type { ContactMessage } from '../../types'
import { Badge, Button, Card, Empty, PageHeader, Spinner, cx, useConfirm } from '../components/ui'
import * as api from '../lib/api'
import { useAdmin } from '../lib/context'
import { useI18n } from '../lib/i18n'
import { useLoad } from '../lib/useLoad'

export function MessagesPage() {
  const { t, n, date } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const { refreshUnread } = useAdmin()
  const { data, setData, reload } = useLoad(() => api.messages.list())
  const [open, setOpen] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const list = (data ?? []).filter((m) => filter === 'all' || !m.is_read)
  const unread = (data ?? []).filter((m) => !m.is_read).length

  const setRead = async (m: ContactMessage, is_read: boolean) => {
    setData((d) => d?.map((x) => (x.id === m.id ? { ...x, is_read } : x)) ?? d)
    try {
      await api.messages.setRead(m.id, is_read)
      refreshUnread()
    } catch {
      toast(t.error)
      reload()
    }
  }

  const toggleOpen = (m: ContactMessage) => {
    const next = open === m.id ? null : m.id
    setOpen(next)
    if (next && !m.is_read) setRead(m, true)
  }

  const remove = async (m: ContactMessage) => {
    if (!(await confirm(t.confirmDeleteMessage))) return
    try {
      await api.messages.remove(m.id)
      toast(t.deleted)
      refreshUnread()
      reload()
    } catch {
      toast(t.error)
    }
  }

  const replyText = (m: ContactMessage) =>
    `Hi ${m.name.split(' ')[0]}, thanks for reaching out to PEJMAN AI about "${m.project_type ?? 'your project'}". `

  return (
    <div>
      <PageHeader
        title={t.inbox}
        subtitle={data ? `${n(unread)} ${t.unread} · ${t.inboxTotal(n(data.length))}` : undefined}
      />
      <div className="mb-4 flex gap-2">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cx(
              'h-10 rounded-full px-4 text-sm font-medium',
              filter === f ? 'bg-paper text-ink' : 'bg-white/[0.05] text-paper/60 ring-1 ring-white/[0.07]',
            )}
          >
            {f === 'all' ? t.all : t.unread} {f === 'unread' && unread ? `(${n(unread)})` : ''}
          </button>
        ))}
      </div>

      {!data ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Empty text={t.noMessages} />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((m) => {
            const isOpen = open === m.id
            return (
              <Card key={m.id} className={cx('overflow-hidden transition-colors', !m.is_read && 'ring-lime/30')}>
                <button
                  type="button"
                  onClick={() => toggleOpen(m)}
                  className="flex w-full items-start gap-3 p-4 text-start"
                >
                  <span
                    className={cx(
                      'flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      m.is_read ? 'bg-white/[0.06]' : 'bg-lime text-ink',
                    )}
                  >
                    {m.name[0]?.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cx('truncate', m.is_read ? 'font-medium' : 'font-bold')} dir="auto">
                        {m.name}
                      </span>
                      <span className="ms-auto shrink-0 text-xs text-paper/40">
                        {date(m.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5" dir="ltr">
                      {m.project_type && <Badge tone="lime">{m.project_type}</Badge>}
                      {m.work_mode && <Badge>{m.work_mode}</Badge>}
                      {m.budget && <Badge>{m.budget}</Badge>}
                    </span>
                    <span className={cx('mt-2 block text-sm text-paper/60', !isOpen && 'line-clamp-2')} dir="auto">
                      {m.message}
                    </span>
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-white/[0.06] p-4 pt-3">
                    <p className="mb-3 text-sm text-paper/50" dir="ltr">
                      {m.email}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      <a
                        href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your PEJMAN AI project')}&body=${encodeURIComponent(replyText(m))}`}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-lime px-4 text-sm font-semibold text-ink"
                      >
                        <Mail className="size-4" /> {t.replyEmail}
                      </a>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`${m.name} (${m.email}) — ${m.project_type ?? ''}\n\n${m.message}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white/[0.06] px-4 text-sm font-semibold ring-1 ring-white/10"
                      >
                        <WhatsAppIcon className="size-4" /> {t.replyWhatsApp}
                      </a>
                      <Button onClick={() => setRead(m, !m.is_read)}>
                        {m.is_read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
                        {m.is_read ? t.markUnread : t.markRead}
                      </Button>
                      <Button variant="danger" onClick={() => remove(m)}>
                        <Trash2 className="size-4" /> {t.delete}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
