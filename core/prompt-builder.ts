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

/** 分组/图名 地址项（功能②） */
export interface AddressEntry {
  group: string
  tag: string
}

/**
 * 多角色/分组模式的注入 prompt（功能②）。
 * - full：枚举全部「分组/图名」地址（无分组的用「图名」）
 * - repeat：列出分组清单 + 共享情绪名清单，指示 AI 组合 [立绘:分组/图名]（省 token；
 *   前提是各分组命名一致，由包作者保证）
 * 无任何分组时退回单角色 prompt，避免多角色模式空转。
 */
export function buildMultiRolePrompt(entries: AddressEntry[], mode: 'full' | 'repeat'): string {
  if (entries.length === 0) return ''
  const groups: string[] = []
  const tags: string[] = []
  for (const e of entries) {
    if (e.group && !groups.includes(e.group)) groups.push(e.group)
    if (!tags.includes(e.tag)) tags.push(e.tag)
  }
  if (groups.length === 0) return buildInjectionPrompt(tags)

  if (mode === 'repeat') {
    return [
      '[角色立绘系统]',
      `可用角色/分组：${groups.join('、')}`,
      `每个角色的可用表情：${tags.join('、')}`,
      '请在每次回复的末尾，选择一个角色和一个表情，',
      `以 [立绘:角色/表情] 的格式单独标注（例如 [立绘:${groups[0]}/${tags[0]}]）。`,
      '角色与表情都只能取自上述清单，每次回复标注一个。',
    ].join('\n')
  }

  const addresses = entries.map((e) => (e.group ? `${e.group}/${e.tag}` : e.tag))
  return [
    '[角色立绘系统]',
    `可用立绘（角色/表情）：${addresses.join('、')}`,
    '请在每次回复的末尾，从上述列表中选择一个最贴合当前情境的立绘，',
    `以 [立绘:名称] 的格式单独标注（例如 [立绘:${addresses[0]}]）。`,
    '只能使用列表中存在的名称，每次回复只标注一个。',
  ].join('\n')
}
