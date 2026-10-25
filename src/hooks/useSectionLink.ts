import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMotion } from '../providers/MotionProvider'

export type SectionId = 'top' | 'about' | 'prompts' | 'blog' | 'services' | 'contact'

/**
 * Smooth-scrolls to a home-page section, navigating home first when needed.
 * "prompts" and "blog" open their own pages.
 */
export function useSectionLink() {
  const { scrollTo } = useMotion()
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(
    (id: SectionId) => {
      if (id === 'prompts' || id === 'blog') {
        navigate(`/${id}`)
        return
      }
      if (location.pathname !== '/') {
        navigate('/', { state: { scrollTo: id } })
        return
      }
      if (id === 'top') scrollTo(0)
      else scrollTo(`#${id}`, { offset: -24 })
    },
    [location.pathname, navigate, scrollTo],
  )
}
