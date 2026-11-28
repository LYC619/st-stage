import type { PhoneApp } from '../../../../core/phone-registry'
import { foldSection, numberRow, toggleRow } from '../widgets'
import { createComposerBridge } from '../renderer/composer'
import { getStoryAiConfig, renderStoryAiSetupCard } from '../shared/story-ai'
import { readChatMetadata, storyIdentity, writeChatMetadata } from '../shared/chat-metadata'
import { clearAppBadge, consumeAppDeepLink, emitStoryEvent, requestOpenApp } from '../shared/story-events'
import { formatStoryDate, parseSpanEnd, relationToToday } from '../shared/story-date'
import { META_KEY } from '../story-state/store'
import { createChronicleController } from './controller'
import { readChronicleData, readChronicleSettings } from './store'
import { entryRelation } from './inject'
import type { ChronicleSettings } from './types'
import { calendarGap, calendarWindow, NO_STORY_DATE, readCalendar, saveCalendarNote, weatherIcon } from './calendar'

function text(tag: string, className: string, value: string): HTMLElement {
  const node = document.createElement(tag); node.className = className; node.textContent = value; return node
}

export function createChronicleApp(): PhoneApp {
  let controller: ReturnType<typeof createChronicleController>, cleanup: (() => void) | undefined
  return {
    id: 'chronicle',
    name: '纪要',
    icon: '📜',
    order: 28,
    fullbleed: true,
    setup(host) { controller = createChronicleController(host); return () => controller.destroy() },
    mount(container, ctx) {
      clearAppBadge('chronicle')
      const deepLink = consumeAppDeepLink('chronicle')
      let selected = deepLink?.tab === 'calendar' ? 1 : 0
      let editingCode = ''
      let editDraft: { code: string; timeSpan: string; summary: string; text: string } | null = null
      let activeCalendarDate = deepLink?.date || ''
      const noteDrafts = new Map<string, string>()
      const composer = createComposerBridge()

      const root = text('div', 'ch-root', ''), header = text('div', 'ch-header', ''), list = text('div', 'ch-list', '')
      const organize = document.createElement('button')
      organize.type = 'button'
      organize.className = 'ch-primary-btn'
      organize.onclick = () => {
        if (selected === 0) {
          if (controller.status().busy) controller.cancel()
          else void controller.trigger(true)
        } else if (controller.calendar.status().busy) {
          controller.calendar.cancel()
        } else {
          const today = controller.status().today
          if (today && !calendarGap(today, readCalendar()).missing.length) {
            status.textContent = '这七天的风物已齐备；想换一批日程可点下方「↻ 重排七天风物」。'
            return
          }
          void controller.refresh()
          void controller.calendar.trigger(true)
        }
      }
      header.append(text('strong', '', '纪要'), organize)

      const tabs = text('div', 'ch-tabs', '')
      tabs.setAttribute('role', 'tablist')
      tabs.setAttribute('aria-label', '纪要页面')
      list.id = 'ch-panel'
      list.setAttribute('role', 'tabpanel')
      list.tabIndex = 0
      const buttons = ['纪要', '日历'].map((label, index) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = label
        button.id = `ch-tab-${index}`
        button.setAttribute('role', 'tab')
        button.setAttribute('aria-controls', list.id)
        button.onclick = () => { selected = index; render() }
        button.onkeydown = event => {
          const target = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? 1 - index : undefined
          if (target === undefined) return
          event.preventDefault(); event.stopPropagation(); selected = target; render(); buttons[target].focus()
        }
        tabs.append(button)
        return button
      })

      const status = text('p', 'ch-status', '')
      status.setAttribute('role', 'status')
      const settings = foldSection('设置', false, 'chronicle-settings'), initial = readChronicleSettings(ctx)
      const update = (change: Partial<ChronicleSettings>) => {
        ctx.setAppData({ ...readChronicleSettings(ctx), ...change })
        void controller.refresh()
      }
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'ch-danger-btn'
      remove.textContent = '删除最后一条纪要'
      remove.onclick = () => {
        const latestEntry = readChronicleData().entries.at(-1)
        const rollbackHint = typeof latestEntry?.startIndex === 'number'
          ? '删掉后会自动退回整理进度，那几层对话随时可以重新整理。'
          : '已整理的消息位置保持不变。'
        if (window.confirm(`删除最后一条纪要？${rollbackHint}`)) void controller.deleteLatest()
      }

      const aiHubSlot = text('div', 'ch-ai-slot', '')
      settings.body.append(
        toggleRow('自动整理', initial.autoGenerate, autoGenerate => { update({ autoGenerate }); if (!autoGenerate) controller.cancel() }),
        numberRow('每几条 AI 回复整理一次', initial.interval, 2, 20, interval => update({ interval })),
        toggleRow('注入主聊天', initial.inject, inject => update({ inject })),
        toggleRow('日期变化时自动补齐日历', initial.autoCalendar, autoCalendar => { update({ autoCalendar }); if (!autoCalendar) controller.calendar.cancel() }),
        toggleRow('今日风物一并注入主聊天', initial.injectCalendar, injectCalendar => update({ injectCalendar })),
        remove,
        aiHubSlot,
      )
      root.append(header, tabs, status, list, settings.box)
      container.append(root)

      function render() {
        const activeEl = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement
          ? (list.contains(document.activeElement) ? document.activeElement : null)
          : null
        const focusMeta = activeEl
          ? {
              noteDate: activeEl.dataset.noteDate || '',
              editField: activeEl.dataset.editField || '',
              start: activeEl.selectionStart,
              end: activeEl.selectionEnd,
            }
          : null

        const restoreFocus = () => {
          if (!focusMeta) return
          const target = focusMeta.noteDate
            ? list.querySelector<HTMLInputElement>(`input[data-note-date="${CSS.escape(focusMeta.noteDate)}"]`)
            : focusMeta.editField
              ? list.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-edit-field="${CSS.escape(focusMeta.editField)}"]`)
              : null
          if (!target) return
          target.focus({ preventScroll: true })
          if (typeof focusMeta.start === 'number' && typeof focusMeta.end === 'number') {
            try { target.setSelectionRange(focusMeta.start, focusMeta.end) } catch { /* Non-text inputs ignore selection range. */ }
          }
        }

        const state = controller.status(), connected = !!getStoryAiConfig(ctx), data = readChronicleData()
        const calendar = controller.calendar.status(), busy = selected === 0 ? state.busy : calendar.busy
        organize.textContent = selected === 0 ? (busy ? '整理中… · 取消' : '整理') : (busy ? '生成中… · 取消' : '刷新日历')
        organize.disabled = !busy && !connected
        status.textContent = connected
          ? (selected === 0 ? state.error : calendar.error)
          : '展开下方「设置」连上幕后 AI（也可沿用微信连接），就能把走过的故事编成纪要与七日风物历啦。'
        remove.disabled = state.busy || !data.entries.length
        aiHubSlot.replaceChildren(renderStoryAiSetupCard(ctx, render))

        buttons.forEach((button, index) => {
          button.setAttribute('aria-selected', String(index === selected))
          button.tabIndex = index === selected ? 0 : -1
        })
        list.setAttribute('aria-labelledby', buttons[selected].id)
        list.replaceChildren()

        if (selected === 1) {
          const today = state.today
          if (!today) {
            if (connected && !calendar.error) status.textContent = NO_STORY_DATE
            else if (!connected) status.textContent = `${NO_STORY_DATE}；并请先连接 AI。`
            const quickSetup = text('section', 'ch-date-setup', '')
            quickSetup.append(
              text('strong', '', '📅 设定故事起始日期'),
              text('p', 'ch-muted', '普通卡还没有写出明确日期时，可以在此直接定下故事的「今天」，即刻排布七天风物日历。'),
            )
            const row = text('div', 'ch-date-setup-row', '')
            const dateInput = document.createElement('input')
            dateInput.type = 'date'
            dateInput.value = '2026-03-21'
            dateInput.setAttribute('aria-label', '故事起始日期')
            const setBtn = document.createElement('button')
            setBtn.type = 'button'
            setBtn.className = 'ch-primary-btn'
            setBtn.textContent = '设为剧情今天'
            setBtn.onclick = async () => {
              if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput.value)) return
              const [y, m, d] = dateInput.value.split('-').map(Number)
              try {
                const existingMeta = readChatMetadata(META_KEY) as { stat_data?: Record<string, unknown> } | undefined
                const statData = structuredClone(existingMeta?.stat_data ?? {})
                const prevTime = (statData.时间 && typeof statData.时间 === 'object' ? statData.时间 : {}) as Record<string, unknown>
                const prevIso = typeof prevTime.年 === 'number' && typeof prevTime.月 === 'number' && typeof prevTime.日 === 'number' && prevTime.年 > 0
                  ? `${String(prevTime.年).padStart(4, '0')}-${String(prevTime.月).padStart(2, '0')}-${String(prevTime.日).padStart(2, '0')}`
                  : ''
                statData.时间 = {
                  ...prevTime,
                  年: y,
                  月: m,
                  日: d,
                  星期: '日一二三四五六'[new Date(y, m - 1, d).getDay()],
                  ...(prevIso !== dateInput.value ? { 显示: '' } : {}),
                }
                const saved = await writeChatMetadata(ctx, storyIdentity(ctx), META_KEY, { stat_data: statData, v: 1 })
                if (!saved) {
                  status.textContent = '请先打开一个角色聊天，再设定故事日期。'
                  return
                }
                await controller.refresh()
                if (getStoryAiConfig(ctx)) void controller.calendar.trigger(true)
                emitStoryEvent({ type: 'story-date-changed', date: dateInput.value })
              } catch (err) {
                console.warn('[st-stage] 设定故事起始日期失败', err)
                status.textContent = (err as Error).message || '设定故事日期失败，请稍后重试。'
              }
            }
            row.append(dateInput, setBtn)
            quickSetup.append(row)
            list.append(quickSetup)
            return
          }

          const calData = readCalendar()
          const days = calData.days
          const notes = calData.notes ?? {}
          const windowDates = calendarWindow(today)
          const todayIso = formatStoryDate(today)
          if (!activeCalendarDate || !windowDates.includes(activeCalendarDate)) activeCalendarDate = todayIso

          const toolbar = text('div', 'ch-cal-toolbar', '')
          toolbar.append(text('small', 'ch-meta', `剧情今天：${todayIso}`))
          if (!calendarGap(today, calData).missing.length && connected) {
            const rerollBtn = document.createElement('button')
            rerollBtn.type = 'button'
            rerollBtn.className = 'ch-ghost-btn'
            rerollBtn.textContent = '↻ 重排七天风物'
            rerollBtn.disabled = busy
            rerollBtn.onclick = () => { void controller.calendar.trigger(true, true) }
            toolbar.append(rerollBtn)
          }
          list.append(toolbar)

          const strip = text('div', 'ch-week-strip', '')
          const dayCards = new Map<string, HTMLDetailsElement>()

          for (const date of windowDates) {
            const parsed = parseSpanEnd(date)!
            const day = days.find(item => item.date === date)
            const isToday = date === todayIso
            const hasNote = Boolean(notes[date])

            const chip = document.createElement('button')
            chip.type = 'button'
            chip.className = `ch-week-chip${date === activeCalendarDate ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`
            chip.append(
              text('small', '', `周${'日一二三四五六'[parsed.getDay()]}`),
              text('strong', '', date.slice(8)),
              text('span', 'ch-week-wx', day ? weatherIcon(day.weather) : '·'),
            )
            if (hasNote) chip.append(text('span', 'ch-week-pin', '📌'))
            chip.onclick = () => {
              activeCalendarDate = date
              const targetCard = dayCards.get(date)
              if (targetCard) {
                targetCard.open = true
                targetCard.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
              }
              strip.querySelectorAll('.ch-week-chip').forEach((el, i) => {
                el.classList.toggle('is-selected', windowDates[i] === date)
              })
            }
            strip.append(chip)
          }
          list.append(strip)

          for (const date of windowDates) {
            const parsed = parseSpanEnd(date)!
            const day = days.find(item => item.date === date)
            const isToday = date === todayIso
            const note = notes[date] || ''
            const card = document.createElement('details')
            card.className = 'ch-card ch-day'
            card.dataset.today = String(isToday)
            if (isToday || date === activeCalendarDate) card.open = true
            dayCards.set(date, card)

            const summary = document.createElement('summary')
            summary.append(
              text('small', 'ch-meta', `${date} · 星期${'日一二三四五六'[parsed.getDay()]} · ${relationToToday(parsed, today)}`),
              text('strong', '', day ? `${weatherIcon(day.weather)} ${day.event}` : '风物待书（点右上角刷新日历）'),
            )
            card.append(summary)

            if (day) {
              card.append(
                text('p', 'ch-meta', [day.festival, day.weather, day.status].filter(Boolean).join(' · ')),
                text('p', 'ch-copy', day.content),
              )
            }

            const noteBox = text('div', 'ch-note-box', '')
            const noteInput = document.createElement('input')
            noteInput.type = 'text'
            noteInput.placeholder = '📌 记下这天的私人约定或备忘…'
            noteInput.value = noteDrafts.has(date) ? noteDrafts.get(date)! : note
            noteInput.dataset.noteDate = date
            noteInput.setAttribute('aria-label', `${date} 当日约定`)
            noteInput.oninput = () => {
              if (noteInput.value === note) noteDrafts.delete(date)
              else noteDrafts.set(date, noteInput.value)
            }
            const saveNoteBtn = document.createElement('button')
            saveNoteBtn.type = 'button'
            saveNoteBtn.className = 'ch-ghost-btn'
            saveNoteBtn.textContent = note ? '更新约定' : '记下'
            saveNoteBtn.onclick = () => {
              const valueToSave = noteInput.value
              void saveCalendarNote(ctx, date, valueToSave).then(ok => {
                if (ok) {
                  noteDrafts.delete(date)
                  status.textContent = valueToSave.trim() ? '已记下当日约定。' : '已清除当日约定。'
                  render()
                } else {
                  status.textContent = '请先打开一个角色聊天，再记下当日约定。'
                }
              }).catch(err => {
                console.warn('[st-stage] 保存日历约定失败', err)
                status.textContent = (err as Error).message || '保存约定失败，请稍后重试。'
              })
            }
            noteBox.append(noteInput, saveNoteBtn)
            card.append(noteBox)

            const actions = text('div', 'ch-card-actions', '')
            const diaryBtn = document.createElement('button')
            diaryBtn.type = 'button'
            diaryBtn.className = 'ch-action-btn'
            diaryBtn.textContent = '📖 看这天日记'
            diaryBtn.onclick = () => requestOpenApp({ appId: 'theater', tab: 'diary', date })
            actions.append(diaryBtn)

            if (day || note) {
              const chatHookBtn = document.createElement('button')
              chatHookBtn.type = 'button'
              chatHookBtn.className = 'ch-action-btn'
              chatHookBtn.textContent = '💬 聊起这天'
              chatHookBtn.onclick = () => {
                const topic = note
                  ? `提起${relationToToday(parsed, today)}（${date}）的约定「${note}」，看看对方准备得怎么样。`
                  : `聊起${relationToToday(parsed, today)}${day?.weather ? '的' + day.weather + '天气和' : ''}「${day?.event}」，顺口听听对方的打算。`
                const res = composer.appendDraft(topic)
                status.textContent = res.ok ? '已把话题记入聊天输入框。' : res.error
              }
              actions.append(chatHookBtn)
            }
            card.append(actions)
            list.append(card)
          }
          restoreFocus()
          return
        }

        if (!data.entries.length) {
          list.append(text('p', 'ch-empty', '故事卷册还是空白的。聊过几轮后点右上角「整理」，把你们走过的故事记成脉络吧。'))
        }
        for (const entry of [...data.entries].reverse()) {
          const card = document.createElement('details')
          card.className = 'ch-card'
          if (editingCode === entry.code) card.open = true
          const summary = document.createElement('summary')
          summary.append(
            text('small', 'ch-meta', [entry.code, entry.timeSpan, entryRelation(entry, state.today)].filter(Boolean).join(' · ')),
            text('strong', '', entry.summary),
          )
          card.append(summary)

          if (editingCode === entry.code) {
            const currentDraft = editDraft?.code === entry.code
              ? editDraft
              : (editDraft = { code: entry.code, timeSpan: entry.timeSpan, summary: entry.summary, text: entry.text })
            const form = text('div', 'ch-edit-form', '')
            const spanInput = document.createElement('input')
            spanInput.type = 'text'
            spanInput.value = currentDraft.timeSpan
            spanInput.dataset.editField = 'span'
            spanInput.placeholder = '时间跨度（如 2026-01-01）'
            spanInput.oninput = () => { currentDraft.timeSpan = spanInput.value }
            const sumInput = document.createElement('input')
            sumInput.type = 'text'
            sumInput.value = currentDraft.summary
            sumInput.dataset.editField = 'summary'
            sumInput.placeholder = '一句话概览'
            sumInput.oninput = () => { currentDraft.summary = sumInput.value }
            const bodyInput = document.createElement('textarea')
            bodyInput.rows = 4
            bodyInput.value = currentDraft.text
            bodyInput.dataset.editField = 'body'
            bodyInput.oninput = () => { currentDraft.text = bodyInput.value }
            const bar = text('div', 'ch-card-actions', '')
            const saveBtn = document.createElement('button')
            saveBtn.type = 'button'
            saveBtn.className = 'ch-primary-btn'
            saveBtn.textContent = '保存修订'
            saveBtn.onclick = () => {
              void controller.updateEntry(entry.code, {
                timeSpan: spanInput.value,
                summary: sumInput.value,
                text: bodyInput.value,
              }).then(ok => {
                if (ok) { editingCode = ''; editDraft = null; render() }
              })
            }
            const cancelBtn = document.createElement('button')
            cancelBtn.type = 'button'
            cancelBtn.className = 'ch-ghost-btn'
            cancelBtn.textContent = '取消'
            cancelBtn.onclick = () => { editingCode = ''; editDraft = null; render() }
            bar.append(saveBtn, cancelBtn)
            form.append(spanInput, sumInput, bodyInput, bar)
            card.append(form)
          } else {
            card.append(text('p', 'ch-copy', entry.text))
            for (const quote of entry.keyDialogue) card.append(text('blockquote', 'ch-dialogue', quote))
            const bar = text('div', 'ch-card-actions', '')
            const editBtn = document.createElement('button')
            editBtn.type = 'button'
            editBtn.className = 'ch-ghost-btn'
            editBtn.textContent = '✏️ 修订纪要'
            editBtn.onclick = () => {
              editingCode = entry.code
              editDraft = { code: entry.code, timeSpan: entry.timeSpan, summary: entry.summary, text: entry.text }
              render()
            }
            bar.append(editBtn)
            card.append(bar)
          }

          list.append(card)
        }
        restoreFocus()
      }

      const off = controller.subscribe(render)
      const offChar = typeof ctx.onCharacterChanged === 'function'
        ? ctx.onCharacterChanged(() => {
            editingCode = ''
            editDraft = null
            activeCalendarDate = ''
            noteDrafts.clear()
            render()
          })
        : () => {}
      render()
      void controller.refresh()
      cleanup = () => { off(); offChar(); composer.dispose(); root.remove() }
    },
    unmount() { cleanup?.(); cleanup = undefined },
  }
}
