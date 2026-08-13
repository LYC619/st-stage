import type { PhoneApp, PhoneAppContext } from '../../../core/phone-registry'
import { appButton, el, foldSection, selectRow } from './widgets'
import { applyTransaction, compareMeasurements, restoreTransaction, type ButlerActionBridge, type MeasurementComparison } from './butler/actions'
import { buildSafePlan, diagnose, type SafePlan } from './butler/diagnosis'
import {
  advanceBinaryIsolation,
  finishExtensionExperiment,
  prepareExtensionExperiment,
  recordExperimentComparison,
  restoreEmergencyExtensionBackup,
  resumeExtensionExperiment,
  startExtensionExperiment,
  type ExtensionExperimentDependencies,
} from './butler/experiments'
import { fitButlerDataBudget } from './butler/history'
import { migrateButlerData } from './butler/migrations'
import {
  buildAdvisorModal,
  buildExtensionModal,
  buildReportModal,
  renderFinding,
  type ButlerModalController,
} from './butler/modals'
import { createButlerAppServices, type ButlerAppServices } from './butler/runtime'
import type {
  ButlerDataV2,
  ButlerExperiment,
  ButlerHistoryRecord,
  ButlerProbe,
  ButlerTransaction,
  Finding,
  JsonValue,
  MeasurementSnapshot,
  PerformanceSettingsSnapshot,
} from './butler/types'

export type { ButlerAppServices } from './butler/runtime'

type DynamicProbe = Exclude<ButlerProbe, 'static'>

interface ButlerViewState {
  measurement: MeasurementSnapshot | null
  findings: Finding[]
  comparison: MeasurementComparison | null
  selectedProbe: DynamicProbe
  sampling: boolean
  applying: boolean
  notice: string
  noticeKind: 'info' | 'success' | 'error'
  controller: AbortController | null
  disposed: boolean
}

const FIELD_LABELS: Record<keyof PerformanceSettingsSnapshot, string> = {
  fast_ui_mode: 'No Blur',
  reduced_motion: '减少动画',
  noShadows: '关闭阴影',
  smooth_streaming: '平滑流式',
  stream_fade_in: '流式淡入',
  streaming_fps: '流式帧率',
  chat_truncation: '消息加载数',
}

function valueText(value: JsonValue | undefined): string {
  if (typeof value === 'boolean') return value ? '开' : '关'
  if (value === undefined) return '不可用'
  return String(value)
}

function text(parent: HTMLElement, value: string, className = 'so-butler-text'): HTMLElement {
  const node = el('div', className)
  node.textContent = value
  parent.append(node)
  return node
}

function latestMeasurement(data: ButlerDataV2, id?: string): MeasurementSnapshot | null {
  const records = data.history.filter((record) => record.kind === 'measurement')
  const target = id
    ? records.find((record) => record.measurement.id === id)
    : records.reduce<Extract<ButlerHistoryRecord, { kind: 'measurement' }> | null>((latest, record) => (
        !latest || record.createdAt > latest.createdAt ? record : latest
      ), null)
  return target?.measurement ?? null
}

function measurementHistory(
  measurement: MeasurementSnapshot,
  label: string,
  outcome: ButlerHistoryRecord['outcome'] = 'completed',
): Extract<ButlerHistoryRecord, { kind: 'measurement' }> {
  return {
    id: `history-${measurement.id}`,
    kind: 'measurement',
    createdAt: measurement.createdAt,
    completedAt: measurement.createdAt + measurement.durationMs,
    outcome,
    summary: {
      label,
      probe: measurement.probe,
      valid: !measurement.invalidReason,
    },
    measurement,
  }
}

function transactionHistory(transaction: ButlerTransaction): Extract<ButlerHistoryRecord, { kind: 'transaction' }> {
  return {
    id: `history-${transaction.id}`,
    kind: 'transaction',
    createdAt: transaction.createdAt,
    completedAt: transaction.completedAt ?? transaction.createdAt,
    outcome: transaction.status === 'restored'
      ? 'restored'
      : transaction.status === 'failed' ? 'failed' : 'completed',
    summary: {
      label: transaction.status === 'restored' ? '恢复性能设置' : '安全性能优化',
      applied: transaction.actions.filter((action) => action.status === 'applied').length,
      failed: transaction.actions.filter((action) => action.status === 'failed').length,
    },
    transaction,
  }
}

