import { useEffect, useRef } from 'react'
import type { Prompt } from '../../types'

/** Visitors on "data saver" get the poster only. */
const saveData = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true

/**
 * Muted looping preview of a video prompt. Nothing but the poster image is downloaded
 * until the card is on screen (preload="none"), and it pauses again once scrolled away,
 * so a page full of videos stays as light as a page of images.
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
      src={prompt.video_url ?? undefined}
      poster={prompt.image_url}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      aria-label={prompt.title}
      className={className}
    />
  )
}
