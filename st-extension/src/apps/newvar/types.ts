/**
 * 「新变量」内置轻量变量追踪 —— 类型定义。
 *
 * 与 MVU App 的区别：MVU 适配外部框架；新变量是我们自建的一套，给没装 MVU 脚本的角色卡用。
 * 用户在 GUI 里定义变量（VariableSchema），插件据此：注入状态+更新规则给 AI、解析 AI 输出的
 * <UpdateVariable> 块、把状态快照存进消息（message.extra，逐楼一份）。
 */

/** 变量叶子类型（对象嵌套用点号路径表达，不设独立 object 类型） */
export type VarType = 'number' | 'string' | 'boolean' | 'enum'

export interface VariableDefinition {
  /** 点号路径，如 "状态.体力" / "好感度" */
  key: string
  type: VarType
  /** 默认值（初始化状态用） */
  default: unknown
  /** 给 AI 看、也在 UI 显示的说明 */
  description: string
  /** 仅 number：闭区间 [min, max]，越界自动 clip */
  range?: [number, number]
  /** 仅 enum：允许的取值 */
  enum?: string[]
  /** 是否对 AI 隐藏（内部计算用，不注入提示词） */
  hidden?: boolean
  /**
   * 更新规则（多行文本，每行一条 check，注入给 AI）：什么时候更新、幅度多大、什么条件下禁止更新。
   * 参考 MVU 世界书 [mvu_update]变量更新规则 里逐变量的 check 列表——这是变量不乱跳的关键。
   */
  updateRule?: string
}

export interface VariableSchema {
  id: string
  name: string
  version: number
  variables: VariableDefinition[]
}

/** AI 输出的变量更新格式：JSON Patch（新版 MVU，默认）/ lodash set（老版兼容） */
export type OutputFormat = 'json_patch' | 'lodash_set'

/** 归一化后的一条更新操作（path 为内部点号路径） */
export interface PatchOp {
  op: 'replace' | 'add' | 'remove'
  path: string
  value?: unknown
}

export interface RejectedPatch {
  /** 原始 JSON Patch 数组中的位置 */
  index: number
  reason: string
}

export interface ParsedBlock {
  /** 是否在文本里找到了 <UpdateVariable> 块 */
  found: boolean
  ops: PatchOp[]
  /** 结构非法且未进入执行阶段的补丁，按原数组顺序排列 */
  rejected?: RejectedPatch[]
  /** 解析阶段的错误（块存在但内容非法时） */
  error?: string
}

export interface ApplyLogEntry {
  path: string
  status: 'accepted' | 'corrected' | 'rejected' | 'removed'
  detail?: string
}

export interface ApplyResult {
  state: Record<string, unknown>
  log: ApplyLogEntry[]
}
