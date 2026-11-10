// Adapted from WeiMeng st-bridge.js (MIT); license preserved in commands.ts.
import { metadataContext, type Item, type Skill } from './store'

function username(): string { const name = metadataContext().name1; return typeof name === 'string' && name ? name : '我' }
export function itemDraft(item: Item): string {
  return `${username()}使用了"${item.名称}"${item.数量 > 1 ? `（剩余 ×${item.数量}）` : ''}。${item.描述 ? `（道具效果：${item.描述}）` : ''}`
}
export function skillDraft(skill: Skill): string {
  return `${username()}发动了能力"${skill.名称}"${skill.等级 ? `（Lv.${skill.等级}）` : ''}${skill.类型 ? `，${skill.类型}` : ''}。${skill.描述 ? `（效果：${skill.描述}）` : ''}`
}
