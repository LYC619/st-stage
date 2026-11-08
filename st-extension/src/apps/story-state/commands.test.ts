// Cases adapted from WeiMeng tests/commands.test.mjs (MIT); see commands.ts.
import { describe, expect, it } from 'vitest'
import { applyCommands, extractCommands, isNoUpdate } from './commands'

describe('WeiMeng command contract', () => {
  it('keeps multiple insertions on one path', () => {
    const stat = { 背包: [] }
    const commands = extractCommands(`_.insert('背包', {"名称":"一"}); _.insert('背包', {"名称":"二"}); _.insert('背包', {"名称":"三"});`)
    expect(applyCommands(stat, commands)).toBe(3); expect(stat.背包).toHaveLength(3)
  })
  it('parses multiline nested objects', () => {
    const stat = { 任务: [] }
    const commands = extractCommands(`_.insert('任务', {\n"标题":"寻找",\n"额外":{"线索":["一","二"]}\n});`)
    expect(applyCommands(stat, commands)).toBe(1); expect(stat.任务).toEqual([{ 标题: '寻找', 额外: { 线索: ['一', '二'] } }])
  })
  it('preserves parentheses and semicolons inside strings', () => {
    const stat = { 位置: { 细节: '' } }; applyCommands(stat, extractCommands("_.set('位置.细节', '门口(左侧); 靠窗');"))
    expect(stat.位置.细节).toBe('门口(左侧); 靠窗')
  })
  it('extracts commands through markdown and prefixes', () => {
    const stat = { 时间: { 显示: '' }, HP: 40 }
    expect(applyCommands(stat, extractCommands("分析\n```\n- _.set('时间.显示', '正午');\n* _.add('HP', 5);\n```"))).toBe(2)
    expect(stat).toEqual({ 时间: { 显示: '正午' }, HP: 45 })
  })
  it('uses the new value in three-argument set', () => {
    const stat = { HP: 66 }; applyCommands(stat, extractCommands("_.set('HP', 66, 74); // reason")); expect(stat.HP).toBe(74)
  })
  it('accepts MVU scalar [0] paths', () => {
    const stat = { 时间: { 显示: '早上' } }; applyCommands(stat, extractCommands("_.set('时间.显示[0]', '正午');")); expect(stat.时间.显示).toBe('正午')
  })
  it('supports three-argument object insertion', () => {
    const stat = { 背包: {} }; expect(applyCommands(stat, extractCommands(`_.insert('背包', 'key', {"名称":"钥匙"});`))).toBe(1)
    expect(stat.背包).toEqual({ key: { 名称: '钥匙' } })
  })
  it('removes array items by value', () => {
    const stat = { 背包: [{ 名称: '门票' }, { 名称: '钥匙' }] }; applyCommands(stat, extractCommands(`_.remove('背包', {"名称":"门票"});`))
    expect(stat.背包).toEqual([{ 名称: '钥匙' }])
  })
  it('recognizes NO_UPDATE only without commands', () => {
    expect(isNoUpdate('NO_UPDATE')).toBe(true); expect(isNoUpdate("NO_UPDATE _.set('x', 1);")).toBe(false)
  })
  it('retains upstream single-quote JSON and trailing comma parsing', () => {
    const stat = { 背包: [] }; expect(applyCommands(stat, extractCommands("_.insert('背包', {'名称':'药水', '数量':3,});"))).toBe(1)
    expect(stat.背包).toEqual([{ 名称: '药水', 数量: 3 }])
  })
  it('reports no change for invalid or identical instructions', () => {
    const stat = { x: 1 }; expect(applyCommands(stat, extractCommands("_.set('x', 1);"))).toBe(0); expect(extractCommands("_.set('未闭合'")).toEqual([])
  })
  it('does not let model paths or object keys mutate prototypes', () => {
    const stat = { data: {} }
    applyCommands(stat, extractCommands(`_.set('__proto__.polluted', true); _.insert('data', '__proto__', {"polluted":true}); _.insert('data', {"__proto__":{"polluted":true}});`))
    expect(Object.getPrototypeOf(stat.data)).toBe(Object.prototype); expect(Object.prototype).not.toHaveProperty('polluted')
  })
})
