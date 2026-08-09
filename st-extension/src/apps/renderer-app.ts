/** Renderer 设置 App：控制协议注入、模式启停和渲染动态效果。 */

import type { AppHost, PhoneApp } from '../../../core/phone-registry'
import { appButton, el, foldSection, hintField, numberRow, toggleRow } from './widgets'
import { buildRendererPrompt } from './renderer/prompt'
import { normalizeRendererSettings, RENDERER_APP_ID, type RendererSettings } from './renderer/config'
import type { RendererRuntime } from './renderer/runtime'

export interface RendererAppDeps {
  runtime: Pick<RendererRuntime, 'reprocessAll'>
}

/** 把当前设置写入本 App 的独立提示词通道。 */
function refreshPrompt(host: AppHost, settings: RendererSettings): void {
  host.injectPrompt(buildRendererPrompt(settings), settings.injectionDepth)
}

/** 构造一组带标题的设置行。 */
function section(title: string, ...rows: HTMLElement[]): HTMLElement {
  const box = el('section', 'so-app-section renderer-settings-section')
  const heading = el('div', 'so-app-title')
  heading.textContent = title
  box.append(heading, ...rows)
  return box
}

function enabledModes(settings: RendererSettings): string[] {
  return [
    settings.galEnabled ? 'Galgame' : '',
    settings.cardsEnabled ? '卡片选择' : '',
    settings.battleEnabled ? '战斗' : '',
  ].filter(Boolean)
}

function rendererStatus(settings: RendererSettings): HTMLElement {
  const status = el('div', 'renderer-status so-app-desc')
  if (!settings.enabled) {
    status.textContent = '未启用（当前不注入任何协议提示词）。启用后，下一条合适的 AI 回复才会尝试显示结构化渲染。'
    return status
  }

  const modes = enabledModes(settings)
  // 把实际注入量摆在明面上：用户怀疑「没注入成功」时可对照发出的提示词自查
  const injected = buildRendererPrompt(settings)
  status.textContent = modes.length > 0
    ? `已启用 · 可用模式：${modes.join('、')} · 正在注入协议说明 ${injected.length} 字符（深度 ${settings.injectionDepth}）`
    : '已启用，但没有启用模式——此时不注入提示词；请至少打开一个模式。'
  return status
}

function quickStep(number: string, title: string, description: string): HTMLElement {
  const row = el('div', 'renderer-quick-step')
  const marker = el('span', 'renderer-quick-step-number')
  marker.textContent = number
  const content = el('div', 'renderer-quick-step-content')
  const heading = el('strong', 'renderer-quick-step-title')
  heading.textContent = title
  const detail = el('span', 'so-app-desc')
  detail.textContent = description
  content.append(heading, detail)
  row.append(marker, content)
  return row
}

function quickStart(settings: RendererSettings, onEnable: () => void): HTMLElement {
  const box = el('section', 'so-app-section renderer-quick-start')
  const heading = el('div', 'so-app-title')
  heading.textContent = '快速开始'
  box.append(heading, rendererStatus(settings))
  if (!settings.enabled) {
    const activation = appButton('启用渲染', onEnable)
    activation.classList.add('renderer-recommend')
    box.append(
      quickStep('1', '打开渲染', '启用下面的总开关，保留至少一个模式。'),
      quickStep('2', '发送普通消息', '不需要手动粘贴 JSON；插件会把协议说明注入给 AI。'),
      quickStep('3', '使用回复中的交互', '卡片会填入输入框，战斗按钮在渲染面板内执行。'),
      activation,
    )
  }
  return box
}

function modeGuide(): HTMLElement {
  const { box, body } = foldSection('模式说明', false, 'renderer:mode-guide')
  box.classList.add('renderer-mode-guide')
  const modes: Array<[string, string]> = [
    ['Galgame', '连续对话和分镜节拍；适合让 AI 控制角色、场景和立绘切换。'],
    ['卡片选择', '2-8 个明确选项；点击后只填入草稿，不会替你自动发送。'],
    ['战斗', '本地确定性战斗；选择攻击、技能、物品或逃跑后立即更新面板。'],
  ]
  for (const [title, description] of modes) {
    const row = el('div', 'renderer-mode-row')
    const name = el('strong', 'renderer-mode-name')
    name.textContent = title
    const detail = el('span', 'so-app-desc')
    detail.textContent = description
    row.append(name, detail)
    body.append(row)
  }
  const troubleshooting = el('p', 'so-app-desc renderer-troubleshooting')
  troubleshooting.textContent = '没有渲染时，普通回复会原样显示。自查顺序：先看上方状态行——显示「正在注入协议说明 N 字符」才说明协议在发给 AI；显示未启用或没有模式则先打开开关；之后发送新消息，只有 AI 返回合法的 STStageRender 块时才会出现面板。'
  body.append(troubleshooting)
  return box
}

/** 创建 Renderer 手机设置 App。 */
export function rendererApp(deps: RendererAppDeps): PhoneApp {
  return {
    id: RENDERER_APP_ID,
    name: '渲染',
    icon: '🎬',
    order: 7,
    setup(host) {
      const inject = (): void => refreshPrompt(host, normalizeRendererSettings(host.getAppData()))
      inject()
      // 切换聊天/角色后重注入：注入通道若被 ST 侧或异常时序清掉，静态注入没有任何
      // 自愈路径（mount 不重注入，只有改设置才会）——这里对齐立绘/新变量的自愈行为
      const offCharacterChanged = host.onCharacterChanged(inject)
      return () => {
        offCharacterChanged()
        host.injectPrompt('')
      }
    },
    mount(container, ctx) {
      let current = normalizeRendererSettings(ctx.getAppData())

      /** 保存完整配置，并同步提示词与已渲染楼层。 */
      function save(next: RendererSettings): void {
        current = normalizeRendererSettings(next)
        ctx.setAppData(current)
        refreshPrompt(ctx, current)
        deps.runtime.reprocessAll()
        render()
      }

      /** 按当前设置重建轻量控件页。 */
      function render(): void {
        container.textContent = ''
        const page = el('div', 'renderer-settings')
        page.append(
          quickStart(current, () => save({ ...current, enabled: true })),
          modeGuide(),
          section(
            '状态',
            toggleRow('启用渲染', current.enabled, (enabled) => save({ ...current, enabled })),
          ),
          section(
            '模式',
            toggleRow('Galgame', current.galEnabled, (galEnabled) => save({ ...current, galEnabled })),
            toggleRow('卡片选择', current.cardsEnabled, (cardsEnabled) => save({ ...current, cardsEnabled })),
            toggleRow('战斗', current.battleEnabled, (battleEnabled) => save({ ...current, battleEnabled })),
          ),
          section(
            '行为',
            numberRow('注入深度', current.injectionDepth, 0, 20, (injectionDepth) => save({ ...current, injectionDepth })),
            hintField(
              toggleRow('打字机', current.typewriter, (typewriter) => save({ ...current, typewriter })),
              '仅控制 Galgame 渲染面板里对话文字的逐字显示动画，与模型的流式输出无关；关闭后整段文字直接显示。',
            ),
            toggleRow('减少动态', current.reducedMotion, (reducedMotion) => save({ ...current, reducedMotion })),
          ),
        )
        container.append(page)
      }

      render()
    },
  }
}
