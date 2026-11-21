/**
 * 变量速查悬浮窗生命周期编排（解耦自 index.ts）。
 */

import { t } from '../../core/i18n'
import type { PluginSettings } from '../../core/types'
import { createVariableHud, type HudSectionSnapshot } from './variable-hud'
import { getLastMessageId, readVariables, subscribeVarEvents } from './apps/mvu/bridge'
import type { NewvarRuntime } from './apps/newvar/runtime'

const VARHUD_STATE_KEY = 'varhud'

export interface HudControllerDeps {
  getSettings: () => PluginSettings
  saveSettingsOnly: (next: PluginSettings) => void
  newvarRuntime: NewvarRuntime
  readExtraSections?: () => Promise<HudSectionSnapshot[]> | HudSectionSnapshot[]
  subscribeExtra?: (handler: () => void) => () => void
}

export function createHudController(deps: HudControllerDeps) {
  let variableHud: ReturnType<typeof createVariableHud> | null = null

  function sync(): void {
    const settings = deps.getSettings()
    if (settings.variableHud && !variableHud) {
      variableHud = createVariableHud({
        readSections: async () => {
          const sections: HudSectionSnapshot[] = []
          const messageId = getLastMessageId()
          const read = await readVariables({ type: 'message', message_id: 'latest' }, messageId)
          sections.push({
            source: 'MVU',
            root: read.status === 'ready' || read.status === 'empty' ? read.data : null,
            notice: read.status === 'unavailable' ? t('variableHud.mvu_unavailable', '未检测到 MVU / 酒馆助手') : read.error ?? '',
          })
          const newvarState = deps.newvarRuntime.getCurrentState()
          sections.push({
            source: t('apps.newvar.name', '新变量'),
            root: newvarState,
            notice: '',
          })
          if (deps.readExtraSections) {
            const extra = await deps.readExtraSections()
            sections.push(...extra)
          }
          return sections
        },
        subscribe: (handler) => {
          const offVar = subscribeVarEvents(handler)
          const offNewvar = deps.newvarRuntime.subscribe(handler)
          const offExtra = deps.subscribeExtra?.(handler)
          return () => {
            offVar()
            offNewvar()
            offExtra?.()
          }
        },
        readState: () => {
          const stored = deps.getSettings().apps[VARHUD_STATE_KEY]
          const s = stored && typeof stored === 'object' ? stored as Record<string, unknown> : {}
          return {
            x: typeof s.x === 'number' ? s.x : 12,
            y: typeof s.y === 'number' ? s.y : 120,
            open: typeof s.open === 'boolean' ? s.open : false,
          }
        },
        writeState: (state) => {
          const current = deps.getSettings()
          deps.saveSettingsOnly({
            ...current,
            apps: { ...current.apps, [VARHUD_STATE_KEY]: state },
          })
        },
      })
    } else if (!settings.variableHud && variableHud) {
      variableHud.dispose()
      variableHud = null
    }
  }

  return {
    sync,
    dispose() {
      variableHud?.dispose()
      variableHud = null
    },
  }
}
