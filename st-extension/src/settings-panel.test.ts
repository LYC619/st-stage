// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultSettings } from '../../core/types'
import { mountSettingsPanel } from './settings-panel'

beforeEach(() => {
  document.body.innerHTML = '<div id="extensions_settings"></div>'
})

describe('mountSettingsPanel', () => {
  it('returns an idempotent cleanup that removes its settings entry', () => {
    const cleanup = mountSettingsPanel({
      getSettings: createDefaultSettings,
      updateSettings: () => {},
    })

    expect(document.querySelector('.sprite-overlay-settings')).not.toBeNull()
    cleanup()
    cleanup()
    expect(document.querySelector('.sprite-overlay-settings')).toBeNull()
  })
})
