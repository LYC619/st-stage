/**
 * 「管家」App — SillyTavern 性能管家（B 档：视觉开关 + 消息加载数）：
 * - 一键性能模式：改动前先把原值快照存 appData（还原红线），一键还原
 * - 手动微调：逐项调整 power_user 性能相关字段，首次改动同样先补快照
 * - 体检：已禁用扩展数 / Quick Reply 集合计数 / 输入卡顿排查思路
 * - 优化指南：浏览器与服务端 config.yaml 里只能提示、前端改不了的项
 *
 * 生效方式（基于 ST 1.18.0 源码核实）：
 * - 流式/声音类字段改完 saveSettingsDebounced 即生效
 * - 视觉类（fast_ui_mode/noShadows）需 applyPowerUserSettings()——不在 context 上，
 *   运行时动态 import('/scripts/power-user.js') 获取（同 URL 同模块实例）
 * - reduced_motion 不在 apply 范围：复刻 jQuery.fx.off，完全生效需刷新页面
 * - chat_truncation 改后调 reloadCurrentChat() 即生效，无需刷新页面
 * 新版本字段缺失时一律 ?? 默认值兜底，只依赖有 export 的官方 API。
 */

import type { PhoneApp, PhoneAppContext } from '../../../core/phone-registry'
import { el, appButton, toggleRow, numberRow, foldSection, hintField } from './widgets'

/** 改动前原值快照：只含管家会写的字段（还原 = 整组写回 + 重跑 apply + save） */
interface PerfSnapshot {
  fast_ui_mode: boolean
  reduced_motion: boolean
  noShadows: boolean
  smooth_streaming: boolean
  stream_fade_in: boolean
  streaming_fps: number
  chat_truncation: number
}

interface ButlerData {
  /** 首次改动前的原值快照；还原成功后清除，下次改动重新快照 */
  snapshot?: PerfSnapshot
  /** 一键性能模式开启标记（仅 UI 展示） */
  perfOn?: boolean
}

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

function readBool(pu: Record<string, unknown>, key: string, dflt: boolean): boolean {
  const v = pu[key]
  return typeof v === 'boolean' ? v : dflt
}

