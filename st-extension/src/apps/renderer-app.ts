/** Renderer 设置 App：控制协议注入、模式启停和渲染动态效果。 */

import type { AppHost, PhoneApp } from '../../../core/phone-registry'
import { el, numberRow, toggleRow } from './widgets'
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

/** 创建 Renderer 手机设置 App。 */
export function rendererApp(deps: RendererAppDeps): PhoneApp {
  return {
    id: RENDERER_APP_ID,
    name: '渲染',
    icon: '🎬',
    order: 7,
    setup(host) {
      refreshPrompt(host, normalizeRendererSettings(host.getAppData()))
      return () => host.injectPrompt('')
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
            toggleRow('打字机', current.typewriter, (typewriter) => save({ ...current, typewriter })),
            toggleRow('减少动态', current.reducedMotion, (reducedMotion) => save({ ...current, reducedMotion })),
          ),
        )
        container.append(page)
      }

      render()
    },
  }
}
