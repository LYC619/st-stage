import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Serve the actual module graph so relative hashed imports behave as in ST. */
export async function loadBuiltExtension(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'zh-CN' })
    try { localStorage.setItem('language', 'zh-cn') } catch { /* about:blank has no storage origin */ }
  })
  const base = 'http://localhost:3101/__extension_fixture/'
  await page.route(base + '**', async route => {
    const file = new URL(route.request().url()).pathname.slice('/__extension_fixture/'.length)
    if (!/^(?:bundle\.js|chunk-[A-Z0-9]+\.js|version\.json|locales\/(?:zh-CN|en-US)\.json)$/.test(file)) return route.abort()
    await route.fulfill({ status: 200, contentType: file.endsWith('.js') ? 'text/javascript' : 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' }, body: readFileSync(resolve(__dirname, '..', file)) })
  })
  await page.addScriptTag({ url: base + 'bundle.js', type: 'module' })
}
