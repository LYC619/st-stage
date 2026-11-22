import type { PhoneApp, PhoneAppContext } from '../../../../core/phone-registry'
import { getPackCover } from '../../../../core/types'
import { foldSection, toggleRow } from '../widgets'
import { storyIdentity } from '../wechat/memory'
import { resolveCharacterAvatarUrl } from '../wechat/bridge'
import type { WeChatAppData } from '../wechat/types'
import { createComposerBridge } from '../renderer/composer'
import { getStoryAiConfig, renderStoryAiSetupCard } from '../shared/story-ai'
import { clearAppBadge, consumeAppDeepLink, requestOpenApp } from '../shared/story-events'
import { createTheaterController } from './controller'
import { readTheaterData, saveTheaterStory } from './generate'
import { diaryCard } from './diary'
import type { TheaterChannel, TheaterStory } from './types'

function text(tag: string, className: string, value: string): HTMLElement {
  const node = document.createElement(tag); node.className = className; node.textContent = value; return node
}

function color(value: string): string {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return ['#7850a0', '#26766f', '#a24c3c', '#466fa1'][Math.abs(hash) % 4]
}

const TAB_CHANNELS: ReadonlyArray<Exclude<TheaterChannel, 'all'>> = ['square', 'forum', 'live', 'diary']

function resolveRoleAvatar(ctx: PhoneAppContext, roleName: string): string {
  const clean = roleName.trim()
  if (!clean) return ''
  const settings = ctx.getSettings()
  const packs = Array.isArray(settings?.packs) ? settings.packs : []
  const matchedPack = packs.find(p => p.roleName?.trim() === clean || p.name.trim() === clean)
  if (matchedPack) {
    const cover = getPackCover(matchedPack)
    if (cover?.url) return cover.url
  }
  const wechat = settings?.apps?.['wechat-sister'] as WeChatAppData | undefined
  const contacts = Object.values(wechat?.contacts ?? {})
  const contact = contacts.find(c => c.name.trim() === clean)
  if (contact?.avatar || contact?.card?.avatar) {
    return resolveCharacterAvatarUrl(contact.avatar ?? contact.card?.avatar) ?? ""
  }
  return ''
}