function experimentHistory(experiment: ButlerExperiment, label: string): Extract<ButlerHistoryRecord, { kind: 'experiment' }> {
  return {
    id: `history-${experiment.id}-${experiment.completedAt ?? experiment.currentRound}`,
    kind: 'experiment',
    createdAt: experiment.startedAt,
    completedAt: experiment.completedAt ?? experiment.startedAt,
    outcome: experiment.status === 'failed' ? 'failed' : 'completed',
    summary: { label, candidates: experiment.candidateExtensions.length },
    experiment,
  }
}

function currentDevice(services: ButlerAppServices): 'mobile' | 'desktop' {
  const mobile = services.readMobile()
  return mobile.available && mobile.value ? 'mobile' : 'desktop'
}

function upsertHistory(data: ButlerDataV2, record: ButlerHistoryRecord): ButlerDataV2 {
  return {
    ...data,
    history: [...data.history.filter((item) => item.id !== record.id), record],
  }
}

export function butlerApp(serviceOverrides?: ButlerAppServices): PhoneApp {
  const services = serviceOverrides ?? createButlerAppServices()
  let activeState: ButlerViewState | null = null
  return {
    id: 'butler',
    name: '管家',
    icon: '🧹',
    order: 3,
    mount(container, ctx) {
      activeState?.controller?.abort()
      activeState = createState()
      mountButler(container, ctx, services, activeState)
    },
    unmount() {
      if (activeState) {
        activeState.disposed = true
        activeState.controller?.abort()
      }
      activeState = null
    },
  }
}

function createState(): ButlerViewState {
  return {
    measurement: null,
    findings: [],
    comparison: null,
    selectedProbe: 'idle',
    sampling: false,
    applying: false,
    notice: '',
    noticeKind: 'info',
    controller: null,
    disposed: false,
  }
}

