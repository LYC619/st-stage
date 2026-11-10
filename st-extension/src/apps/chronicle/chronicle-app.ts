import type { PhoneApp } from '../../../../core/phone-registry'
import { foldSection, numberRow, toggleRow } from '../widgets'
import { getStoryAiConfig } from '../shared/story-ai'
import { createChronicleController } from './controller'
import { readChronicleData, readChronicleSettings } from './store'
import { entryRelation } from './inject'
import type { ChronicleSettings } from './types'
import { calendarWindow, NO_STORY_DATE, readCalendar } from './calendar'
import { formatStoryDate, parseSpanEnd, relationToToday } from '../shared/story-date'

function text(tag: string, className: string, value: string): HTMLElement {
  const node = document.createElement(tag); node.className = className; node.textContent = value; return node
}

export function createChronicleApp(): PhoneApp {
  let controller: ReturnType<typeof createChronicleController>, cleanup: (() => void) | undefined
  return {
    id: 'chronicle', name: '纪要', icon: '📜', order: 28,
    setup(host) { controller = createChronicleController(host); return () => controller.destroy() },
    mount(container, ctx) {
      let selected = 0
      const root = text('div', 'ch-root', ''), header = text('div', 'ch-header', ''), list = text('div', 'ch-list', '')
      const organize = document.createElement('button'); organize.type = 'button'
      organize.onclick = () => {
        if (selected === 0) { if (controller.status().busy) controller.cancel(); else void controller.trigger(true) }
        else if (controller.calendar.status().busy) controller.calendar.cancel()
        else { void controller.refresh(); void controller.calendar.trigger(true) }
      }
      header.append(text('strong', '', '纪要'), organize)
      const tabs = text('div', 'ch-tabs', ''); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '纪要页面')
      list.id = 'ch-panel'; list.setAttribute('role', 'tabpanel'); list.tabIndex = 0
      const buttons = ['纪要', '日历'].map((label, index) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label
        button.id = `ch-tab-${index}`; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', list.id)
        button.onclick = () => { selected = index; render() }
        button.onkeydown = event => {
          const target = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? 1 - index : undefined
          if (target === undefined) return
          event.preventDefault(); event.stopPropagation(); selected = target; render(); buttons[target].focus()
        }
        tabs.append(button); return button
      })
      const status = text('p', 'ch-status', ''); status.setAttribute('role', 'status')
      const settings = foldSection('设置', false, 'chronicle-settings'), initial = readChronicleSettings(ctx)
      const update = (change: Partial<ChronicleSettings>) => { ctx.setAppData({ ...readChronicleSettings(ctx), ...change }); void controller.refresh() }
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '删除最后一条纪要'
      remove.onclick = () => { if (window.confirm('删除最后一条纪要？已整理的消息位置保持不变。')) void controller.deleteLatest() }
      settings.body.append(toggleRow('自动整理', initial.autoGenerate, autoGenerate => { update({ autoGenerate }); if (!autoGenerate) controller.cancel() }),
        numberRow('每几条 AI 回复整理一次', initial.interval, 2, 20, interval => update({ interval })),
        toggleRow('注入主聊天', initial.inject, inject => update({ inject })),
        toggleRow('日期变化时自动补齐日历', initial.autoCalendar, autoCalendar => { update({ autoCalendar }); if (!autoCalendar) controller.calendar.cancel() }), remove)
      root.append(header, tabs, status, list, settings.box); container.append(root)
      function render() {
        const state = controller.status(), connected = !!getStoryAiConfig(ctx), data = readChronicleData()
        const calendar = controller.calendar.status(), busy = selected === 0 ? state.busy : calendar.busy
        organize.textContent = selected === 0 ? busy ? '整理中… · 取消' : '整理' : busy ? '生成中… · 取消' : '刷新日历'
        organize.disabled = !busy && !connected
        status.textContent = connected ? selected === 0 ? state.error : calendar.error : '请先在微信设置里连接 AI。'
        remove.disabled = state.busy || !data.entries.length
        buttons.forEach((button, index) => { button.setAttribute('aria-selected', String(index === selected)); button.tabIndex = index === selected ? 0 : -1 })
        list.setAttribute('aria-labelledby', buttons[selected].id)
        list.replaceChildren()
        if (selected === 1) {
          const today = state.today
          if (!today) { status.textContent = NO_STORY_DATE; return }
          const days = readCalendar().days
          for (const date of calendarWindow(today)) {
            const parsed = parseSpanEnd(date)!, day = days.find(day => day.date === date), card = document.createElement('details')
            card.className = 'ch-card ch-day'; card.dataset.today = String(date === formatStoryDate(today))
            const summary = document.createElement('summary')
            summary.append(text('small', 'ch-meta', `${date} · 星期${'日一二三四五六'[parsed.getDay()]} · ${relationToToday(parsed, today)}`),
              text('strong', '', day ? day.event : '尚未生成'))
            card.append(summary)
            if (day) card.append(text('p', 'ch-meta', [day.festival, day.weather, day.status].filter(Boolean).join(' · ')), text('p', 'ch-copy', day.content))
            list.append(card)
          }
          return
        }
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