export function createTheaterApp(): PhoneApp {
  let controller: ReturnType<typeof createTheaterController>
  let cleanup: (() => void) | undefined
  return {
    id: 'theater',
    name: '小剧场',
    icon: '🎪',
    order: 26,
    fullbleed: true,
    setup(host) {
      controller = createTheaterController(host)
      return () => controller.destroy()
    },
    mount(container, ctx) {
      clearAppBadge('theater')
      const deepLink = consumeAppDeepLink('theater')
      let selected = deepLink?.tab ? Math.max(0, TAB_CHANNELS.indexOf(deepLink.tab as Exclude<TheaterChannel, 'all'>)) : 0
      let paused = false
      let diaryRoleFilter = deepLink?.role || ''
      let diaryDateFilter = deepLink?.date || ''
      const composer = createComposerBridge()

      const root = text('div', 'th-root', '')
      const header = text('div', 'th-header', '')
      const headerActions = text('div', 'th-header-actions', '')

      const refresh = document.createElement('button')
      refresh.type = 'button'
      refresh.className = 'th-primary-btn'
      refresh.onclick = () => {
        if (controller.status().busy) controller.cancel()
        else void controller.trigger(true, 'all')
      }

      const refreshTab = document.createElement('button')
      refreshTab.type = 'button'
      refreshTab.className = 'th-ghost-btn'
      refreshTab.title = '只重刷当前频道'
      refreshTab.onclick = () => {
        if (controller.status().busy) return
        if (selected === 3) diaryDateFilter = ''
        void controller.trigger(true, TAB_CHANNELS[selected])
      }

      headerActions.append(refreshTab, refresh)
      header.append(text('strong', '', '小剧场'), headerActions)

      const tabs = text('div', 'th-tabs', '')
      tabs.setAttribute('role', 'tablist')
      tabs.setAttribute('aria-label', '小剧场频道')

      const panel = text('div', 'th-panel', '')
      panel.id = 'th-panel'
      panel.setAttribute('role', 'tabpanel')
      panel.tabIndex = 0

      const buttons = ['广场', '论坛', '直播', '日记'].map((label, index) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = label
        button.id = `th-tab-${index}`
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

      const status = text('div', 'th-status', '')
      status.setAttribute('role', 'status')
      const retry = document.createElement('button')
      retry.type = 'button'
      retry.className = 'th-retry-btn'
      retry.textContent = '重试'
      retry.onclick = () => { void controller.trigger(true, 'all') }

      const settings = foldSection('设置', false, 'theater-settings')
      const autoToggle = toggleRow('后台自动生成（每 5 分钟最多一次）', readTheaterData(ctx).autoGenerate, enabled => {
        ctx.setAppData({ ...readTheaterData(ctx), autoGenerate: enabled })
        if (!enabled) controller.cancel()
      })
      const aiHubSlot = text('div', 'th-ai-slot', '')
      settings.body.append(autoToggle, aiHubSlot)

      root.append(header, tabs, status, retry, panel, settings.box)
      container.append(root)

      function updateCurrentStory(mutator: (story: TheaterStory) => void) {
        const key = storyIdentity(ctx)
        const data = readTheaterData(ctx)
        const current = data.stories[key]
        if (!current) return
        const clone: TheaterStory = structuredClone(current)
        mutator(clone)
        ctx.setAppData(saveTheaterStory(data, key, clone))
        render()
      }

      function sendRpHook(draftText: string) {
        const res = composer.appendDraft(draftText)
        if (res.ok) {
          status.textContent = '已将话题记入聊天输入框，随时可发送。'
          ctx.toast?.('info', '已写入聊天输入框')
        } else {
          status.textContent = res.error
        }
      }

      function render() {
        const state = controller.status()
        const connected = !!getStoryAiConfig(ctx)
        refresh.textContent = state.busy ? '生成中… · 取消' : '刷新'
        refresh.disabled = !connected && !state.busy
        refreshTab.textContent = '重刷本栏'
        refreshTab.hidden = !connected || state.busy
        status.textContent = connected
          ? state.error
          : '请先在微信设置里连接 AI，或在下方「设置」中直接填写接口。'
        retry.hidden = !connected || !state.error || state.busy

        aiHubSlot.replaceChildren(renderStoryAiSetupCard(ctx, render))

        buttons.forEach((button, index) => {
          button.setAttribute('aria-selected', String(index === selected))
          button.tabIndex = index === selected ? 0 : -1
        })
        panel.setAttribute('aria-labelledby', buttons[selected].id)
        panel.replaceChildren()

        const story = readTheaterData(ctx).stories[storyIdentity(ctx)]
        if (!story || (selected === 0 ? !story.square.length : selected === 1 ? !story.forum.length : selected === 2 ? !story.live : !story.diary.length)) {
          panel.append(text('p', 'th-empty', '这里还没有内容。点右上角「刷新」看看酒馆外大家都在聊什么。'))
          return
        }

        if (selected === 0) {
          story.square.forEach((post, postIdx) => {
            const card = text('article', `th-card${post.pinned ? ' is-pinned' : ''}`, '')
            const author = text('div', 'th-author', '')
            const avatarUrl = resolveRoleAvatar(ctx, post.author)
            if (avatarUrl) {
              const img = document.createElement('img')
              img.className = 'th-avatar-img'
              img.src = avatarUrl
              img.alt = post.author
              author.append(img)
            } else {
              const badge = text('span', 'th-avatar', post.author.slice(0, 1))
              badge.style.background = color(post.author)
              author.append(badge)
            }
            author.append(text('strong', '', post.author))
            if (post.tag) author.append(text('span', 'th-muted th-role-tag', post.tag))
            card.append(author)
            if (post.time) card.append(text('small', 'th-muted', post.time))
            card.append(text('p', 'th-copy', post.text))
            if (post.topics.length) card.append(text('div', 'th-topics', post.topics.map(t => '#' + t).join(' ')))
            if (post.comments.length) {
              const comments = text('div', 'th-comments', '')
              for (const comment of post.comments) comments.append(text('p', '', `${comment.name}：${comment.text}`))
              card.append(comments)
            }
            const foot = text('div', 'th-card-foot', '')
            foot.append(text('small', 'th-muted', post.stats))
            const bar = text('div', 'th-card-actions', '')
            const likeBtn = document.createElement('button')
            likeBtn.type = 'button'
            likeBtn.className = `th-action-btn${post.liked ? ' is-active' : ''}`
            likeBtn.textContent = post.liked ? '♥ 已赞' : '♡ 点赞'
            likeBtn.onclick = () => updateCurrentStory(s => { if (s.square[postIdx]) s.square[postIdx].liked = !s.square[postIdx].liked })

            const pinBtn = document.createElement('button')
            pinBtn.type = 'button'
            pinBtn.className = `th-action-btn${post.pinned ? ' is-active' : ''}`
            pinBtn.textContent = post.pinned ? '📌 已收藏' : '📌 收藏'
            pinBtn.onclick = () => updateCurrentStory(s => { if (s.square[postIdx]) s.square[postIdx].pinned = !s.square[postIdx].pinned })

            const shareBtn = document.createElement('button')
            shareBtn.type = 'button'
            shareBtn.className = 'th-action-btn'
            shareBtn.textContent = '📲 拿给 TA 看'
            shareBtn.onclick = () => sendRpHook(`把手机屏幕转向对方，指了指广场上${post.author}刚发的动态：“你看这条——”`)

            bar.append(likeBtn, pinBtn, shareBtn)
            foot.append(bar)
            card.append(foot)
            panel.append(card)
          })
        }

        if (selected === 1) {
          story.forum.forEach((post, postIdx) => {
            const card = text('article', `th-card th-forum${post.pinned ? ' is-pinned' : ''}`, '')
            card.style.borderTopColor = color(post.title)
            card.append(text('small', 'th-muted', post.board), text('h3', '', post.title), text('p', 'th-copy', post.text))
            const tags = text('div', 'th-tags', '')
            for (const tag of post.tags) tags.append(text('span', '', tag))
            card.append(tags, text('small', 'th-muted', [post.user, post.heat].filter(Boolean).join(' · ')))
            if (post.comments.length) {
              const comments = text('div', 'th-comments', '')
              post.comments.forEach((comment, index) => comments.append(text('p', '', `${index + 1} 楼 · ${comment}`)))
              card.append(comments)
            }
            const bar = text('div', 'th-card-actions', '')
            const pinBtn = document.createElement('button')
            pinBtn.type = 'button'
            pinBtn.className = `th-action-btn${post.pinned ? ' is-active' : ''}`
            pinBtn.textContent = post.pinned ? '📌 已收藏' : '📌 收藏'
            pinBtn.onclick = () => updateCurrentStory(s => { if (s.forum[postIdx]) s.forum[postIdx].pinned = !s.forum[postIdx].pinned })

            const talkBtn = document.createElement('button')
            talkBtn.type = 'button'
            talkBtn.className = 'th-action-btn'
            talkBtn.textContent = '📲 聊起热帖'
            talkBtn.onclick = () => sendRpHook(`随口提起论坛【${post.board || '闲聊'}】版上的热帖《${post.title}》，想听听对方怎么看。`)

            bar.append(pinBtn, talkBtn)
            card.append(bar)
            panel.append(card)
          })
        }

        if (selected === 3) {
          const roles = [...new Set(story.diary.map(item => item.role))]
          const dates = [...new Set(story.diary.map(item => item.date).filter(Boolean))]
          if (roles.length > 1 || dates.length > 1 || diaryDateFilter || diaryRoleFilter) {
            const filterBar = text('div', 'th-filter-bar', '')
            const allRoleBtn = document.createElement('button')
            allRoleBtn.type = 'button'
            allRoleBtn.className = `th-chip-btn${!diaryRoleFilter && !diaryDateFilter ? ' is-active' : ''}`
            allRoleBtn.textContent = '全部手记'
            allRoleBtn.onclick = () => { diaryRoleFilter = ''; diaryDateFilter = ''; render() }
            filterBar.append(allRoleBtn)
            for (const role of roles) {
              const chip = document.createElement('button')
              chip.type = 'button'
              chip.className = `th-chip-btn${diaryRoleFilter === role ? ' is-active' : ''}`
              chip.textContent = role
              chip.onclick = () => { diaryRoleFilter = diaryRoleFilter === role ? '' : role; render() }
              filterBar.append(chip)
            }
            for (const d of dates) {
              const chip = document.createElement('button')
              chip.type = 'button'
              chip.className = `th-chip-btn${diaryDateFilter === d ? ' is-active' : ''}`
              chip.textContent = d
              chip.onclick = () => { diaryDateFilter = diaryDateFilter === d ? '' : d; render() }
              filterBar.append(chip)
            }
            panel.append(filterBar)
          }

          const entries = [...story.diary].reverse().filter(entry =>
            (!diaryRoleFilter || entry.role === diaryRoleFilter) &&
            (!diaryDateFilter || entry.date === diaryDateFilter),
          )
          if (!entries.length) {
            panel.append(text('p', 'th-empty', '这天还没有留存的手记，点上方「全部手记」或右上角重刷看看。'))
          }
          for (const entry of entries) {
            panel.append(diaryCard(entry, {
              avatarUrl: resolveRoleAvatar(ctx, entry.role),
              onPrivateChat: (item) => requestOpenApp({ appId: 'wechat-sister', contactName: item.role }),
              onDraftObserve: (item) => sendRpHook(`不动声色地留意了一下${item.role}今天的神色，顺着话头聊起近况。`),
              onTogglePin: (item) => updateCurrentStory(s => {
                const target = s.diary.find(d => d.role === item.role && d.date === item.date)
                if (target) target.pinned = !target.pinned
              }),
            }))
          }
        }

        if (selected === 2 && story.live) {
          const live = story.live
          const card = text('article', 'th-card th-live', '')
          card.append(
            text('small', 'th-muted', live.room),
            text('h3', '', live.title),
            text('strong', '', live.cast),
            text('p', 'th-copy', live.summary),
            text('small', 'th-muted', live.stats),
          )
          const wall = text('div', 'th-danmaku', '')
          const track = text('div', 'th-danmaku-track', '')
          track.style.animationPlayState = paused ? 'paused' : 'running'
          for (const item of live.danmaku) {
            const line = text('p', '', item.fan ? `[${item.fan}] ${item.text}` : item.text)
            line.style.color = color(item.fan || '观众')
            track.append(line)
          }
          wall.append(track)

          const danmakuForm = text('div', 'th-danmaku-send', '')
          const dmInput = document.createElement('input')
          dmInput.type = 'text'
          dmInput.placeholder = '发条弹幕凑热闹…'
          dmInput.setAttribute('aria-label', '发送直播弹幕')
          const dmBtn = document.createElement('button')
          dmBtn.type = 'button'
          dmBtn.textContent = '发弹幕'
          const submitDanmaku = () => {
            const val = dmInput.value.trim()
            if (!val) return
            dmInput.value = ''
            updateCurrentStory(s => {
              if (s.live) s.live.danmaku.unshift({ fan: '我', text: val })
            })
          }
          dmBtn.onclick = submitDanmaku
          dmInput.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); submitDanmaku() } }
          danmakuForm.append(dmInput, dmBtn)

          card.append(
            toggleRow('暂停弹幕滚动', paused, value => {
              paused = value
              track.style.animationPlayState = value ? 'paused' : 'running'
            }),
            wall,
            danmakuForm,
          )
          panel.append(card)
        }
      }

      const off = controller.subscribe(render)
      const offChar = typeof ctx.onCharacterChanged === 'function'
        ? ctx.onCharacterChanged(() => { diaryRoleFilter = ''; diaryDateFilter = ''; render() })
        : () => {}
      render()
      cleanup = () => { off(); offChar(); composer.dispose(); root.remove() }
    },
    unmount() { cleanup?.(); cleanup = undefined },
  }
}
