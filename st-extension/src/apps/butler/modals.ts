import { appButton, el, foldSection } from '../widgets'
import type { MeasurementComparison } from './actions'
import type { ExtensionInventoryResult } from './bridge'
import {
  defaultExperimentCandidates,
  dependencyWarnings,
  readEmergencyBackup,
  type EmergencyExtensionBackup,
} from './experiments'
import type { ButlerAppServices } from './runtime'
import type {
  ButlerDataV2,
  ButlerExperiment,
  Finding,
  MeasurementSnapshot,
} from './types'

export interface ButlerModalController {
  getData(): ButlerDataV2
  getMeasurement(): MeasurementSnapshot | null
  getFindings(): Finding[]
  getComparison(): MeasurementComparison | null
  startExperiment(
    kind: ButlerExperiment['kind'],
    selected: string[],
    inventory: Extract<ExtensionInventoryResult, { status: 'ready' }>,
  ): Promise<void>
  sampleExperiment(): Promise<void>
  finishExperiment(decision: 'keep' | 'restore'): Promise<void>
  advanceBinary(symptomImproved: boolean): Promise<void>
  restoreEmergencyBackup(backup: EmergencyExtensionBackup): Promise<void>
}

const LAYER_LABELS: Record<Finding['layer'], string> = {
  pageRendering: '页面与渲染',
  mediaResourcesStorage: '媒体、资源与存储',
  extensions: '扩展',
  generationContext: '生成与上下文',
}

const EXPLANATION_LABELS: Array<[keyof Finding['explanation'], string]> = [
  ['detected', '检测到什么'],
  ['change', '建议修改'],
  ['reason', '为什么可能改善'],
  ['impact', '可能影响'],
  ['reload', '生效与刷新'],
  ['restore', '如何恢复'],
  ['result', '实测结果'],
]

function text(parent: HTMLElement, value: string, className = 'so-butler-text'): HTMLElement {
  const node = el('div', className)
  node.textContent = value
  parent.append(node)
  return node
}

function title(parent: HTMLElement, value: string): void {
  text(parent, value, 'so-butler-modal-title')
}

