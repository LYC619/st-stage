/**
 * 标签提取器：从 AI 回复文本中提取 [立绘:xxx] 标签。
 * 容错：全角/半角冒号与括号、标签前后空格、多个标签取最后一个（最贴近结尾情境）。
 */

const TAG_REGEX = /[\[【]\s*立绘\s*[:：]\s*([^\]】]+?)\s*[\]】]/g

/** 提取文本中所有立绘标签（按出现顺序） */
export function extractTags(text: string): string[] {
  const tags: string[] = []
  let match: RegExpExecArray | null
  const regex = new RegExp(TAG_REGEX.source, 'g')
  while ((match = regex.exec(text)) !== null) {
    const tag = match[1].trim()
    if (tag) tags.push(tag)
  }
  return tags
}

/** 提取最后一个立绘标签（通常代表消息末尾的最终情绪），无则返回 null */
export function extractLastTag(text: string): string | null {
  const tags = extractTags(text)
  return tags.length > 0 ? tags[tags.length - 1] : null
}

/** 从文本中移除所有立绘标签（用于「隐藏标签文本」渲染） */
export function stripTags(text: string): string {
  return text.replace(new RegExp(TAG_REGEX.source, 'g'), '').replace(/[ \t]+$/gm, '')
}

/** 检查文本是否含立绘标签 */
export function hasTag(text: string): boolean {
  return new RegExp(TAG_REGEX.source).test(text)
}
