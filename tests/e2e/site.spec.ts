import { expect, test } from '@playwright/test'
import { openHome, serveAsPejiai, servePage, watchErrors } from './helpers'

// What already works must keep working: home, prompts, code section, contact, admin.

test('home page loads with no errors or security-policy violations', async ({ page }) => {
  const errors = watchErrors(page)
  await openHome(page)
  await expect(page.locator('#code')).toBeVisible()
  await expect(page.locator('#contact')).toBeAttached()
  await page.mouse.wheel(0, 4000)
  await page.waitForTimeout(800)
  expect(errors).toEqual([])
})

test('the strict security policy is in the page (no unsafe-inline / unsafe-eval)', async ({ request }) => {
  for (const path of ['/', '/admin/']) {
    const html = await (await request.get(path)).text()
    const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? ''
    expect(csp, path).toContain("default-src 'self'")
    expect(csp, path).toContain("object-src 'none'")
    expect(csp, path).not.toContain('unsafe-inline')
    expect(csp, path).not.toContain('unsafe-eval')
  }
})

test('no horizontal scrolling at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await openHome(page)
  for (const y of [0, 1500, 3000, 6000, 9000]) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(150)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `at scroll ${y}`).toBeLessThanOrEqual(1)
  }
})

test('free code item: popup, live preview and copy still work', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
  await openHome(page, '/?code=glass-pricing-card')
  const dialog = page.getByRole('dialog', { name: 'Glass Pricing Card' })
  await expect(dialog).toBeVisible()
  await expect(dialog.frameLocator('iframe[title^="Live preview"]').getByText('Start free trial')).toBeVisible()
  await dialog.getByRole('button', { name: /Copy/ }).first().click()
  await expect(page.getByText(/copied/i).first()).toBeVisible()
})

test('contact form sends (demo mode) and has a hidden bot trap', async ({ page }) => {
  await openHome(page)
  const form = page.locator('#contact form')
  await form.scrollIntoViewIfNeeded()
  await expect(form.locator('input[name="company"]')).toBeHidden()
  await form.getByPlaceholder('Your name').fill('Test Person')
  await form.getByPlaceholder('Email address').fill('test@example.com')
  await form.getByPlaceholder(/Tell me about your project/).fill('Hello from the browser tests')
  await form.getByRole('button', { name: /Send message/ }).click()
  await expect(page.getByText('Thanks — message received.')).toBeVisible()
})

test('a bot that fills the hidden field is ignored', async ({ page }) => {
  await openHome(page)
  const form = page.locator('#contact form')
  await form.scrollIntoViewIfNeeded()
  await form.locator('input[name="company"]').evaluate((el: HTMLInputElement) => (el.value = 'Spam Inc'))
  await form.getByPlaceholder('Your name').fill('Bot')
  await form.getByPlaceholder('Email address').fill('bot@example.com')
  await form.getByPlaceholder(/Tell me about your project/).fill('spam')
  await form.getByRole('button', { name: /Send message/ }).click()
  await page.waitForTimeout(1200)
  await expect(page.getByText('Thanks — message received.')).toHaveCount(0)
})

test('admin panel is hidden from search engines', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toMatch(/Disallow: \/admin\//)
  const admin = await (await request.get('/admin/')).text()
  expect(admin).toContain('<meta name="robots" content="noindex" />')
})

test('the site refuses to run inside another site’s frame (clickjacking)', async ({ page, context }) => {
  await serveAsPejiai(context)
  await servePage(context, 'https://evil.example/', '<!doctype html><iframe src="https://pejiai.com/admin/" width="800" height="600"></iframe>')
  await page.goto('https://evil.example/')
  const framed = page.frameLocator('iframe')
  await expect(framed.locator('#root')).toHaveText(/Open pejiai\.com directly/)
  await expect(framed.getByRole('button', { name: /Google/ })).toHaveCount(0)
})