function mountButler(
  container: HTMLElement,
  ctx: PhoneAppContext,
  services: ButlerAppServices,
  state: ButlerViewState,
): void {
  let data = migrateButlerData(ctx.getAppData<unknown>(), {
    now: services.now(),
    idFactory: services.createId,
  })

  const persistData = (next: ButlerDataV2, candidateHistoryId?: string): ButlerDataV2 => {
    const result = fitButlerDataBudget(next, undefined, candidateHistoryId)
    data = result.data
    ctx.setAppData(data)
    if (result.status === 'protected-over-budget' || result.status === 'data-over-budget') {
      state.notice = '管家恢复状态已达到 64 KiB 上限；新的历史记录未保存。'
      state.noticeKind = 'error'
    } else if (candidateHistoryId && !result.historyAccepted) {
      state.notice = '本次结果可查看，但因 64 KiB 上限未写入历史。'
      state.noticeKind = 'info'
    }
    return data
  }

  const setNotice = (message: string, kind: ButlerViewState['noticeKind'] = 'info') => {
    state.notice = message
    state.noticeKind = kind
  }

  const safely = async (task: () => Promise<void>) => {
    try {
      await task()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '操作失败，请重试', 'error')
    }
    if (!state.disposed) render()
  }

  const readPerformanceGroup = async (): Promise<Record<string, JsonValue>> => {
    const current = services.readPerformance()
    if (!current) throw new Error('当前 SillyTavern 性能设置不完整，无法安全写入')
    return { ...current }
  }

  const actionBridge: ButlerActionBridge = {
    readGroup: async (group) => {
      if (group !== 'performanceSettings') throw new Error('当前主屏只处理性能设置事务')
      return readPerformanceGroup()
    },
    writeGroup: async (group, fields) => {
      if (group !== 'performanceSettings') throw new Error('当前主屏只处理性能设置事务')
      await services.writePerformance(fields as Partial<PerformanceSettingsSnapshot>)
    },
    persistTransaction: async (transaction) => {
      data = persistData({ ...data, activeTransaction: transaction, performanceModeOn: transaction.status !== 'restored' })
    },
    now: services.now,
    createId: services.createId,
  }

  const experimentDeps: ExtensionExperimentDependencies = {
    readExtensions: services.readExtensions,
    setExtensionEnabled: services.setExtensionEnabled,
    persistExperiment: async (experiment) => {
      data = persistData({ ...data, pendingExperiment: experiment })
    },
    reloadPage: services.reloadPage,
    now: services.now,
    createId: services.createId,
    backupStorage: services.backupStorage,
    warnRecovery: services.warnRecovery,
  }

  const runProbe = async (probe: DynamicProbe, forExperiment = false): Promise<MeasurementSnapshot> => {
    state.sampling = true
    const controller = new AbortController()
    state.controller = controller
    setNotice(forExperiment ? '正在运行扩展复测，请保持页面前台。' : '正在采样，请保持页面前台且不要操作聊天。')
    render()
    try {
      const result = probe === 'controlledScroll'
        ? await services.sampleControlledScroll(controller.signal)
        : await services.sampleIdle(controller.signal)
      state.measurement = result
      state.findings = diagnose(result, services.readPerformance())
      setNotice(result.invalidReason ?? '6 秒体检完成。', result.invalidReason ? 'error' : 'success')
      return result
    } finally {
      if (state.controller === controller) state.controller = null
      state.sampling = false
    }
  }

  const baselineForTransaction = (): MeasurementSnapshot | null => {
    const baselineId = data.activeTransaction?.baselineMeasurementId
    if (baselineId) return latestMeasurement(data, baselineId)
    const current = state.measurement
    if (current && current.probe !== 'static') return current
    return null
  }

  const applySafePlan = async (plan: SafePlan) => {
    if (state.applying || plan.actions.length === 0) return
    state.applying = true
    setNotice('正在逐项应用并回读 SillyTavern 实际值。')
    render()
    try {
      let baseline = baselineForTransaction()
      if (!baseline || baseline.probe === 'static' || baseline.invalidReason) {
        baseline = await runProbe(state.selectedProbe)
        const record = measurementHistory(
          baseline,
          '优化前基线',
          baseline.invalidReason ? 'cancelled' : 'completed',
        )
        data = persistData(upsertHistory(data, record), record.id)
        if (baseline.invalidReason) throw new Error(`基线样本无效：${baseline.invalidReason}`)
      }
      const transaction = await applyTransaction(plan.actions, actionBridge, baseline?.id)
      data = persistData(upsertHistory(data, transactionHistory(transaction)), `history-${transaction.id}`)
      setNotice(
        transaction.status === 'applied'
          ? `已应用 ${transaction.actions.filter((action) => action.status === 'applied').length} 项；可复测并随时恢复。`
          : '部分设置未成功写入，已保留事务和每项实际结果。',
        transaction.status === 'applied' ? 'success' : 'error',
      )
      if (baseline && !data.history.some((record) => record.kind === 'measurement' && record.measurement.id === baseline.id)) {
        const record = measurementHistory(baseline, '优化前基线', baseline.invalidReason ? 'cancelled' : 'completed')
        data = persistData(upsertHistory(data, record), record.id)
      }
    } finally {
      state.applying = false
    }
  }

  const remeasure = async () => {
    if (state.sampling) return
    const baseline = baselineForTransaction()
    if (!baseline || baseline.probe === 'static') throw new Error('请先完成一次 6 秒体检，再运行同探针复测')
    const result = await runProbe(baseline.probe)
    const record = measurementHistory(result, '优化后复测', result.invalidReason ? 'cancelled' : 'completed')
    data = persistData(upsertHistory(data, record), record.id)
    state.comparison = compareMeasurements(baseline, result)
    setNotice(
      state.comparison.comparable
        ? '样本条件一致，已计算原始指标差值。'
        : `样本不可直接比较：${state.comparison.reasons.join('；')}。`,
      state.comparison.comparable ? 'success' : 'info',
    )
  }

  const restorePerformance = async () => {
    const transaction = data.activeTransaction
    if (!transaction) return
    let result = await restoreTransaction(transaction, actionBridge)
    if (result.conflicts.length > 0) {
      const lines = result.conflicts.map((conflict) => (
        `${FIELD_LABELS[conflict.field as keyof PerformanceSettingsSnapshot] ?? conflict.field}：当前 ${valueText(conflict.current)}，优化后 ${valueText(conflict.after)}，原值 ${valueText(conflict.before)}`
      ))
      if (!services.confirm(`这些设置在优化后又被修改：\n${lines.join('\n')}\n\n仍要覆盖并恢复原值吗？`)) {
        setNotice('检测到后续修改，未覆盖当前设置。', 'info')
        return
      }
      result = await restoreTransaction(transaction, actionBridge, result.conflicts.map((item) => item.field))
    }
    if (result.transaction.restoreStatus === 'restored') {
      const record = transactionHistory(result.transaction)
      data = persistData({
        ...upsertHistory(data, record),
        activeTransaction: null,
        performanceModeOn: false,
      }, record.id)
      setNotice('已恢复到优化前设置。', 'success')
    } else {
      data = persistData({ ...data, activeTransaction: result.transaction })
      setNotice(result.transaction.error ?? '部分设置未恢复，请查看冲突。', 'error')
    }
  }

  const modalController: ButlerModalController = {
    getData: () => data,
    getMeasurement: () => state.measurement,
    getFindings: () => state.findings,
    getComparison: () => state.comparison,
    async startExperiment(kind, selected, inventory) {
      let baseline = state.measurement
      if (!baseline || baseline.probe === 'static' || baseline.invalidReason) {
        baseline = await runProbe(state.selectedProbe)
        if (baseline.invalidReason) throw new Error('基线样本无效，未开始扩展实验')
      }
      const record = measurementHistory(baseline, '扩展实验基线')
      data = persistData(upsertHistory(data, record), record.id)
      const prepared = prepareExtensionExperiment(kind, selected, inventory, baseline.id, {
        now: services.now,
        createId: services.createId,
      })
      const result = await startExtensionExperiment(prepared, experimentDeps)
      data = persistData({ ...data, pendingExperiment: result.experiment })
      if (!result.batch.ok) throw new Error(result.experiment.notes ?? '扩展变更失败')
    },
    async sampleExperiment() {
      const pending = data.pendingExperiment
      if (!pending || pending.status !== 'sampling') throw new Error('当前没有等待复测的扩展实验')
      const baseline = latestMeasurement(data, pending.baselineMeasurementId)
      const probe = baseline?.probe === 'controlledScroll' ? 'controlledScroll' : 'idle'
      const comparison = await runProbe(probe, true)
      const record = measurementHistory(comparison, '扩展实验复测', comparison.invalidReason ? 'cancelled' : 'completed')
      data = persistData(upsertHistory(data, record), record.id)
      if (comparison.invalidReason) throw new Error('扩展复测样本无效，请重试')
      const next = recordExperimentComparison(pending, comparison.id)
      data = persistData({ ...data, pendingExperiment: next })
      if (baseline) state.comparison = compareMeasurements(baseline, comparison)
    },
    async finishExperiment(decision) {
      const pending = data.pendingExperiment
      if (!pending) return
      const completed = await finishExtensionExperiment(pending, decision, experimentDeps)
      if (completed.status !== 'completed') {
        data = persistData({ ...data, pendingExperiment: completed })
        throw new Error(completed.notes ?? '扩展清单恢复失败')
      }
      const record = experimentHistory(completed, decision === 'keep' ? '保留扩展 A/B 结果' : '恢复扩展禁用清单')
      data = persistData({ ...upsertHistory(data, record), pendingExperiment: null }, record.id)
      setNotice(decision === 'keep' ? '已保留当前扩展禁用结果。' : '已恢复最初扩展禁用清单。', 'success')
    },
    async advanceBinary(symptomImproved) {
      const pending = data.pendingExperiment
      if (!pending) return
      if (pending.candidateExtensions.length <= 1) {
        setNotice(`已缩小到：${pending.candidateExtensions[0] ?? '无候选'}。可保留或恢复原清单。`, 'success')
        return
      }
      const next = await advanceBinaryIsolation(pending, symptomImproved, experimentDeps)
      data = persistData({ ...data, pendingExperiment: next })
    },
    async restoreEmergencyBackup(backup) {
      const result = await restoreEmergencyExtensionBackup(backup, experimentDeps)
      if (!result.ok) {
        throw new Error(`紧急恢复失败：${result.failed.map((item) => `${item.name}（${item.error}）`).join('、')}`)
      }
      setNotice('紧急扩展禁用清单已恢复。', 'success')
    },
  }

  const renderPlan = (parent: HTMLElement, plan: SafePlan) => {
    const changed = foldSection(`将修改（${plan.actions.length}）`, true, 'butler-plan-changed')
    if (plan.actions.length === 0) text(changed.body, '当前性能设置已不高于安全方案。')
    for (const action of plan.actions) {
      text(changed.body, `${FIELD_LABELS[action.field as keyof PerformanceSettingsSnapshot] ?? action.label}：${valueText(action.before)} → ${valueText(action.requested)}${action.reloadRequired ? '（需刷新或重载聊天）' : ''}`)
    }
    parent.append(changed.box)

    const unchanged = foldSection(`保持不变（${plan.unchanged.length}）`, false, 'butler-plan-unchanged')
    for (const action of plan.unchanged) {
      text(unchanged.body, `${FIELD_LABELS[action.field as keyof PerformanceSettingsSnapshot] ?? action.label}：${valueText(action.before)} → ${valueText(action.requested)}`)
    }
    parent.append(unchanged.box)
  }

  const renderTransaction = (parent: HTMLElement, transaction: ButlerTransaction) => {
    const result = foldSection('逐项实际结果', true, 'butler-transaction-results')
    for (const action of transaction.actions) {
      const suffix = action.error ? ` · ${action.error}` : ''
      text(result.body, `${action.label}：请求 ${valueText(action.requested)}，实际 ${valueText(action.actual)} · ${action.status}${suffix}`)
    }
    parent.append(result.box)
  }

  const render = () => {
    if (state.disposed) return
    container.textContent = ''
    container.classList.add('so-butler-app')
    const current = services.readPerformance()
    const mobile = services.readMobile()
    const health = services.readHealth()

    const header = el('div', 'so-app-section so-butler-hero')
    const heading = el('div', 'so-app-title')
    heading.textContent = '环境体检'
    const summary = el('div', 'so-butler-summary-grid')
    const summaryItems = [
      ['设备', mobile.available ? mobile.value ? '移动端' : '桌面端' : '未知'],
      ['性能设置', current ? '可读写' : '不可用'],
      ['禁用扩展', health.disabledExtensions.available ? String(health.disabledExtensions.value) : '未知'],
      ['最近记录', String(data.history.length)],
    ]
    for (const [label, value] of summaryItems) {
      const item = el('div', 'so-butler-summary-item')
      const small = document.createElement('small')
      small.textContent = label
      const strong = document.createElement('strong')
      strong.textContent = value
      item.append(small, strong)
      summary.append(item)
    }
    header.append(heading, summary)
    if (!state.measurement) text(header, '正在读取当前环境...', 'so-butler-muted')
    else {
      text(header, state.measurement.invalidReason
        ? `最近体检无效：${state.measurement.invalidReason}`
        : `最近体检：${state.measurement.probe === 'static' ? '静态' : '6 秒'} · ${state.findings.length} 条可解释发现`,
      state.measurement.invalidReason ? 'so-butler-alert' : 'so-butler-text')
    }
    container.append(header)

    const sampling = el('div', 'so-app-section')
    const sampleTitle = el('div', 'so-app-title')
    sampleTitle.textContent = '短时采样'
    sampling.append(sampleTitle)
    text(sampling, '静置探针观察页面自身活动；受控滚动会固定滚动一段长聊天并恢复原位置。切后台、生成、聊天变化或用户干预会取消。')
    sampling.append(selectRow(
      '探针',
      state.selectedProbe,
      [
        { value: 'idle', label: '6 秒静置' },
        { value: 'controlledScroll', label: '6 秒受控滚动' },
      ],
      (value) => {
        state.selectedProbe = value as DynamicProbe
        render()
      },
    ))
    if (state.sampling) sampling.append(appButton('取消采样', () => state.controller?.abort()))
    else sampling.append(appButton('开始 6 秒体检', () => void safely(async () => {
      const result = await runProbe(state.selectedProbe)
      const record = measurementHistory(result, result.probe === 'idle' ? '静置体检' : '受控滚动体检', result.invalidReason ? 'cancelled' : 'completed')
      data = persistData(upsertHistory(data, record), record.id)
    })))
    container.append(sampling)

    const findingSection = foldSection(`核心发现（${state.findings.length}）`, true, 'butler-findings')
    if (state.findings.length === 0) text(findingSection.body, state.measurement ? '当前证据没有触发建议。' : '静态体检完成后显示。')
    for (const finding of state.findings.slice(0, 5)) renderFinding(findingSection.body, finding)
    container.append(findingSection.box)

    const planSection = el('div', 'so-app-section')
    const planTitle = el('div', 'so-app-title')
    planTitle.textContent = '安全优化'
    planSection.append(planTitle)
    if (!current) {
      text(planSection, '当前 SillyTavern 没有公开完整性能设置，管家只做只读体检。', 'so-butler-alert')
    } else {
      const plan = buildSafePlan(current, currentDevice(services))
      renderPlan(planSection, plan)
      if (data.activeTransaction) {
        renderTransaction(planSection, data.activeTransaction)
        const actions = el('div', 'so-butler-actions')
        actions.append(
          appButton(state.sampling ? '正在复测' : '用相同探针复测', () => void safely(remeasure)),
          appButton('恢复本次性能设置', () => void safely(restorePerformance)),
        )
        planSection.append(actions)
      } else if (plan.actions.length > 0) {
        planSection.append(appButton(state.applying ? '正在应用' : '应用安全优化', () => void safely(() => applySafePlan(plan))))
      }
    }
    if (state.comparison) {
      const comparison = foldSection('复测结果', true, 'butler-comparison')
      text(comparison.body, state.comparison.comparable
        ? '样本条件一致，以下差值为“复测 - 基线”。负值通常表示对应耗时或数量下降。'
        : `样本不可直接比较：${state.comparison.reasons.join('；')}。只在完整报告并列原始值。`)
      if (state.comparison.comparable) {
        for (const [key, delta] of Object.entries(state.comparison.deltas)) {
          text(comparison.body, `${key} 差值：${delta >= 0 ? '+' : ''}${delta}`)
        }
      }
      planSection.append(comparison.box)
    }
    container.append(planSection)

    const modalActions = el('div', 'so-app-section so-butler-modal-actions')
    modalActions.append(
      appButton('完整报告', () => ctx.openModal(buildReportModal(modalController))),
      appButton('扩展排障', () => ctx.openModal(buildExtensionModal(services, modalController))),
      appButton('玩法与服务端顾问', () => ctx.openModal(buildAdvisorModal(services))),
    )
    container.append(modalActions)

    if (data.pendingExperiment) {
      const pending = el('div', 'so-app-section so-butler-pending')
      text(pending, `扩展实验进行中：${data.pendingExperiment.kind === 'binaryIsolation' ? '二分隔离' : '选定扩展 A/B'} · 第 ${data.pendingExperiment.currentRound} 轮`)
      pending.append(appButton('继续扩展排障', () => ctx.openModal(buildExtensionModal(services, modalController))))
      container.append(pending)
    }

    if (state.notice) text(container, state.notice, `so-butler-notice so-butler-notice-${state.noticeKind}`)
  }

  if (data.pendingExperiment?.status === 'awaitingReload') {
    data = persistData({ ...data, pendingExperiment: resumeExtensionExperiment(data.pendingExperiment) })
  }
  persistData(data)
  render()
  void safely(async () => {
    const measurement = await services.collectStatic()
    if (!state.measurement || state.measurement.probe === 'static') {
      state.measurement = measurement
      state.findings = diagnose(measurement, services.readPerformance())
    }
    if (!state.notice) setNotice('静态体检完成。需要动态证据时运行 6 秒体检。', 'success')
  })
}
