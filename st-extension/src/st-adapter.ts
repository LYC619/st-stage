/**
 * SillyTavern 平台适配器。
 * 依赖 ST 全局运行时（SillyTavern.getContext()），仅在 ST 内运行。
 *
 * 关键 API：
 * - context.extensionSettings[MODULE] + saveSettingsDebounced()：设置持久化
 * - context.setExtensionPrompt(MODULE, prompt, position, depth)：prompt 注入（官方 API，
 *   优于 fetch 拦截，抗 ST 版本升级）
 * - context.eventSource.on(event_types.MESSAGE_RECEIVED)：消息事件（优于 DOM 监听）
 * - /api/images/upload：把上传图片写入用户数据目录，并读回校验后返回可访问 URL
 */

import type { PlatformAdapter } from '../../core/adapter'
import type { PluginSettings } from '../../core/types'
import { createDefaultSettings, INJECTION_DEPTH_DEFAULT } from '../../core/types'
import { migrateSettings } from '../../core/migrate'
import { isPresetPack, mergePresetPacks } from '../../core/presets'
import { isSafeLocalUserImagePath } from '../../core/sprite-store'
import { blobToDataUri } from '../../core/image-compress'
import { persistSTImage, type ImageSaveOptions } from './image-persistence'
import { storyArchiveKey, type StoryContext } from '../../core/story-archive'
import { getLocale, isI18nDict, loadTranslations, resetI18n, setLocale, t, type Locale, type I18nDict } from '../../core/i18n'

export const MODULE_NAME = 'sprite_overlay'

/**
 * 加载 i18n 翻译文件（从扩展根目录 /locales/）
 *
 * @returns 加载并解析的翻译字典，失败时返回空对象
 */
async function loadLocaleFile(locale: Locale, bundleUrl: string): Promise<I18nDict> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    // 同一个时限覆盖请求和响应体；即使宿主 fetch 忽略 abort，也会结束等待。
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error('Locale loading timed out'))
      }, 3000)
    })
    const request = async (): Promise<I18nDict> => {
      const url = new URL(`./locales/${locale}.json`, bundleUrl).href
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const dict: unknown = await response.json()
      if (!isI18nDict(dict)) throw new TypeError('Invalid translation dictionary')
      return dict
    }
    return await Promise.race([request(), deadline])
  } catch (err) {
    console.warn(`[sprite-overlay] 加载 locale ${locale} 异常`, err)
    return {}
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 初始化 i18n 系统
 *
 * 遵循 ST 的 language 本地偏好，再回退到浏览器语言；宿主切换语言后会重载页面。
 * 加载失败或超时后继续启动，降级到中文词典或调用处的 fallback 文本。
 */
export async function initI18n(bundleUrl = import.meta.url): Promise<void> {
  resetI18n()
  const [zhDict, enDict] = await Promise.all([
    loadLocaleFile('zh-CN', bundleUrl),
    loadLocaleFile('en-US', bundleUrl),
  ])

  loadTranslations('zh-CN', zhDict)
  loadTranslations('en-US', enDict)

  let savedLanguage: string | null = null
  try {
    savedLanguage = localStorage.getItem('language')
  } catch {
    // 浏览器限制存储访问时仍可使用浏览器语言，不写入宿主偏好。
  }
  const browser = typeof navigator === 'undefined' ? undefined : navigator as Navigator & { userLanguage?: string }
  const language = String(savedLanguage || browser?.language || browser?.userLanguage || 'en').toLowerCase()
  const locale: Locale = language.startsWith('en') ? 'en-US' : 'zh-CN'

  try {
    setLocale(locale)
  } catch {
    // 空字典会抛错，降级到 zh-CN
    if (locale !== 'zh-CN') {
      try {
        setLocale('zh-CN')
      } catch {
        // 两个都是空字典，不再重试
      }
    }
  }

  console.log(`[sprite-overlay] i18n 已初始化: ${getLocale()}`)
}

/** ST 设置只保存用户自定义包;代码内预设通过覆盖层重新合成。 */
export function persistableSTSettings(settings: PluginSettings): PluginSettings {
  return {
    ...settings,
    packs: settings.packs.filter((pack) => !isPresetPack(pack.id)),
  }
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
  /** 只读返回指定消息的原始文本，供可见 DOM 的保守后处理建立边界证据。 */
  getRawMessage(messageId: string | number): string | null {
    const index = typeof messageId === 'number'
      ? messageId
      : /^(?:0|[1-9]\d*)$/.test(messageId)
        ? Number(messageId)
        : NaN
    if (!Number.isInteger(index) || index < 0) return null
    const message = getContext().chat[index]
    return typeof message?.mes === 'string' ? message.mes : null
  }

  async loadSettings(): Promise<PluginSettings> {
    const ctx = getContext()
    const saved = ctx.extensionSettings[MODULE_NAME]
    // 内置预设是代码内的远程清单；加载时替换旧清单，用户可在图库中按需保存到本地
    if (saved && typeof saved === 'object') {
      // 任意历史版本 → 当前版本（v1 无 settingsVersion 字段，migrate 会补齐新字段并反推图床编码）
      const merged = migrateSettings(saved)
      const customPacks = merged.packs.filter((p) => !isPresetPack(p.id))
      merged.packs = [...mergePresetPacks(merged.presetOverrides), ...customPacks]
      return merged
    }
    const defaults = createDefaultSettings()
    defaults.packs = mergePresetPacks(defaults.presetOverrides)
    ctx.extensionSettings[MODULE_NAME] = defaults
    ctx.saveSettingsDebounced()
    return defaults
  }

  async saveSettings(settings: PluginSettings): Promise<void> {
    const ctx = getContext()
    // 预设包随扩展分发、加载时动态合并，持久化时剔除以免存储冗余/过期 URL
    ctx.extensionSettings[MODULE_NAME] = persistableSTSettings(settings)
    ctx.saveSettingsDebounced()
  }

  /** 迁移/备份入口按需读取原始插件值，不在启动时复制大对象。 */
  getStoredSettingsForBackup(): unknown {
    return getContext().extensionSettings[MODULE_NAME]
  }

  saveDataUri(dataUri: string, options: ImageSaveOptions = {}): Promise<string> {
    const ctx = getContext()
    const headers = ctx.getRequestHeaders
    return persistSTImage(dataUri, {
      fetch,
      getRequestHeaders: headers ? () => headers.call(ctx) : undefined,
    }, options)
  }

  async saveImage(_fileName: string, base64Data: string, _characterName: string): Promise<string> {
    return this.saveDataUri(base64Data)
  }

  async saveImageFile(file: File, fileName: string, characterName: string): Promise<string> {
    return this.saveImage(fileName, await blobToDataUri(file), characterName)
  }

  async deleteImage(url: string): Promise<void> {
    const path = url.split(/[?#]/, 1)[0].replace(/\\/g, '/')
    if (!isSafeLocalUserImagePath(path)) {
      throw new Error(t('imageActions.delete_scope', '只能删除 SillyTavern 用户图片目录中的文件'))
    }
    const ctx = getContext()
    const response = await fetch('/api/images/delete', {
      method: 'POST',
      headers: ctx.getRequestHeaders?.() ?? { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path.slice(1) }),
    })
    if (!response.ok && response.status !== 404) {
      throw new Error(t('imageActions.delete_failed', '删除本地图片失败：HTTP {{status}}', { status: response.status }))
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
