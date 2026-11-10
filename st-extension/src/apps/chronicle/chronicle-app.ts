import type { PhoneApp } from '../../../../core/phone-registry'
import { foldSection, numberRow, toggleRow } from '../widgets'
import { getStoryAiConfig } from '../shared/story-ai'
import { createChronicleController } from './controller'
import { readChronicleData, readChronicleSettings } from './store'
import { entryRelation } from './inject'
import type { ChronicleSettings } from './types'

function text(tag: string, className: string, value: string): HTMLElement {
  const node = document.createElement(tag); node.className = className; node.textContent = value; return node
}

export function createChronicleApp(): PhoneApp {
  let controller: ReturnType<typeof createChronicleController>, cleanup: (() => void) | undefined
  return {
    id: 'chronicle', name: '纪要', icon: '📜', order: 28,
    setup(host) { controller = createChronicleController(host); return () => controller.destroy() },
    mount(container, ctx) {
      const root = text('div', 'ch-root', ''), header = text('div', 'ch-header', ''), list = text('div', 'ch-list', '')
      const organize = document.createElement('button'); organize.type = 'button'
      organize.onclick = () => { if (controller.status().busy) controller.cancel(); else void controller.trigger(true) }
      header.append(text('strong', '', '纪要'), organize)
      const status = text('p', 'ch-status', ''); status.setAttribute('role', 'status')
      const settings = foldSection('设置', false, 'chronicle-settings'), initial = readChronicleSettings(ctx)
      const update = (change: Partial<ChronicleSettings>) => { ctx.setAppData({ ...readChronicleSettings(ctx), ...change }); void controller.refresh() }
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '删除最后一条纪要'
      remove.onclick = () => { if (window.confirm('删除最后一条纪要？已整理的消息位置保持不变。')) void controller.deleteLatest() }
      settings.body.append(toggleRow('自动整理', initial.autoGenerate, autoGenerate => { update({ autoGenerate }); if (!autoGenerate) controller.cancel() }),
        numberRow('每几条 AI 回复整理一次', initial.interval, 2, 20, interval => update({ interval })),
        toggleRow('注入主聊天', initial.inject, inject => update({ inject })), remove)
      root.append(header, status, list, settings.box); container.append(root)
      function render() {
        const state = controller.status(), connected = !!getStoryAiConfig(ctx), data = readChronicleData()
        organize.textContent = state.busy ? '整理中… · 取消' : '整理'; organize.disabled = !state.busy && !connected
        status.textContent = connected ? state.error : '请先在微信设置里连接 AI。'
        remove.disabled = state.busy || !data.entries.length
        list.replaceChildren()
        if (!data.entries.length) list.append(text('p', 'ch-empty', '还没有纪要。点击「整理」记录已经发生的剧情。'))
        for (const entry of [...data.entries].reverse()) {
          const card = document.createElement('details'); card.className = 'ch-card'
          const summary = document.createElement('summary')
          summary.append(text('small', 'ch-meta', [entry.code, entry.timeSpan, entryRelation(entry, state.today)].filter(Boolean).join(' · ')), text('strong', '', entry.summary))
          card.append(summary, text('p', 'ch-copy', entry.text))
          for (const quote of entry.keyDialogue) card.append(text('blockquote', 'ch-dialogue', quote))
          list.append(card)
        }
      }
      const off = controller.subscribe(render); render(); void controller.refresh()
      cleanup = () => { off(); root.remove() }
    },
    unmount() { cleanup?.(); cleanup = undefined },
  }
}
