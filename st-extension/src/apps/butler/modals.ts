import { appButton, el, foldSection } from '../widgets'
import {
  summarizeMeasurementComparison,
  type MeasurementComparison,
} from './actions'
import type { ExtensionInventoryItem, ExtensionInventoryResult } from './bridge'
import {
  readEmergencyBackup,
  type EmergencyExtensionBackup,
} from './experiments'
import { getSystemExtensionAdvice } from './extension-advisor'
import { SELF_DIRECTORY_NAME } from './self-identity'
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
  /** 恢复升级前搁浅的排查：还原原始禁用清单并清空待处理状态。 */
  discardStrandedExperiment(): Promise<void>
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

const CAPABILITY_LABELS: Record<string, string> = {
  pageSummary: '聊天与页面结构',
  performanceSettings: '性能设置',
  mediaDom: '图片与媒体',
  resourceTiming: '资源加载记录',
  storageEstimate: '站点存储空间',
  jsHeap: '网页内存信息',
  cssAnimations: '动画数量统计',
  longTasks: '页面卡顿记录',
}

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

export function renderMeasurementComparison(
  parent: HTMLElement,
  comparison: MeasurementComparison,
): void {
  const table = el('div', 'so-butler-comparison-table')
  for (const row of summarizeMeasurementComparison(comparison)) {
    const item = el('div', 'so-butler-comparison-row')
    item.dataset.metricId = row.id
    const heading = document.createElement('strong')
    heading.textContent = row.label
    const values = el('div', 'so-butler-comparison-values')
    values.textContent = `优化前 ${row.before} → 优化后 ${row.after} · ${row.change}`
    const explanation = el('small', 'so-butler-muted')
    explanation.textContent = row.explanation
    item.append(heading, values, explanation)
    table.append(item)
  }
  parent.append(table)
  text(
    parent,
    '网页内存受浏览器垃圾回收和缓存影响，单次升降不能证明设置有效；请结合长任务、帧间隔和相同条件下的多次检查判断。',
    'so-butler-muted',
  )
}

