import type { PhoneApp } from '../../../../core/phone-registry'
import { foldSection, toggleRow } from '../widgets'
import { storyIdentity } from '../wechat/memory'
import { getStoryAiConfig } from '../shared/story-ai'
import { createTheaterController } from './controller'
import { readTheaterData } from './generate'

function text(tag: string, className: string, value: string): HTMLElement {
  const node = document.createElement(tag); node.className = className; node.textContent = value; return node
}
function color(value: string): string {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return ['#7850a0', '#26766f', '#a24c3c', '#466fa1'][Math.abs(hash) % 4]
}

export function createTheaterApp(): PhoneApp {
  let controller: ReturnType<typeof createTheaterController>
  let cleanup: (() => void) | undefined
  return {
    id: 'theater', name: '小剧场', icon: '🎭', order: 26,
    setup(host) { controller = createTheaterController(host); return () => controller.destroy() },
    mount(container, ctx) {
      let selected = 0, paused = false
      const root = text('div', 'th-root', ''), header = text('div', 'th-header', '')
      const refresh = document.createElement('button'); refresh.type = 'button'
      refresh.onclick = () => { if (controller.status().busy) controller.cancel(); else void controller.trigger(true) }
      header.append(text('strong', '', '小剧场'), refresh)
      const tabs = text('div', 'th-tabs', ''); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '小剧场频道')
      const panel = text('div', 'th-panel', ''); panel.id = 'th-panel'; panel.setAttribute('role', 'tabpanel'); panel.tabIndex = 0
      const buttons = ['广场', '论坛', '直播'].map((label, index) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label
        button.id = `th-tab-${index}`; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id)
        button.onclick = () => { selected = index; render() }
        button.onkeydown = event => {
          const target = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : undefined
          if (target === undefined) return
          event.preventDefault(); event.stopPropagation(); selected = target; render(); buttons[target].focus()
        }
        tabs.append(button); return button
      })
      const status = text('div', 'th-status', ''); status.setAttribute('role', 'status')
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '重试'; retry.onclick = () => { void controller.trigger(true) }
      const settings = foldSection('设置', false, 'theater-settings')
      settings.body.append(toggleRow('后台自动生成（每 5 分钟最多一次）', readTheaterData(ctx).autoGenerate, enabled => {
        ctx.setAppData({ ...readTheaterData(ctx), autoGenerate: enabled }); if (!enabled) controller.cancel()
      }))
      root.append(header, tabs, status, retry, panel, settings.box); container.append(root)
      function render() {
        const state = controller.status(), connected = !!getStoryAiConfig(ctx)
        refresh.textContent = state.busy ? '生成中… · 取消' : '刷新'; refresh.disabled = !connected
        status.textContent = connected ? state.error : '请先在微信设置里连接 AI。返回主屏 → 微信 → 设置 → AI 连接。'
        retry.hidden = !connected || !state.error || state.busy
        buttons.forEach((button, index) => { button.setAttribute('aria-selected', String(index === selected)); button.tabIndex = index === selected ? 0 : -1 })
        panel.setAttribute('aria-labelledby', buttons[selected].id); panel.replaceChildren()
        const story = readTheaterData(ctx).stories[storyIdentity(ctx)]
        if (!story || (selected === 0 ? !story.square.length : selected === 1 ? !story.forum.length : !story.live)) {
          panel.append(text('p', 'th-empty', '这里还没有内容。刷新生成当前剧情的小剧场。')); return
        }
        if (selected === 0) for (const post of story.square) {
          const card = text('article', 'th-card', ''), author = text('div', 'th-author', '')
          author.append(text('span', 'th-avatar', post.author.slice(0, 1)), text('strong', '', post.author), text('span', 'th-muted', post.tag))
          card.append(author, text('small', 'th-muted', post.time), text('p', 'th-copy', post.text), text('div', 'th-topics', post.topics.map(t => '#' + t).join(' ')))
          const comments = text('div', 'th-comments', '')
          for (const comment of post.comments) comments.append(text('p', '', `${comment.name}：${comment.text}`))
          card.append(comments, text('small', 'th-muted', post.stats)); panel.append(card)
        }
        if (selected === 1) for (const post of story.forum) {
          const card = text('article', 'th-card th-forum', ''); card.style.borderTopColor = color(post.title)
          card.append(text('small', 'th-muted', post.board), text('h3', '', post.title), text('p', 'th-copy', post.text))
          const tags = text('div', 'th-tags', ''); for (const tag of post.tags) tags.append(text('span', '', tag))
          card.append(tags, text('small', 'th-muted', `${post.user} · ${post.heat}`))
          const comments = text('div', 'th-comments', '')
          post.comments.forEach((comment, index) => comments.append(text('p', '', `${index + 1} 楼 · ${comment}`)))
          card.append(comments); panel.append(card)
        }
        if (selected === 2 && story.live) {
          const live = story.live, card = text('article', 'th-card th-live', '')
          card.append(text('small', 'th-muted', live.room), text('h3', '', live.title), text('strong', '', live.cast), text('p', 'th-copy', live.summary), text('small', 'th-muted', live.stats))
          const wall = text('div', 'th-danmaku', '')
          const track = text('div', 'th-danmaku-track', ''); track.style.animationPlayState = paused ? 'paused' : 'running'
          for (const item of live.danmaku) { const line = text('p', '', `[${item.fan}] ${item.text}`); line.style.color = color(item.fan); track.append(line) }
          wall.append(track)
          card.append(toggleRow('暂停弹幕滚动', paused, value => { paused = value; track.style.animationPlayState = value ? 'paused' : 'running' }), wall)
          panel.append(card)
        }
      }
      const off = controller.subscribe(render); render()
      cleanup = () => { off(); root.remove() }
    },
    unmount() { cleanup?.(); cleanup = undefined },
  }
}
