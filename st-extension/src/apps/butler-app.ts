/**
 * 「管家」App — SillyTavern 性能管家（B 档：视觉开关 + 消息加载数）：
 * - 一键性能模式：改动前先把原值快照存 appData（还原红线），一键还原
 * - 手动微调：逐项调整 power_user 性能相关字段，首次改动同样先补快照
 * - 体检：已禁用扩展数 / Quick Reply 集合计数 / 输入卡顿排查思路
 * - 优化指南：浏览器与服务端 config.yaml 里只能提示、前端改不了的项
 *
 * ST 耦合（power_user 读写与各字段的生效路径）收敛在 ./butler/bridge；
 * 本文件只管 UI 与快照编排，不碰 ST 细节。
 */

import type { PhoneApp, PhoneAppContext } from '../../../core/phone-registry'
import { el, appButton, toggleRow, numberRow, foldSection, hintField } from './widgets'
import { readPerf, writePerf, readHealth, isMobile, type PerfSnapshot } from './butler/bridge'

interface ButlerData {
  /** 首次改动前的原值快照；还原成功后清除，下次改动重新快照 */
  snapshot?: PerfSnapshot
  /** 一键性能模式开启标记（仅 UI 展示） */
  perfOn?: boolean
}

/** 有快照就复用（重复点开启不能用性能值覆盖原值快照），没有才新拍 */
function ensureSnapshot(ctx: PhoneAppContext, perf: PerfSnapshot): ButlerData {
  const data = ctx.getAppData<ButlerData>() ?? {}
  if (data.snapshot) return data
  const next = { ...data, snapshot: perf }
  ctx.setAppData<ButlerData>(next)
  return next
}

async function enablePerfMode(ctx: PhoneAppContext): Promise<void> {
  const perf = readPerf()
  if (!perf) return
  const data = ensureSnapshot(ctx, perf)
  ctx.setAppData<ButlerData>({ ...data, perfOn: true })

  const target = isMobile() ? 20 : 50
  const curTrunc = perf.chat_truncation
  // 用户已设得比预设更省（且非 0=全部）就不往回抬
  const nextTrunc = curTrunc > 0 && curTrunc < target ? curTrunc : target

  await writePerf({
    fast_ui_mode: true,
    reduced_motion: true,
    noShadows: true,
    smooth_streaming: false,
    stream_fade_in: false,
    streaming_fps: 15,
    chat_truncation: nextTrunc,
  })
}

async function restoreSnapshot(ctx: PhoneAppContext): Promise<void> {
  const snap = (ctx.getAppData<ButlerData>() ?? {}).snapshot
  if (!readPerf() || !snap) return
  await writePerf(snap)
  ctx.setAppData<ButlerData>({ perfOn: false })
}

/** 手动微调单字段：先补快照，生效路径由 bridge 按字段类别分发 */
async function writeField(ctx: PhoneAppContext, key: keyof PerfSnapshot, value: boolean | number): Promise<void> {
  const perf = readPerf()
  if (!perf) return
  ensureSnapshot(ctx, perf)
  await writePerf({ [key]: value })
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
  const perf = readPerf()

  if (!perf) {
    const section = el('div', 'so-app-section')
    descLine(section, '未检测到 SillyTavern 运行时（Web 模拟器中仅可查看优化指南）。')
    container.append(section, buildGuide())
    return
  }

  const data = ctx.getAppData<ButlerData>() ?? {}
  // container 在本次 mount 生命周期内有效，操作完成后整页重建刷新状态
  const rerender = () => render(container, ctx)
  const mobile = isMobile()

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
      void enablePerfMode(ctx).then(rerender)
    }),
  )
  if (data.snapshot) {
    main.append(
      appButton('还原到改动前快照', () => {
        void restoreSnapshot(ctx).then(rerender)
      }),
    )
    descLine(main, '已保存改动前快照，可随时一键还原。')
  }
  container.append(main)

  // —— 手动微调（每行挂 ⓘ：桌面悬浮、移动端点开）——
  const tweak = foldSection('手动微调')
  tweak.body.append(
    hintField(
      toggleRow('No Blur（关背景模糊）', perf.fast_ui_mode, (v) => {
        void writeField(ctx, 'fast_ui_mode', v)
      }),
      '关闭聊天框、弹窗背后的毛玻璃模糊。模糊很吃 GPU，几乎所有卡顿场景都建议开启（=关模糊）。官方公认最有效的提速项之一。',
    ),
    hintField(
      toggleRow('减少动画', perf.reduced_motion, (v) => {
        void writeField(ctx, 'reduced_motion', v)
      }),
      '关闭界面过渡动画（展开/淡入等）。低端机、长聊天滚动卡顿时开。改此项需刷新页面才完全生效。',
    ),
    hintField(
      toggleRow('关闭阴影', perf.noShadows, (v) => {
        void writeField(ctx, 'noShadows', v)
      }),
      '去掉界面元素投影，减少重绘。视觉略扁平，但换来更顺滑的滚动。追求性能可开。',
    ),
    hintField(
      toggleRow('平滑流式', perf.smooth_streaming, (v) => {
        void writeField(ctx, 'smooth_streaming', v)
      }),
      'AI 回复逐字平滑吐字的动画。好看但持续占用渲染；出字卡顿、掉帧时建议关闭。',
    ),
    hintField(
      toggleRow('流式淡入', perf.stream_fade_in, (v) => {
        void writeField(ctx, 'stream_fade_in', v)
      }),
      '新出的文字带淡入效果。同样是额外渲染开销，卡顿时关。',
    ),
    hintField(
      numberRow('流式帧率 FPS', perf.streaming_fps, 5, 100, (v) => {
        void writeField(ctx, 'streaming_fps', v)
      }),
      'AI 回复刷新的帧率。越高越顺滑但越吃性能。默认约 30；低端机/手机官方建议降到 10–15，肉眼几乎无差却明显省电省算力。',
    ),
    hintField(
      numberRow('消息加载数', perf.chat_truncation, 0, 100000, (v) => {
        void writeField(ctx, 'chat_truncation', v)
      }),
      '打开对话时载入 DOM 的最近消息条数（0=全部）。长聊天最主要的卡顿来源。手机建议 15–20、桌面 50 左右；往上翻能继续加载更早的消息，不会丢。改后自动重载当前对话。',
    ),
  )
  container.append(tweak.box)

  // —— 体检 ——
  const check = foldSection('体检')
  const health = readHealth()
  descLine(check.body, `已禁用扩展：${health.disabledExtensions} 个。`)
  if (health.quickReplySets !== null) {
    descLine(check.body, `Quick Reply 集合：${health.quickReplySets} 个（社区反馈集合过多可能造成输入拖拽卡顿，卡则精简）。`)
  }
  descLine(check.body, '输入卡顿最常见元凶是第三方扩展：逐个禁用排查（扩展启停改动需刷新页面才真正生效）。')
  container.append(check.box)

  // —— 指南 ——
  container.append(buildGuide())
}
