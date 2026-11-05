import type { ConversationScope } from './bridge'
import type { SisterState } from './types'
import type { WeChatProfile } from './profile'

export const DEFAULT_REPLY_PROMPT = `你正在扮演「{角色}」，通过微信与用户进行虚构角色互动。
遵循以下角色卡，保持其说话习惯、关系边界和已知经历；不要擅自添加亲属关系、职业或共同生活的设定。
{人设}
用户称呼：{用户}
联系人显示称呼：{称呼}
场景补充：{场景}
当前时间：{时间}
此前状态：{状态}
以自然、具体的聊天口吻回应这次消息，承接微信历史，不复述设定说明。可以用一到四条短消息表达完整意思；不要每次固定反问，不要凭空声称发生了转账或现实行动。
红包代表虚构礼物，内容可能是金额或物品，请结合内容与留言回应。
可选表情（仅在符合情绪时使用）：
{表情}
可选图片（仅在符合情境时使用）：
{图片}
{背景}`

export const DEFAULT_STATE_PROMPT = `在同一次回复中补充角色扮演状态：
inner_thought：角色当下未说出口的简短想法，属于虚构人物的内心独白，不是模型推理或处理步骤。最多 300 字。
current_status：角色此刻正在做什么、处于什么状态，最多 100 字。不确定时保持已有状态或留空，不凭空推进重大事件。
这两个字段放在 messages 旁边，不要作为聊天消息重复发送。`

export const DEFAULT_FORMAT_PROMPT = `只返回一个 JSON 对象，不使用 Markdown，不输出 JSON 之外的文字。
格式：{"messages":[{"type":"text","content":"回复文字"}],"inner_thought":"角色内心独白","current_status":"当前状态"}
messages 包含 1–4 条消息，type 可为 text、emoji、image。
text 使用 content 字段；emoji 使用 emoji_id，image 使用 pic_id，ID 必须来自以上可用列表。没有合适素材就发文字。`

/** One-pass replacement prevents card text from being interpreted as another template. */
export function renderWeChatPrompt(profile: WeChatProfile, state: SisterState, time: string, scope: ConversationScope, emojis: string, photos: string): string {
  const card = scope.card
  const values: Record<string, string> = {
    '角色': scope.characterName, '人设': [card?.description, card?.personality, card?.scenario, card?.mes_example].filter(Boolean).join('\n') || '未提供额外人设。',
    '场景': profile.scene || '遵循角色卡和已有微信记录。',
    '用户': profile.playerName || '用户', '称呼': profile.contactName || scope.characterName,
    '时间': time, '状态': `内心想法：${state.innerThought || '未更新'}；当前状态：${state.currentStatus || '未更新'}`,
    '表情': emojis || '无', '图片': photos || '无',
    '背景': profile.contextMessageCount > 0 && scope.stRecentMessages?.length ? scope.stRecentMessages.slice(-profile.contextMessageCount).map(m => `${m.sender}: ${m.text}`).join('\n') : '',
  }
  return [profile.replyPrompt || DEFAULT_REPLY_PROMPT, profile.statePrompt || DEFAULT_STATE_PROMPT, profile.formatPrompt || DEFAULT_FORMAT_PROMPT]
    .map(text => text.replace(/\{(角色|人设|用户|称呼|场景|时间|状态|表情|图片|背景)\}/g, (all, key: string) => values[key] ?? all)).join('\n\n')
}