function valueText(value: unknown): string {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2)
  if (typeof value === 'string' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function renderFinding(parent: HTMLElement, finding: Finding): HTMLElement {
  const card = document.createElement('details')
  card.className = `so-butler-finding so-butler-severity-${finding.severity}`
  const summary = document.createElement('summary')
  const layer = el('span', 'so-butler-layer')
  layer.textContent = LAYER_LABELS[finding.layer]
  const detected = document.createElement('span')
  detected.textContent = finding.explanation.detected
  summary.append(layer, detected)
  const body = el('div', 'so-butler-finding-body')
  for (const [key, label] of EXPLANATION_LABELS) {
    const row = el('div', 'so-butler-explanation-row')
    const strong = document.createElement('strong')
    strong.textContent = label
    const content = document.createElement('span')
    content.textContent = finding.explanation[key]
    row.append(strong, content)
    body.append(row)
  }
  card.append(summary, body)
  parent.append(card)
  return card
}

function environmentRows(parent: HTMLElement, measurement: MeasurementSnapshot): void {
  const entries = [
    ['SillyTavern', measurement.environment.stVersion],
    ['st-stage', measurement.environment.stageBuild],
    ['设备', measurement.environment.mobile],
    ['聊天标识', measurement.chatKey ? { available: true as const, value: measurement.chatKey } : { available: false as const, reason: '不可用' }],
  ] as const
  for (const [label, observed] of entries) {
    const row = el('div', 'so-butler-kv')
    const key = document.createElement('span')
    key.textContent = label
    const value = document.createElement('strong')
    value.textContent = observed.available ? valueText(observed.value) : observed.reason
    if (!observed.available) value.className = 'so-butler-muted'
    row.append(key, value)
    parent.append(row)
  }
}

export function buildReportModal(controller: ButlerModalController) {
  return (body: HTMLElement) => {
    title(body, '完整体检报告')
    text(body, '这里只展示可观测证据和能力缺失原因，不生成综合性能分数。', 'so-butler-lead')
    const measurement = controller.getMeasurement()
    if (!measurement) {
      text(body, '尚无体检结果。关闭后运行一次静态或 6 秒体检。')
      return
    }

    const environment = foldSection('环境与采样条件', true)
    environmentRows(environment.body, measurement)
    text(environment.body, `探针：${measurement.probe} · ${measurement.durationMs / 1000} 秒 · ${measurement.foreground ? '前台' : '后台'}`)
    if (measurement.invalidReason) text(environment.body, measurement.invalidReason, 'so-butler-alert')
    body.append(environment.box)

    const metrics = foldSection('原始摘要指标', true)
    for (const [key, value] of Object.entries(measurement.metrics)) {
      const row = el('div', 'so-butler-metric-block')
      const strong = document.createElement('strong')
      strong.textContent = key
      const pre = document.createElement('pre')
      pre.textContent = JSON.stringify(value, null, 2)
      row.append(strong, pre)
      metrics.body.append(row)
    }
    body.append(metrics.box)

    const capabilities = foldSection('能力支持情况')
    for (const capability of measurement.capabilities) {
      text(
        capabilities.body,
        capability.available ? `${capability.id}：可用` : `${capability.id}：${capability.reason}`,
        capability.available ? 'so-butler-text' : 'so-butler-muted',
      )
    }
    body.append(capabilities.box)

    const findings = foldSection(`全部发现（${controller.getFindings().length}）`, true)
    for (const finding of controller.getFindings()) renderFinding(findings.body, finding)
    body.append(findings.box)

    const comparison = controller.getComparison()
    if (comparison) {
      const compare = foldSection('最近一次前后对比', true)
      text(compare.body, comparison.comparable
        ? '样本条件一致，可以查看原始差值。'
        : `样本不可直接比较：${comparison.reasons.join('；')}。这里只并列原始值。`)
      if (comparison.comparable) {
        for (const [key, value] of Object.entries(comparison.deltas)) {
          text(compare.body, `${key}：${value >= 0 ? '+' : ''}${value}`)
        }
      }
      body.append(compare.box)
    }

    const history = foldSection(`最近操作（${controller.getData().history.length}）`)
    for (const record of [...controller.getData().history].reverse()) {
      text(history.body, `${new Date(record.createdAt).toLocaleString()} · ${String(record.summary.label ?? record.kind)} · ${record.outcome}`)
    }
    if (controller.getData().history.length === 0) text(history.body, '暂无已保存操作。')
    body.append(history.box)
  }
}

function experimentStatus(experiment: ButlerExperiment): string {
  const labels: Record<ButlerExperiment['status'], string> = {
    prepared: '准备中',
    awaitingReload: '等待刷新',
    sampling: '等待扩展复测',
    awaitingDecision: '等待结果决定',
    restoring: '正在恢复',
    completed: '已完成',
    failed: '失败',
  }
  return labels[experiment.status]
}

export function buildExtensionModal(
  services: ButlerAppServices,
  controller: ButlerModalController,
) {
  return (body: HTMLElement) => {
    let disposed = false
    let inventory: ExtensionInventoryResult | null = null
    let selected = new Set<string>()
    let busy = false
    let notice = ''
    let emergencyBackup = readEmergencyBackup(services.backupStorage)

    const run = async (task: () => Promise<void>) => {
      if (busy) return
      busy = true
      notice = ''
      render()
      try {
        await task()
      } catch (error) {
        notice = error instanceof Error ? error.message : '操作失败'
      } finally {
        busy = false
        if (!disposed) render()
      }
    }

    const renderPending = (experiment: ButlerExperiment) => {
      title(body, '扩展排障')
      text(body, `当前流程：${experiment.kind === 'binaryIsolation' ? '二分隔离' : '选定扩展 A/B'} · 第 ${experiment.currentRound} 轮`)
      text(body, `状态：${experimentStatus(experiment)}`, experiment.notes ? 'so-butler-alert' : 'so-butler-lead')
      if (experiment.notes) text(body, experiment.notes, 'so-butler-alert')
      text(body, `本轮暂时禁用：${(experiment.trialDisabledExtensions ?? experiment.candidateExtensions).join('、')}`)
      text(body, '最初禁用清单已同时保存在管家数据、localStorage 和控制台恢复命令中。')

      if (experiment.status === 'sampling') {
        body.append(appButton(busy ? '正在复测' : '运行扩展复测', () => run(controller.sampleExperiment)))
      }
      if (experiment.status === 'awaitingDecision') {
        if (
          experiment.kind === 'binaryIsolation' &&
          experiment.candidateExtensions.length > 1 &&
          experiment.reloadRequiredAfterDecision === undefined
        ) {
          const actions = el('div', 'so-butler-actions')
          actions.append(
            appButton('症状改善', () => run(() => controller.advanceBinary(true))),
            appButton('症状无改善', () => run(() => controller.advanceBinary(false))),
          )
          body.append(actions)
        }
        const decisions = el('div', 'so-butler-actions')
        decisions.append(
          appButton('保留当前禁用', () => run(() => controller.finishExperiment('keep'))),
          appButton('恢复原清单', () => run(() => controller.finishExperiment('restore'))),
        )
        body.append(decisions)
      }
      if (notice) text(body, notice, 'so-butler-alert')
    }

    const renderInventory = (ready: Extract<ExtensionInventoryResult, { status: 'ready' }>) => {
      title(body, '扩展排障')
      text(body, '扩展脚本和样式只有刷新后才会真正停止加载。管家使用 SillyTavern 官方禁用接口，不修改内部数组。', 'so-butler-lead')
      if (!ready.governance.writable) text(body, ready.governance.reason ?? '当前版本只支持查看。', 'so-butler-alert')
      if (emergencyBackup) {
        const backup = foldSection('检测到紧急恢复备份', true, 'butler-emergency-backup')
        text(backup.body, `保存时间：${new Date(emergencyBackup.createdAt).toLocaleString()} · 原禁用清单 ${emergencyBackup.disabledExtensions.length} 项。`)
        backup.body.append(appButton('恢复备份中的禁用清单', () => run(async () => {
          if (!emergencyBackup) return
          await controller.restoreEmergencyBackup(emergencyBackup)
          emergencyBackup = null
          notice = '紧急备份已恢复。'
        })))
        body.append(backup.box)
      }

      text(body, '第三方扩展', 'so-butler-section-title')
      const list = el('div', 'so-butler-extension-list')
      for (const extension of ready.extensions) {
        const row = el('label', 'so-butler-extension-row')
        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.value = extension.name
        checkbox.checked = selected.has(extension.name)
        checkbox.disabled = extension.isSelf || !extension.configuredEnabled || !ready.governance.writable
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) selected.add(extension.name)
          else selected.delete(extension.name)
        })
        const label = el('span', 'so-butler-extension-name')
        label.textContent = extension.manifest?.displayName
          ? `${extension.manifest.displayName} (${extension.name})`
          : extension.name
        const state = el('small', 'so-butler-muted')
        state.textContent = extension.isSelf
          ? '受保护'
          : extension.configuredEnabled ? `${extension.type} · 当前启用` : `${extension.type} · 当前禁用`
        row.append(checkbox, label, state)
        list.append(row)
      }
      body.append(list)

      const start = async (kind: ButlerExperiment['kind']) => {
        const names = [...selected]
        if (names.length === 0) throw new Error('至少选择一个启用的第三方扩展')
        const warnings = dependencyWarnings(ready, names)
        if (warnings.length > 0) {
          const detail = warnings.map((item) => `${item.dependent} 依赖 ${item.dependency}`).join('\n')
          if (!services.confirm(`所选扩展存在启用中的依赖方：\n${detail}\n\n仍要开始临时禁用实验吗？`)) return
        }
        await controller.startExperiment(kind, names, ready)
      }
      const actions = el('div', 'so-butler-actions')
      actions.append(
        appButton('开始选定扩展 A/B', () => run(() => start('selectedExtensions'))),
        appButton('开始二分隔离', () => run(() => start('binaryIsolation'))),
      )
      body.append(actions)
      text(body, '系统扩展默认不参与；st-stage 自身永远不可选。二分隔离只在你选定的候选集内逐轮缩小范围。')
      if (notice) text(body, notice, 'so-butler-alert')
    }

    const render = () => {
      if (disposed) return
      body.textContent = ''
      const pending = controller.getData().pendingExperiment
      if (pending) {
        renderPending(pending)
        return
      }
      if (!inventory) {
        title(body, '扩展排障')
        text(body, '正在读取 SillyTavern 扩展清单...')
        return
      }
      if (inventory.status !== 'ready') {
        title(body, '扩展排障')
        text(body, inventory.reason, 'so-butler-alert')
        return
      }
      renderInventory(inventory)
    }

    render()
    void services.readExtensions().then((value) => {
      if (disposed) return
      inventory = value
      if (value.status === 'ready') selected = new Set(defaultExperimentCandidates(value))
      render()
    })
    return () => { disposed = true }
  }
}

