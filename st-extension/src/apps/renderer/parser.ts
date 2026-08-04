import type {
  BattleRenderBlock,
  CardsRenderBlock,
  ChoiceCard,
  FighterConfig,
  GalBeat,
  GalRenderBlock,
  ItemConfig,
  RendererBlock,
  RendererParseResult,
  SkillConfig,
  StatusConfig,
} from './types'

const OPEN_TAG = '<STStageRender>'
const CLOSE_TAG = '</STStageRender>'
const MAX_JSON_BYTES = 64 * 1024
const MAX_ARRAY_ITEMS = 12
const MAX_BEATS = 50
const MAX_CARDS = 8

type RecordValue = Record<string, unknown>

/** 返回一组校验结果中的首个错误。 */
function firstError(...errors: Array<string | null>): string | null {
  return errors.find((error): error is string => error !== null) ?? null
}

/** 构造已发现渲染块的失败结果。 */
function fail(error: string): RendererParseResult {
  return { ok: false, found: true, error }
}

/** 判断输入是否为可校验的非数组对象。 */
function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 检查对象是否只包含协议声明过的字段，避免把 HTML 或隐藏配置带进渲染层。 */
function checkKeys(value: RecordValue, allowed: readonly string[], label: string): string | null {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) return `${label}包含未知字段: ${key}`
  }
  return null
}

/** 校验必填字符串及其长度和 HTML 限制。 */
function getRequiredString(value: RecordValue, key: string, label: string, maxLength: number): string | null {
  const field = value[key]
  if (typeof field !== 'string' || field.trim().length === 0) return `${label}.${key} 必须是非空字符串`
  if (field.length > maxLength) return `${label}.${key} 超过最大长度 ${maxLength}`
  if (/<\/?[a-z][^>]*>/i.test(field)) return `${label}.${key} 不接受 HTML`
  return null
}

/** 校验可选字符串及其长度和 HTML 限制。 */
function getOptionalString(value: RecordValue, key: string, label: string, maxLength: number): string | null {
  if (!(key in value)) return null
  const field = value[key]
  if (typeof field !== 'string') return `${label}.${key} 必须是字符串`
  if (field.length > maxLength) return `${label}.${key} 超过最大长度 ${maxLength}`
  if (/<\/?[a-z][^>]*>/i.test(field)) return `${label}.${key} 不接受 HTML`
  return null
}

/** 校验指定闭区间内的有限整数。 */
function getNumber(value: RecordValue, key: string, label: string, min: number, max: number): string | null {
  const field = value[key]
  if (typeof field !== 'number' || !Number.isFinite(field) || !Number.isInteger(field)) {
    return `${label}.${key} 必须是有限整数`
  }
  if (field < min || field > max) return `${label}.${key} 必须在 ${min}-${max} 范围内`
  return null
}

/** 校验必填布尔字段。 */
function getBoolean(value: RecordValue, key: string, label: string): string | null {
  if (typeof value[key] !== 'boolean') return `${label}.${key} 必须是布尔值`
  return null
}

