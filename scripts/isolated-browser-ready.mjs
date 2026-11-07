import { expect } from '@playwright/test'

// Only for explicitly disposable ST acceptance data. Finish a fresh account's onboarding.
export async function isolatedReady(page) {
  await expect.poll(async () => {
    const welcome = page.locator('dialog[open]').filter({ has: page.locator('.onboarding') })
    if (await welcome.isVisible()) await welcome.locator('.popup-button-ok').click()
    return page.evaluate(async () => (await import('/script.js')).settingsReady)
  }, { timeout: 30000 }).toBe(true)
  await page.locator('.so-phone-fab').waitFor({ state: 'attached' })
}
