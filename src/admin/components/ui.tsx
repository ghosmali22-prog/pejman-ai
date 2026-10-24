import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { useI18n } from '../lib/i18n'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-3xl bg-ink-2 ring-1 ring-white/[0.07]', className)}>{children}</div>
}

type Variant = 'lime' | 'dark' | 'ghost' | 'danger' | 'light'
const variants: Record<Variant, string> = {
  lime: 'bg-lime text-ink hover:bg-lime-2',
  light: 'bg-paper text-ink hover:bg-paper/90',
  dark: 'bg-white/[0.06] text-paper ring-1 ring-white/10 hover:bg-white/10',
  ghost: 'text-paper/70 hover:bg-white/[0.06] hover:text-paper',
  danger: 'bg-red-500/10 text-red-300 ring-1 ring-red-500/20 hover:bg-red-500/20',
}

export function Button({
  variant = 'dark',
  size = 'md',
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
}) {
  const sizes = {
    sm: 'h-9 px-3.5 text-[13px] gap-1.5',
    md: 'h-11 px-4 text-sm gap-2',
    lg: 'h-13 px-6 text-[15px] gap-2',
    icon: 'size-11 justify-center',
  }
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50',
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cx('flex flex-col gap-2', className)}>
      <span className="text-[13px] font-medium text-paper/70">{label}</span>
      {children}
      {hint ? <span className="text-xs text-paper/40">{hint}</span> : null}
    </label>
  )
}

const inputBase =
  'w-full rounded-2xl bg-ink px-4 text-[16px] text-paper outline-none ring-1 ring-white/10 transition placeholder:text-paper/25 focus:ring-lime/60 md:text-sm'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputBase, 'h-12', props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputBase, 'min-h-28 py-3 leading-relaxed', props.className)} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputBase, 'h-12 appearance-none', props.className)} />
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center justify-between gap-4 rounded-2xl bg-ink px-4 py-3 text-start ring-1 ring-white/10"
    >
      <span className="text-sm font-medium">{label}</span>
      <span
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-lime' : 'bg-white/15')}
      >
        <span
          className={cx(
            'absolute top-1 size-5 rounded-full bg-paper shadow transition-all duration-300',
            checked ? 'bg-ink ltr:left-6 rtl:right-6' : 'ltr:left-1 rtl:right-1',
          )}
        />
      </span>
    </button>
  )
}

export function Badge({ tone = 'mute', children }: { tone?: 'lime' | 'mute' | 'red' | 'white'; children: ReactNode }) {
  const tones = {
    lime: 'bg-lime/15 text-lime',
    mute: 'bg-white/[0.06] text-paper/60',
    red: 'bg-red-500/15 text-red-300',
    white: 'bg-paper text-ink',
  }
  return (
    <span
      className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold', tones[tone])}
    >
      {children}
    </span>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight md:text-[34px]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-paper/50">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="size-3 rounded-full bg-lime shadow-[0_0_24px_rgb(198_244_50/0.8)]" />
      <p className="text-paper/60">{text}</p>
      {action}
    </Card>
  )
}

export function Spinner() {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-paper/50">
      <Loader2 className="size-5 animate-spin text-lime" /> {t.loading}
    </div>
  )
}

// ---------------------------------------------------------------- confirm dialog
type ConfirmFn = (message: string, opts?: { danger?: boolean; confirmLabel?: string }) => Promise<boolean>
const ConfirmCtx = createContext<ConfirmFn>(async () => false)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [state, setState] = useState<{ message: string; danger: boolean; label?: string } | null>(null)
  const resolver = useRef<(v: boolean) => void>(() => {})

  const confirm = useCallback<ConfirmFn>((message, opts) => {
    setState({ message, danger: opts?.danger ?? true, label: opts?.confirmLabel })
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (v: boolean) => {
    resolver.current(v)
    setState(null)
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {state && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close(false)}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              className="w-full max-w-sm rounded-3xl bg-ink-2 p-6 ring-1 ring-white/10"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-base leading-relaxed">{state.message}</p>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <Button onClick={() => close(false)}>{t.cancel}</Button>
                <Button variant={state.danger ? 'danger' : 'lime'} onClick={() => close(true)} autoFocus>
                  {state.label ?? (state.danger ? t.delete : t.save)}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmCtx.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmCtx)
