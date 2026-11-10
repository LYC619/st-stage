import type { PhoneApp } from '../../../../core/phone-registry'
import { foldSection, numberRow, toggleRow } from '../widgets'
import { subscribeVarEvents } from '../mvu/bridge'
import { createComposerBridge } from '../renderer/composer'
import { getStoryAiConfig } from '../shared/story-ai'
import { storyIdentity } from '../wechat/memory'
import { formatTime, readStoryState, readSyncSettings, type StoryStateSnapshot } from './store'
import { createStorySync } from './sync'
import { itemDraft, skillDraft } from './drafts'

function text(tag: string, className: string, value: string): HTMLElement {
  const node = document.createElement(tag); node.className = className; node.textContent = value; return node
}

export function createStoryStateApp(): PhoneApp {
  let sync: ReturnType<typeof createStorySync>, cleanup: (() => void) | undefined
  return {
    id: 'story-state', name: '剧情状态', icon: '🎒', order: 27,
    setup(host) { sync = createStorySync(host); return () => sync.destroy() },
    mount(container, ctx) {
      let selected = 0, snapshot: StoryStateSnapshot | undefined, alive = true, loadId = 0, loadError = ''
      const composer = createComposerBridge(), timers = new Set<ReturnType<typeof setTimeout>>()
      const root = text('div', 'ss-root', ''), tabs = text('div', 'ss-tabs', ''), panel = text('div', 'ss-panel', '')
      tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '剧情状态分类')
      panel.id = 'ss-panel'; panel.setAttribute('role', 'tabpanel'); panel.tabIndex = 0
      const buttons = ['时空', '任务', '背包', '能力'].map((name, index) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = name
        button.id = `ss-tab-${index}`; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id)
        button.onclick = () => { selected = index; render() }
        button.onkeydown = event => {
          const target = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : undefined
          if (target === undefined) return
          event.preventDefault(); event.stopPropagation(); selected = target; render(); buttons[target].focus()
        }
        tabs.append(button); return button
      })
      const status = text('p', 'ss-status', ''); status.setAttribute('role', 'status')
      const source = text('small', 'ss-source', ''), settings = foldSection('设置', false, 'story-state-settings'), config = readSyncSettings(ctx)
      settings.body.append(toggleRow('后台自动整理', config.autoSync, value => {
        ctx.setAppData({ ...readSyncSettings(ctx), autoSync: value }); if (!value) sync.cancel()
      }), numberRow('读取最近消息条数', config.contextMessages, 1, 60, value => { ctx.setAppData({ ...readSyncSettings(ctx), contextMessages: value }) }))
      if (!getStoryAiConfig(ctx)) settings.body.append(text('p', 'ss-muted', '请先在微信设置里连接 AI'))
      root.append(tabs, status, panel, settings.box, source); container.append(root)
      function draftButton(label: string, draft: string): HTMLButtonElement {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label
        button.onclick = () => {
          const result = composer.insertDraft(draft)
          if (!result.ok) { status.textContent = result.error; return }
          button.textContent = '已填入'
          const timer = setTimeout(() => { timers.delete(timer); button.textContent = label }, 1500); timers.add(timer)
        }
        return button
      }
      function empty() {
        panel.append(text('p', 'ss-empty', '还没有这类状态。MVU 卡可让 AI 在 stat_data 中记录「时间」「位置」「任务」「背包」「技能」。普通卡可在设置里打开「后台自动整理」。'))
      }
      function render() {
        const current = sync.status()
        status.textContent = loadError || current.error || (current.busy ? '正在后台整理…' : '')
        buttons.forEach((button, index) => { button.setAttribute('aria-selected', String(selected === index)); button.tabIndex = selected === index ? 0 : -1 })
        panel.setAttribute('aria-labelledby', buttons[selected].id); panel.replaceChildren()
        panel.classList.toggle('ss-inventory', selected === 2)
        if (!snapshot) { source.textContent = ''; return }
        source.textContent = snapshot.backend === 'mvu' ? '来自 MVU 变量' : '本聊天的状态'
        const state = snapshot.state
        if (selected === 0) {
          panel.append(text('div', 'ss-time', formatTime(state.时间)), text('p', 'ss-location', [state.位置.区域, state.位置.地点].filter(Boolean).join(' · ') || '尚未记录地点'))
          for (const label of ['区域', '地点', '细节'] as const) {
            const card = text('article', 'ss-card', ''); card.append(text('small', 'ss-muted', label), text('p', '', state.位置[label] || '尚未记录')); panel.append(card)
          }
          if (!Object.keys(snapshot.raw).length) empty()
        }
        if (selected === 1) {
          if (!state.任务.length) empty()
          for (const quest of [...state.任务].reverse()) {
            const card = text('article', 'ss-card ss-quest', ''); card.dataset.status = quest.状态
            card.append(text('small', 'ss-muted', `${quest.状态} · ${quest.时间}`), text('h3', '', quest.标题), text('p', '', quest.描述))
            if (quest.奖励) card.append(text('p', 'ss-reward', `🎁 ${quest.奖励}`))
            panel.append(card)
          }
        }
        if (selected === 2) {
          if (!state.背包.length) empty()
          for (const item of state.背包) {
            const card = text('article', 'ss-card ss-item', ''); card.dataset.rarity = item.稀有度
            card.append(text('h3', '', item.名称), text('small', 'ss-muted', `×${item.数量} · ${item.稀有度}`), text('p', '', item.描述), draftButton('使用', itemDraft(item))); panel.append(card)
          }
        }
        if (selected === 3) {
          if (!state.技能.length) empty()
          for (const skill of state.技能) {
            const card = text('article', 'ss-card', ''), progress = document.createElement('progress')
            progress.max = 100; progress.value = skill.熟练度; progress.setAttribute('aria-label', `${skill.名称}熟练度`)
            card.append(text('h3', '', `${skill.名称} · Lv.${skill.等级}`), text('small', 'ss-muted', `${skill.类型} · 熟练度 ${skill.熟练度}%`), progress,
              text('p', '', skill.描述), draftButton('发动', skillDraft(skill))); panel.append(card)
          }
        }
      }
      async function load() {
        const request = ++loadId
        if (snapshot?.key !== storyIdentity(ctx)) { snapshot = undefined; render() }
        try {
          const next = await readStoryState(ctx)
          if (!alive || request !== loadId) return
          snapshot = next; loadError = ''
        } catch (error) { if (!alive || request !== loadId) return; loadError = (error as Error).message }
        render()
      }
      const offSync = sync.subscribe(() => { render(); if (!sync.status().busy) void load() })
      const offVars = subscribeVarEvents(() => { void load() }), offChange = ctx.onCharacterChanged(() => { void load() })
      render(); void load()
      cleanup = () => { alive = false; offSync(); offVars(); offChange(); for (const timer of timers) clearTimeout(timer); composer.dispose(); root.remove() }
    },
    unmount() { cleanup?.(); cleanup = undefined },
  }
}
