import { useEffect, useRef } from 'react'
import type { Prompt } from '../../types'

/** Visitors on "data saver" get the poster only. */
const saveData = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true

/** Previews loop only this many seconds, so only the start of each file is downloaded. */
const PREVIEW_SECONDS = 4

/** Without a cover image, ask for the first frame (also makes iOS show it). */
const previewSrc = (p: Prompt) => (p.image_url ? p.video_url! : `${p.video_url}#t=0.1`)

/** Restarts the clip after PREVIEW_SECONDS. */
const loopPreview = (e: React.SyntheticEvent<HTMLVideoElement>) => {
  if (e.currentTarget.currentTime >= PREVIEW_SECONDS) e.currentTarget.currentTime = 0
}

/**
 * Muted preview of a video prompt that plays its first few seconds on a loop. Nothing but the
 * cover (or the first frame) is downloaded until the card is on screen, and it pauses again
 * once scrolled away, so a page full of videos stays as light as a page of images.
 */
export function PromptVideo({
  prompt,
  className,
  active = true,
}: {
  prompt: Prompt
  className?: string
  /** Extra condition for playing, e.g. "this is the centred carousel card". */
  active?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const inView = useRef(false)
  const activeRef = useRef(active)

  const sync = () => {
    const v = ref.current
    if (!v) return
    if (inView.current && activeRef.current && !saveData()) {
      if (v.paused) v.play().catch(() => {})
    } else if (!v.paused) v.pause()
  }

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const io = new IntersectionObserver(
      ([e]) => {
        inView.current = e.isIntersecting
        sync()
      },
      { rootMargin: '120px' },
    )
    io.observe(v)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    activeRef.current = active
    sync()
  }, [active])

  return (
    <video
      ref={ref}
      src={previewSrc(prompt)}
      poster={prompt.image_url || undefined}
      muted
      loop
      playsInline
      preload={prompt.image_url ? 'none' : 'metadata'}
      onTimeUpdate={loopPreview}
      disablePictureInPicture
      aria-label={prompt.title}
      className={className}
    />
  )
}
