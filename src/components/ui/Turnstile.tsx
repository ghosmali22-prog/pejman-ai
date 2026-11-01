import { useEffect, useRef } from 'react'
import { TURNSTILE_SITE_KEY } from '../../lib/config'

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loader: Promise<TurnstileApi> | null = null
function loadTurnstile(): Promise<TurnstileApi> {
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing')))
    s.onerror = () => {
      loader = null
      reject(new Error('Turnstile failed to load'))
    }
    document.head.appendChild(s)
  })
  return loader
}

/**
 * Cloudflare Turnstile "are you human?" check. Loads only when a site key is configured;
 * the token is checked again on the server by the contact Edge Function.
 */
export function Turnstile({ onToken, resetKey }: { onToken: (token: string) => void; resetKey?: unknown }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const onTokenRef = useRef(onToken)
  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !boxRef.current) return
    let id = ''
    let cancelled = false
    loadTurnstile()
      .then((t) => {
        if (cancelled || !boxRef.current) return
        id = t.render(boxRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'light',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        })
      })
      .catch(() => onTokenRef.current(''))
    return () => {
      cancelled = true
      if (id) window.turnstile?.remove(id)
    }
  }, [resetKey])

  if (!TURNSTILE_SITE_KEY) return null
  return <div ref={boxRef} className="min-h-[65px] sm:col-span-2" />
}
