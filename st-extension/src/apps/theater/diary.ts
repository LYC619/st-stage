// Rules and presentation adapted from 玉子手机 tables/sources/小剧场2.1/06-小日记表.md and modules/phone-theater/scenes/diary.js.
import type { DiaryEntry } from './types'

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

export function mergeDiary(previous: DiaryEntry[], incoming: DiaryEntry[]): DiaryEntry[] {
  const date = incoming[0]?.date
  const rows = new Map((date && previous[0]?.date === date ? previous : []).map(entry => [entry.role, entry]))
  for (const entry of incoming) rows.set(entry.role, entry)
  return [...rows.values()].slice(-5)
}

function inline(parent: HTMLElement, value: string) {
  let cursor = 0
  for (const match of value.matchAll(/~~([\s\S]*?)~~/g)) {
    parent.append(document.createTextNode(value.slice(cursor, match.index)))
    const strike = document.createElement('del'); strike.textContent = match[1]; parent.append(strike)
    cursor = match.index + match[0].length
  }
  parent.append(document.createTextNode(value.slice(cursor)))
}

export function diaryCard(entry: DiaryEntry): HTMLElement {
  const card = document.createElement('article'); card.className = 'th-card th-diary'
  const title = document.createElement('h3'); title.textContent = entry.role
  const date = document.createElement('small'); date.className = 'th-muted'; date.textContent = entry.date
  card.append(date, title)
  const footer = document.createElement('footer')
  const sections = entry.content.replace(/\r\n?/g, '\n').split(/(?=(?:^|\s)P{1,2}S\s*[:：])/i)
  for (const section of sections) {
    const value = section.trim()
    if (!value) continue
    const paragraph = document.createElement('p'); paragraph.className = 'th-copy'; inline(paragraph, value)
    if (/^P{1,2}S\s*[:：]/i.test(value)) footer.append(paragraph)
    else card.append(paragraph)
  }
  if (footer.childElementCount) card.append(footer)
  return card
}
