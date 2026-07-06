/**
 * prompt 构建器：根据当前角色可用的立绘标签列表，生成注入的 system prompt。
 */

/** 生成注入 prompt。tags 为空时返回空字符串（不注入）。 */
export function buildInjectionPrompt(tags: string[]): string {
  if (tags.length === 0) return ''
  const list = tags.join('、')
  return [
    '[角色立绘系统]',
    `可用立绘表情：${list}`,
    '请在每次回复的末尾，从上述列表中选择一个最贴合当前情境与角色情绪的标签，',
    '以 [立绘:标签名] 的格式单独标注（例如 [立绘:' + tags[0] + ']）。',
    '只能使用列表中存在的标签，每次回复只标注一个。',
  ].join('\n')
}
