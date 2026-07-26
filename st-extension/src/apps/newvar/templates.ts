/**
 * 内置变量模板库：让新手一键得到一套「变量 + 更新规则」都写好的优质方案。
 * 设计与规则写法取材 reference/MVU 两张实测表现好的世界书：
 * - 时间推进规则（对话 5~15 分钟/移动 10~30/重大事件更长，按累计切换时段）
 * - 好感度小步进（常规 +1~3、重大 ±5~10、禁止无理由跳变、输出完整数值而非增量）
 * - 阶段类变量要求「数值达标 + 标志性事件」才推进，不可跳级
 * - 多角色：是否在场 gate，不在场角色除位置外不更新
 */

import type { VariableDefinition } from './types'

export interface NewvarTemplate {
  id: string
  name: string
  description: string
  variables: VariableDefinition[]
}

const TIME_SLOT: VariableDefinition = {
  key: '时间.当前时段',
  type: 'enum',
  default: '下午',
  description: '当前时间段',
  enum: ['清晨', '上午', '中午', '下午', '傍晚', '夜晚', '深夜'],
  updateRule: '按剧情累计推进：对话约 5~15 分钟，场景移动 10~30 分钟，重大事件 30 分钟以上\n累计跨过时段边界时才切换，禁止无故跳时段',
}

const romanceSingle: NewvarTemplate = {
  id: 'romance-single',
  name: '恋爱 · 单角色',
  description: '好感度/关系阶段/心情/时间地点。好感度小步进、阶段须事件驱动，适合大多数单角色卡。',
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
      default: '陌生',
      description: '与用户的关系阶段',
      enum: ['陌生', '熟识', '朋友', '暧昧', '恋人'],
      updateRule: '只有好感度达到相应水平且发生标志性事件时才推进一级，不可跳级\n没有重大变故不要倒退',
    },
    {
      key: '心情',
      type: 'enum',
      default: '平静',
      description: '角色当前心情',
      enum: ['开心', '平静', '害羞', '烦躁', '难过'],
    },
    {
      key: '当前状态',
      type: 'string',
      default: '初次见面',
      description: '正在做什么、与用户的互动状态（一句话）',
    },
    TIME_SLOT,
    { key: '地点.当前地点', type: 'string', default: '教室', description: '当前所在地点' },
  ],
}

function roleVars(role: string): VariableDefinition[] {
  return [
    {
      key: `角色.${role}.是否在场`,
      type: 'boolean',
      default: role === '角色A',
      description: '是否出现在当前场景',
      updateRule: '只有实际出现在当前场景才为 true\n不在场角色的其他变量（除所在位置外）不要更新',
    },
    {
      key: `角色.${role}.好感度`,
      type: 'number',
      default: 20,
      description: `${role}对用户的好感（0~100）`,
      range: [0, 100],
      updateRule: '正面互动 +1~3；重大事件 ±5~10；输出更新后的完整数值',
    },
    { key: `角色.${role}.当前状态`, type: 'string', default: '——', description: '在做什么/情绪（一句话）' },
    { key: `角色.${role}.所在位置`, type: 'string', default: '未知', description: '当前所在位置' },
    { key: `角色.${role}.穿着`, type: 'string', default: '日常便服', description: '当前穿着' },
  ]
}

const romanceMulti: NewvarTemplate = {
  id: 'romance-multi',
  name: '恋爱 · 多角色',
  description: '两个示例角色（角色A/角色B）各自维护在场/好感/状态/位置/穿着。导入后点击各条定义，把路径里的「角色A」改成你卡里的名字。',
  variables: [...roleVars('角色A'), ...roleVars('角色B'), TIME_SLOT, {
    key: '地点.当前地点',
    type: 'string',
    default: '客厅',
    description: '用户当前所在地点',
  }],
}

const rpg: NewvarTemplate = {
  id: 'rpg',
  name: 'RPG 冒险',
  description: '生命/法力/金币/等级/状态。数值全部要求输出计算后的完整值，等级须事件驱动。',
  variables: [
    {
      key: '生命值',
      type: 'number',
      default: 100,
      description: '当前生命（0~100）',
      range: [0, 100],
      updateRule: '战斗受伤 -10~30；休息/治疗恢复；归零进入昏迷',
    },
    { key: '法力值', type: 'number', default: 50, description: '当前法力（0~100）', range: [0, 100] },
    {
      key: '金币',
      type: 'number',
      default: 0,
      description: '持有金币',
      range: [0, 999999],
      updateRule: '交易/战利品/悬赏时增减；输出计算后的总额，禁止输出增量',
    },
    {
      key: '等级',
      type: 'number',
      default: 1,
      description: '冒险者等级（1~99）',
      range: [1, 99],
      updateRule: '只有明确的升级事件才 +1，严禁随剧情自动增长',
    },
    { key: '当前地点', type: 'string', default: '新手村', description: '当前所在地' },
    {
      key: '状态',
      type: 'enum',
      default: '正常',
      description: '身体状态',
      enum: ['正常', '受伤', '中毒', '昏迷'],
      updateRule: '由战斗/事件驱动；生命值归零时置为 昏迷',
    },
  ],
}

const daily: NewvarTemplate = {
  id: 'daily',
  name: '日常陪伴',
  description: '好感/心情/体力/当前活动/时间地点，适合慢节奏日常卡。',
  variables: [
    {
      key: '好感度',
      type: 'number',
      default: 30,
      description: '角色对用户的好感（0~100）',
      range: [0, 100],
      updateRule: '日常互动 +1~2；特别的时刻 +3~5；冷落或伤害 -1~5',
    },
    {
      key: '心情',
      type: 'enum',
      default: '平静',
      description: '当前心情',
      enum: ['开心', '平静', '疲惫', '低落', '兴奋'],
    },
    {
      key: '体力',
      type: 'number',
      default: 100,
      description: '体力（0~100）',
      range: [0, 100],
      updateRule: '活动消耗 5~15；休息恢复；清晨重置为 100',
    },
    { key: '当前活动', type: 'string', default: '闲聊', description: '正在做的事（一句话）' },
    TIME_SLOT,
    { key: '地点.当前地点', type: 'string', default: '家里', description: '当前所在地点' },
  ],
}

export const NEWVAR_TEMPLATES: NewvarTemplate[] = [romanceSingle, romanceMulti, rpg, daily]
