// Rules and presentation adapted from 玉子手机 tables/sources/小剧场2.1/06-小日记表.md and modules/phone-theater/scenes/diary.js.
import type { DiaryEntry } from './types'

export const MAX_DIARY_ENTRIES = 30

export const DIARY_PROMPT = `日记 diary：记录当前日期下重要 NPC 写下的私人日记，最多5篇，同一角色一篇。只输出 role 和 content，日期由代码填写。
- 角色：写下日记的重要 NPC 名称。只能选择当前剧情中已成立、与主角或当前事件存在足够关联的重要 NPC；不要使用路人、旁白、作者、系统、读者、剧情概括等不具备独立视角的群体。
- 内容：约 200 字，写成该角色当天私下写给自己的日记。第一人称视角，必须贴合人物性格、关系距离、知识边界、处境、口吻和自我欺骗方式；不得全知，不得替剧情总结，不得知道角色没有渠道知道的秘密。
- 日记应从角色本人视角出发，围绕当天的重要事件、对主角的观察与揣测、内心矛盾、后续期待或担忧，以及不愿明说的潜意识暗流展开。
- 可以出现细节化的生活感、语气停顿、嘴硬、逃避、试探、自我安慰或自我否认；不要写成剧情梗概、人物小传、旁白总结或作者解析。
- 可以在正文中少量插入由 ~~ 包裹的内容，表示角色不愿承认、试图压下去的念头、欲望、嫉妒、恐惧或冲动。这类内容应体现角色的隐秘面，让日记更有反转感或趣味，但不要每篇机械使用。
- 结尾可包含 PS: 与 PPS: 两段，用来写角色表面日记之外的隐秘想法。PS/PPS 是日记的精华，必须写出人物最私密、不愿面对的念头，可以与正文自我陈述形成幽默或讽刺的反差。即使是严肃角色，也允许在这里流露出幼稚、慌张、吐槽、自我解嘲或过分脑补等鲜活的另一面，让读者感到“原来他/她还会这样想”。杜绝平淡的附加说明或流水账补充。
- 日记可以提到主角，但只能基于该角色在当天合理看到、听到、经历、猜测或误解的信息。禁止知道主角内心、跨空间知情、跨时间知情、未传播完成的信息、推理式全知补全、通过结果反推全过程、通过后果还原未知细节、未出现场景却掌握现场情况、远程同步剧情认知。
- 每篇日记应体现不同角色的关注点和表达习惯，不要所有角色都用同一种抒情腔或同一种恋爱脑口吻。鼓励在贴合核心性格的前提下，展现放松、自嘲、偏激、中二等隐藏人格切面，突显“私人日记”的真实感和鲜活度。
- 日期不变时，内容要求连贯但也必须保持200字左右。若当前没有足够重要 NPC 或没有足够事件支撑，可以少于 5 篇；不要为了凑满 5 篇生成路人、无关角色或空泛日记。`

function diaryKey(entry: DiaryEntry): string {
  return `${entry.date || '未记日期'}::${entry.role}`
}

/**
 * 跨天归档合并：
 * - 绝不在跨天或单频道空增量时清空旧日记
 * - 同一天同一角色覆写最新心境（保留已珍藏标记），不同日期顺次沉淀
 * - 最多保留 30 篇，优先保护已珍藏（pinned）的篇目
 */
export function mergeDiary(previous: DiaryEntry[], incoming: DiaryEntry[], limit = MAX_DIARY_ENTRIES): DiaryEntry[] {
  const rows = new Map<string, DiaryEntry>()
  for (const entry of previous) rows.set(diaryKey(entry), entry)
  for (const entry of incoming) {
    const key = diaryKey(entry)
    const prior = rows.get(key)
    rows.delete(key)
    rows.set(key, prior ? { ...entry, pinned: prior.pinned } : entry)
  }
  const all = [...rows.values()]
  if (all.length <= limit) return all
  const pinned = all.filter(item => item.pinned)
  const unpinned = all.filter(item => !item.pinned)
  const keepUnpinned = Math.max(0, limit - pinned.length)
  const keptSet = new Set([...pinned.slice(-limit), ...(keepUnpinned ? unpinned.slice(-keepUnpinned) : [])])
  return all.filter(item => keptSet.has(item))
}

