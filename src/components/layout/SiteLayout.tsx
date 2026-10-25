import { AnimatePresence, motion } from 'framer-motion'
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

  // Once the old page has faded out, start the new one at the top
  // (opening/closing a prompt overlay keeps the same page, so it never scrolls).
  const onPageSwap = () => {
    scrollTo(0, { immediate: true })
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
          {outlet}
        </motion.div>
      </AnimatePresence>
      <Footer />
      <CustomCursor />
    </>
  )
}
