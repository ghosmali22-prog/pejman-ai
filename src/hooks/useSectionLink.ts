import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMotion } from '../providers/MotionProvider'

export type SectionId = 'top' | 'about' | 'prompts' | 'services' | 'contact'

/** Smooth-scrolls to a home-page section, navigating home first when needed. */
export function useSectionLink() {
  const { scrollTo } = useMotion()
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(
    (id: SectionId) => {
      const onHome = location.pathname === '/' || location.pathname.startsWith('/p/')
      if (!onHome) {
        navigate('/', { state: { scrollTo: id } })
        return
      }
      if (location.pathname !== '/') navigate('/', { replace: true })
      if (id === 'top') scrollTo(0)
      else scrollTo(`#${id}`, { offset: -24 })
    },
    [location.pathname, navigate, scrollTo],
  )
}
