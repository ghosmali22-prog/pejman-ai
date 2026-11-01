import type { BrowserContext, Page } from '@playwright/test'

export const LOCAL = 'http://localhost:4173'

/** Collects JS errors and Content-Security-Policy violations, so a test can assert there were none. */
export function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    const text = m.text()
    if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(text)) {
      // Demo frames deliberately run untrusted preview code; their logs are not the site's errors.
      if (!/sandbox|favicon/i.test(m.location().url)) errors.push(`console: ${text}`)
    }
  })
  return errors
}

/**
 * Makes https://pejiai.com/... load the local build, so the domain lock can be tested
 * exactly as it runs on the real site.
 */
export async function serveAsPejiai(context: BrowserContext) {
  await context.route('https://pejiai.com/**', async (route) => {
    const url = new URL(route.request().url())
    const response = await route.fetch({ url: LOCAL + url.pathname + url.search })
    await route.fulfill({ response })
  })
}

/** Serves one HTML page at an arbitrary https URL (another site, a direct link, …). */
export async function servePage(context: BrowserContext, url: string, html: string) {
  await context.route(url, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }))
}

/** Skips the intro animation and waits for the Code section. */
export async function openHome(page: Page, path = '/') {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('pj-intro-seen', '1')
    } catch {
      /* ignore */
    }
  })
  await page.goto(path)
  await page.locator('#code').waitFor()
}
