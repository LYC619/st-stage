import type {
  ButlerAction,
  ButlerCapability,
  ButlerConfidence,
  ButlerLayer,
  ButlerSeverity,
  Finding,
  FindingExplanation,
  JsonValue,
  MeasurementSnapshot,
  PerformanceSettingsSnapshot,
} from './types'

export type ButlerDeviceClass = 'mobile' | 'desktop'

export interface SafePlan {
  deviceClass: ButlerDeviceClass
  actions: ButlerAction[]
  unchanged: ButlerAction[]
}

interface FindingInput {
  id: string
  layer: ButlerLayer
  evidence: Record<string, JsonValue>
  severity: ButlerSeverity
  confidence: ButlerConfidence
  actionId?: string
  explanation: Omit<FindingExplanation, 'result'> & { result?: string }
}

function finding(input: FindingInput): Finding {
  return {
    id: input.id,
    layer: input.layer,
    evidence: input.evidence,
    severity: input.severity,
    confidence: input.confidence,
    ...(input.actionId ? { actionId: input.actionId } : {}),
    explanation: {
      ...input.explanation,
      result: input.explanation.result ?? '尚未应用，等待再次检查。',
    },
  }
}

function planAction(
  id: string,
  label: string,
  field: keyof PerformanceSettingsSnapshot,
  before: boolean | number,
  requested: boolean | number,
  reloadRequired = false,
): ButlerAction {
  return {
    id,
    group: 'performanceSettings',
    label,
    field,
    before,
    requested,
    status: before === requested ? 'unchanged' : 'planned',
    reloadRequired,
  }
}

/** Build a safe plan that can only preserve or reduce the current rendering/DOM cost. */
export function buildSafePlan(
  current: PerformanceSettingsSnapshot,
  deviceClass: ButlerDeviceClass,
): SafePlan {
  const messageLimit = deviceClass === 'mobile' ? 20 : 50
  const nextMessages = current.chat_truncation === 0
    ? messageLimit
    : Math.min(current.chat_truncation, messageLimit)
  const candidates = [
    planAction('perf-fast-ui', '关闭背景模糊', 'fast_ui_mode', current.fast_ui_mode, true),
    planAction('perf-reduced-motion', '开启减少动画', 'reduced_motion', current.reduced_motion, true, true),
    planAction('perf-no-shadows', '关闭阴影', 'noShadows', current.noShadows, true),
    planAction('perf-smooth-streaming', '关闭平滑文字更新', 'smooth_streaming', current.smooth_streaming, false),
    planAction('perf-stream-fade', '关闭文字淡入', 'stream_fade_in', current.stream_fade_in, false),
    planAction(
      'perf-streaming-fps',
      '降低流式更新频率',
      'streaming_fps',
      current.streaming_fps,
      Math.min(current.streaming_fps, 15),
    ),
    planAction(
      'perf-chat-truncation',
      '减少同时显示的消息',
      'chat_truncation',
      current.chat_truncation,
      nextMessages,
      true,
    ),
  ]
  return {
    deviceClass,
    actions: candidates.filter((action) => action.status === 'planned'),
    unchanged: candidates.filter((action) => action.status === 'unchanged'),
  }
}

function settingFinding(
  id: string,
  actionId: string,
  detected: string,
  change: string,
  reason: string,
  impact: string,
  reload: string,
): Finding {
  return finding({
    id,
    layer: 'pageRendering',
    evidence: { detected },
    severity: 'suggestion',
    confidence: 'setting',
    actionId,
    explanation: {
      detected,
      change,
      reason,
      impact,
      reload,
      restore: '可以点“恢复本次性能设置”回到修改前。',
    },
  })
}

function numberRecord(value: JsonValue | undefined): Record<string, JsonValue> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, JsonValue>
}

function resourceGroups(snapshot: MeasurementSnapshot): Array<Record<string, JsonValue>> {
  const resources = numberRecord(snapshot.metrics.resources)
  return Array.isArray(resources?.groups)
    ? resources.groups.filter((item): item is Record<string, JsonValue> => (
        typeof item === 'object' && item !== null && !Array.isArray(item)
      ))
    : []
}

