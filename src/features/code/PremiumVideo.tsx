import { useEffect, useRef, useState } from 'react'

/**
 * Looping preview video of a premium item: muted, inline, loaded only when it scrolls into view
 * and paused when it leaves. Falls back to the screenshot if the video can't play.
 */
export function PremiumVideo({
  src,
  poster,
  title,
  thumbnail,
  className = '',
}: {
  src: string
  poster?: string | null
  title: string
  thumbnail?: boolean
  className?: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [near, setNear] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true)
        const v = videoRef.current
        if (!v) return
        if (entry.isIntersecting && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) v.play().catch(() => {})
        else v.pause()
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [near])

  return (
    <div ref={boxRef} className={`relative overflow-hidden bg-ink-3 ${className}`} aria-hidden={thumbnail || undefined}>
      {poster && (
        <img
          src={poster}
          alt={thumbnail ? '' : `Preview of ${title}`}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover object-top"
        />
      )}
      {near && !failed && (
        <video
          ref={videoRef}
          src={src}
          poster={poster ?? undefined}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          disablePictureInPicture
          controlsList="nodownload noplaybackrate"
          onError={() => setFailed(true)}
          aria-label={thumbnail ? undefined : `Video preview of ${title}`}
          className="absolute inset-0 size-full object-cover object-top"
        />
      )}
    </div>
  )
}
