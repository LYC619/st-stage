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

const survivalExploration: NewvarTemplate = {
  id: 'survival-exploration',
  name: '生存探索',
  description: '生命、饥饿、口渴、疲劳、体感温度、危险、地点与时间，适合荒野和末日探索。',
  variables: [
    {
      key: '生存.生命值',
      type: 'number',
      default: 100,
      description: '当前生命值（0~100，0 表示失去行动能力）',
      range: [0, 100],
      updateRule: '受伤、疾病或恶劣环境时按剧情降低；治疗和安全休息时恢复；输出完整数值',
    },
    {
      key: '生存.饥饿度',
      type: 'number',
      default: 10,
      description: '当前饥饿程度（0~100，越高越饥饿）',
      range: [0, 100],
      updateRule: '随活动和时间缓慢增加，进食后按食物份量降低；未经过明显时间时不要变化',
    },
    {
      key: '生存.口渴度',
      type: 'number',
      default: 10,
      description: '当前口渴程度（0~100，越高越缺水）',
      range: [0, 100],
      updateRule: '随时间、炎热和剧烈活动增加，饮水后降低；变化通常快于饥饿度',
    },
    {
      key: '生存.疲劳度',
      type: 'number',
      default: 5,
      description: '当前疲劳程度（0~100，越高越疲劳）',
      range: [0, 100],
      updateRule: '移动、战斗和缺眠时增加，休息或睡眠后降低；短暂对话不应显著变化',
    },
    {
      key: '环境.体感温度',
      type: 'enum',
      default: '舒适',
      description: '角色当前的体感温度状态',
      enum: ['舒适', '寒冷', '炎热', '失温', '中暑'],
      updateRule: '由天气、衣物、庇护和持续暴露决定；只有环境或防护条件变化时更新',
    },
    {
      key: '环境.危险等级',
      type: 'enum',
      default: '安全',
      description: '当前区域对角色的即时危险等级',
      enum: ['安全', '警戒', '危险', '致命'],
      updateRule: '根据已发现的敌人、灾害和退路判断；潜在风险未被发现前不要使用全知信息',
    },
    {
      key: '地点.当前地点',
      type: 'string',
      default: '临时营地',
      description: '角色当前所在地点或区域',
      updateRule: '明确移动并抵达新区域后更新；仍在途中时保留当前区域并在正文描述移动',
    },
    ...timeVariables(),
  ],
}

const mysteryInvestigation: NewvarTemplate = {
  id: 'mystery-investigation',
  name: '悬疑调查',
  description: '调查目标、线索摘要、嫌疑、紧迫度、阶段、地点与时间，适合推理和侦探剧情。',
  variables: [
    {
      key: '调查.当前目标',
      type: 'string',
      default: '确认事件经过',
      description: '调查者当前最直接的调查目标（一句话）',
      updateRule: '目标完成、失效或出现更优先线索时更新；同时只保留一个最直接目标',
    },
    {
      key: '调查.线索摘要',
      type: 'string',
      default: '尚无可靠线索',
      description: '已确认关键线索的简短摘要，不记录未经证实的猜测',
      updateRule: '获得、排除或重新解释关键线索时重写摘要；只写角色已知信息，避免全知泄露',
    },
    {
      key: '调查.嫌疑度',
      type: 'number',
      default: 10,
      description: '当前主要怀疑方向的可信程度（0~100）',
      range: [0, 100],
      updateRule: '可靠证据支持时 +5~20，反证出现时 -5~30；普通直觉只允许小幅变化',
    },
    {
      key: '调查.紧迫度',
      type: 'number',
      default: 20,
      description: '案件时间压力或即时威胁（0~100）',
      range: [0, 100],
      updateRule: '截止临近、威胁升级或证据将消失时增加；解除威胁或争取到时间后降低',
    },
    {
      key: '调查.阶段',
      type: 'enum',
      default: '案发',
      description: '当前调查流程阶段',
      enum: ['案发', '勘查', '推理', '对质', '结案'],
      updateRule: '完成当前阶段的关键行动后推进一级；证据不足时不得从勘查直接跳到结案',
    },
    {
      key: '地点.当前地点',
      type: 'string',
      default: '案发现场',
      description: '调查者当前所在地点',
      updateRule: '明确抵达新的调查地点后更新；提及其他地点或远程联络时保持原值',
    },
    ...timeVariables(),
  ],
}

const questProgression: NewvarTemplate = {
  id: 'quest-progression',
  name: '任务推进',
  description: '目标、进度、阶段、阻碍、截止压力和完成状态，适合长期主线与委托。',
  variables: [
    {
      key: '任务.目标',
      type: 'string',
      default: '确认任务目标',
      description: '当前任务的可验证最终目标（一句话）',
      updateRule: '任务被正式替换或目标条件改变时更新；执行步骤变化不等于最终目标变化',
    },
    {
      key: '任务.进度',
      type: 'number',
      default: 0,
      description: '任务总体完成进度（0~100）',
      range: [0, 100],
      updateRule: '完成可验证里程碑时增加 5~30；普通对话不增加；任务失败可按实际损失回退',
    },
    {
      key: '任务.阶段',
      type: 'enum',
      default: '未开始',
      description: '当前任务执行阶段',
      enum: ['未开始', '进行中', '受阻', '收尾', '已完成'],
      updateRule: '按实际执行状态更新；主要阻碍未解除时保持受阻，完成验收后才进入已完成',
    },
    {
      key: '任务.阻碍',
      type: 'string',
      default: '无',
      description: '当前阻止任务推进的首要问题',
      updateRule: '出现新的首要阻碍时更新，解除后改为下一个阻碍或“无”；不要罗列次要困难',
    },
    {
      key: '任务.截止压力',
      type: 'enum',
      default: '无',
      description: '任务截止期限造成的当前压力',
      enum: ['无', '低', '中', '高', '迫近'],
      updateRule: '根据剩余时间和所需工作量调整；时间推进但余量充足时不必升级',
    },
    {
      key: '任务.已完成',
      type: 'boolean',
      default: false,
      description: '任务是否已满足最终目标并完成验收',
      updateRule: '只有最终目标已满足且剧情确认完成时设为 true；任务重开或验收失败时才恢复 false',
    },
    ...timeVariables(),
  ],
}

export const NEWVAR_TEMPLATES: NewvarTemplate[] = [
  romanceSingle,
  romanceMulti,
  rpg,
  daily,
  survivalExploration,
  mysteryInvestigation,
  questProgression,
]
