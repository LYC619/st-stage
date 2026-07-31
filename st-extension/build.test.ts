// @vitest-environment node

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('extension loader stylesheet lifecycle', () => {
  it('removes the previous marked stylesheet before appending the next marked link', () => {
    const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
    const removeAt = source.indexOf("querySelectorAll('link[data-st-stage-style]')")
    const markAt = source.indexOf("setAttribute('data-st-stage-style', '')")
    const appendAt = source.indexOf('document.head.appendChild(link)')

    expect(removeAt).toBeGreaterThanOrEqual(0)
    expect(markAt).toBeGreaterThan(removeAt)
    expect(appendAt).toBeGreaterThan(markAt)
  })
})