/** 只允许可作为图片资源的协议和 ST/扩展本地路径。 */
function isSafeImageUrl(value: string): boolean {
  if (/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=]+$/i.test(value)) return true
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0
    } catch {
      return false
    }
  }
  if (value.startsWith('//') || value.includes('\\') || /[\s<>]/.test(value)) return false
  const localPrefix = /^(?:\/user\/|\.\/|assets\/|\/scripts\/extensions\/third-party\/)/i
  if (!localPrefix.test(value)) return false
  const path = value.split(/[?#]/, 1)[0].replace(/^\.\//, '')
  try {
    return !path.split('/').some((segment) => {
      let decoded = segment
      for (let depth = 0; depth < 2; depth += 1) decoded = decodeURIComponent(decoded)
      return decoded === '.' || decoded === '..'
    })
  } catch {
    return false
  }
}

/** 校验可选图片地址字段。 */
function getOptionalImageUrl(value: RecordValue, key: string, label: string): string | null {
  const error = getOptionalString(value, key, label, 2048)
  if (error !== null) return error
  if (!(key in value)) return null
  if (!isSafeImageUrl(value[key] as string)) return `${label}.${key} 不是安全图片 URL`
  return null
}

/** 返回数组中首个重复 ID，没有重复时返回空值。 */
function findDuplicateId(items: Array<{ id: string }>): string | null {
  const ids = new Set<string>()
  for (const item of items) {
    if (ids.has(item.id)) return item.id
    ids.add(item.id)
  }
  return null
}

/** 校验并归一化 Galgame 协议块。 */
function validateGal(value: RecordValue): GalRenderBlock | string {
  const keys = ['version', 'mode', 'title', 'scene', 'background', 'beats'] as const
  const keyError = checkKeys(value, keys, 'gal')
  if (keyError) return keyError
  if (value.version !== 1) return 'version 只支持 1'
  if (value.mode !== 'gal') return 'mode 只支持 gal、cards 或 battle'
  for (const [key, max] of [['title', 200], ['scene', 500]] as const) {
    const error = key === 'title'
      ? getOptionalString(value, key, 'gal', max)
      : getRequiredString(value, key, 'gal', max)
    if (error) return error
  }
  const backgroundError = getOptionalImageUrl(value, 'background', 'gal')
  if (backgroundError) return backgroundError
  if (!Array.isArray(value.beats) || value.beats.length < 1) return 'gal.beats 至少需要 1 项'
  if (value.beats.length > MAX_BEATS) return 'gal.beats 必须在 1-50 范围内'
  const beats: GalBeat[] = []
  for (const [index, item] of value.beats.entries()) {
    if (!isRecord(item)) return `gal.beats[${index}] 必须是对象`
    const itemError = checkKeys(item, ['speaker', 'text', 'portrait', 'background'], `gal.beats[${index}]`)
    if (itemError) return itemError
    const contentError = firstError(
      getRequiredString(item, 'speaker', `gal.beats[${index}]`, 100),
      getRequiredString(item, 'text', `gal.beats[${index}]`, 2000),
      getOptionalImageUrl(item, 'portrait', `gal.beats[${index}]`),
      getOptionalImageUrl(item, 'background', `gal.beats[${index}]`),
    )
    if (contentError) return contentError
    beats.push({
      speaker: item.speaker as string,
      text: item.text as string,
      ...(item.portrait === undefined ? {} : { portrait: item.portrait as string }),
      ...(item.background === undefined ? {} : { background: item.background as string }),
    })
  }
  return {
    version: 1,
    mode: 'gal',
    ...(value.title === undefined ? {} : { title: value.title as string }),
    scene: value.scene as string,
    ...(value.background === undefined ? {} : { background: value.background as string }),
    beats,
  }
}

/** 校验并归一化单张选择卡片。 */
function validateCard(value: unknown, index: number): ChoiceCard | string {
  if (!isRecord(value)) return `cards.cards[${index}] 必须是对象`
  const label = `cards.cards[${index}]`
  const keyError = checkKeys(value, ['id', 'title', 'description', 'consequence', 'action'], label)
  if (keyError) return keyError
  const errors = [
    getRequiredString(value, 'id', label, 100),
    getRequiredString(value, 'title', label, 200),
    getRequiredString(value, 'description', label, 1000),
    getOptionalString(value, 'consequence', label, 1000),
    getRequiredString(value, 'action', label, 2000),
  ]
  const error = firstError(...errors)
  if (error) return error
  return {
    id: value.id as string,
    title: value.title as string,
    description: value.description as string,
    ...(value.consequence === undefined ? {} : { consequence: value.consequence as string }),
    action: value.action as string,
  }
}

/** 校验并归一化卡片选择协议块。 */
function validateCards(value: RecordValue): CardsRenderBlock | string {
  const keyError = checkKeys(value, ['version', 'mode', 'title', 'cards'], 'cards')
  if (keyError) return keyError
  if (value.version !== 1) return 'version 只支持 1'
  if (value.mode !== 'cards') return 'mode 只支持 gal、cards 或 battle'
  const titleError = getRequiredString(value, 'title', 'cards', 200)
  if (titleError) return titleError
  if (!Array.isArray(value.cards) || value.cards.length < 2) return 'cards.cards 至少需要 2 项'
  if (value.cards.length > MAX_CARDS) return 'cards.cards 必须在 2-8 范围内'
  const cards: ChoiceCard[] = []
  for (const [index, item] of value.cards.entries()) {
    const card = validateCard(item, index)
    if (typeof card === 'string') return card
    cards.push(card)
  }
  const duplicateId = findDuplicateId(cards)
  if (duplicateId) return `cards.cards 包含重复 ID: ${duplicateId}`
  return { version: 1, mode: 'cards', title: value.title as string, cards }
}

/** 校验并归一化战斗技能。 */
function validateSkill(value: unknown, index: number): SkillConfig | string {
  if (!isRecord(value)) return `battle.skills[${index}] 必须是对象`
  const label = `battle.skills[${index}]`
  const keyError = checkKeys(value, ['id', 'name', 'description', 'type', 'mpCost', 'power'], label)
  if (keyError) return keyError
  const stringError = firstError(getRequiredString(value, 'id', label, 100), getRequiredString(value, 'name', label, 100), getOptionalString(value, 'description', label, 500))
  if (stringError) return stringError
  if (value.type !== 'damage' && value.type !== 'heal') return `${label}.type 只支持 damage 或 heal`
  const numericError = firstError(getNumber(value, 'mpCost', label, 0, 9999), getNumber(value, 'power', label, 0, 9999))
  if (numericError) return numericError
  return {
    id: value.id as string,
    name: value.name as string,
    ...(value.description === undefined ? {} : { description: value.description as string }),
    type: value.type as SkillConfig['type'],
    mpCost: value.mpCost as number,
    power: value.power as number,
  }
}

/** 校验并归一化战斗物品。 */
function validateItem(value: unknown, index: number): ItemConfig | string {
  if (!isRecord(value)) return `battle.items[${index}] 必须是对象`
  const label = `battle.items[${index}]`
  const keyError = checkKeys(value, ['id', 'name', 'description', 'effect', 'quantity', 'power'], label)
  if (keyError) return keyError
  const stringError = firstError(getRequiredString(value, 'id', label, 100), getRequiredString(value, 'name', label, 100), getOptionalString(value, 'description', label, 500))
  if (stringError) return stringError
  if (value.effect !== 'heal_hp' && value.effect !== 'heal_mp') return `${label}.effect 只支持 heal_hp 或 heal_mp`
  const numericError = firstError(getNumber(value, 'quantity', label, 0, 9999), getNumber(value, 'power', label, 0, 9999))
  if (numericError) return numericError
  return {
    id: value.id as string,
    name: value.name as string,
    ...(value.description === undefined ? {} : { description: value.description as string }),
    effect: value.effect as ItemConfig['effect'],
    quantity: value.quantity as number,
    power: value.power as number,
  }
}

/** 校验并归一化初始战斗状态。 */
function validateStatus(value: unknown, index: number): StatusConfig | string {
  if (!isRecord(value)) return `battle.statuses[${index}] 必须是对象`
  const label = `battle.statuses[${index}]`
  const keyError = checkKeys(value, ['id', 'name', 'duration', 'attackDelta', 'defenseDelta', 'damagePerTurn'], label)
  if (keyError) return keyError
  const stringError = firstError(getRequiredString(value, 'id', label, 100), getRequiredString(value, 'name', label, 100))
  if (stringError) return stringError
  const durationError = getNumber(value, 'duration', label, 1, 9999)
  if (durationError) return durationError
  for (const key of ['attackDelta', 'defenseDelta', 'damagePerTurn'] as const) {
    const min = key === 'damagePerTurn' ? 0 : -9999
    const error = key in value ? getNumber(value, key, label, min, 9999) : null
    if (error) return error
  }
  return {
    id: value.id as string,
    name: value.name as string,
    duration: value.duration as number,
    ...(value.attackDelta === undefined ? {} : { attackDelta: value.attackDelta as number }),
    ...(value.defenseDelta === undefined ? {} : { defenseDelta: value.defenseDelta as number }),
    ...(value.damagePerTurn === undefined ? {} : { damagePerTurn: value.damagePerTurn as number }),
  }
}

/** 校验并归一化一名战斗角色及其嵌套集合。 */
function validateFighter(value: unknown, label: string): FighterConfig | string {
  if (!isRecord(value)) return `${label} 必须是对象`
  const keyError = checkKeys(value, ['id', 'name', 'hp', 'maxHp', 'mp', 'maxMp', 'attack', 'defense', 'speed', 'crit', 'dodge', 'portrait', 'skills', 'items', 'statuses'], label)
  if (keyError) return keyError
  const identityError = firstError(getRequiredString(value, 'id', label, 100), getRequiredString(value, 'name', label, 100))
  if (identityError) return identityError
  const numericErrors = [
    getNumber(value, 'hp', label, 0, 9999),
    getNumber(value, 'maxHp', label, 1, 9999),
    getNumber(value, 'mp', label, 0, 9999),
    getNumber(value, 'maxMp', label, 0, 9999),
    getNumber(value, 'attack', label, 0, 9999),
    getNumber(value, 'defense', label, 0, 9999),
    getNumber(value, 'speed', label, 0, 9999),
    getNumber(value, 'crit', label, 0, 100),
    getNumber(value, 'dodge', label, 0, 100),
  ]
  const numericError = numericErrors.find((item): item is string => item !== null)
  if (numericError) return numericError
  if ((value.hp as number) > (value.maxHp as number)) return `${label}.hp 必须小于等于 maxHp`
  if ((value.mp as number) > (value.maxMp as number)) return `${label}.mp 必须小于等于 maxMp`
  const portraitError = getOptionalImageUrl(value, 'portrait', label)
  if (portraitError) return portraitError
  const parsed: FighterConfig = {
    id: value.id as string,
    name: value.name as string,
    hp: value.hp as number,
    maxHp: value.maxHp as number,
    mp: value.mp as number,
    maxMp: value.maxMp as number,
    attack: value.attack as number,
    defense: value.defense as number,
    speed: value.speed as number,
    crit: value.crit as number,
    dodge: value.dodge as number,
    ...(value.portrait === undefined ? {} : { portrait: value.portrait as string }),
  }
  const validators = [
    { key: 'skills', validate: validateSkill },
    { key: 'items', validate: validateItem },
    { key: 'statuses', validate: validateStatus },
  ] as const
  for (const { key, validate } of validators) {
    if (!(key in value)) continue
    const items = value[key]
    if (!Array.isArray(items)) return `${label}.${key} 必须是数组`
    if (items.length > MAX_ARRAY_ITEMS) return `${label}.${key} 最多 12 项`
    const parsedItems: unknown[] = []
    for (const [index, item] of items.entries()) {
      const parsedItem = validate(item, index)
      if (typeof parsedItem === 'string') return parsedItem
      parsedItems.push(parsedItem)
    }
    const duplicateId = findDuplicateId(parsedItems as Array<{ id: string }>)
    if (duplicateId) return `${label}.${key} 包含重复 ID: ${duplicateId}`
    if (key === 'skills') parsed.skills = parsedItems as SkillConfig[]
    if (key === 'items') parsed.items = parsedItems as ItemConfig[]
    if (key === 'statuses') parsed.statuses = parsedItems as StatusConfig[]
  }
  return parsed
}

/** 校验并归一化战斗协议块。 */
function validateBattle(value: RecordValue): BattleRenderBlock | string {
  const keyError = checkKeys(value, ['version', 'mode', 'title', 'background', 'player', 'enemy', 'enemyIntent', 'allowFlee'], 'battle')
  if (keyError) return keyError
  if (value.version !== 1) return 'version 只支持 1'
  if (value.mode !== 'battle') return 'mode 只支持 gal、cards 或 battle'
  const titleError = getRequiredString(value, 'title', 'battle', 200)
  if (titleError) return titleError
  const backgroundError = getOptionalImageUrl(value, 'background', 'battle')
  if (backgroundError) return backgroundError
  const player = validateFighter(value.player, 'battle.player')
  if (typeof player === 'string') return player
  const enemy = validateFighter(value.enemy, 'battle.enemy')
  if (typeof enemy === 'string') return enemy
  if (player.id === enemy.id) return `battle.player 与 battle.enemy 包含重复 ID: ${player.id}`
  const intentError = getOptionalString(value, 'enemyIntent', 'battle', 500)
  if (intentError) return intentError
  const fleeError = 'allowFlee' in value ? getBoolean(value, 'allowFlee', 'battle') : null
  if (fleeError) return fleeError
  return {
    version: 1,
    mode: 'battle',
    title: value.title as string,
    ...(value.background === undefined ? {} : { background: value.background as string }),
    player,
    enemy,
    ...(value.enemyIntent === undefined ? {} : { enemyIntent: value.enemyIntent as string }),
    ...(value.allowFlee === undefined ? {} : { allowFlee: value.allowFlee as boolean }),
  }
}

/** 根据判别字段分派到对应模式校验器。 */
function validateBlock(value: unknown): RendererBlock | string {
  if (!isRecord(value)) return '渲染块必须是 JSON 对象'
  if (value.version !== 1) return 'version 只支持 1'
  if (value.mode === 'gal') return validateGal(value)
  if (value.mode === 'cards') return validateCards(value)
  if (value.mode === 'battle') return validateBattle(value)
  return 'mode 只支持 gal、cards 或 battle'
}

/** 从 AI 回复中提取并校验唯一的完整渲染块，失败时保留原文由上层回退显示。 */
export function parseRendererBlock(source: string): RendererParseResult {
  if (typeof source !== 'string') return { ok: false, found: false }
  const firstStart = source.indexOf(OPEN_TAG)
  if (firstStart < 0) return { ok: false, found: false }
  const secondStart = source.indexOf(OPEN_TAG, firstStart + OPEN_TAG.length)
  const firstEnd = source.indexOf(CLOSE_TAG, firstStart + OPEN_TAG.length)
  if (firstEnd < 0) return fail('STStageRender 块未闭合')
  if (secondStart >= 0 || source.indexOf(CLOSE_TAG, firstEnd + CLOSE_TAG.length) >= 0) return fail('只允许一个 STStageRender 块')
  const json = source.slice(firstStart + OPEN_TAG.length, firstEnd)
  if (new TextEncoder().encode(json).byteLength > MAX_JSON_BYTES) return fail('渲染 JSON 不能超过 64 KiB')
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return fail('渲染块 JSON 格式无效')
  }
  const block = validateBlock(value)
  if (typeof block === 'string') return fail(block)
  const raw = source.slice(firstStart, firstEnd + CLOSE_TAG.length)
  return { ok: true, block, raw }
}