export function buildReportModal(controller: ButlerModalController) {
  return (body: HTMLElement) => {
    title(body, '详细检查结果')
    text(body, '这里只展示可观测证据和能力缺失原因，不生成综合性能分数。', 'so-butler-lead')
    const measurement = controller.getMeasurement()
    if (!measurement) {
      text(body, '尚无检查结果。关闭后运行一次基础检查或 6 秒检查。')
      return
    }

    const environment = foldSection('检查环境', true)
    environmentRows(environment.body, measurement)
    const probeLabel = measurement.probe === 'controlledScroll'
      ? '滚动长聊天检查'
      : measurement.probe === 'idle' ? '不操作时检查' : '基础信息检查'
    text(environment.body, `检查方式：${probeLabel} · ${measurement.durationMs / 1000} 秒 · ${measurement.foreground ? '页面在前台' : '页面在后台'}`)
    if (measurement.invalidReason) text(environment.body, measurement.invalidReason, 'so-butler-alert')
    body.append(environment.box)

    const metrics = foldSection('高级：原始数据', false)
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

    const capabilities = foldSection('哪些数据可以读取')
    for (const capability of measurement.capabilities) {
      text(
        capabilities.body,
        capability.available
          ? `${CAPABILITY_LABELS[capability.id] ?? capability.id}：可用`
          : `${CAPABILITY_LABELS[capability.id] ?? capability.id}：${capability.reason}`,
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
        ? '两次检查条件一致，可以查看前后变化。'
        : `两次检查条件不同，暂不计算差值：${comparison.reasons.join('；')}。这里只并列原始数据。`)
      renderMeasurementComparison(compare.body, comparison)
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

/**
 * 通用判断经验，不针对具体扩展。
 *
 * 刻意只讲能从 manifest 观察到的结构性事实与公认代价，不编造某个扩展的耗时数字：
 * 管家不读第三方扩展源码，任何"这个扩展耗时 X ms"的说法都会是猜的。
 */
const EXTENSION_COST_PRINCIPLES = [
  '按代价从大到小看：每条消息都要处理的（改写、翻译、朗读、表情切换）＞ 每次生成都要请求外部服务的 ＞ 只在你点按钮时才干活的 ＞ 只加了几个按钮或设置项的。',
  '声明了样式表的扩展会参与每次重绘。楼层多、开了动画或模糊效果时，这部分更明显。',
  '需要后端模块的扩展（向量、语音、图片生成）会等服务器响应。服务不通时，卡的可能是等待超时，不是浏览器算不过来。',
  '有依赖方的扩展不能单独关：先关依赖它的那个，否则被依赖方一起失效，你会看到一片功能同时坏掉而误判。',
  '长聊天里最先该怀疑的不是扩展数量，而是"每楼都跑一遍"的处理。楼层数翻倍，这类代价就翻倍。',
  '关之前先想清楚失去什么：正则和记忆类扩展常被角色卡或预设依赖，关掉会让玩法直接不对，代价通常大于省下的性能。',
]

/** 反查谁依赖它：关闭前必须知道会不会连带弄坏别的扩展。 */
function dependentsOf(
  extension: ExtensionInventoryItem,
  all: ExtensionInventoryItem[],
): string[] {
  const target = extension.name.trim().toLowerCase().split('/').pop() ?? ''
  if (!target) return []
  return all
    .filter((candidate) => {
      if (candidate.name === extension.name) return false
      const declared = candidate.manifest?.dependencies
      if (!declared || declared.status !== 'valid') return false
      return declared.names.some(
        (name: string) => (name.trim().toLowerCase().split('/').pop() ?? '') === target,
      )
    })
    .map((candidate) => candidate.manifest?.displayName || candidate.name)
}

function thirdPartyCard(
  extension: ExtensionInventoryItem,
  all: ExtensionInventoryItem[],
): HTMLElement {
  const card = document.createElement('details')
  card.className = 'so-butler-system-advice'
  card.dataset.extension = extension.name
  const summary = document.createElement('summary')
  const displayName = extension.manifest?.displayName || extension.name
  const stateLabel = extension.isSelf
    ? '受保护，不建议关闭'
    : extension.configuredEnabled ? '当前启用' : '当前禁用'
  summary.textContent = `${displayName} · ${stateLabel}`
  const content = el('div', 'so-butler-system-advice-body')

  text(content, `扩展标识：${extension.name}${extension.manifest?.version ? ` · 版本 ${extension.manifest.version}` : ''}`)

  if (extension.isSelf) {
    // 目录名按运行时推导，不写死：真实安装目录是 st-stage-ext，写死会报错名
    text(content, `这是 ${SELF_DIRECTORY_NAME} 自己。关掉它会同时失去手机、立绘、图库、变量、导出和管家本身，请到 SillyTavern 扩展管理里操作，管家不提供自我关闭入口。`, 'so-butler-alert')
  }

  // 只陈述 manifest 声明了什么，以及由此可推断的代价方向；不给耗时数字
  const declares: string[] = []
  if (extension.manifest?.css) declares.push('样式表（参与每次重绘）')
  if (extension.manifest?.js) declares.push('脚本')
  const modules = extension.manifest?.requiredModules
  if (modules?.status === 'valid' && modules.names.length > 0) {
    declares.push(`后端模块：${modules.names.join('、')}（需要服务器响应）`)
  }
  text(content, declares.length > 0 ? `声明了：${declares.join('；')}` : '清单里没有声明样式表或后端模块。')

  const dependencies = extension.manifest?.dependencies
  if (dependencies?.status === 'valid' && dependencies.names.length > 0) {
    text(content, `它依赖：${dependencies.names.join('、')}。这些先关掉的话，本扩展也会失效。`)
  }
  const dependents = dependentsOf(extension, all)
  if (dependents.length > 0) {
    text(content, `依赖它的扩展：${dependents.join('、')}。要关它请先关这些，否则会连带失效。`, 'so-butler-alert')
  }

  if (extension.manifest?.loadingOrder !== undefined) {
    text(content, `加载顺序：${valueText(extension.manifest.loadingOrder)}`, 'so-butler-muted')
  }
  if (!extension.manifest) {
    text(content, '读不到这个扩展的清单，因此无法说明它声明了什么。不提供关闭或性能结论。', 'so-butler-muted')
  }

  text(content, '关闭方法：SillyTavern「扩展」管理里停用，然后刷新页面。刷新前脚本和样式仍在运行。', 'so-butler-muted')
  card.append(summary, content)
  return card
}

export function buildExtensionModal(
  services: ButlerAppServices,
  controller: ButlerModalController,
) {
  return (body: HTMLElement) => {
    let disposed = false
    let inventory: ExtensionInventoryResult | null = null
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

    /**
     * 升级搁浅救援：旧版本的"临时关闭扩展找卡顿"流程已移除，但升级前正处在流程中间的
     * 用户，扩展还停在被禁用的状态。直接删掉待处理流程会让他们既看不到自己关了什么、
     * 也没有一键恢复的入口，只能去 localStorage 里翻。
     *
     * 所以保留一张一次性恢复卡：显示原始禁用清单 + 恢复按钮。恢复后清空待处理状态，
     * 卡片不再出现。这里不复现任何采样/二分步骤——那套流程不再存在。
     */
    const renderStrandedExperiment = (experiment: ButlerExperiment) => {
      title(body, '恢复上次排查前的扩展状态')
      text(body, '「临时关闭扩展找卡顿」流程已改为只读的扩展指南。你上次的排查还没结束，下面是它当时暂时禁用的扩展。', 'so-butler-lead')
      text(body, `上次暂时禁用：${(experiment.trialDisabledExtensions ?? experiment.candidateExtensions).join('、') || '（清单为空）'}`)
      text(body, `排查前的原始禁用清单：${experiment.originalDisabledExtensions.join('、') || '（原本没有禁用任何扩展）'}`)
      body.append(appButton(busy ? '正在恢复…' : '恢复排查前的扩展状态', () => run(async () => {
        await controller.discardStrandedExperiment()
        notice = '已恢复排查前的扩展状态。刷新 SillyTavern 后生效。'
      })))
      text(body, '恢复后请刷新页面：扩展的脚本与样式只有刷新才真正停止或重新加载。', 'so-butler-muted')
      if (notice) text(body, notice, 'so-butler-alert')
    }

    const renderInventory = (ready: Extract<ExtensionInventoryResult, { status: 'ready' }>) => {
      title(body, '扩展指南')
      text(body, '用途：看懂每个扩展做什么、大致的性能代价、什么情况下可以放心关掉。开关一律由你在 SillyTavern 自己的「扩展」管理里操作，管家不代你改第三方扩展的启停。', 'so-butler-lead')
      text(body, '扩展脚本和样式只有刷新后才会真正停止或重新加载，所以改完记得刷新页面再看效果。', 'so-butler-muted')
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

      text(body, '内置扩展用途与关闭建议', 'so-butler-section-title')
      text(body, '这里根据功能用途给出保守建议，不代表已经测出某个扩展耗时。内置扩展只读展示，不会被下方排障操作自动关闭。', 'so-butler-muted')
      const systemList = el('div', 'so-butler-system-advice-list')
      const systemExtensions = ready.extensions.filter((extension) => extension.type.toLowerCase() === 'system')
      for (const extension of systemExtensions) {
        const advice = getSystemExtensionAdvice(extension.name)
        const card = document.createElement('details')
        card.className = 'so-butler-system-advice'
        const summary = document.createElement('summary')
        const displayName = advice?.displayName || extension.manifest?.displayName || extension.name
        summary.textContent = advice
          ? `${displayName} · 当前${extension.configuredEnabled ? '启用' : '禁用'} · ${advice.recommendation}`
          : `${displayName} · 当前${extension.configuredEnabled ? '启用' : '禁用'} · 用途未收录`
        const content = el('div', 'so-butler-system-advice-body')
        if (advice) {
          text(content, `用途：${advice.purpose}`)
          text(content, `什么时候需要：${advice.whenNeeded}`)
          text(content, `关闭会失去：${advice.disabledImpact}`)
          text(content, `建议：${advice.recommendation}。这是用途判断，不是实际耗时结论。`, 'so-butler-muted')
        } else {
          text(content, `扩展标识：${extension.name}。当前目录没有足够资料说明用途，因此不提供关闭或性能结论。`, 'so-butler-muted')
        }
        card.append(summary, content)
        systemList.append(card)
      }
      if (systemExtensions.length === 0) text(systemList, '当前没有读取到内置扩展。', 'so-butler-muted')
      body.append(systemList)

      text(body, '第三方扩展指南', 'so-butler-section-title')
      text(body, '这里只读列出每个第三方扩展声明了什么、谁依赖它、关闭前要注意什么。管家不代你开关任何第三方扩展——要停用请到 SillyTavern 自己的「扩展」管理里操作，改完刷新页面才真正生效。', 'so-butler-lead')
      const thirdPartyExtensions = ready.extensions.filter((extension) => extension.type.toLowerCase() !== 'system')
      const list = el('div', 'so-butler-extension-list')
      for (const extension of thirdPartyExtensions) {
        list.append(thirdPartyCard(extension, thirdPartyExtensions))
      }
      if (thirdPartyExtensions.length === 0) text(list, '当前没有读取到第三方扩展。', 'so-butler-muted')
      body.append(list)

      const principles = foldSection('怎么判断一个扩展值不值得关', false, 'butler-extension-principles')
      for (const line of EXTENSION_COST_PRINCIPLES) text(principles.body, line)
      body.append(principles.box)

      text(body, '管家不会读取第三方扩展的代码，也测不出单个扩展占了多少帧。上面写的是它自己声明的信息加通用经验，不是对某个扩展的实测结论。要确认到底是谁拖慢的，只能在扩展管理里关掉一个、刷新、重复同一个操作再看整体检查结果。', 'so-butler-muted')
      if (notice) text(body, notice, 'so-butler-alert')
    }

    const render = () => {
      if (disposed) return
      body.textContent = ''
      const pending = controller.getData().pendingExperiment
      if (pending) {
        renderStrandedExperiment(pending)
        return
      }
      if (!inventory) {
        title(body, '扩展指南')
        text(body, '正在读取 SillyTavern 扩展清单...')
        return
      }
      if (inventory.status !== 'ready') {
        title(body, '扩展指南')
        text(body, inventory.reason, 'so-butler-alert')
        return
      }
      renderInventory(inventory)
    }

    render()
    void services.readExtensions().then((value) => {
      if (disposed) return
      inventory = value
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
    title(body, '记忆与服务器设置建议')
    text(body, '这里解释会影响记忆、检索、总结和服务器资源的设置。管家只读查看，不会自动修改，也不会加入一键性能优化。', 'so-butler-lead')
    const health = services.readHealth()
    const extensionState = text(body, '常用扩展状态：正在读取 SillyTavern 扩展清单...', 'so-butler-muted')
    advisorSection(body, '世界书（World Info）', [
      '世界书条目越多、扫描深度越高，生成前匹配工作通常越多；它同时承载设定一致性，不应按“越少越好”处理。',
      '优先清理重复条目、缩小不必要的扫描范围，再用相同对话比较调整前后的生成时间。',
    ])
    advisorSection(body, '向量检索（Vector Storage）', [
      '向量检索会增加索引、查询和存储工作，但能从长历史或资料库召回相关内容。',
      '只在明确不需要语义召回的对话里临时关闭并比较；不要把 Token 减少直接等同于页面渲染变快。',
    ])
    advisorSection(body, '自动总结（Summarize）', [
      '总结会额外调用模型或处理历史，但可以控制长期上下文大小。频率太高会增加请求，频率太低会让上下文膨胀。',
      '根据实际聊天长度和模型速度调整，保留角色记忆需求。',
    ])
    advisorSection(body, '自动化规则（Regex / Quick Reply）', [
      '大量生成时 Regex 规则可能增加每次回复的处理工作，且角色卡和预设可能依赖它们，因此管家不会自动关闭。',
      health.quickReplySets.available
        ? `当前检测到 ${health.quickReplySets.value} 个 Quick Reply 集合。集合数量只作信息展示，不代表运行时成本。`
        : `Quick Reply 集合数不可用：${health.quickReplySets.reason}`,
    ])
    advisorSection(body, '服务器设置（config.yaml）', [
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
