/** 内置变量模板：每个叶子都带完整约束和更新规则，可直接生成稳定的变量注入。 */

import { isSafePath } from '../path-utils'
import type { VariableDefinition } from './types'

export interface TemplateParameter {
  key: string
  label: string
  default: string
}

export interface NewvarTemplate {
  id: string
  name: string
  description: string
  variables: VariableDefinition[]
  parameters?: TemplateParameter[]
  instantiate?: (parameters: Record<string, string>) => VariableDefinition[]
}

const RELATIONSHIP_STAGES = ['陌生', '熟悉', '信任', '亲密', '挚爱']
const RELATIONSHIP_RULE =
  '按好感度区间判断：陌生 0-19；熟悉 20-39；信任 40-59；亲密 60-79；挚爱 80-100\n只有数值跨入新区间且剧情关系确有变化时才调整，不可跳级'

function timeVariables(): VariableDefinition[] {
  return [
    {
      key: '时间.日期',
      type: 'string',
      default: '故事开始日',
      description: '当前故事日期（优先使用 YYYY-MM-DD，原作未给年份时用明确的月日或第几天）',
      updateRule: '剧情明确跨过午夜或日期推进时更新；同一天内保持不变，禁止凭空补造年份',
    },
    {
      key: '时间.当前时间',
      type: 'string',
      default: '15:00',
      description: '当前 24 小时时间（HH:mm）',
      updateRule: '按剧情累计推进：对话约 5~15 分钟，移动 10~30 分钟，重大事件 30 分钟以上；保持 HH:mm 格式',
    },
    {
      key: '时间.当前时段',
      type: 'enum',
      default: '下午',
      description: '由当前时间对应的时段',
      enum: ['清晨', '上午', '中午', '下午', '傍晚', '夜晚', '深夜'],
      updateRule: '跟随 时间.当前时间 跨过时段边界时更新，未跨界时保持不变',
    },
  ]
}

const romanceSingle: NewvarTemplate = {
  id: 'romance-single',
  name: '恋爱 · 单角色',
  description: '好感、关系阶段、心情、行动和完整日期时间；关系按明确阈值小步推进。',
  variables: [
    {
      key: '好感度',
      type: 'number',
      default: 20,
      description: '角色对用户的好感（0~100）',
      range: [0, 100],
      updateRule: '正面互动 +1~3；重大事件（告白、共渡难关）±5~10；负面言行 -1~5\n无实质互动时保持不变，禁止无缘由跳变',
    },
    {
      key: '关系阶段',
      type: 'enum',
      default: '熟悉',
      description: '角色与用户当前的关系阶段',
      enum: RELATIONSHIP_STAGES,
      updateRule: RELATIONSHIP_RULE,
    },
    {
      key: '心情',
      type: 'enum',
      default: '平静',
      description: '角色当前主导心情',
      enum: ['开心', '平静', '害羞', '烦躁', '难过'],
      updateRule: '仅在当前场景出现明确情绪变化时更新；短暂措辞不代表主导心情改变',
    },
    {
      key: '当前状态',
      type: 'string',
      default: '初次见面',
      description: '角色正在做什么以及与用户的互动状态（一句话）',
      updateRule: '角色行动或互动目标改变时用一句话概括；没有变化时保持原值',
    },
    {
      key: '地点.当前地点',
      type: 'string',
      default: '教室',
      description: '角色与用户当前所在地点',
      updateRule: '明确发生场景移动后更新；只改变视角或提及其他地点时不要更新',
    },
    ...timeVariables(),
  ],
}

function roleVariables(role: string, initiallyPresent: boolean): VariableDefinition[] {
  const presencePath = `角色.${role}.是否在场`
  const gate = `仅当 ${presencePath}为 true 时更新；不在场时保持原值`
  return [
    {
      key: presencePath,
      type: 'boolean',
      default: initiallyPresent,
      description: `${role}是否实际出现在当前场景`,
      updateRule: '角色进入当前场景时设为 true，明确离开时设为 false；仅被提及不算在场',
    },
    {
      key: `角色.${role}.好感度`,
      type: 'number',
      default: 20,
      description: `${role}对用户的好感（0~100）`,
      range: [0, 100],
      updateRule: `${gate}\n正面互动 +1~3；重大事件 ±5~10；输出更新后的完整数值`,
    },
    {
      key: `角色.${role}.关系阶段`,
      type: 'enum',
      default: '熟悉',
      description: `${role}与用户的关系阶段`,
      enum: RELATIONSHIP_STAGES,
      updateRule: `${gate}\n${RELATIONSHIP_RULE}`,
    },
    {
      key: `角色.${role}.当前状态`,
      type: 'string',
      default: '等待互动',
      description: `${role}正在做什么以及当前情绪（一句话）`,
      updateRule: `${gate}\n行动或主导情绪明确改变时更新为一句话概括`,
    },
    {
      key: `角色.${role}.所在位置`,
      type: 'string',
      default: '未知',
      description: `${role}当前所在位置`,
      updateRule: '角色移动或剧情明确交代其位置时更新；即使不在用户当前场景也可更新已知位置',
    },
    {
      key: `角色.${role}.穿着`,
      type: 'string',
      default: '日常便服',
      description: `${role}当前主要穿着`,
      updateRule: `${gate}\n明确换装或衣物状态显著变化时更新；未提及时保持原值`,
    },
  ]
}

