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
      result: input.explanation.result ?? '尚未应用 / 待复测。',
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
    planAction('perf-fast-ui', '开启 No Blur', 'fast_ui_mode', current.fast_ui_mode, true),
    planAction('perf-reduced-motion', '开启减少动画', 'reduced_motion', current.reduced_motion, true, true),
    planAction('perf-no-shadows', '关闭阴影', 'noShadows', current.noShadows, true),
    planAction('perf-smooth-streaming', '关闭平滑流式', 'smooth_streaming', current.smooth_streaming, false),
    planAction('perf-stream-fade', '关闭流式淡入', 'stream_fade_in', current.stream_fade_in, false),
    planAction(
      'perf-streaming-fps',
      '降低流式帧率',
      'streaming_fps',
      current.streaming_fps,
      Math.min(current.streaming_fps, 15),
    ),
    planAction(
      'perf-chat-truncation',
      '限制消息 DOM 数量',
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
      restore: '可以从本次性能设置事务恢复到修改前的原值。',
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
      'No Blur 当前未开启，界面仍可能使用背景模糊。',
      '开启 No Blur。',
      '背景模糊会增加合成与 GPU 工作。',
      '界面毛玻璃效果会减少，功能与生成语义不变。',
      '通常立即生效；部分界面在刷新后完全更新。',
    ))
    if (!current.reduced_motion) findings.push(settingFinding(
      'setting-reduced-motion',
      'perf-reduced-motion',
      '减少动画当前未开启。',
      '开启减少动画。',
      '减少持续过渡和动画更新可降低主线程与合成工作。',
      '界面过渡会更直接，功能与生成语义不变。',
      '刷新页面后完全生效。',
    ))
    if (!current.noShadows) findings.push(settingFinding(
      'setting-no-shadows',
      'perf-no-shadows',
      '关闭阴影当前未开启。',
      '开启关闭阴影。',
      '减少阴影绘制可降低重绘成本。',
      '界面层次感会减弱，功能与生成语义不变。',
      '通常立即生效。',
    ))
    if (current.smooth_streaming) findings.push(settingFinding(
      'setting-smooth-streaming',
      'perf-smooth-streaming',
      '平滑流式当前开启。',
      '关闭平滑流式。',
      '减少生成期间持续的文字动画与重绘。',
      '文字会更直接地更新，不改变模型输出内容。',
      '立即影响后续流式回复。',
    ))
    if (current.stream_fade_in) findings.push(settingFinding(
      'setting-stream-fade',
      'perf-stream-fade',
      '流式淡入当前开启。',
      '关闭流式淡入。',
      '减少每批新文字的视觉动画。',
      '新文字不再淡入，不改变模型输出内容。',
      '立即影响后续流式回复。',
    ))
    if (current.streaming_fps > 15) findings.push(settingFinding(
      'setting-streaming-fps',
      'perf-streaming-fps',
      `流式帧率为 ${current.streaming_fps} FPS，高于安全方案上限 15 FPS。`,
      '降低到 15 FPS；已有更低值不会调高。',
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
        ? '消息加载数为 0，会把当前聊天全部放入 DOM。'
        : `消息加载数为 ${current.chat_truncation}，高于当前设备建议上限 ${limit}。`,
      `限制到 ${limit}；已有更低的非零值不会调高。`,
      '减少同时渲染的历史消息与 DOM 节点。',
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
      detected: `6 秒样本中观察到 ${longTaskCount} 次 Long Task，最长 ${longestTask}ms。`,
      change: '先应用安全渲染方案并用相同探针复测；若仍存在，再做扩展 A/B。',
      reason: 'Long Task 表示主线程连续占用至少 50ms，会阻塞输入和绘制。',
      impact: '该指标属于整个页面，不能单独归因到某个扩展。',
      reload: '安全渲染项按各字段要求生效；扩展 A/B 需要刷新。',
      restore: '安全设置和扩展实验分别保存恢复状态。',
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
      detected: `Resource Timing 记录到 ${extensionResources.length} 个扩展资源分组。`,
      change: '只把这些扩展作为刷新后 A/B 的候选，不自动禁用。',
      reason: '下载或加载记录仅提供相关线索，不能归因持续 CPU 或内存成本。',
      impact: 'A/B 暂时禁用扩展可能影响对应功能，必须由用户选择。',
      reload: '扩展启停需要刷新后才真正改变加载状态。',
      restore: 'A/B 流程保留最初禁用清单，可全部恢复。',
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
