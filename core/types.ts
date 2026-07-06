/**
 * 角色立绘悬浮窗 — 核心类型定义
 * 纯 TS，零框架依赖，Web 测试环境与 SillyTavern 扩展共用。
 */

/** 单张立绘：一个表情标签对应一张图片 */
export interface Sprite {
  /** 表情标签，如 "微笑"、"害羞恼怒" */
  tag: string
  /** 图片地址：图床 URL、本地静态路由路径，或 data: base64 */
  url: string
}

/** 立绘包：一套角色表情立绘的集合 */
export interface SpritePack {
  /** 唯一 ID（导入时生成） */
  id: string
  /** 包名，如 "银发萝莉" */
  name: string
  /** 作者（可选） */
  author?: string
  /** 描述（可选） */
  description?: string
  /** 立绘列表 */
  sprites: Sprite[]
}

/** 角色 → 立绘包的绑定配置 */
export interface CharacterBinding {
  /** 角色名（与 ST 角色卡名称匹配；Web 端为模拟角色名） */
  characterName: string
  /** 绑定的立绘包 ID */
  packId: string
  /** 是否启用 */
  enabled: boolean
}

/** 悬浮窗位置与尺寸（视口百分比 + 像素混合） */
export interface OverlayLayout {
  /** 距视口左侧 px */
  x: number
  /** 距视口顶部 px */
  y: number
  /** 悬浮窗宽度 px（高度按图片比例自适应） */
  width: number
}

/** 插件全局设置 */
export interface PluginSettings {
  /** 总开关 */
  enabled: boolean
  /** 提取标签后是否在消息渲染中隐藏 [立绘:xxx] 文本 */
  hideTagInMessage: boolean
  /** 悬浮窗布局 */
  overlay: OverlayLayout
  /** 所有立绘包 */
  packs: SpritePack[]
  /** 角色绑定 */
  bindings: CharacterBinding[]
}

/** 立绘包导出文件格式（sprite-pack@1） */
export interface SpritePackFile {
  format: 'sprite-pack@1'
  name: string
  author?: string
  description?: string
  sprites: Array<{
    tag: string
    /** 图床 / 静态 URL（与 data 二选一） */
    url?: string
    /** 内嵌 base64 data URI（与 url 二选一） */
    data?: string
  }>
}

/** 默认设置 */
export function createDefaultSettings(): PluginSettings {
  return {
    enabled: true,
    hideTagInMessage: false,
    overlay: { x: 24, y: 80, width: 220 },
    packs: [],
    bindings: [],
  }
}
