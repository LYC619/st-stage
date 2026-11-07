// Summarizes retained axe uncertainty. Computed ratios are evidence, not WCAG certification.
import { readFileSync, writeFileSync } from 'node:fs'
const args = process.argv.slice(2)
const option = key => args[args.indexOf(key) + 1]
for (const key of ['--historical', '--current', '--output']) if (!args.includes(key)) throw new Error('missing ' + key)
const read = name => JSON.parse(readFileSync(name, 'utf8'))
function metrics(report) {
  const scans = report.scenarios.flatMap(s => s.scans), rules = scans.flatMap(s => s.incomplete)
  const nodes = rules.flatMap(rule => rule.nodes.map(node => ({ rule: rule.id, ...node })))
  return { build: report.build, scans: scans.length, violations: scans.reduce((n, s) => n + s.violations.length, 0),
    incompleteRecords: rules.length, nodeRecords: nodes.length,
    uniqueRuleTargetReason: new Set(nodes.map(n => JSON.stringify([n.rule, n.target, n.failureSummary]))).size }
}
const current = read(option('--current'))
const nodes = current.scenarios.flatMap(s => s.scans.flatMap(scan => (scan.nodeReview || []).map(n => ({ scenario: s.name, screen: scan.name, ...n }))))
function category(node) {
  if (node.rule === 'aria-valid-attr-value') return 'popup-reference'
  if (node.rule === 'label-content-name-mismatch') return 'symbol-name'
  for (const [pattern, name] of [[/no value/, 'empty-input'], [/gradient/, 'gradient'], [/background image/, 'select-background-image'], [/image node/, 'image-overlay'], [/overlap|obscured/, 'overlap']]) if (pattern.test(node.reason)) return name
  return 'symbol-contrast'
}
const rgba = value => { const n = value.match(/[\d.]+/g)?.map(Number); return n?.length >= 3 ? [...n.slice(0, 3), n[3] ?? 1] : undefined }
const over = (front, back) => front.slice(0, 3).map((v, i) => v * front[3] + back[i] * (1 - front[3]))
const luminance = rgb => rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
function contrast(node) {
  if (node.rule !== 'color-contrast' || /overlap|obscured|image node|background image/.test(node.reason)) return undefined
  let background = [255, 255, 255]
  for (const [index, layer] of [...node.backgrounds].reverse().entries()) {
    // Ancestor opacity requires group compositing; leave it unresolved.
    if (index < node.backgrounds.length - 1 && Number(layer.opacity) !== 1) return undefined
    const color = rgba(layer.color); if (color) background = over(color, background)
    if (layer.image !== 'none') {
      const colors = layer.image.match(/rgba?\([^)]+\)/g) || []
      if (colors.length !== 2 || colors[0] !== colors[1]) return undefined
      background = over(rgba(colors[0]), background)
    }
  }
  const foreground = rgba(node.foreground); if (!foreground) return undefined
  foreground[3] *= Number(node.backgrounds[0].opacity)
  const levels = [luminance(over(foreground, background)), luminance(background)].sort((a, b) => b - a)
  return +((levels[0] + 0.05) / (levels[1] + 0.05)).toFixed(2)
}
const result = { scope: 'No axe suppression. Ratios use recorded solid/equal-stop gradient backgrounds and element opacity; images, spatial overlap, varying gradients and ancestor opacity remain unresolved. No human screen-reader or full WCAG claim.',
  historical: metrics(read(option('--historical'))), current: metrics(current), groups: {}, computedContrast: [], populatedInputs: [], popupReferences: [] }
for (const node of nodes) {
  const key = category(node), group = result.groups[key] ??= { nodes: 0, targets: [], screens: [] }
  group.nodes++
  if (!group.targets.includes(node.target[0])) group.targets.push(node.target[0])
  if (!group.screens.includes(node.scenario + '/' + node.screen)) group.screens.push(node.scenario + '/' + node.screen)
  const ratio = contrast(node)
  if (ratio !== undefined) result.computedContrast.push({ scenario: node.scenario, screen: node.screen, target: node.target, ratio })
  if (node.populatedContrast) result.populatedInputs.push({ scenario: node.scenario, screen: node.screen, target: node.target, ...node.populatedContrast })
  if (node.rule === 'aria-valid-attr-value') result.popupReferences.push({ scenario: node.scenario, screen: node.screen, target: node.target, controls: node.controls })
}
writeFileSync(option('--output'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ historical: result.historical, current: result.current,
  computedNodes: result.computedContrast.length, minimumComputedRatio: Math.min(...result.computedContrast.map(n => n.ratio)),
  below45: result.computedContrast.filter(n => n.ratio < 4.5), popupReferencesExist: result.popupReferences.every(n => n.controls.length && n.controls.every(c => c.exists)) }, null, 2))
