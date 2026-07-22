/**
 * Web 测试环境适配器：
 * - 设置持久化：localStorage（模拟 ST 的 extension_settings，仅测试环境使用）
 * - 图片保存：转 data URI 内嵌
 * - prompt 注入：更新回调（页面显示「注入预览」）
 * - 消息事件：简单事件总线（聊天模拟器发出 AI 回复时触发）
 */

import type { PlatformAdapter } from '@/core/adapter'
import type { PluginSettings } from '@/core/types'
import { createDefaultSettings } from '@/core/types'
import { migrateSettings } from '@/core/migrate'
import { getPresetPacks } from '@/core/presets'

const STORAGE_KEY = 'sprite-overlay-settings-v1'

type MessageHandler = (text: string) => void

export class WebAdapter implements PlatformAdapter {
  private messageHandlers = new Set<MessageHandler>()
  private currentCharacter = '小雪'
  public onInjectionChange: ((prompt: string) => void) | null = null

  async loadSettings(): Promise<PluginSettings> {
    const defaults = createDefaultSettings()
    // 内置预设包始终存在；默认角色开箱绑定银发萝莉预设
    defaults.packs = getPresetPacks()
    defaults.bindings = [{ characterName: '小雪', packIds: ['preset_silver_loli'], enabled: true }]
    if (typeof window === 'undefined') return defaults
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return defaults
      // 任意历史版本 → 当前版本；预设包以代码内清单为准（保证图片路径正确），用户自定义包保留
      const saved = migrateSettings(JSON.parse(raw))
      const customPacks = saved.packs.filter((p) => !p.id.startsWith('preset_'))
      return {
        ...saved,
        bindings: saved.bindings.length > 0 ? saved.bindings : defaults.bindings,
        packs: [...getPresetPacks(), ...customPacks],
      }
    } catch {
      return defaults
    }
  }

  async saveSettings(settings: PluginSettings): Promise<void> {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch (err) {
      // 图片 base64 过大可能超出 localStorage 限额，仅提示不中断
      console.warn('[sprite-overlay] 设置保存失败（可能超出存储限额）', err)
    }
  }

  async saveImage(_fileName: string, base64Data: string): Promise<string> {
    // Web 端直接用 data URI 作为图片地址
    return base64Data
  }

  getCurrentCharacterName(): string {
    return this.currentCharacter
  }

  setCurrentCharacterName(name: string): void {
    this.currentCharacter = name
  }

  injectPrompt(prompt: string): void {
    this.onInjectionChange?.(prompt)
  }

  onMessageReceived(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  /** 聊天模拟器调用：模拟收到一条 AI 消息 */
  emitMessage(text: string): void {
    for (const handler of this.messageHandlers) handler(text)
  }
}

export const webAdapter = new WebAdapter()