function unavailableCapabilities(
  capabilities: ButlerCapability[],
): Array<Extract<ButlerCapability, { available: false }>> {
  return capabilities.filter(
    (capability): capability is Extract<ButlerCapability, { available: false }> => !capability.available,
  )
}

function capabilityAvailable(snapshot: MeasurementSnapshot, id: string): boolean {
  return snapshot.capabilities.some((capability) => capability.id === id && capability.available)
}

export function diagnose(
  snapshot: MeasurementSnapshot,
  current: PerformanceSettingsSnapshot | null,
): Finding[] {
  const findings: Finding[] = []

  if (current) {
    if (!current.fast_ui_mode) findings.push(settingFinding(
      'setting-no-blur',
      'perf-fast-ui',
      '背景模糊当前开启。',
      '关闭背景模糊。',
      '背景模糊会增加页面绘制工作。',
      '界面毛玻璃效果会减少，不改变模型回复内容。',
      '通常立即生效；部分界面在刷新后完全更新。',
    ))
    if (!current.reduced_motion) findings.push(settingFinding(
      'setting-reduced-motion',
      'perf-reduced-motion',
      '动画效果当前较多。',
      '减少动画效果。',
      '减少持续过渡和动画更新可降低主线程与合成工作。',
      '界面过渡会更直接，不改变模型回复内容。',
      '刷新页面后完全生效。',
    ))
    if (!current.noShadows) findings.push(settingFinding(
      'setting-no-shadows',
      'perf-no-shadows',
      '阴影效果当前开启。',
      '关闭阴影效果。',
      '减少阴影绘制可降低重绘成本。',
      '界面层次感会减弱，不改变模型回复内容。',
      '通常立即生效。',
    ))
    if (current.smooth_streaming) findings.push(settingFinding(
      'setting-smooth-streaming',
      'perf-smooth-streaming',
      '平滑文字更新当前开启。',
      '关闭平滑文字更新。',
      '减少生成期间持续的文字动画与重绘。',
      '文字会更直接地更新，不改变模型输出内容。',
      '立即影响后续流式回复。',
    ))
    if (current.stream_fade_in) findings.push(settingFinding(
      'setting-stream-fade',
      'perf-stream-fade',
      '文字淡入当前开启。',
      '关闭文字淡入。',
      '减少每批新文字的视觉动画。',
      '新文字不再淡入，不改变模型输出内容。',
      '立即影响后续流式回复。',
    ))
    if (current.streaming_fps > 15) findings.push(settingFinding(
      'setting-streaming-fps',
      'perf-streaming-fps',
      `流式更新频率为 ${current.streaming_fps}，高于安全建议上限 15。`,
      '降低到 15；已有更低值不会调高。',
      '减少生成期间 UI 更新频率。',
      '流式动画细腻度会降低，不改变回复内容。',
      '立即影响后续流式回复。',
    ))
    const limit = snapshot.environment.mobile.available
      ? snapshot.environment.mobile.value ? 20 : 50
      : null
    if (limit !== null && (current.chat_truncation === 0 || current.chat_truncation > limit)) findings.push(settingFinding(
      'setting-chat-truncation',
      'perf-chat-truncation',
      current.chat_truncation === 0
        ? '同时显示的消息数为 0，会把当前聊天全部放入页面。'
        : `同时显示的消息数为 ${current.chat_truncation}，高于当前设备建议上限 ${limit}。`,
      `限制到 ${limit}；已有更低的非零值不会调高。`,
      '减少同时渲染的历史消息与页面节点。',
      '上翻时仍可继续加载历史消息，不会删除聊天数据。',
      '需要重载当前聊天。',
    ))
  }

  const dynamic = numberRecord(snapshot.metrics.dynamic)
  const longestTask = typeof dynamic?.longestTaskMs === 'number' ? dynamic.longestTaskMs : 0
  const longTaskCount = typeof dynamic?.longTaskCount === 'number' ? dynamic.longTaskCount : 0
  if (capabilityAvailable(snapshot, 'longTasks') && longTaskCount > 0 && longestTask >= 50) findings.push(finding({
    id: 'measured-long-tasks',
    layer: 'pageRendering',
    evidence: { longTaskCount, longestTaskMs: longestTask },
    severity: longestTask >= 100 ? 'risk' : 'suggestion',
    confidence: 'measurement',
    explanation: {
      detected: `6 秒检查中发现 ${longTaskCount} 次页面长时间占用，最长 ${longestTask}ms。`,
      change: '先应用安全显示建议，再次检查；若仍存在，再临时关闭扩展做对比。',
      reason: '页面连续忙碌超过 50ms，可能让点击和绘制变慢。',
      impact: '该指标属于整个页面，不能单独归因到某个扩展。',
      reload: '显示设置按各项说明生效；临时关闭扩展需要刷新。',
      restore: '显示设置和扩展排查都保留独立的恢复入口。',
    },
  }))

  const extensionResources = resourceGroups(snapshot).filter((group) => (
    typeof group.key === 'string' && group.key.startsWith('extension:')
  ))
  if (capabilityAvailable(snapshot, 'resourceTiming') && extensionResources.length > 0) findings.push(finding({
    id: 'extension-resource-evidence',
    layer: 'extensions',
    evidence: { groups: extensionResources },
    severity: 'info',
    confidence: 'correlation',
    explanation: {
      detected: `记录到 ${extensionResources.length} 个扩展的加载资源。`,
      change: '只把这些扩展列为“临时关闭扩展找卡顿”的对比对象，不会自动关闭。',
      reason: '下载或加载记录只能提供线索，不能据此判断某个扩展持续占用处理器或内存。',
      impact: '临时关闭扩展可能影响对应功能，必须由用户自己选择。',
      reload: '扩展启停需要刷新后才真正改变加载状态。',
      restore: '扩展排查会保留最初的禁用清单，可以全部恢复。',
    },
  }))

  const page = numberRecord(snapshot.metrics.page)
  if (page && capabilityAvailable(snapshot, 'pageSummary')) findings.push(finding({
    id: 'evidence-page-dom',
    layer: 'pageRendering',
    evidence: page,
    severity: 'info',
    confidence: 'measurement',
    explanation: {
      detected: '已记录当前聊天消息数、已渲染楼层和 DOM 节点摘要。',
      change: '仅作为环境证据，不因数量本身自动修改设置。',
      reason: '相同数量在不同设备和内容结构上的开销差异很大。',
      impact: '无自动变更。',
      reload: '不需要。',
      restore: '没有修改，无需恢复。',
    },
  }))
  const media = numberRecord(snapshot.metrics.media)
  if (media && capabilityAvailable(snapshot, 'mediaDom')) findings.push(finding({
    id: 'evidence-media',
    layer: 'mediaResourcesStorage',
    evidence: media,
    severity: 'info',
    confidence: 'measurement',
    explanation: {
      detected: '已记录页面媒体元素及可见/离屏摘要。',
      change: '仅作为环境证据，不自动暂停媒体或控制 GIF。',
      reason: '元素数量不能直接代表解码、显存或播放成本。',
      impact: '无自动变更。',
      reload: '不需要。',
      restore: '没有修改，无需恢复。',
    },
  }))

  const unavailable = unavailableCapabilities(snapshot.capabilities)
  if (unavailable.length > 0) findings.push(finding({
    id: 'capability-unavailable',
    layer: 'mediaResourcesStorage',
    evidence: { capabilities: unavailable.map((item) => ({ id: item.id, reason: item.reason })) },
    severity: 'info',
    confidence: 'correlation',
    explanation: {
      detected: `${unavailable.length} 项浏览器或 ST 指标在当前环境不可用。`,
      change: '保留缺失原因，不生成估算值。',
      reason: '不同浏览器和 ST 版本公开的能力不同。',
      impact: '报告信息会减少，但不会影响其他可用指标。',
      reload: '通常不需要。',
      restore: '没有修改，无需恢复。',
    },
  }))

  return findings
}
