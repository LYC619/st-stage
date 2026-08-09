import { buildPrompt, buildPromptSceneNotes } from './prompt-builder'
import { getActiveAddresses, getActivePacks } from './sprite-store'
import type { PluginSettings } from './types'

/** 当前角色真正用于注入与预览的立绘 Prompt，避免两个入口参数漂移。 */
export function buildActiveSpritePrompt(
  settings: PluginSettings,
  characterName: string,
  budget = settings.promptBudget,
): string {
  const packs = getActivePacks(settings, characterName)
  const addresses = getActiveAddresses(settings, characterName)
  return buildPrompt(
    addresses,
    settings.multiRolePromptMode,
    settings.spriteCount,
    settings.promptTemplate,
    budget,
    buildPromptSceneNotes(packs, addresses),
  )
}
