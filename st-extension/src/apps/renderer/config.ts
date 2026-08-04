/** Renderer 设置存于 settings.apps.renderer。 */
export interface RendererSettings {
  enabled: boolean
  galEnabled: boolean
  cardsEnabled: boolean
  battleEnabled: boolean
  injectionDepth: number
  typewriter: boolean
  reducedMotion: boolean
}

export const RENDERER_APP_ID = 'renderer'
/** 独立命名通道便于设置关闭或生命周期结束时精确清理。 */
export const RENDERER_CHANNEL = 'renderer'

/** 返回 Renderer 的安全默认配置。 */
export function defaultRendererSettings(): RendererSettings {
  return {
    enabled: false,
    galEnabled: true,
    cardsEnabled: true,
    battleEnabled: true,
    injectionDepth: 4,
    typewriter: true,
    reducedMotion: false,
  }
}

/** 把历史或损坏的持久化数据归一化为完整设置。 */
export function normalizeRendererSettings(raw: unknown): RendererSettings {
  const settings = defaultRendererSettings()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return settings
  const value = raw as Record<string, unknown>
  for (const key of ['enabled', 'galEnabled', 'cardsEnabled', 'battleEnabled', 'typewriter', 'reducedMotion'] as const) {
    if (typeof value[key] === 'boolean') settings[key] = value[key]
  }
  if (typeof value.injectionDepth === 'number' && Number.isInteger(value.injectionDepth)) {
    settings.injectionDepth = Math.min(20, Math.max(0, value.injectionDepth))
  }
  return settings
}
