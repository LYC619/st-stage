import type { RendererSettings } from './config'

const GAL_PROMPT = `【Galgame 模式】
适合连续对话或分镜。字段：version=1，mode="gal"，scene 为场景说明，beats 为 1-50 个节拍；每个节拍必须有 speaker 和 text，title、background、节拍的 portrait/background 可省略。
示例：
<STStageRender>{"version":1,"mode":"gal","title":"雨夜重逢","scene":"车站月台","beats":[{"speaker":"小雪","text":"你终于来了。","portrait":"/user/images/xiaoxue.png"},{"speaker":"我","text":"抱歉，让你久等了。"}]}</STStageRender>`

const CARDS_PROMPT = `【SLG 卡片选择模式】
适合给出 2-8 个明确选择。每张卡必须有唯一 id、title、description、action，consequence 可省略；action 是填入输入框但不自动发送的文字。
示例：
<STStageRender>{"version":1,"mode":"cards","title":"下一步行动","cards":[{"id":"advance","title":"继续前进","description":"沿山路调查灯光","consequence":"可能遭遇守卫","action":"我选择沿山路继续前进。"},{"id":"rest","title":"原地休整","description":"恢复体力并整理物资","action":"我选择原地休整。"}]}</STStageRender>`

const BATTLE_PROMPT = `【战斗模式】
适合可由本地确定性规则处理的简单战斗。player/enemy 必须有不同的唯一 id，并包含 name、hp/maxHp、mp/maxMp、attack、defense、speed、crit、dodge。所有基础数值为 0-9999，hp 不得大于 maxHp，mp 不得大于 maxMp，crit/dodge 为 0-100。
skills、items、statuses 各最多 12 项且各自 id 不重复。skill 字段为 id/name/type/mpCost/power，type 只能是 damage 或 heal；item 字段为 id/name/effect/quantity/power，effect 只能是 heal_hp 或 heal_mp；status 字段为 id/name/duration，可选 attackDelta、defenseDelta、damagePerTurn。description 可用于技能和物品；background、enemyIntent、allowFlee 可省略。
示例：
<STStageRender>{"version":1,"mode":"battle","title":"遗迹守卫战","player":{"id":"hero","name":"旅行者","hp":80,"maxHp":100,"mp":30,"maxMp":50,"attack":18,"defense":8,"speed":12,"crit":10,"dodge":5,"skills":[{"id":"slash","name":"斩击","type":"damage","mpCost":5,"power":20}]},"enemy":{"id":"guard","name":"遗迹守卫","hp":90,"maxHp":90,"mp":0,"maxMp":0,"attack":16,"defense":10,"speed":8,"crit":5,"dodge":3},"enemyIntent":"蓄力攻击","allowFlee":true}</STStageRender>`

/** 按启用模式生成注入说明；关闭时返回空串供通道直接清理。 */
export function buildRendererPrompt(settings: RendererSettings): string {
  if (!settings.enabled) return ''
  const modes: string[] = []
  if (settings.galEnabled) modes.push(GAL_PROMPT)
  if (settings.cardsEnabled) modes.push(CARDS_PROMPT)
  if (settings.battleEnabled) modes.push(BATTLE_PROMPT)
  if (modes.length === 0) return ''
  return `# ST Stage 结构化渲染协议

普通回复不需要输出渲染块；仅在当前场景明显适合以下已启用模式时使用。
每条回复最多输出一个 STStageRender 标签块，标签内部必须是严格 JSON。
禁止输出 HTML、脚本或其他可执行代码，也不要增加协议未声明的字段。
叙事正文放在块外，并保证块外内容脱离渲染器后仍然独立可读。
所有数值使用整数，图片只使用可信的 http(s)、base64 栅格 data:image、/user/ 或扩展相对路径。

${modes.join('\n\n')}`
}
