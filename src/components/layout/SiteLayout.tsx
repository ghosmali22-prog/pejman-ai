import { AnimatePresence, motion } from 'framer-motion'
import { useLayoutEffect } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { ScrollTrigger } from '../../lib/motion'
import { useMotion } from '../../providers/MotionProvider'
import { CustomCursor } from '../motion/CustomCursor'
import { Intro } from '../motion/Intro'
import { Footer } from './Footer'
import { Navbar } from './Navbar'

/** "/prompts" and "/p/<slug>" are the same page (the library); everything else is its own page. */
const pageKey = (path: string) => (path === '/prompts' || path.startsWith('/p/') ? 'library' : path)

export function SiteLayout() {
  const location = useLocation()
  const outlet = useOutlet()
  const { scrollTo, level } = useMotion()
  const key = pageKey(location.pathname)

  // Start every new page at the top (opening/closing a prompt overlay keeps the same page).
  // Done before the old page fades, when it is gone, and again once the new page is in —
  // iPhone Safari can otherwise keep the old position and land at the bottom of the new page.
  const toTop = () => {
    ScrollTrigger.clearScrollMemory('manual')
    window.scrollTo(0, 0)
    scrollTo(0, { immediate: true })
  }
  const onPageSwap = () => {
    toTop()
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }

  return (
    <>
      <Intro />
      <Navbar />
      <AnimatePresence mode="wait" initial={false} onExitComplete={onPageSwap}>
        <motion.div
          key={key}
          initial={level === 'none' ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <PageTop toTop={toTop} />
          {outlet}
        </motion.div>
      </AnimatePresence>
      <Footer />
      <CustomCursor />
    </>
  )
}

/** Runs once when a page mounts: snaps to the top, then once more after layout settles. */
function PageTop({ toTop }: { toTop: () => void }) {
  const location = useLocation()
  useLayoutEffect(() => {
    // Arriving with a section to jump to (e.g. "About" from the library): HomePage handles it.
    if ((location.state as { scrollTo?: string } | null)?.scrollTo) return
    toTop()
    const a = requestAnimationFrame(() => {
      toTop()
    })
    const t = window.setTimeout(toTop, 120)
    return () => {
      cancelAnimationFrame(a)
      window.clearTimeout(t)
    }
    // Only on mount of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
