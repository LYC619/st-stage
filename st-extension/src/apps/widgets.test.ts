// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { rangeRow } from './widgets'

describe('rangeRow', () => {
  it('拖动时更新稳定读数，松手 change 时才提交', () => {
    const onInput = vi.fn()
    const onCommit = vi.fn()
    const row = rangeRow('不透明度', 80, 20, 100, onInput, onCommit, (value) => `${value}%`)
    const input = row.querySelector<HTMLInputElement>('input[type="range"]')!
    const output = row.querySelector<HTMLOutputElement>('output')!

    expect(input.value).toBe('80')
    expect(output.value).toBe('80%')

    input.value = '55'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(output.value).toBe('55%')
    expect(onInput).toHaveBeenLastCalledWith(55)
    expect(onCommit).not.toHaveBeenCalled()

    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(onCommit).toHaveBeenLastCalledWith(55)
  })

  it('夹取越界值并同步回输入框', () => {
    const onInput = vi.fn()
    const onCommit = vi.fn()
    const row = rangeRow('数值', 50, 20, 100, onInput, onCommit)
    const input = row.querySelector<HTMLInputElement>('input')!

    input.value = '120'
    input.dispatchEvent(new Event('input'))
    expect(input.value).toBe('100')
    expect(onInput).toHaveBeenLastCalledWith(100)

    input.dispatchEvent(new Event('change'))
    expect(onCommit).toHaveBeenLastCalledWith(100)
  })
})
