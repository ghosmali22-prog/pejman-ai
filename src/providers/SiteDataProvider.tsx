import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { defaultSettings } from '../config/site'
import { fetchCodeItems } from '../services/code'
import { fetchCategories, fetchPrompts } from '../services/prompts'
import { fetchSettings } from '../services/settings'
import type { Category, CodeItem, Prompt, SiteSettings } from '../types'

interface SiteData {
  settings: SiteSettings
  prompts: Prompt[]
  categories: Category[]
  codeItems: CodeItem[]
  loading: boolean
  error: string | null
}

const SiteDataContext = createContext<SiteData | null>(null)

export function SiteDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SiteData>({
    settings: defaultSettings,
    prompts: [],
    categories: [],
    codeItems: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    let alive = true
    Promise.allSettled([fetchSettings(), fetchPrompts(), fetchCategories(), fetchCodeItems()]).then(([s, p, c, code]) => {
      if (!alive) return
      setState({
        settings: s.status === 'fulfilled' ? s.value : defaultSettings,
        prompts: p.status === 'fulfilled' ? p.value : [],
        categories: c.status === 'fulfilled' ? c.value : [],
        codeItems: code.status === 'fulfilled' ? code.value : [],
        loading: false,
        error: p.status === 'rejected' ? 'Could not load prompts. Please refresh.' : null,
      })
    })
    return () => {
      alive = false
    }
  }, [])

  return <SiteDataContext.Provider value={state}>{children}</SiteDataContext.Provider>
}

export function useSiteData() {
  const ctx = useContext(SiteDataContext)
  if (!ctx) throw new Error('useSiteData must be used inside <SiteDataProvider>')
  return ctx
}
