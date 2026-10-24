import { useGSAP } from '@gsap/react'
import { Fragment, useRef, type ElementType } from 'react'
import { gsap } from '../../lib/motion'
import { useMotion } from '../../providers/MotionProvider'

interface RevealTextProps {
  text: string
  as?: ElementType
  className?: string
  /** "scroll" waits until the element enters the screen; "manual" waits for `play`. */
  mode?: 'scroll' | 'manual'
  play?: boolean
  delay?: number
  stagger?: number
  start?: string
}

/**
 * Words slide up from behind a mask. Use "\n" in `text` for hard line breaks.
 * The text is rendered visible in the HTML; GSAP only hides it right before animating,
 * so it can never stay hidden if JavaScript fails.
 */
export function RevealText({
  text,
  as: Tag = 'h2',
  className,
  mode = 'scroll',
  play = true,
  delay = 0,
  stagger = 0.05,
  start = 'top 88%',
}: RevealTextProps) {
  const ref = useRef<HTMLElement>(null)
  const { level } = useMotion()

  useGSAP(
    () => {
      if (level === 'none' || !ref.current) return
      const words = ref.current.querySelectorAll('.reveal-word')
      if (mode === 'manual' && !play) {
        gsap.set(words, { yPercent: 110 })
        return
      }
      gsap.fromTo(
        words,
        { yPercent: 110 },
        {
          yPercent: 0,
          duration: 1.1,
          ease: 'expo.out',
          stagger,
          delay,
          scrollTrigger: mode === 'scroll' ? { trigger: ref.current, start, once: true } : undefined,
        },
      )
    },
    { scope: ref, dependencies: [level, play, text] },
  )

  const lines = text.split('\n')
  return (
    <Tag ref={ref} className={className}>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {line
            .split(' ')
            .filter(Boolean)
            .map((word, wi, arr) => (
              <Fragment key={wi}>
                <span className="reveal-mask">
                  <span className="reveal-word">{word}</span>
                </span>
                {wi < arr.length - 1 ? ' ' : null}
              </Fragment>
            ))}
          {li < lines.length - 1 ? <br /> : null}
        </Fragment>
      ))}
    </Tag>
  )
}
