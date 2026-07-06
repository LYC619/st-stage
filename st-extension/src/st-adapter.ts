/**
 * SillyTavern 平台适配器。
 * 依赖 ST 全局运行时（SillyTavern.getContext()），仅在 ST 内运行。
 *
 * 关键 API：
 * - context.extensionSettings[MODULE] + saveSettingsDebounced()：设置持久化
 * - context.setExtensionPrompt(MODULE, prompt, position, depth)：prompt 注入（官方 API，
 *   优于 fetch 拦截，抗 ST 版本升级）
 * - context.eventSource.on(event_types.MESSAGE_RECEIVED)：消息事件（优于 DOM 监听）
 * - saveBase64AsFile：把上传图片写入用户数据目录，返回可访问 URL
 */

import type { PlatformAdapter } from '../../core/adapter'
import type { PluginSettings } from '../../core/types'
import { createDefaultSettings } from '../../core/types'
import { getPresetPacks, isPresetPack } from '../../core/presets'

export const MODULE_NAME = 'sprite_overlay'

/** 仓库名即扩展安装目录名（通过 GitHub 链接安装时） */
const DEFAULT_EXTENSION_FOLDER = 'st-stage'

/**
 * 探测扩展的静态资源根路径。
 * ST 把第三方扩展 clone 到 /scripts/extensions/third-party/<仓库名>/ 并静态托管。
 * 通过错误堆栈中的脚本 URL 动态解析目录名，用户改文件夹名也不会失效；
 * 解析失败时回退到默认仓库名。
 */
export function getExtensionBaseUrl(): string {
  try {
    const stack = new Error().stack ?? ''
    const match = stack.match(/\/scripts\/extensions\/third-party\/([^/]+)\//)
    if (match) {
      return `/scripts/extensions/third-party/${match[1]}`
    }
  } catch {
    // 忽略，走回退
  }
  return `/scripts/extensions/third-party/${DEFAULT_EXTENSION_FOLDER}`
}

/** ST 全局 context 的最小类型描述 */
interface STContext {
  extensionSettings: Record<string, unknown>
  saveSettingsDebounced: () => void
  setExtensionPrompt: (key: string, prompt: string, position: number, depth: number) => void
  eventSource: {
    on: (event: string, handler: (...args: unknown[]) => void) => void
    removeListener: (event: string, handler: (...args: unknown[]) => void) => void
  }
  eventTypes: Record<string, string>
  characters: Array<{ name: string }>
  /** 注意：真实 ST 中可能是字符串（如 "5"），也可能未定义 */
  characterId: number | string | undefined
  /** 当前对话的角色显示名（比 characterId 更可靠的回退） */
  name2?: string
  chat: Array<{ mes: string; is_user: boolean }>
}

declare global {
  interface Window {
    SillyTavern?: { getContext: () => STContext }
  }
}

function getContext(): STContext {
  const st = window.SillyTavern
  if (!st) throw new Error('[sprite-overlay] SillyTavern 全局对象不存在，扩展只能在 ST 内运行')
  return st.getContext()
}

export class STAdapter implements PlatformAdapter {
  async loadSettings(): Promise<PluginSettings> {
    const ctx = getContext()
    const saved = ctx.extensionSettings[MODULE_NAME] as PluginSettings | undefined
    // 内置预设包随扩展仓库分发（public/presets/），每次加载都以当前安装路径刷新 URL
    const presets = getPresetPacks(`${getExtensionBaseUrl()}/public`)
    if (saved && typeof saved === 'object') {
      const merged = { ...createDefaultSettings(), ...saved }
      const customPacks = (merged.packs ?? []).filter((p) => !isPresetPack(p.id))
      merged.packs = [...presets, ...customPacks]
      return merged
    }
    const defaults = createDefaultSettings()
    defaults.packs = presets
    ctx.extensionSettings[MODULE_NAME] = defaults
    ctx.saveSettingsDebounced()
    return defaults
  }

  async saveSettings(settings: PluginSettings): Promise<void> {
    const ctx = getContext()
    // 预设包随扩展分发、加载时动态合并，持久化时剔除以免存储冗余/过期 URL
    ctx.extensionSettings[MODULE_NAME] = {
      ...settings,
      packs: settings.packs.filter((p) => !isPresetPack(p.id)),
    }
    ctx.saveSettingsDebounced()
  }

  async saveImage(fileName: string, base64Data: string, characterName: string): Promise<string> {
    // ST 提供的文件保存工具（写入用户数据目录，返回静态可访问路径）
    // saveBase64AsFile(base64WithoutPrefix, subFolder, fileName, extension)
    const ctx = getContext() as STContext & {
      saveBase64AsFile?: (data: string, folder: string, name: string, ext: string) => Promise<string>
    }
    const match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/s)
    if (!match) throw new Error('图片数据格式不正确')
    const [, ext, data] = match
    const baseName = fileName.replace(/\.[^.]+$/, '')
    if (typeof ctx.saveBase64AsFile === 'function') {
      return await ctx.saveBase64AsFile(data, `sprite-overlay/${characterName}`, baseName, ext)
    }
    // 回退：直接内嵌 data URI（占空间但保证可用）
    return base64Data
  }

  getCurrentCharacterName(): string {
    const ctx = getContext()
    // characterId 在真实 ST 中可能是字符串（"5"）；空串/undefined 都视为未选择
    const id = ctx.characterId
    if (id !== undefined && id !== null && `${id}` !== '') {
      const byId = ctx.characters[Number(id)]?.name
      if (byId) return byId
    }
    // 回退：name2 是 ST 维护的当前角色显示名
    return ctx.name2 ?? ''
  }

  injectPrompt(prompt: string): void {
    const ctx = getContext()
    // position 1 = IN_PROMPT（拼接到 prompt 中），depth 4 = 距末尾 4 层，贴近对话又不干扰最新消息
    ctx.setExtensionPrompt(MODULE_NAME, prompt, 1, 4)
  }

  onMessageReceived(handler: (messageText: string) => void): () => void {
    const ctx = getContext()
    const eventName =
      ctx.eventTypes?.MESSAGE_RECEIVED ??
      (ctx as unknown as { event_types?: Record<string, string> }).event_types?.MESSAGE_RECEIVED ??
      'message_received'

    const wrapped = (...args: unknown[]) => {
      try {
        const messageId = args[0]
        const chat = getContext().chat
        const message =
          typeof messageId === 'number' ? chat[messageId] : chat[chat.length - 1]
        if (message && !message.is_user && typeof message.mes === 'string') {
          handler(message.mes)
        }
      } catch (err) {
        console.error('[sprite-overlay] 处理消息事件失败', err)
      }
    }
    ctx.eventSource.on(eventName, wrapped)
    return () => ctx.eventSource.removeListener(eventName, wrapped)
  }

  /** 订阅角色切换事件 */
  onCharacterChanged(handler: () => void): () => void {
    const ctx = getContext()
    const eventName = ctx.eventTypes?.CHAT_CHANGED ?? 'chat_id_changed'
    ctx.eventSource.on(eventName, handler)
    return () => ctx.eventSource.removeListener(eventName, handler)
  }
}
