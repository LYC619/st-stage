// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import {
  createVariableTreeView,
  type VariableEditDefinition,
  type VariableTreeHandlers,
  type VariableTreeModel,
} from './variable-tree'

function renderEditor(
  definition: VariableEditDefinition,
  value: unknown,
  commitResult: ReturnType<VariableTreeHandlers['commitSet']> = { ok: true, value },
  allowAdd = true,
) {
  const container = document.createElement('div')
  const commitSet = vi.fn(() => commitResult)
  const model: VariableTreeModel = {
    data: { [definition.key]: value },
    definitions: [definition],
    allowAdd,
    isMvu: false,
    delta: new Map(),
    status: 'ready',
    statusText: '测试',
    emptyText: '',
    canWrite: true,
    addHint: '',
  }
  const view = createVariableTreeView(container, {
    getModel: () => model,
    commitSet,
    commitDelete: vi.fn(),
    requestRefresh: vi.fn(),
  })
  view.render()
  ;(container.querySelector('.vm-leaf-main') as HTMLElement).click()
  return { container, commitSet, view }
}

describe('variable tree schema-aware editors', () => {
  it('数字定义使用 number 输入并在本地拦截非数字', () => {
    const { container, commitSet, view } = renderEditor(
      { key: '体力', type: 'number', range: [0, 100] },
      50,
    )
    const input = container.querySelector<HTMLInputElement>('.vm-edit-input')!
    expect(input.type).toBe('number')
    expect(input.min).toBe('0')
    expect(input.max).toBe('100')

    input.value = ''
    ;(container.querySelector('.vm-act') as HTMLButtonElement).click()
    expect(commitSet).not.toHaveBeenCalled()
    expect(container.querySelector<HTMLElement>('.vm-add-err')!.hidden).toBe(false)
    expect(view.isEditing()).toBe(true)
  })

  it('枚举定义只提供配置中的选项', () => {
    const { container, commitSet } = renderEditor(
      { key: '心情', type: 'enum', enum: ['开心', '平静'] },
      '平静',
    )
    const select = container.querySelector<HTMLSelectElement>('select.vm-edit-input')!
    expect([...select.options].map((option) => option.value)).toEqual(['开心', '平静'])
    select.value = '开心'
    ;(container.querySelector('.vm-act') as HTMLButtonElement).click()
    expect(commitSet).toHaveBeenCalledWith('心情', '开心')
  })

  it('布尔定义使用 checkbox 且提交布尔值', () => {
    const { container, commitSet } = renderEditor({ key: '在场', type: 'boolean' }, false)
    const input = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    expect(input.type).toBe('checkbox')
    input.checked = true
    ;(container.querySelector('.vm-act') as HTMLButtonElement).click()
    expect(commitSet).toHaveBeenCalledWith('在场', true)
  })

  it('文本定义保持字符串，不自动转换 true 或数字', () => {
    const { container, commitSet } = renderEditor({ key: '备注', type: 'string' }, '旧值')
    const input = container.querySelector<HTMLInputElement>('input.vm-edit-input')!
    expect(input.type).toBe('text')
    input.value = 'true'
    ;(container.querySelector('.vm-act') as HTMLButtonElement).click()
    expect(commitSet).toHaveBeenCalledWith('备注', 'true')
  })

  it('运行时拒绝提交时显示错误并保留编辑态', () => {
    const { container, commitSet, view } = renderEditor(
      { key: '体力', type: 'number', range: [0, 100] },
      50,
      { ok: false, error: '体力必须是 0 到 100' },
    )
    const input = container.querySelector<HTMLInputElement>('.vm-edit-input')!
    input.value = '80'
    ;(container.querySelector('.vm-act') as HTMLButtonElement).click()

    expect(commitSet).toHaveBeenCalledWith('体力', 80)
    expect(container.querySelector<HTMLElement>('.vm-add-err')!.textContent).toContain('0 到 100')
    expect(view.isEditing()).toBe(true)
  })

  it('模型禁用新增时不显示必然失败的新增区', () => {
    const { container } = renderEditor(
      { key: '体力', type: 'number', range: [0, 100] },
      50,
      { ok: true, value: 50 },
      false,
    )

    expect([...container.querySelectorAll('summary')].some((node) => node.textContent?.includes('新增变量'))).toBe(false)
  })
})
