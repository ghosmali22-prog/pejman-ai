import { useEffect } from 'react'

/**
 * Sets the tab title, meta description and canonical link while a page is open,
 * and puts the previous values back when it closes.
 */
export function usePageMeta(meta: { title: string; description?: string; canonical?: string } | null) {
  const { title, description, canonical } = meta ?? {}
  useEffect(() => {
    if (!title) return
    const desc = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')
    const link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const prev = { title: document.title, desc: desc?.content, href: link?.href }
    document.title = title
    if (desc && description) desc.content = description
    if (link && canonical) link.href = canonical
    return () => {
      document.title = prev.title
      if (desc && prev.desc !== undefined) desc.content = prev.desc
      if (link && prev.href !== undefined) link.href = prev.href
    }
  }, [title, description, canonical])
}
