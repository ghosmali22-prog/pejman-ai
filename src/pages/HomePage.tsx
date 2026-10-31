import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ThemeBackdrop } from '../components/motion/ThemeBackdrop'
import type { SectionId } from '../hooks/useSectionLink'
import { ScrollTrigger } from '../lib/motion'
import { useMotion } from '../providers/MotionProvider'
import { useSiteData } from '../providers/SiteDataProvider'
import { CodeModal } from '../features/code/CodeModal'
import { About } from '../sections/About'
import { CodeShowcase } from '../sections/CodeShowcase'
import { Contact } from '../sections/Contact'
import { Hero } from '../sections/Hero'
import { Marquee } from '../sections/Marquee'
import { PromptShowcase } from '../sections/PromptShowcase'
import { Services } from '../sections/Services'
import { VideoShowcase } from '../sections/VideoShowcase'

/**
 * The one-page home site. Ready-made UI code is the first section after the hero; the full
 * prompt library lives on its own page (/prompts). A code item opens as an overlay at ?code=<slug>.
 */
export function HomePage() {
  const { loading, prompts, codeItems } = useSiteData()
  const { scrollTo } = useMotion()
  const location = useLocation()
  const navigate = useNavigate()

  // Content height changes once data arrives — recalculate scroll positions.
  useEffect(() => {
    if (loading) return
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(id)
  }, [loading, prompts.length, codeItems.length])

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
        <CodeShowcase />
        <About />
        <PromptShowcase />
        <VideoShowcase />
        <Services />
        <Contact />
        <Marquee />
      </main>
      <CodeModal />
    </>
  )
}