function instantiateRomanceMulti(parameters: Record<string, string>): VariableDefinition[] {
  const roleA = normalizeRoleName(parameters.roleA, '角色A')
  const roleB = normalizeRoleName(parameters.roleB, '角色B')
  if (roleA === roleB) throw new Error('模板角色名不能重复')
  return [
    ...roleVariables(roleA, true),
    ...roleVariables(roleB, false),
    {
      key: '地点.当前地点',
      type: 'string',
      default: '客厅',
      description: '用户当前所在地点',
      updateRule: '用户明确移动到新场景后更新；仅提及地点时保持原值',
    },
    ...timeVariables(),
  ]
}

function normalizeRoleName(raw: string | undefined, fallback: string): string {
  const name = raw?.trim() || fallback
  if (name.includes('.')) throw new Error('模板角色名不能包含点号')
  if (!isSafePath(`角色.${name}.变量`)) throw new Error('模板角色名包含危险路径字段')
  return name
}

const romanceMultiParameters: TemplateParameter[] = [
  { key: 'roleA', label: '角色 1 名称', default: '角色A' },
  { key: 'roleB', label: '角色 2 名称', default: '角色B' },
]

const romanceMulti: NewvarTemplate = {
  id: 'romance-multi',
  name: '恋爱 · 多角色',
  description: '为两个角色分别维护在场、好感、关系、状态、位置和穿着；导入前可直接填写角色名。',
  parameters: romanceMultiParameters,
  instantiate: instantiateRomanceMulti,
  variables: instantiateRomanceMulti(Object.fromEntries(romanceMultiParameters.map((item) => [item.key, item.default]))),
}

const rpg: NewvarTemplate = {
  id: 'rpg',
  name: 'RPG 冒险',
  description: '生命、法力、金币、等级、身体状态、位置与完整日期时间。',
  variables: [
    {
      key: '生命值',
      type: 'number',
      default: 100,
      description: '当前生命（0~100）',
      range: [0, 100],
      updateRule: '战斗受伤通常 -10~30；休息或治疗按剧情恢复；归零后状态必须改为昏迷',
    },
    {
      key: '法力值',
      type: 'number',
      default: 50,
      description: '当前法力（0~100）',
      range: [0, 100],
      updateRule: '施法按强度消耗 5~30；休息、药剂或法力源按剧情恢复；输出计算后的完整数值',
    },
    {
      key: '金币',
      type: 'number',
      default: 0,
      description: '当前持有金币',
      range: [0, 999999],
      updateRule: '交易、战利品或悬赏结算时增减；输出计算后的总额，禁止输出增量',
    },
    {
      key: '等级',
      type: 'number',
      default: 1,
      description: '冒险者等级（1~99）',
      range: [1, 99],
      updateRule: '只有剧情明确确认升级时增加 1；不得因普通战斗自动增长或跳级',
    },
    {
      key: '当前地点',
      type: 'string',
      default: '新手村',
      description: '冒险者当前所在地',
      updateRule: '队伍明确移动并抵达新地点后更新；途中提及目的地时保持原值',
    },
    {
      key: '状态',
      type: 'enum',
      default: '正常',
      description: '冒险者当前身体状态',
      enum: ['正常', '受伤', '中毒', '昏迷'],
      updateRule: '由战斗、治疗和事件驱动；生命值归零时必须为昏迷，恢复意识后再按剧情调整',
    },
    ...timeVariables(),
  ],
}

const daily: NewvarTemplate = {
  id: 'daily',
  name: '日常陪伴',
  description: '好感、心情、体力、活动、地点与完整日期时间，适合慢节奏日常卡。',
  variables: [
    {
      key: '好感度',
      type: 'number',
      default: 30,
      description: '角色对用户的好感（0~100）',
      range: [0, 100],
      updateRule: '日常正面互动 +1~2；特别时刻 +3~5；冷落或伤害 -1~5；无实质互动时保持不变',
    },
    {
      key: '心情',
      type: 'enum',
      default: '平静',
      description: '角色当前主导心情',
      enum: ['开心', '平静', '疲惫', '低落', '兴奋'],
      updateRule: '场景出现明确情绪变化时更新；短暂语气变化不代表主导心情改变',
    },
    {
      key: '体力',
      type: 'number',
      default: 100,
      description: '角色当前体力（0~100）',
      range: [0, 100],
      updateRule: '活动通常消耗 5~15；休息或进食按剧情恢复；跨日充分睡眠后可恢复到 100',
    },
    {
      key: '当前活动',
      type: 'string',
      default: '闲聊',
      description: '角色当前正在做的事（一句话）',
      updateRule: '主要活动改变时更新为一句话；动作细节变化但活动未变时保持原值',
    },
    {
      key: '地点.当前地点',
      type: 'string',
      default: '家里',
      description: '角色与用户当前所在地点',
      updateRule: '明确移动并抵达新地点后更新；只计划外出时保持原值',
    },
    ...timeVariables(),
  ],
}

export const NEWVAR_TEMPLATES: NewvarTemplate[] = [romanceSingle, romanceMulti, rpg, daily]