function inline(parent: HTMLElement, value: string) {
  let cursor = 0
  for (const match of value.matchAll(/~~([\s\S]*?)~~/g)) {
    parent.append(document.createTextNode(value.slice(cursor, match.index)))
    const strike = document.createElement('del')
    strike.className = 'th-subtext'
    strike.textContent = match[1]
    strike.tabIndex = 0
    strike.setAttribute('role', 'button')
    strike.title = '轻触显影划掉的心声'
    strike.setAttribute('aria-label', '划掉的心声，轻触显影')
    const toggle = (event: Event) => {
      event.stopPropagation()
      strike.classList.toggle('is-revealed')
    }
    strike.addEventListener('click', toggle)
    strike.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        toggle(event)
      }
    })
    parent.append(strike)
    cursor = match.index + match[0].length
  }
  parent.append(document.createTextNode(value.slice(cursor)))
}

export interface DiaryCardActions {
  avatarUrl?: string
  onPrivateChat?: (entry: DiaryEntry) => void
  onDraftObserve?: (entry: DiaryEntry) => void
  onTogglePin?: (entry: DiaryEntry) => void
}

export function diaryCard(entry: DiaryEntry, actions: DiaryCardActions = {}): HTMLElement {
  const card = document.createElement('article')
  card.className = `th-card th-diary${entry.pinned ? ' is-pinned' : ''}`

  const head = document.createElement('div')
  head.className = 'th-diary-head'

  const metaWrap = document.createElement('div')
  metaWrap.className = 'th-diary-meta'
  if (actions.avatarUrl) {
    const img = document.createElement('img')
    img.className = 'th-avatar-img'
    img.src = actions.avatarUrl
    img.alt = entry.role
    metaWrap.append(img)
  }
  const titleWrap = document.createElement('div')
  const date = document.createElement('small')
  date.className = 'th-muted'
  date.textContent = entry.date || '某日夜里'
  const title = document.createElement('h3')
  title.textContent = entry.role
  titleWrap.append(date, title)
  metaWrap.append(titleWrap)
  head.append(metaWrap)
  card.append(head)

  const footer = document.createElement('footer')
  footer.className = 'th-diary-ps'
  const sections = entry.content.replace(/\r\n?/g, '\n').split(/(?=(?:^|\s)P{1,2}S\s*[:：])/i)
  for (const section of sections) {
    const value = section.trim()
    if (!value) continue
    const paragraph = document.createElement('p')
    paragraph.className = 'th-copy'
    inline(paragraph, value)
    if (/^P{1,2}S\s*[:：]/i.test(value)) footer.append(paragraph)
    else card.append(paragraph)
  }
  if (footer.childElementCount) card.append(footer)

  const subtexts = Array.from(card.querySelectorAll<HTMLElement>('del.th-subtext'))
  if (subtexts.length) {
    const revealBtn = document.createElement('button')
    revealBtn.type = 'button'
    revealBtn.className = 'th-chip-btn'
    revealBtn.textContent = '显影心声'
    revealBtn.onclick = () => {
      const allOpen = subtexts.every(node => node.classList.contains('is-revealed'))
      for (const node of subtexts) node.classList.toggle('is-revealed', !allOpen)
      revealBtn.textContent = allOpen ? '显影心声' : '收起心声'
    }
    head.append(revealBtn)
  }

  if (actions.onPrivateChat || actions.onDraftObserve || actions.onTogglePin) {
    const bar = document.createElement('div')
    bar.className = 'th-card-actions'
    if (actions.onPrivateChat) {
      const chatBtn = document.createElement('button')
      chatBtn.type = 'button'
      chatBtn.className = 'th-action-btn'
      chatBtn.textContent = '💬 找 TA 私聊'
      chatBtn.onclick = () => actions.onPrivateChat?.(entry)
      bar.append(chatBtn)
    }
    if (actions.onDraftObserve) {
      const observeBtn = document.createElement('button')
      observeBtn.type = 'button'
      observeBtn.className = 'th-action-btn'
      observeBtn.textContent = '✒️ 留意神色'
      observeBtn.onclick = () => actions.onDraftObserve?.(entry)
      bar.append(observeBtn)
    }
    if (actions.onTogglePin) {
      const pinBtn = document.createElement('button')
      pinBtn.type = 'button'
      pinBtn.className = `th-action-btn${entry.pinned ? ' is-active' : ''}`
      pinBtn.textContent = entry.pinned ? '📌 已珍藏' : '📌 珍藏'
      pinBtn.onclick = () => actions.onTogglePin?.(entry)
      bar.append(pinBtn)
    }
    card.append(bar)
  }

  return card
}
