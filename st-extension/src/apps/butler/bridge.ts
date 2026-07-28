/**
 * 「管家」App 的 ST 交互层：与 SillyTavern 的全部耦合收敛在此，UI 层不碰 ST 细节。
 * 生效方式（基于 ST 1.18.0 源码核实）：
 * - 流式/声音类字段改完 saveSettingsDebounced 即生效
 * - 视觉类（fast_ui_mode/noShadows）需 applyPowerUserSettings()——不在 context 上，
 *   运行时动态 import('/scripts/power-user.js') 获取（同 URL 同模块实例）
 * - reduced_motion 不在 apply 范围：复刻 jQuery.fx.off，完全生效需刷新页面
 * - chat_truncation 改后调 reloadCurrentChat() 即生效，无需刷新页面
 * 新版本字段缺失时一律 ?? 默认值兜底，只依赖有 export 的官方 API。
 */

/** 管家所需的 ST context 最小切面（字段可能随版本缺失，全部可选） */
interface ButlerSTContext {
  powerUserSettings?: Record<string, unknown>
  saveSettingsDebounced?: () => void
  reloadCurrentChat?: () => unknown
  isMobile?: () => boolean
  extensionSettings?: Record<string, unknown>
}

function getST(): ButlerSTContext | undefined {
  try {
    return window.SillyTavern?.getContext() as unknown as ButlerSTContext | undefined
  } catch {
    return undefined
  }
}

/** 管家会读写的全部 power_user 性能字段（同时是快照的形状） */
export interface PerfSnapshot {
  fast_ui_mode: boolean
  reduced_motion: boolean
  noShadows: boolean
  smooth_streaming: boolean
  stream_fade_in: boolean
  streaming_fps: number
  chat_truncation: number
}

function readBool(pu: Record<string, unknown>, key: string, dflt: boolean): boolean {
  const v = pu[key]
  return typeof v === 'boolean' ? v : dflt
}

function readNum(pu: Record<string, unknown>, key: string, dflt: number): number {
  const v = pu[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : dflt
}

/** 读当前性能字段整组值；无 ST 运行时（Web 模拟器）返回 null */
export function readPerf(): PerfSnapshot | null {
  const pu = getST()?.powerUserSettings
  if (!pu) return null
  return {
    fast_ui_mode: readBool(pu, 'fast_ui_mode', true),
    reduced_motion: readBool(pu, 'reduced_motion', false),
    noShadows: readBool(pu, 'noShadows', false),
    smooth_streaming: readBool(pu, 'smooth_streaming', false),
    stream_fade_in: readBool(pu, 'stream_fade_in', false),
    streaming_fps: readNum(pu, 'streaming_fps', 30),
    chat_truncation: readNum(pu, 'chat_truncation', 100),
  }
}

export function isMobile(): boolean {
  const st = getST()
  return typeof st?.isMobile === 'function' && st.isMobile()
}

/** 视觉类字段生效：applyPowerUserSettings 只能从 power-user.js 模块拿（同 URL 同实例） */
async function applyVisuals(): Promise<void> {
  try {
    // 用变量作说明符：esbuild 不解析、保留为浏览器原生动态 import
    const modUrl = '/scripts/power-user.js'
    const mod = (await import(modUrl)) as { applyPowerUserSettings?: () => void }
    mod.applyPowerUserSettings?.()
  } catch (err) {
    console.warn('[st-stage] 管家：applyPowerUserSettings 不可用，视觉项将在刷新页面后生效', err)
  }
}

/** reduced_motion 不在 applyPowerUserSettings 覆盖范围内，复刻其核心动作 */
function applyReducedMotion(on: boolean): void {
  const jq = (window as unknown as { jQuery?: { fx?: { off?: boolean } } }).jQuery
  if (jq?.fx) jq.fx.off = on
}

async function reloadChatSafe(st: ButlerSTContext): Promise<void> {
  try {
    await Promise.resolve(st.reloadCurrentChat?.())
  } catch (err) {
    console.warn('[st-stage] 管家：重载当前对话失败，消息加载数将在切换对话后生效', err)
  }
}

/**
 * 写一组性能字段并按字段类别走各自的生效路径：
 * reduced_motion → jQuery.fx；fast_ui_mode/noShadows → applyPowerUserSettings；
 * 全部 → saveSettingsDebounced；chat_truncation 有实际变化 → reloadCurrentChat。
 * 无 ST 运行时静默跳过（调用方界面上本就不该出现写入口）。
 */
export async function writePerf(fields: Partial<PerfSnapshot>): Promise<void> {
  const st = getST()
  const pu = st?.powerUserSettings
  if (!st || !pu) return
  const prevTrunc = readNum(pu, 'chat_truncation', 100)
  Object.assign(pu, fields)
  if (fields.reduced_motion !== undefined) applyReducedMotion(fields.reduced_motion)
  if (fields.fast_ui_mode !== undefined || fields.noShadows !== undefined) await applyVisuals()
  st.saveSettingsDebounced?.()
  if (fields.chat_truncation !== undefined && fields.chat_truncation !== prevTrunc) {
    await reloadChatSafe(st)
  }
}

/** 体检读数（无 ST 时 quickReplySets 为 null、禁用数为 0） */
export interface PerfHealth {
  disabledExtensions: number
  /** Quick Reply 集合数；QR 扩展数据缺失时为 null（不展示该行） */
  quickReplySets: number | null
}

export function readHealth(): PerfHealth {
  const ext = getST()?.extensionSettings ?? {}
  const disabled = ext['disabledExtensions']
  const qr = ext['quickReply'] as { config?: { setList?: unknown[] } } | undefined
  return {
    disabledExtensions: Array.isArray(disabled) ? disabled.length : 0,
    quickReplySets: Array.isArray(qr?.config?.setList) ? qr.config.setList.length : null,
  }
}
