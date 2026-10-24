import { Languages, LogOut } from 'lucide-react'
import { useState } from 'react'
import { Logo } from '../../components/layout/Navbar'
import { Button, Card } from '../components/ui'
import * as api from '../lib/api'
import { useI18n } from '../lib/i18n'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-8Z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z"
      />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8Z" />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z"
      />
    </svg>
  )
}

export function LoginPage({ email }: { email: string | null }) {
  const { t, toggle } = useI18n()
  const [busy, setBusy] = useState(false)

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-5">
      <div aria-hidden="true" className="lime-glow pointer-events-none absolute inset-x-0 bottom-0 h-96" />
      <button
        type="button"
        onClick={toggle}
        className="absolute end-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm text-paper/70 ring-1 ring-white/10"
      >
        <Languages className="size-4" /> {t.language}
      </button>
      <Card className="relative w-full max-w-sm p-8 text-center">
        <div dir="ltr" className="flex justify-center">
          <Logo className="text-2xl" />
        </div>
        {email ? (
          <>
            <h1 className="mt-8 text-2xl font-bold">{t.deniedTitle}</h1>
            <p className="mt-2 text-sm text-paper/55">{t.deniedText}</p>
            <p className="mt-4 rounded-full bg-white/[0.06] px-4 py-2 text-sm" dir="ltr">
              {email}
            </p>
            <Button className="mt-6 w-full" size="lg" onClick={() => api.auth.signOut()}>
              <LogOut className="size-4" /> {t.signOut}
            </Button>
          </>
        ) : (
          <>
            <h1 className="mt-8 text-2xl font-bold">{t.signInTitle}</h1>
            <p className="mt-2 text-sm text-paper/55">{t.signInText}</p>
            <Button
              variant="light"
              size="lg"
              className="mt-8 w-full"
              loading={busy}
              onClick={async () => {
                setBusy(true)
                await api.auth.signIn().catch(() => setBusy(false))
              }}
            >
              {!busy && <GoogleIcon />} {t.signInGoogle}
            </Button>
          </>
        )}
      </Card>
    </div>
  )
}
