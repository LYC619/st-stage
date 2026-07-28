/**
 * Web 模拟器的 App 事件源（ctx 能力层降级实现，阶段五·5a）：
 * page.tsx 在模拟 AI 回复 / 切换角色时 emit，PhoneMount 把 subscribe 接进 host/ctx。
 * 模块级单例：模拟器单页面单实例，零接线成本；真 ST 端走 st-extension/src/index.ts 的 hub。
 */
import { createEventHub } from '@/core/capabilities'

export const webAppEvents = {
  /** 模拟 AI 回复全文 */
  message: createEventHub<string>(),
  /** 角色名变化 */
  character: createEventHub<null>(),
}
