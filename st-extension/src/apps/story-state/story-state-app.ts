import type { PhoneApp } from '../../../../core/phone-registry'
import { foldSection, numberRow, toggleRow } from '../widgets'
import { subscribeVarEvents } from '../mvu/bridge'
import { createComposerBridge } from '../renderer/composer'
import { getStoryAiConfig, renderStoryAiSetupCard } from '../shared/story-ai'
import { safeRandomId } from '../shared/safe-runtime'
import { clearAppBadge, consumeAppDeepLink, emitStoryEvent, requestOpenApp } from '../shared/story-events'
import { isStorySwitchedError, storyIdentity } from '../shared/chat-metadata'
import {
  formatIsoDateFromTime,
  formatTime,
  readStoryState,
  readSyncSettings,
  type StoryStateSnapshot,
} from './store'
import { createStorySync } from './sync'
import { createLocalEdits, localRowIndex } from './local-edits'
import { itemDraft, questDraft, skillDraft } from './drafts'

function text(tag: string, className: string, value: string): HTMLElement {
  const node = document.createElement(tag); node.className = className; node.textContent = value; return node
}

const TAB_KEYS = ['time', 'quest', 'bag', 'skill'] as const

export function createStoryStateApp(): PhoneApp {
  let sync: ReturnType<typeof createStorySync>, cleanup: (() => void) | undefined
  return {
    id: 'story-state',
    name: '剧情状态',
    icon: '🎒',
    order: 27,
    fullbleed: true,
    setup(host) { sync = createStorySync(host); return () => sync.destroy() },
    mount(container, ctx) {
      clearAppBadge('story-state')
      const deepLink = consumeAppDeepLink('story-state')
      let selected = deepLink?.tab ? Math.max(0, TAB_KEYS.indexOf(deepLink.tab as typeof TAB_KEYS[number])) : 0
      let snapshot: StoryStateSnapshot | undefined
      let alive = true, loadId = 0, loadError = '', pendingAppendDraft = ''
      const composer = createComposerBridge(), timers = new Set<ReturnType<typeof setTimeout>>()

      const root = text('div', 'ss-root', '')
      const header = text('div', 'ss-header', '')
      const titleGroup = text('div', 'ss-header-title', '')
      const source = text('small', 'ss-source', '')
      titleGroup.append(text('strong', '', '剧情状态'), source)

      const syncBtn = document.createElement('button')
      syncBtn.type = 'button'
      syncBtn.className = 'ss-sync-btn'
      syncBtn.onclick = () => {
        if (sync.status().busy) sync.cancel()
        else void sync.trigger(true)
      }
      header.append(titleGroup, syncBtn)

      const tabs = text('div', 'ss-tabs', '')
      const panel = text('div', 'ss-panel', '')
      tabs.setAttribute('role', 'tablist')
      tabs.setAttribute('aria-label', '剧情状态分类')
      panel.id = 'ss-panel'
      panel.setAttribute('role', 'tabpanel')
      panel.tabIndex = 0

      const buttons = ['时空', '任务', '背包', '能力'].map((name, index) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = name
        button.id = `ss-tab-${index}`
        button.setAttribute('role', 'tab')
        button.setAttribute('aria-controls', panel.id)
        button.onclick = () => { selected = index; render() }
        button.onkeydown = event => {
          const target = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : undefined
          if (target === undefined) return
          event.preventDefault(); event.stopPropagation(); selected = target; render(); buttons[target].focus()
        }
        tabs.append(button)
        return button
      })

      const statusWrap = text('div', 'ss-status-bar', '')
      const status = text('p', 'ss-status', '')
      status.setAttribute('role', 'status')
      const appendFallbackBtn = document.createElement('button')
      appendFallbackBtn.type = 'button'
      appendFallbackBtn.className = 'ss-append-btn'
      appendFallbackBtn.textContent = '追加到草稿末尾'
      appendFallbackBtn.hidden = true
      appendFallbackBtn.onclick = () => {
        if (!pendingAppendDraft) return
        const res = composer.appendDraft(pendingAppendDraft)
        if (res.ok) {
          pendingAppendDraft = ''
          appendFallbackBtn.hidden = true
          status.textContent = '已追加到聊天草稿末尾。'
        } else {
          status.textContent = res.error
        }
      }
      statusWrap.append(status, appendFallbackBtn)

      const settings = foldSection('设置', false, 'story-state-settings')
      const config = readSyncSettings(ctx)
      const aiHubSlot = text('div', 'ss-ai-slot', '')
      const aiHint = text('p', 'ss-muted', '')
      settings.body.append(
        toggleRow('后台自动整理', config.autoSync, value => {
          ctx.setAppData({ ...readSyncSettings(ctx), autoSync: value })
          if (!value) sync.cancel()
        }),
        toggleRow('把当前时辰、地点与行囊悄悄提醒给主聊天 AI（普通卡适用）', config.injectToChat, value => {
          ctx.setAppData({ ...readSyncSettings(ctx), injectToChat: value })
          void sync.refreshInjection()
        }),
        numberRow('整理时参考最近几条对话', config.contextMessages, 1, 60, value => {
          ctx.setAppData({ ...readSyncSettings(ctx), contextMessages: value })
        }),
        aiHint,
        aiHubSlot,
      )

      root.append(header, tabs, statusWrap, panel, settings.box)
      container.append(root)

      const edits = createLocalEdits(ctx, {
        async saved(before, after, eventSummary) {
          const beforeDate = formatIsoDateFromTime(before.时间), afterDate = formatIsoDateFromTime(after.时间)
          if (afterDate && afterDate !== beforeDate) emitStoryEvent({ type: 'story-date-changed', date: afterDate })
          emitStoryEvent({ type: 'story-state-updated', summary: eventSummary || '手账已更新' })
          await sync.refreshInjection()
          if (alive) await load()
        },
        failed(error) { status.textContent = error instanceof Error ? error.message : '保存手账失败，请重试。' },
      })
      const mutateLocal = edits.enqueue

      function draftButton(label: string, draft: string): HTMLButtonElement {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'ss-action-btn'
        button.textContent = label
        button.onclick = () => {
          const result = composer.insertDraft(draft)
          if (!result.ok) {
            status.textContent = result.error
            if (result.error.includes('未覆盖')) {
              pendingAppendDraft = draft
              appendFallbackBtn.hidden = false
            }
            return
          }
          pendingAppendDraft = ''
          appendFallbackBtn.hidden = true
          button.textContent = '已填入'
          const timer = setTimeout(() => { timers.delete(timer); button.textContent = label }, 1500)
          timers.add(timer)
        }
        return button
      }

      function empty() {
        const isMvu = snapshot?.backend === 'mvu'
        panel.append(text(
          'p',
          'ss-empty',
          isMvu
            ? '这张角色卡的变量里暂时还没有记录时辰、地点或行囊（这里只做随身速览，不会改写原卡数据）。'
            : '行囊手账还是空白的。可在设置里打开「后台自动整理」，或直接在下方随手记下一笔。',
        ))
      }

      function makeInputField(labelText: string, value = '', type = 'text', placeholder = '') {
        const wrap = text('label', 'ss-edit-field', '')
        wrap.append(text('span', '', labelText))
        const input = document.createElement('input')
        input.type = type
        input.value = value
        input.placeholder = placeholder
        wrap.append(input)
        return { wrap, input }
      }

      function render() {
        const current = sync.status()
        const connected = !!getStoryAiConfig(ctx)
        syncBtn.textContent = current.busy ? '整理中… · 取消' : '立即整理'
        syncBtn.disabled = !current.busy && (!connected || snapshot?.backend === 'mvu')
        syncBtn.hidden = snapshot?.backend === 'mvu'
        aiHint.textContent = connected ? '' : '在下方「设置」连上幕后 AI 后，就能随对话帮你打理旅途时辰与随身行囊啦'
        aiHint.hidden = connected
        aiHubSlot.replaceChildren(renderStoryAiSetupCard(ctx, () => { render(); void sync.refreshInjection() }))

        if (loadError || current.error || current.busy) {
          status.textContent = loadError || current.error || '正在后台整理…'
        } else if (!pendingAppendDraft) {
          status.textContent = ''
        }

        buttons.forEach((button, index) => {
          button.setAttribute('aria-selected', String(selected === index))
          button.tabIndex = selected === index ? 0 : -1
        })
        panel.setAttribute('aria-labelledby', buttons[selected].id)
        panel.replaceChildren()
        panel.classList.toggle('ss-inventory', selected === 2)

        if (!snapshot) { source.textContent = ''; return }
        source.textContent = snapshot.backend === 'mvu' ? '联动角色卡变量' : '随身旅途手账'
        const state = snapshot.state
        const isLocal = snapshot.backend === 'local'

        if (selected === 0) {
          const hero = text('div', 'ss-spacetime-hero', '')
          const rawTimeText = formatTime(state.时间)
          hero.append(
            text('div', 'ss-time', rawTimeText === '尚未记录' ? '时辰未定' : rawTimeText),
            text('p', 'ss-location', [state.位置.区域, state.位置.地点].filter(Boolean).join(' · ') || '落脚处未记'),
          )
          const calBtn = document.createElement('button')
          calBtn.type = 'button'
          calBtn.className = 'ss-link-btn'
          calBtn.textContent = '📅 查看七天风物日历'
          calBtn.onclick = () => requestOpenApp({ appId: 'chronicle', tab: 'calendar' })
          hero.append(calBtn)
          panel.append(hero)

          for (const label of ['区域', '地点', '细节'] as const) {
            const card = text('article', 'ss-card', '')
            card.append(text('small', 'ss-muted', label), text('p', '', state.位置[label] || '暂未留笔'))
            panel.append(card)
          }
          if (!Object.keys(snapshot.raw).length) empty()

          if (isLocal) {
            const editor = document.createElement('details')
            editor.className = 'ss-quick-edit'
            const sum = document.createElement('summary')
            sum.textContent = '✏️ 手动校准时空与地点'
            const iso = formatIsoDateFromTime(state.时间)
            const dateF = makeInputField('故事日期', iso, 'date')
            const showF = makeInputField('时间展示', state.时间.显示, 'text', '如：深秋傍晚 18:20')
            const regionF = makeInputField('所在区域', state.位置.区域, 'text', '如：下城区·码头街')
            const placeF = makeInputField('具体地点', state.位置.地点, 'text', '如：白鸥酒馆二楼')
            const detailF = makeInputField('环境细节', state.位置.细节, 'text', '如：炉火正旺，窗外小雨')
            const saveBtn = document.createElement('button')
            saveBtn.type = 'button'
            saveBtn.className = 'ss-primary-btn'
            saveBtn.textContent = '保存时空记录'
            saveBtn.onclick = () => {
              const nextIso = dateF.input.value.trim(), nextShow = showF.input.value.trim()
              const location = { 区域: regionF.input.value.trim(), 地点: placeF.input.value.trim(), 细节: detailF.input.value.trim() }
              void mutateLocal(working => {
                const tObj = (working.时间 && typeof working.时间 === 'object' ? working.时间 : {}) as Record<string, unknown>
                const prevIso = formatIsoDateFromTime(state.时间)
                if (/^\d{4}-\d{2}-\d{2}$/.test(nextIso)) {
                  const [y, m, d] = nextIso.split('-').map(Number)
                  tObj.年 = y; tObj.月 = m; tObj.日 = d
                  tObj.星期 = '日一二三四五六'[new Date(y, m - 1, d).getDay()]
                } else if (!nextIso) {
                  tObj.年 = 0; tObj.月 = 0; tObj.日 = 0; tObj.星期 = ''
                }
                // 若修改了日期但未改旧的「时间展示」文本，自动清空旧文本让新年月日生效
                tObj.显示 = nextIso !== prevIso && nextShow === state.时间.显示 ? '' : nextShow
                working.时间 = tObj
                working.位置 = {
                  ...(working.位置 && typeof working.位置 === 'object' ? working.位置 as Record<string, unknown> : {}),
                  ...location,
                }
              }, '时空坐标已校准')
            }
            editor.append(sum, dateF.wrap, showF.wrap, regionF.wrap, placeF.wrap, detailF.wrap, saveBtn)
            panel.append(editor)
          }
        }

        if (selected === 1) {
          if (!state.任务.length) empty()
          state.任务.slice().reverse().forEach(quest => {
            const card = text('article', 'ss-card ss-quest', '')
            card.dataset.status = quest.状态
            card.append(
              text('small', 'ss-muted', [quest.状态, quest.时间].filter(Boolean).join(' · ')),
              text('h3', '', quest.标题),
              text('p', '', quest.描述),
            )
            if (quest.奖励) card.append(text('p', 'ss-reward', `🎁 ${quest.奖励}`))
            const actions = text('div', 'ss-card-actions', '')
            actions.append(draftButton('推进', questDraft(quest)))
            if (isLocal) {
              const cycleBtn = document.createElement('button')
              cycleBtn.type = 'button'
              cycleBtn.className = 'ss-ghost-btn'
              const nextStatus = quest.状态 === '进行中' ? '完成' : quest.状态 === '完成' ? '失败' : '进行中'
              cycleBtn.textContent = `标为${nextStatus}`
              cycleBtn.onclick = () => {
                void mutateLocal(working => {
                  const list = Array.isArray(working.任务) ? working.任务 as Array<Record<string, unknown>> : []
                  const idx = localRowIndex(list, quest.id, '标题', quest.标题)
                  if (list[idx]) list[idx].状态 = nextStatus
                }, `委托「${quest.标题}」已标为${nextStatus}`)
              }
              const delBtn = document.createElement('button')
              delBtn.type = 'button'
              delBtn.className = 'ss-ghost-btn'
              delBtn.textContent = '移除'
              delBtn.onclick = () => {
                void mutateLocal(working => {
                  const list = Array.isArray(working.任务) ? [...(working.任务 as Array<Record<string, unknown>>)] : []
                  const idx = localRowIndex(list, quest.id, '标题', quest.标题)
                  list.splice(idx, 1)
                  working.任务 = list
                }, `已移除委托「${quest.标题}」`)
              }
              actions.append(cycleBtn, delBtn)
            }
            card.append(actions)
            panel.append(card)
          })

          if (isLocal) {
            const adder = document.createElement('details')
            adder.className = 'ss-quick-edit'
            const sum = document.createElement('summary')
            sum.textContent = '➕ 记下一桩新委托'
            const titleF = makeInputField('委托标题', '', 'text', '如：替酒保送一封密信')
            const descF = makeInputField('线索说明', '', 'text', '如：午夜前送到钟楼下')
            const rewardF = makeInputField('约定报酬', '', 'text', '如：两枚银币与旧钥匙')
            const addBtn = document.createElement('button')
            addBtn.type = 'button'
            addBtn.className = 'ss-primary-btn'
            addBtn.textContent = '记入任务栏'
            addBtn.onclick = () => {
              const titleVal = titleF.input.value.trim()
              if (!titleVal) { status.textContent = '请先填写委托标题。'; return }
              const description = descF.input.value.trim(), reward = rewardF.input.value.trim()
              void mutateLocal(working => {
                const list = Array.isArray(working.任务) ? [...(working.任务 as unknown[])] : []
                list.push({ id: safeRandomId(), 标题: titleVal, 描述: description, 状态: '进行中', 时间: formatTime(state.时间) === '尚未记录' ? '' : formatTime(state.时间), 奖励: reward })
                working.任务 = list
              }, `记下新委托：${titleVal}`)
            }
            adder.append(sum, titleF.wrap, descF.wrap, rewardF.wrap, addBtn)
            panel.append(adder)
          }
        }

        if (selected === 2) {
          if (!state.背包.length) empty()
          state.背包.forEach(item => {
            const card = text('article', 'ss-card ss-item', '')
            card.dataset.rarity = item.稀有度
            card.append(text('h3', '', item.名称), text('small', 'ss-muted', `×${item.数量} · ${item.稀有度}`), text('p', '', item.描述))
            const actions = text('div', 'ss-card-actions', '')
            actions.append(draftButton('使用', itemDraft(item)))
            if (isLocal) {
              const minus = document.createElement('button')
              minus.type = 'button'
              minus.className = 'ss-step-btn'
              minus.textContent = '−1'
              minus.title = '减少 1 个'
              minus.onclick = () => {
                void mutateLocal(working => {
                  const list = Array.isArray(working.背包)
                    ? [...(working.背包 as Array<Record<string, unknown>>)]
                    : Object.values(working.背包 as Record<string, Record<string, unknown>> ?? {})
                  const idx = localRowIndex(list, item.id, '名称', item.名称)
                  const nextQty = Math.max(0, (Number(list[idx].数量) || 1) - 1)
                  if (nextQty === 0) list.splice(idx, 1)
                  else list[idx] = { ...list[idx], 数量: nextQty }
                  working.背包 = list
                }, `${item.名称} 数量已调整`)
              }
              const plus = document.createElement('button')
              plus.type = 'button'
              plus.className = 'ss-step-btn'
              plus.textContent = '+1'
              plus.title = '增加 1 个'
              plus.onclick = () => {
                void mutateLocal(working => {
                  const list = Array.isArray(working.背包)
                    ? [...(working.背包 as Array<Record<string, unknown>>)]
                    : Object.values(working.背包 as Record<string, Record<string, unknown>> ?? {})
                  const idx = localRowIndex(list, item.id, '名称', item.名称)
                  list[idx] = { ...list[idx], 数量: (Number(list[idx].数量) || 0) + 1 }
                  working.背包 = list
                }, `${item.名称} +1`)
              }
              actions.append(minus, plus)
            }
            card.append(actions)
            panel.append(card)
          })

          if (isLocal) {
            const adder = document.createElement('details')
            adder.className = 'ss-quick-edit'
            adder.style.gridColumn = '1 / -1'
            const sum = document.createElement('summary')
            sum.textContent = '➕ 收纳新物品到行囊'
            const nameF = makeInputField('物品名称', '', 'text', '如：褪色怀表')
            const qtyF = makeInputField('数量', '1', 'number')
            const rarityF = makeInputField('品质', '普通', 'text', '普通 / 稀有 / 史诗 / 传说')
            const descF = makeInputField('来历或效果', '', 'text', '如：表盖内侧刻着一行小字')
            const addBtn = document.createElement('button')
            addBtn.type = 'button'
            addBtn.className = 'ss-primary-btn'
            addBtn.textContent = '放入行囊'
            addBtn.onclick = () => {
              const nameVal = nameF.input.value.trim()
              if (!nameVal) { status.textContent = '请先填写物品名称。'; return }
              const qtyVal = Math.max(1, Math.round(Number(qtyF.input.value) || 1))
              const description = descF.input.value.trim(), rarity = rarityF.input.value.trim() || '普通'
              void mutateLocal(working => {
                const list = Array.isArray(working.背包)
                  ? [...(working.背包 as unknown[])]
                  : Object.values(working.背包 as Record<string, unknown> ?? {})
                list.push({ id: safeRandomId(), 名称: nameVal, 数量: qtyVal, 描述: description, 稀有度: rarity })
                working.背包 = list
              }, `收纳了 ${nameVal} ×${qtyVal}`)
            }
            adder.append(sum, nameF.wrap, qtyF.wrap, rarityF.wrap, descF.wrap, addBtn)
            panel.append(adder)
          }
        }

        if (selected === 3) {
          if (!state.技能.length) empty()
          state.技能.forEach(skill => {
            const card = text('article', 'ss-card', ''), progress = document.createElement('progress')
            progress.max = 100
            progress.value = skill.熟练度
            progress.setAttribute('aria-label', `${skill.名称}熟练度`)
            const actions = text('div', 'ss-card-actions', '')
            actions.append(draftButton('发动', skillDraft(skill)))
            if (isLocal) {
              const delBtn = document.createElement('button')
              delBtn.type = 'button'
              delBtn.className = 'ss-ghost-btn'
              delBtn.textContent = '移除'
              delBtn.onclick = () => {
                void mutateLocal(working => {
                  const list = Array.isArray(working.技能)
                    ? [...(working.技能 as Array<Record<string, unknown>>)]
                    : Object.values(working.技能 as Record<string, Record<string, unknown>> ?? {})
                  const idx = localRowIndex(list, skill.id, '名称', skill.名称)
                  list.splice(idx, 1)
                  working.技能 = list
                }, `已移除能力「${skill.名称}」`)
              }
              actions.append(delBtn)
            }
            card.append(
              text('h3', '', `${skill.名称} · Lv.${skill.等级}`),
              text('small', 'ss-muted', `${skill.类型} · 熟练度 ${skill.熟练度}%`),
              progress,
              text('p', '', skill.描述),
              actions,
            )
            panel.append(card)
          })

          if (isLocal) {
            const adder = document.createElement('details')
            adder.className = 'ss-quick-edit'
            const sum = document.createElement('summary')
            sum.textContent = '➕ 记下一项新能力'
            const nameF = makeInputField('能力名称', '', 'text', '如：察言观色 / 冰霜法印')
            const typeF = makeInputField('类别', '特长', 'text', '如：法术 / 武技 / 社交')
            const lvlF = makeInputField('等级', '1', 'number')
            const profF = makeInputField('熟练度 (%)', '20', 'number')
            const descF = makeInputField('效果说明', '', 'text', '如：更容易听出对方话里的弦外之音')
            const addBtn = document.createElement('button')
            addBtn.type = 'button'
            addBtn.className = 'ss-primary-btn'
            addBtn.textContent = '记入能力栏'
            addBtn.onclick = () => {
              const nameVal = nameF.input.value.trim()
              if (!nameVal) { status.textContent = '请先填写能力名称。'; return }
              const lvlVal = Math.max(1, Math.round(Number(lvlF.input.value) || 1))
              const profVal = Math.max(0, Math.min(100, Math.round(Number(profF.input.value) || 0)))
              const type = typeF.input.value.trim() || '特长', description = descF.input.value.trim()
              void mutateLocal(working => {
                const list = Array.isArray(working.技能)
                  ? [...(working.技能 as unknown[])]
                  : Object.values(working.技能 as Record<string, unknown> ?? {})
                list.push({ id: safeRandomId(), 名称: nameVal, 类型: type, 等级: lvlVal, 熟练度: profVal, 描述: description })
                working.技能 = list
              }, `记下新能力：${nameVal}`)
            }
            adder.append(sum, nameF.wrap, typeF.wrap, lvlF.wrap, profF.wrap, descF.wrap, addBtn)
            panel.append(adder)
          }
        }
      }

      async function load() {
        const request = ++loadId, key = storyIdentity(ctx)
        if (snapshot?.key !== storyIdentity(ctx)) { snapshot = undefined; render() }
        try {
          const next = await readStoryState(ctx)
          if (!alive || request !== loadId) return
          snapshot = next
          loadError = ''
        } catch (error) {
          if (!alive || request !== loadId) return
          if (key !== storyIdentity(ctx) || isStorySwitchedError(error)) { void load(); return }; loadError = (error as Error).message
        }
        render()
      }

      const offSync = sync.subscribe(() => { render(); if (!sync.status().busy) void load() })
      const offVars = subscribeVarEvents(() => { void load() })
      const offChange = ctx.onCharacterChanged(() => { edits.invalidate(); void load() })
      render()
      void load()
      cleanup = () => {
        alive = false
        edits.dispose()
        offSync()
        offVars()
        offChange()
        for (const timer of timers) clearTimeout(timer)
        composer.dispose()
        root.remove()
      }
    },
    unmount() { cleanup?.(); cleanup = undefined },
  }
}
