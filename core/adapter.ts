/**
 * PlatformAdapter：核心逻辑与运行环境（Web 测试页 / SillyTavern）之间的桥接接口。
 * - Web 端实现：localStorage 存配置，上传图片转 data URI
 * - ST 端实现：extension_settings 存配置，saveBase64AsFile 存图片，setExtensionPrompt 注入
 */

import type { PluginSettings } from './types'

export interface PlatformAdapter {
  /** 读取持久化设置（无则返回默认值） */
  loadSettings(): Promise<PluginSettings>
  /** 持久化设置 */
  saveSettings(settings: PluginSettings): Promise<void>
  /**
   * 保存一张上传图片，返回可用于 img.src 的 URL。
   * Web 端：转 data URI；ST 端：写入用户数据目录并返回静态路由路径。
   */
  saveImage(fileName: string, base64Data: string, characterName: string): Promise<string>
  /** 获取当前对话的角色名 */
  getCurrentCharacterName(): string
  /**
   * 注入/更新 system prompt。传空字符串表示清除注入。
   * ST 端使用 setExtensionPrompt（depth = IN_CHAT 距末尾楼层数，缺省 4）；Web 端更新「注入预览」状态。
   */
  injectPrompt(prompt: string, depth?: number): void
  /**
   * 命名注入通道：每个 channel 一个独立槽位，通道之间、以及与立绘的 injectPrompt 之间互不覆盖。
   * 供内置 App / 后续功能各自注入提示词（如「新变量」的变量状态+更新规则）。
   * ST 端 key = `st-stage::<channel>`（独立 setExtensionPrompt 槽位）；Web 端更新对应通道的预览。
   * 传空字符串清除该通道。
   */
  injectChannel(channel: string, prompt: string, depth?: number): void
  /**
   * 订阅「收到 AI 消息」事件，回调收到消息全文。
   * 返回取消订阅函数。
   */
  onMessageReceived(handler: (messageText: string) => void): () => void
}