function advisorSection(body: HTMLElement, heading: string, paragraphs: string[]): void {
  const section = foldSection(heading, true)
  for (const paragraph of paragraphs) text(section.body, paragraph)
  body.append(section.box)
}

export function buildAdvisorModal(services: ButlerAppServices) {
  return (body: HTMLElement) => {
    title(body, '玩法与服务端顾问')
    text(body, '这部分可能影响记忆、检索和上下文语义，默认只提供建议，不进入一键安全优化。', 'so-butler-lead')
    const health = services.readHealth()
    const extensionState = text(body, '常用扩展状态：正在读取 SillyTavern 扩展清单...', 'so-butler-muted')
    advisorSection(body, 'World Info', [
      '世界书条目越多、扫描深度越高，生成前匹配工作通常越多；它同时承载设定一致性，不应按“越少越好”处理。',
      '优先清理重复条目、缩小不必要的扫描范围，再用相同对话做生成前后 A/B。',
    ])
    advisorSection(body, 'Vector Storage', [
      '向量检索会增加索引、查询和存储工作，但能从长历史或资料库召回相关内容。',
      '只在明确不需要语义召回的对话里临时关闭并比较；不要把 Token 减少直接等同于页面渲染变快。',
    ])
    advisorSection(body, 'Summarize', [
      '总结会额外调用模型或处理历史，但可以控制长期上下文大小。频率太高会增加请求，频率太低会让上下文膨胀。',
      '根据实际聊天长度和模型速度调整，保留角色记忆需求。',
    ])
    advisorSection(body, 'Regex 与 Quick Reply', [
      '大量生成时 Regex 规则可能增加每次回复的处理工作，且角色卡和预设可能依赖它们，因此管家不会自动关闭。',
      health.quickReplySets.available
        ? `当前检测到 ${health.quickReplySets.value} 个 Quick Reply 集合。集合数量只作信息展示，不代表运行时成本。`
        : `Quick Reply 集合数不可用：${health.quickReplySets.reason}`,
    ])
    advisorSection(body, '服务端 config.yaml', [
      'requestCompression：长聊天或弱网可减少传输体积；修改后需要重启 SillyTavern。',
      'lazyLoadCharacters：大量角色卡时应保持开启；旧配置可能沿用 false。',
      'memoryCacheCapacity：按角色卡规模设置缓存容量，容量越高通常占用更多服务端内存。',
      'useDiskCache：只有磁盘极慢时才考虑关闭。管家没有稳定公开接口读取或修改这些键，因此不会伪装成已检测。',
    ])
    void services.readExtensions().then((inventory) => {
      if (inventory.status !== 'ready') {
        extensionState.textContent = `常用扩展状态：不可用（${inventory.reason}）`
        return
      }
      const status = (label: string, names: string[]) => {
        const found = inventory.extensions.find((extension) => names.includes(extension.name))
        return found ? `${label}：当前${found.configuredEnabled ? '启用' : '禁用'}` : `${label}：未检测到`
      }
      extensionState.textContent = [
        status('Vector Storage', ['vectors']),
        status('Summarize', ['memory']),
        status('Regex', ['regex']),
      ].join('；')
    }).catch(() => {
      extensionState.textContent = '常用扩展状态：读取失败'
    })
  }
}
