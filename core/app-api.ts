/**
 * st-stage APP 框架规范（v1）。
 * 手机壳内的每个功能都是一个 PhoneApp；内置 APP 与第三方 APP 使用同一套接口。
 *
 * 第三方开发者：在 SillyTavern 中通过 `window.STStage.registerApp(app)` 注册。
 * 详见仓库 README「APP 开发规范」章节。
 */

import type { PlatformAdapter } from './adapter'
import type { PluginSettings } from './types'

/** APP 生命周期上下文：框架注入给每个 APP 的能力集 */
export interface PhoneAppContext {
  /** 平台适配器（读写设置 / 角色名 / prompt 注入 / 消息事件 / 静态资源路径） */
  adapter: PlatformAdapter
  /** 当前设置的只读快照（写入请用 updateSettings） */
  getSettings(): PluginSettings
  /** 更新设置并持久化；回调形式保证原子性 */
  updateSettings(updater: (prev: PluginSettings) => PluginSettings): Promise<PluginSettings>
  /** 导航到其他 APP（'home' = 返回主屏） */
  navigate(appId: string | 'home'): void
  /** 收起整个手机（折叠为悬浮图标） */
  collapse(): void
  /**
   * 订阅框架事件。返回取消订阅函数。
   * - 'message': 收到 AI 消息（参数：消息全文）
   * - 'chat-changed': 切换聊天/角色
   * - 'settings-changed': 设置被任何 APP 更新
   */
  on(event: 'message' | 'chat-changed' | 'settings-changed', handler: (payload?: string) => void): () => void
}

/** 手机 APP 定义 */
export interface PhoneApp {
  /** 唯一 ID（重复注册会警告并覆盖） */
  id: string
  /** 显示名 */
  name: string
  /** 图标：单个 emoji 或图片 URL */
  icon: string
  /** 主屏排序权重，越小越靠前（内置 APP 为 0-99，第三方建议 ≥100） */
  order?: number
  /**
   * APP 打开时调用：将 UI 渲染进 container。
   * 可返回卸载函数（关闭/切换 APP 时调用，用于清理监听器等）。
   */
  mount(container: HTMLElement, ctx: PhoneAppContext): void | (() => void)
  /**
   * 可选：APP 是否希望以无边框模式全屏展示（如立绘 APP）。
   * 返回 true 时手机壳提供「隐藏边框」开关。
   */
  supportsFrameless?: boolean
}

/** window.STStage 全局对象的形状 */
export interface STStageGlobal {
  /** 框架版本 */
  version: string
  /** 注册一个 APP（ST 加载完成后随时可调） */
  registerApp(app: PhoneApp): void
}
