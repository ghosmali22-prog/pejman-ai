import { Copy, Download, Trash2 } from 'lucide-react'
import { copyText } from '../../lib/clipboard'
import { useToast } from '../../providers/ToastProvider'
import { Button, Card, Empty, PageHeader, Spinner, useConfirm } from '../components/ui'
import * as api from '../lib/api'
import { useI18n } from '../lib/i18n'
import { useLoad } from '../lib/useLoad'

export function SubscribersPage() {
  const { t, n, date } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const { data, reload } = useLoad(() => api.subscribers.list())

  const exportCsv = () => {
    const rows = [['email', 'joined'], ...(data ?? []).map((s) => [s.email, s.created_at])]
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pejman-ai-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <PageHeader
        title={t.subscribers}
        subtitle={data ? n(data.length) : undefined}
        actions={
          data?.length ? (
            <>
              <Button
                onClick={async () => {
                  await copyText(data.map((s) => s.email).join(', '))
                  toast(t.emailsCopied)
                }}
              >
                <Copy className="size-4" /> {t.copyEmails}
              </Button>
              <Button onClick={exportCsv}>
                <Download className="size-4" /> {t.exportCsv}
              </Button>
            </>
          ) : null
        }
      />
      {!data ? (
        <Spinner />
      ) : data.length === 0 ? (
        <Empty text={t.noSubscribers} />
      ) : (
        <Card className="divide-y divide-white/[0.06]">
          {data.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" dir="ltr" style={{ textAlign: 'start' }}>
                  {s.email}
                </p>
                <p className="text-xs text-paper/40">
                  {t.joined}: {date(s.created_at)}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t.delete}
                className="hover:text-red-300"
                onClick={async () => {
                  if (!(await confirm(t.confirmDeleteSubscriber))) return
                  try {
                    await api.subscribers.remove(s.id)
                    toast(t.deleted)
                    reload()
                  } catch {
                    toast(t.error)
                  }
                }}
              >
                <Trash2 className="size-[18px]" />
              </Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
