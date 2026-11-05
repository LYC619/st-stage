import { t } from '../../core/i18n'
import type { PluginSettings } from '../../core/types'
import type { PhoneHomeSummary } from '../../core/phone-shell'
import { normalizeNewvarData } from './apps/newvar/config'
import { normalizeRendererSettings } from './apps/renderer/config'

export type ExternalVariableStatus = 'checking' | 'mvu' | 'helper' | 'empty' | 'unavailable' | 'error' | 'preview'

export function buildRoleSummary(settings: PluginSettings, characterName: string, chatTitle: string, external: ExternalVariableStatus): PhoneHomeSummary {
  const binding = settings.bindings.find(item => item.characterName === characterName)
  const packs = (binding?.packIds ?? []).map(id => settings.packs.find(pack => pack.id === id)).filter(pack => !!pack)
  const newvar = normalizeNewvarData(settings.apps.newvar)
  const renderer = normalizeRendererSettings(settings.apps.renderer)
  const rawWechat = settings.apps['wechat-sister'] as { config?: { apiKey?: unknown } } | undefined
  const hasKey = typeof rawWechat?.config?.apiKey === 'string' && !!rawWechat.config.apiKey.trim()
  const enabled = t('phone.role.enabled', '已启用'), disabled = t('phone.role.disabled', '已关闭')
  const externalText: Record<ExternalVariableStatus, string> = {
    checking: t('phone.role.checking', '正在检查'),
    mvu: t('phone.role.mvu_ready', 'MVU · 当前聊天有数据'),
    helper: t('phone.role.helper_ready', '酒馆助手 · 当前聊天有数据'),
    empty: t('phone.role.variables_empty', '当前聊天无变量数据'),
    unavailable: t('phone.role.variables_unavailable', '未检测到可用变量接口'),
    error: t('phone.role.variables_error', '读取失败，打开面板检查'),
    preview: t('phone.role.preview', '模拟器不读取外部变量'),
  }
  return {
    title: characterName || t('phone.role.no_character', '尚未选择角色'),
    subtitle: characterName ? chatTitle : t('phone.role.select_hint', '先在酒馆打开角色聊天，再配置体验'),
    rows: characterName ? [
      { id: 'gallery', appId: 'gallery', label: t('phone.role.packs', '图包'), value: packs.length
        ? t('phone.role.pack_count', '{{count}} 个图包 · {{state}}', { count: packs.length, state: binding?.enabled ? enabled : disabled })
        : t('phone.role.no_packs', '尚未绑定，前往图库') },
      { id: 'sprites', appId: 'sprites', label: t('phone.role.sprites', '立绘'), value: !settings.enabled ? disabled
        : !binding?.enabled || !packs.some(pack => pack.sprites.length > 0) ? t('phone.role.needs_pack', '待启用有图片的图包') : enabled },
      { id: 'newvar', appId: 'newvar', label: t('phone.role.newvar', '新变量'), value: !newvar.enabled ? disabled
        : !newvar.schema.variables.length ? t('phone.role.needs_schema', '已开启，尚未定义变量')
          : t('phone.role.variable_count', '已启用 · {{count}} 个定义', { count: newvar.schema.variables.length }) },
      { id: 'mvu', appId: 'mvu', label: t('phone.role.external', '外部变量'), value: externalText[external] },
      { id: 'renderer', appId: 'renderer', label: t('phone.role.renderer', '渲染'), value: !renderer.enabled ? disabled
        : !(renderer.galEnabled || renderer.cardsEnabled || renderer.battleEnabled) ? t('phone.role.needs_mode', '已开启，未选择模式') : enabled },
      { id: 'wechat', appId: 'wechat-sister', label: t('phone.role.wechat', '微信'), value: hasKey
        ? t('phone.role.ai_configured', '已配置 AI · 连接未验证') : t('phone.role.local_replies', '本地回复 · 可配置 AI') },
    ] : [],
  }
}