function readNum(pu: Record<string, unknown>, key: string, dflt: number): number {
  const v = pu[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : dflt
}

function takeSnapshot(pu: Record<string, unknown>): PerfSnapshot {
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

/** 有快照就复用（重复点开启不能用性能值覆盖原值快照），没有才新拍 */
function ensureSnapshot(ctx: PhoneAppContext, pu: Record<string, unknown>): ButlerData {
  const data = ctx.getAppData<ButlerData>() ?? {}
  if (data.snapshot) return data
  const next = { ...data, snapshot: takeSnapshot(pu) }
  ctx.setAppData<ButlerData>(next)
  return next
}

async function enablePerfMode(ctx: PhoneAppContext, st: ButlerSTContext): Promise<void> {
  const pu = st.powerUserSettings
  if (!pu) return
  const data = ensureSnapshot(ctx, pu)
  ctx.setAppData<ButlerData>({ ...data, perfOn: true })

  const mobile = typeof st.isMobile === 'function' && st.isMobile()
  const curTrunc = readNum(pu, 'chat_truncation', 100)
  const target = mobile ? 20 : 50
  // 用户已设得比预设更省（且非 0=全部）就不往回抬
  const nextTrunc = curTrunc > 0 && curTrunc < target ? curTrunc : target

  pu.fast_ui_mode = true
  pu.reduced_motion = true
  pu.noShadows = true
  pu.smooth_streaming = false
  pu.stream_fade_in = false
  pu.streaming_fps = 15
  pu.chat_truncation = nextTrunc

  applyReducedMotion(true)
  await applyVisuals()
  st.saveSettingsDebounced?.()
  if (nextTrunc !== curTrunc) await reloadChatSafe(st)
}

async function restoreSnapshot(ctx: PhoneAppContext, st: ButlerSTContext): Promise<void> {
  const pu = st.powerUserSettings
  const snap = (ctx.getAppData<ButlerData>() ?? {}).snapshot
  if (!pu || !snap) return

  const curTrunc = readNum(pu, 'chat_truncation', 100)
  Object.assign(pu, snap)
  applyReducedMotion(snap.reduced_motion)
  await applyVisuals()
  st.saveSettingsDebounced?.()
  if (snap.chat_truncation !== curTrunc) await reloadChatSafe(st)
  ctx.setAppData<ButlerData>({ perfOn: false })
}

/** 手动微调单字段：先补快照，再按字段类别走各自的生效路径 */
async function writeField(
  ctx: PhoneAppContext,
  st: ButlerSTContext,
  key: keyof PerfSnapshot,
  value: boolean | number,
): Promise<void> {
  const pu = st.powerUserSettings
  if (!pu) return
  ensureSnapshot(ctx, pu)
  const prev = pu[key]
  pu[key] = value
  if (key === 'fast_ui_mode' || key === 'noShadows') await applyVisuals()
  if (key === 'reduced_motion') applyReducedMotion(Boolean(value))
  st.saveSettingsDebounced?.()
  if (key === 'chat_truncation' && prev !== value) await reloadChatSafe(st)
}

function descLine(parent: HTMLElement, text: string): void {
  const d = el('div', 'so-app-desc')
  d.textContent = text
  parent.append(d)
}

/** 优化指南：只能提示、管家代改不了的项（浏览器/服务端 config.yaml）。无 ST 环境也可看 */
function buildGuide(): HTMLElement {
  const { box, body } = foldSection('优化指南（需手动操作）')
  descLine(body, '【浏览器】硬件加速是两面刃：本机同时跑本地模型（SD/本地 LLM）建议关，不跑建议开。')
  descLine(body, '【浏览器】Android 浏览器不要手动开 GPU rasterization 类实验项（反而有害）。')
  descLine(
    body,
    '【浏览器】桌面 Chrome 可试 chrome://flags 的 GPU rasterization / ANGLE D3D11（实验项名称随版本变化，搜不到说明已移除或改名）。',
  )
  descLine(body, '【浏览器】已知拖慢 ST 的浏览器扩展：iCloud 密码、DeepL、AI 语法纠正类、部分广告拦截器。')
  descLine(body, '【服务端 config.yaml，前端改不了】requestCompression 开启后长聊天弱网明显省流量。')
  descLine(body, '【服务端】lazyLoadCharacters：1.18 默认已开；老用户沿用的旧 config 可能还是 false，卡多必开。')
  descLine(body, '【服务端】memoryCacheCapacity：约每 3000 张角色卡 +100MB。')
  descLine(body, '【服务端】useDiskCache：仅磁盘极慢（如老 SD 卡）场景才考虑关。')
  return box
}

export function butlerApp(): PhoneApp {
  return {
    id: 'butler',
    name: '管家',
    icon: '🧹',
    order: 3,
    mount(container, ctx) {
      render(container, ctx)
    },
  }
}

function render(container: HTMLElement, ctx: PhoneAppContext): void {
  container.textContent = ''
  const st = getST()
  const pu = st?.powerUserSettings

  if (!st || !pu) {
    const section = el('div', 'so-app-section')
    descLine(section, '未检测到 SillyTavern 运行时（Web 模拟器中仅可查看优化指南）。')
    container.append(section, buildGuide())
    return
  }

  const data = ctx.getAppData<ButlerData>() ?? {}
  // container 在本次 mount 生命周期内有效，操作完成后整页重建刷新状态
  const rerender = () => render(container, ctx)
  const mobile = typeof st.isMobile === 'function' && st.isMobile()

  // —— 一键性能模式 ——
  const main = el('div', 'so-app-section')
  const title = el('div', 'so-app-title')
  title.textContent = data.perfOn ? '一键性能模式（已开启）' : '一键性能模式'
  main.append(
    hintField(
      title,
      '第一次开启前会把你当前的这些设置整组拍成快照存起来；“还原”就是把快照原样写回。所以放心开——不满意随时一键还原到开启前的样子，不会丢你原来的偏好。',
    ),
  )
  descLine(
    main,
    `关闭背景模糊/阴影/动画/平滑流式，流式帧率降到 15，消息加载数降到 ${mobile ? '20（移动端）' : '50'}。改动前自动保存原设置快照。`,
  )
  main.append(
    appButton('开启性能模式', () => {
      void enablePerfMode(ctx, st).then(rerender)
    }),
  )
  if (data.snapshot) {
    main.append(
      appButton('还原到改动前快照', () => {
        void restoreSnapshot(ctx, st).then(rerender)
      }),
    )
    descLine(main, '已保存改动前快照，可随时一键还原。')
  }
  container.append(main)

  // —— 手动微调（每行挂 ⓘ：桌面悬浮、移动端点开）——
  const tweak = foldSection('手动微调')
  tweak.body.append(
    hintField(
      toggleRow('No Blur（关背景模糊）', readBool(pu, 'fast_ui_mode', true), (v) => {
        void writeField(ctx, st, 'fast_ui_mode', v)
      }),
      '关闭聊天框、弹窗背后的毛玻璃模糊。模糊很吃 GPU，几乎所有卡顿场景都建议开启（=关模糊）。官方公认最有效的提速项之一。',
    ),
    hintField(
      toggleRow('减少动画', readBool(pu, 'reduced_motion', false), (v) => {
        void writeField(ctx, st, 'reduced_motion', v)
      }),
      '关闭界面过渡动画（展开/淡入等）。低端机、长聊天滚动卡顿时开。改此项需刷新页面才完全生效。',
    ),
    hintField(
      toggleRow('关闭阴影', readBool(pu, 'noShadows', false), (v) => {
        void writeField(ctx, st, 'noShadows', v)
      }),
      '去掉界面元素投影，减少重绘。视觉略扁平，但换来更顺滑的滚动。追求性能可开。',
    ),
    hintField(
      toggleRow('平滑流式', readBool(pu, 'smooth_streaming', false), (v) => {
        void writeField(ctx, st, 'smooth_streaming', v)
      }),
      'AI 回复逐字平滑吐字的动画。好看但持续占用渲染；出字卡顿、掉帧时建议关闭。',
    ),
    hintField(
      toggleRow('流式淡入', readBool(pu, 'stream_fade_in', false), (v) => {
        void writeField(ctx, st, 'stream_fade_in', v)
      }),
      '新出的文字带淡入效果。同样是额外渲染开销，卡顿时关。',
    ),
    hintField(
      numberRow('流式帧率 FPS', readNum(pu, 'streaming_fps', 30), 5, 100, (v) => {
        void writeField(ctx, st, 'streaming_fps', v)
      }),
      'AI 回复刷新的帧率。越高越顺滑但越吃性能。默认约 30；低端机/手机官方建议降到 10–15，肉眼几乎无差却明显省电省算力。',
    ),
    hintField(
      numberRow('消息加载数', readNum(pu, 'chat_truncation', 100), 0, 100000, (v) => {
        void writeField(ctx, st, 'chat_truncation', v)
      }),
      '打开对话时载入 DOM 的最近消息条数（0=全部）。长聊天最主要的卡顿来源。手机建议 15–20、桌面 50 左右；往上翻能继续加载更早的消息，不会丢。改后自动重载当前对话。',
    ),
  )
  container.append(tweak.box)

  // —— 体检 ——
  const check = foldSection('体检')
  const extSettings = st.extensionSettings ?? {}
  const disabled = extSettings['disabledExtensions']
  descLine(check.body, `已禁用扩展：${Array.isArray(disabled) ? disabled.length : 0} 个。`)
  const qr = extSettings['quickReply'] as { config?: { setList?: unknown[] } } | undefined
  if (Array.isArray(qr?.config?.setList)) {
    descLine(check.body, `Quick Reply 集合：${qr.config.setList.length} 个（社区反馈集合过多可能造成输入拖拽卡顿，卡则精简）。`)
  }
  descLine(check.body, '输入卡顿最常见元凶是第三方扩展：逐个禁用排查（扩展启停改动需刷新页面才真正生效）。')
  container.append(check.box)

  // —— 指南 ——
  container.append(buildGuide())
}
