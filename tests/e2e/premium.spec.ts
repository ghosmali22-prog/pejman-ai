import { expect, test } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'
import { openHome, serveAsPejiai, servePage, watchErrors } from './helpers'

// Premium items: video / screenshot preview, "Get this code" first, and the protected live demo
// that only renders when framed by pejiai.com.

const PREMIUM = 'saas-landing-hero'
let vite: ViteDevServer
let demoHtml = ''

test.beforeAll(async () => {
  // Build a demo exactly like the admin panel does, to test the file itself.
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
  const { buildDemoDocument, loadObfuscator } = await vite.ssrLoadModule('/src/lib/demoBuild.ts')
  const { sampleDemoSource } = await vite.ssrLoadModule('/src/data/sampleCode.ts')
  demoHtml = buildDemoDocument(sampleDemoSource(), PREMIUM, await loadObfuscator())
})
test.afterAll(() => vite?.close())

const frameHost = (src: string) =>
  `<!doctype html><body style="margin:0"><iframe id="f" sandbox="allow-scripts" src="${src}" width="900" height="700"></iframe></body>`

test('premium popup: "Get this code" is the main button, no code is shown', async ({ page }) => {
  await openHome(page, `/?code=${PREMIUM}`)
  const dialog = page.getByRole('dialog', { name: 'SaaS Landing Hero' })
  await expect(dialog.getByRole('button', { name: 'Get this code' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Try live demo' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Copy/ })).toHaveCount(0)
  await expect(dialog.locator('pre code')).toHaveCount(0)
})

test('live demo works when framed by pejiai.com (watermarked, Desktop/Mobile switch)', async ({ page, context }) => {
  await serveAsPejiai(context)
  const errors = watchErrors(page)
  await openHome(page, `https://pejiai.com/?code=${PREMIUM}`)
  const dialog = page.getByRole('dialog', { name: 'SaaS Landing Hero' })
  await dialog.getByRole('button', { name: 'Try live demo' }).click()
  const frame = dialog.frameLocator('iframe[title*="protected demo"]')
  await expect(frame.getByText('Start free trial')).toBeVisible()
  await expect(frame.getByText('View on pejiai.com')).toHaveCount(0)

  // sandbox="allow-scripts" only — never allow-same-origin
  await expect(dialog.locator('iframe[title*="protected demo"]')).toHaveAttribute('sandbox', 'allow-scripts')
  // watermark: in the title and drawn by CSS
  const title = await page.frames().find((f) => f !== page.mainFrame() && f.url().includes('sandbox'))!.title()
  expect(title).toContain('Preview · pejiai.com')

  await dialog.getByRole('tab', { name: 'Mobile' }).click()
  await expect(dialog.frameLocator('iframe[title*="protected demo"]').getByText('Start free trial')).toBeVisible()
  expect(errors).toEqual([])
})

test('demo opened directly (not in a frame) shows "View on pejiai.com"', async ({ page, context }) => {
  await servePage(context, 'https://downloaded.example/demo.html', demoHtml)
  await page.goto('https://downloaded.example/demo.html')
  await expect(page.getByRole('link', { name: 'View on pejiai.com' })).toBeVisible()
  await expect(page.getByText('Start free trial')).toHaveCount(0)
})

test('demo framed by another website shows "View on pejiai.com"', async ({ page, context }) => {
  await servePage(context, 'https://copycat.example/demo.html', demoHtml)
  await servePage(context, 'https://copycat.example/', frameHost('/demo.html'))
  await page.goto('https://copycat.example/')
  const frame = page.frameLocator('#f')
  await expect(frame.getByRole('link', { name: 'View on pejiai.com' })).toBeVisible()
  await expect(frame.getByText('Start free trial')).toHaveCount(0)
})

test('demo on localhost (not pejiai.com) is blocked in the real popup too', async ({ page }) => {
  await openHome(page, `/?code=${PREMIUM}`)
  const dialog = page.getByRole('dialog', { name: 'SaaS Landing Hero' })
  await dialog.getByRole('button', { name: 'Try live demo' }).click()
  const frame = dialog.frameLocator('iframe[title*="protected demo"]')
  await expect(frame.getByRole('link', { name: 'View on pejiai.com' })).toBeVisible()
  await expect(frame.getByText('Start free trial')).toHaveCount(0)
})

test('demo file hides the source: no comments, no readable names, watermark woven in', async () => {
  expect(demoHtml).not.toMatch(/<!--/)
  expect(demoHtml).not.toContain('class="card"')
  expect(demoHtml).not.toContain('.pill')
  // CSS badge (plain text) + tiled overlay (URL-encoded SVG); the script's copies are encrypted.
  expect(demoHtml).toContain('content:"Preview · pejiai.com"')
  expect(demoHtml).toContain(encodeURIComponent('Preview · pejiai.com'))
})

test('right-click and text selection are blocked inside the demo', async ({ page, context }) => {
  await serveAsPejiai(context)
  await servePage(context, 'https://pejiai.com/__demo.html', demoHtml)
  await servePage(context, 'https://pejiai.com/__host.html', frameHost('/__demo.html'))
  await page.goto('https://pejiai.com/__host.html')
  const frame = page.frames().find((f) => f.url().endsWith('__demo.html'))!
  await expect(page.frameLocator('#f').getByText('Start free trial')).toBeVisible()
  const blocked = await frame.evaluate(() => {
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    document.body.dispatchEvent(ev)
    return { menu: ev.defaultPrevented, select: getComputedStyle(document.body).userSelect }
  })
  expect(blocked.menu).toBe(true)
  expect(blocked.select).toBe('none')
})

test('admin: premium item has the video upload, demo switch and demo preview', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/admin/code')
  await page.getByText('SaaS Landing Hero').first().click()
  await expect(page.getByText(/Premium preview|پیش‌نمایش پرمیوم/)).toBeVisible()
  await expect(page.getByText(/Preview video|ویدیوی پیش‌نمایش/)).toBeVisible()
  await expect(page.getByText(/Protected live demo|دموی زندهٔ محافظت‌شده/)).toBeVisible()
  await page.getByRole('button', { name: /Build & preview demo|ساخت و پیش‌نمایش دمو/ }).click()
  // On localhost the lock is expected; the build itself must succeed under the strict policy.
  const frame = page.frameLocator('iframe[title*="protected demo"]')
  await expect(frame.getByRole('link', { name: 'View on pejiai.com' })).toBeVisible({ timeout: 30_000 })
  expect(errors).toEqual([])
})
