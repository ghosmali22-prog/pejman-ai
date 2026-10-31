import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMotion } from '../providers/MotionProvider'

export type SectionId = 'top' | 'code' | 'about' | 'prompts' | 'services' | 'contact'

/**
 * Smooth-scrolls to a home-page section, navigating home first when needed.
 * "prompts" opens the separate prompt library page.
 */
export function useSectionLink() {
  const { scrollTo } = useMotion()
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(
    (id: SectionId) => {
      if (id === 'prompts') {
        navigate('/prompts')
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
