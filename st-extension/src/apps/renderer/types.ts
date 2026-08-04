/** 渲染器支持的三种交互模式。 */
export type RendererMode = 'gal' | 'cards' | 'battle'

export interface GalBeat {
  speaker: string
  text: string
  portrait?: string
  background?: string
}

export interface GalRenderBlock {
  version: 1
  mode: 'gal'
  title?: string
  scene: string
  background?: string
  beats: GalBeat[]
}

export interface ChoiceCard {
  id: string
  title: string
  description: string
  consequence?: string
  action: string
}

export interface CardsRenderBlock {
  version: 1
  mode: 'cards'
  title: string
  cards: ChoiceCard[]
}

export interface SkillConfig {
  id: string
  name: string
  description?: string
  type: 'damage' | 'heal'
  mpCost: number
  power: number
}

export interface ItemConfig {
  id: string
  name: string
  description?: string
  effect: 'heal_hp' | 'heal_mp'
  quantity: number
  power: number
}

export interface StatusConfig {
  id: string
  name: string
  duration: number
  attackDelta?: number
  defenseDelta?: number
  damagePerTurn?: number
}

export interface FighterConfig {
  id: string
  name: string
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  attack: number
  defense: number
  speed: number
  crit: number
  dodge: number
  portrait?: string
  skills?: SkillConfig[]
  items?: ItemConfig[]
  statuses?: StatusConfig[]
}

export interface BattleRenderBlock {
  version: 1
  mode: 'battle'
  title: string
  background?: string
  player: FighterConfig
  enemy: FighterConfig
  enemyIntent?: string
  allowFlee?: boolean
}

export type RendererBlock = GalRenderBlock | CardsRenderBlock | BattleRenderBlock

export type RendererParseResult =
  | { ok: true; block: RendererBlock; raw: string }
  | { ok: false; found: false; error?: undefined }
  | { ok: false; found: true; error: string }
