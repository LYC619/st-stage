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
import { createDefaultSettings, INJECTION_DEPTH_DEFAULT } from '../../core/types'
import { migrateSettings } from '../../core/migrate'
import { getPresetPacks, isPresetPack } from '../../core/presets'
import { isSafeLocalUserImagePath } from '../../core/sprite-store'
import { sanitizePathSegment } from '../../core/naming'
import { blobToDataUri } from '../../core/image-compress'
import { storyArchiveKey, type StoryContext } from '../../core/story-archive'

export const MODULE_NAME = 'sprite_overlay'

/** 仓库名即扩展安装目录名（通过 GitHub 链接安装时） */
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
  chatId?: string | number
  groupId?: string | number
  chatMetadata?: { name?: string; file_name?: string }
  groups?: Array<{ id?: string | number; name?: string }>
  chat: Array<{ mes: string; is_user: boolean }>
  getRequestHeaders?: () => Record<string, string>
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

/** 查找 SillyTavern 主消息输入框；DOM 选择器只在适配层维护。 */
export function findComposerTextarea(root: ParentNode = document): HTMLTextAreaElement | null {
  const input = root.querySelector('#send_textarea')
  return input instanceof HTMLTextAreaElement ? input : null
}

export class STAdapter implements PlatformAdapter {
  async loadSettings(): Promise<PluginSettings> {
    const ctx = getContext()
    const saved = ctx.extensionSettings[MODULE_NAME]
    // 内置预设是代码内的远程清单；加载时替换旧清单，用户可在图库中按需保存到本地
    const presets = getPresetPacks()
    if (saved && typeof saved === 'object') {
      // 任意历史版本 → 当前版本（v1 无 settingsVersion 字段，migrate 会补齐新字段并反推图床编码）
      const merged = migrateSettings(saved)
      const customPacks = merged.packs.filter((p) => !isPresetPack(p.id))
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
    const baseName = sanitizePathSegment(fileName.replace(/\.[^.]+$/, '')) || `sprite_${Date.now()}`
    const folder = sanitizePathSegment(characterName) || 'shared'
    if (typeof ctx.saveBase64AsFile === 'function') {
      return await ctx.saveBase64AsFile(data, `sprite-overlay/${folder}`, baseName, ext)
    }
    // 回退：直接内嵌 data URI（占空间但保证可用）
    return base64Data
  }

  async saveImageFile(file: File, fileName: string, characterName: string): Promise<string> {
    return this.saveImage(fileName, await blobToDataUri(file), characterName)
  }

  async deleteImage(url: string): Promise<void> {
    const path = url.split(/[?#]/, 1)[0].replace(/\\/g, '/')
    if (!isSafeLocalUserImagePath(path)) {
      throw new Error('只能删除 SillyTavern 用户图片目录中的文件')
    }
    const ctx = getContext()
    const response = await fetch('/api/images/delete', {
      method: 'POST',
      headers: ctx.getRequestHeaders?.() ?? { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path.slice(1) }),
    })
    if (!response.ok && response.status !== 404) {
      throw new Error(`删除本地图片失败：HTTP ${response.status}`)
    }
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

  getStoryContext(): StoryContext {
    const ctx = getContext()
    const groupId = ctx.groupId
    const group = groupId === undefined || groupId === null
      ? undefined
      : ctx.groups?.find((candidate) => `${candidate.id ?? ''}` === `${groupId}`)
    const characterName = group?.name || this.getCurrentCharacterName() || 'Unknown'
    const chatId = ctx.chatId ?? ctx.chatMetadata?.file_name
    const title = ctx.chatMetadata?.name || ctx.chatMetadata?.file_name || `${chatId ?? ''}` || characterName
    return {
      key: storyArchiveKey({
        chatId,
        characterId: ctx.characterId,
        groupId,
        title,
        characterName,
      }),
      title,
      characterName,
    }
  }

  injectPrompt(prompt: string, depth = INJECTION_DEPTH_DEFAULT): void {
    const ctx = getContext()
    // position 1 = IN_CHAT：以 system 角色按 depth 插入对话楼层流（2026-07 实测确认，非 IN_PROMPT）
    // depth 默认 4 = 距末尾 4 层，贴近对话又不干扰最新消息；可在「立绘」App 调整
    ctx.setExtensionPrompt(MODULE_NAME, prompt, 1, depth)
  }

  injectChannel(channel: string, prompt: string, depth = INJECTION_DEPTH_DEFAULT): void {
    const ctx = getContext()
    // setExtensionPrompt 以 key 为槽位：每个通道独立 key，通道间及与立绘（MODULE_NAME）互不覆盖
    ctx.setExtensionPrompt(`st-stage::${channel}`, prompt, 1, depth)
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
        // messageId 可能是数字或数字字符串（"5"）；两者都按索引取，非法才回退最后一条
        const idNum =
          typeof messageId === 'number'
            ? messageId
            : typeof messageId === 'string' && messageId.trim() !== ''
              ? Number(messageId)
              : NaN
        const message =
          Number.isInteger(idNum) && idNum >= 0 && idNum < chat.length
            ? chat[idNum]
            : chat[chat.length - 1]
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

  /** 订阅新聊天创建；CHAT_CHANGED 在部分 ST 版本中会早于新聊天 DOM 稳定。 */
  onChatCreated(handler: () => void): () => void {
    const ctx = getContext()
    const eventName = ctx.eventTypes?.CHAT_CREATED ?? 'chat_created'
    ctx.eventSource.on(eventName, handler)
    return () => ctx.eventSource.removeListener(eventName, handler)
  }

  /** 订阅流式累计文本。ST 每次事件传入从回复开头到当前 token 的完整字符串。 */
  onStreamText(handler: (text: string) => void): () => void {
    const ctx = getContext()
    const eventName = ctx.eventTypes?.STREAM_TOKEN_RECEIVED ?? 'stream_token_received'
    const wrapped = (text: unknown) => {
      if (typeof text === 'string') handler(text)
    }
    ctx.eventSource.on(eventName, wrapped)
    return () => ctx.eventSource.removeListener(eventName, wrapped)
  }

  /** 订阅生成结束，用于清空流式增量状态。 */
  onGenerationEnded(handler: () => void): () => void {
    const ctx = getContext()
    const eventName = ctx.eventTypes?.GENERATION_ENDED ?? 'generation_ended'
    ctx.eventSource.on(eventName, handler)
    return () => ctx.eventSource.removeListener(eventName, handler)
  }
}
