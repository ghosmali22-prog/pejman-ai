import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ThemeBackdrop } from '../components/motion/ThemeBackdrop'
import { PromptModal } from '../features/prompts/PromptModal'
import type { SectionId } from '../hooks/useSectionLink'
import { ScrollTrigger } from '../lib/motion'
import { useMotion } from '../providers/MotionProvider'
import { useSiteData } from '../providers/SiteDataProvider'
import { About } from '../sections/About'
import { Contact } from '../sections/Contact'
import { Hero } from '../sections/Hero'
import { Marquee } from '../sections/Marquee'
import { Prompts } from '../sections/Prompts'
import { Services } from '../sections/Services'

/** The one-page site. Also stays mounted underneath /p/:slug so prompts open as an overlay. */
export function HomePage() {
  const { loading, prompts } = useSiteData()
  const { scrollTo } = useMotion()
  const location = useLocation()
  const navigate = useNavigate()

  // Content height changes once data arrives — recalculate scroll positions.
  useEffect(() => {
    if (loading) return
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(id)
  }, [loading, prompts.length])

  // Arriving from another page with a section to jump to (e.g. /admin → Contact).
  useEffect(() => {
    const target = (location.state as { scrollTo?: SectionId } | null)?.scrollTo
    if (!target) return
    const t = window.setTimeout(() => {
      scrollTo(target === 'top' ? 0 : `#${target}`, { offset: -24 })
      navigate('.', { replace: true, state: null })
    }, 120)
    return () => window.clearTimeout(t)
  }, [location.state, scrollTo, navigate])

  return (
    <>
      <ThemeBackdrop deps={[loading]} />
      <main>
        <Hero />
        <About />
        <Prompts />
        <Services />
        <Contact />
        <Marquee />
      </main>
      <PromptModal />
    </>
  )
}
