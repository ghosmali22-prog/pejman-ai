import { useEffect, useMemo, useRef, useState } from 'react'
import { buildPreviewDocument } from '../../lib/code'
import type { CodeFile } from '../../types'

export type Device = 'desktop' | 'mobile'

const WIDTH: Record<Device, number> = { desktop: 1280, mobile: 390 }

/** Short fingerprint of a document, so a changed document gets a fresh frame. */
const fingerprint = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return `${s.length}-${h}`
}
const SANDBOX_URL = `${import.meta.env.BASE_URL}sandbox.html`
/**
 * Camera-capable runner on a SEPARATE origin (repo ghosmali22-prog/pejiai-sandbox). Browsers refuse the
 * camera to opaque "null" origins, so the full-screen /demo/ page runs code there instead: a real origin,
 * but not pejiai.com, so it still cannot read this site's cookies, storage or admin session.
 */
export const CAMERA_SANDBOX_URL = 'https://ghosmali22-prog.github.io/pejiai-sandbox/'
const CAMERA_SANDBOX_ORIGIN = new URL(CAMERA_SANDBOX_URL).origin

interface CodePreviewProps {
  files?: CodeFile[]
  /** A ready document instead of files (the protected live demo of a premium item). */
  html?: string
  title: string
  device?: Device
  /** Card thumbnail: not interactive, hidden from screen readers. */
  thumbnail?: boolean
  /**
   * Render the frame at the box's real size (full-screen demo page) instead of a scaled virtual width.
   * The box then needs its own positioning via className (e.g. "fixed inset-0").
   */
  fill?: boolean
  /** Run in the camera-capable runner on its own origin (full-screen demo page only). */
  camera?: boolean
  className?: string
}

/**
 * Live preview of HTML/CSS/JS in a sandboxed iframe.
 *
 * Security: the frame loads /sandbox.html with sandbox="allow-scripts" and deliberately WITHOUT
 * allow-same-origin, so the code runs in an opaque origin. It cannot read this site's cookies,
 * localStorage (the admin session) or DOM, cannot navigate the page and cannot open pop-ups.
 * The code is handed over with postMessage and never runs anywhere else.
 * The frame's allow="camera; microphone; fullscreen; autoplay" only delegates those permissions so
 * demos (e.g. hand tracking) can ask for the webcam — the browser still prompts the visitor, and the
 * code still runs in the opaque origin with no access to this site.
 *
 * Speed: the frame is created only when the preview scrolls into view. It renders at a real
 * desktop (1280px) or phone (390px) width and is scaled down to fit its box — or, with `fill`,
 * at the box's own size.
 */
export function CodePreview({
  files,
  html: doc,
  title,
  device = 'desktop',
  thumbnail,
  fill,
  camera,
  className = '',
}: CodePreviewProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [visible, setVisible] = useState(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [ready, setReady] = useState(false)
  const html = useMemo(() => doc ?? buildPreviewDocument(files ?? []), [doc, files])

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    const ro = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    )
    ro.observe(el)
    return () => {
      io.disconnect()
      ro.disconnect()
    }
  }, [])

  // Hand the document to the sandbox once it says it is ready (only to our own frame).
  useEffect(() => {
    if (!visible) return
    const onMessage = (e: MessageEvent) => {
      const win = frameRef.current?.contentWindow
      if (!win || e.source !== win || e.data?.type !== 'pj-sandbox-ready') return
      // The opaque-origin sandbox can only be reached with '*'; the camera runner by its exact origin.
      win.postMessage({ type: 'pj-render', html }, camera ? CAMERA_SANDBOX_ORIGIN : '*')
      setReady(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [visible, html, camera])

  const virtualW = WIDTH[device]
  // Phones in the modal are shown at 1:1 when there is room, desktops always fill the width.
  const scale = size.w ? Math.min(1, size.w / virtualW) : 0
  const frameH = scale ? size.h / scale : 0

  return (
    <div
      ref={boxRef}
      // With `fill` the caller positions the box (e.g. "fixed inset-0"), so `relative` must not override it.
      className={`${fill ? '' : 'relative '}overflow-hidden transition-colors duration-500 ${ready ? 'bg-white' : 'bg-ink-3'} ${className}`}
      aria-hidden={thumbnail || undefined}
    >
      {visible && (fill || scale > 0) && (
        <iframe
          // A new frame per document/device: the sandbox accepts exactly one document.
          key={`${device}|${fingerprint(html)}`}
          ref={frameRef}
          src={camera ? CAMERA_SANDBOX_URL : SANDBOX_URL}
          // allow-same-origin only for the runner on its own origin (never for /sandbox.html on pejiai.com).
          sandbox={camera ? 'allow-scripts allow-same-origin' : 'allow-scripts'}
          allow="camera; microphone; fullscreen; autoplay"
          allowFullScreen
          // Demos check that they are framed by pejiai.com; browsers without ancestorOrigins read the referrer.
          referrerPolicy={doc ? 'strict-origin' : 'no-referrer'}
          title={`Live preview: ${title}`}
          tabIndex={thumbnail ? -1 : undefined}
          className={`absolute top-0 origin-top-left border-0 transition-opacity duration-500 ${
            ready ? 'opacity-100' : 'opacity-0'
          } ${thumbnail ? 'pointer-events-none' : ''}`}
          style={
            fill
              ? { width: '100%', height: '100%', left: 0 }
              : {
                  width: virtualW,
                  height: frameH,
                  left: device === 'mobile' && size.w > virtualW ? (size.w - virtualW) / 2 : 0,
                  transform: `scale(${scale})`,
                }
          }
        />
      )}
      {!ready && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.06] to-white/[0.02]" />}
    </div>
  )
}
