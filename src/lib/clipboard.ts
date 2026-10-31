/** Copies text, falling back to a hidden textarea on older mobile browsers. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}

export const promptUrl = (slug: string) =>
  new URL(`p/${slug}`, window.location.origin + import.meta.env.BASE_URL).toString()

export const codeUrl = (slug: string) =>
  new URL(`?code=${slug}`, window.location.origin + import.meta.env.BASE_URL).toString()
