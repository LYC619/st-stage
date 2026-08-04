// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createComposerBridge } from './composer'

function mountComposer(value = ''): HTMLTextAreaElement {
  const input = document.createElement('textarea')
  input.id = 'send_textarea'
  input.value = value
  document.body.append(input)
  return input
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('createComposerBridge', () => {
  it('写入 ST 输入框、触发 input 并聚焦，但不自动发送', () => {
    const input = mountComposer()
    const onInput = vi.fn()
    input.addEventListener('input', onInput)
    const focus = vi.spyOn(input, 'focus')
    const bridge = createComposerBridge()

    expect(bridge.insertDraft('我选择前进。')).toEqual({ ok: true })
    expect(input.value).toBe('我选择前进。')
    expect(onInput).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it('输入框不存在时返回可显示错误', () => {
    expect(createComposerBridge().insertDraft('行动')).toEqual({
      ok: false,
      error: expect.stringMatching(/输入框/),
    })
  })

  it('仅在 renderer 草稿未被用户修改时允许另一张卡替换', () => {
    const input = mountComposer()
    const bridge = createComposerBridge()
    expect(bridge.insertDraft('选择 A')).toEqual({ ok: true })
    expect(bridge.insertDraft('选择 B')).toEqual({ ok: true })
    expect(input.value).toBe('选择 B')

    input.value = '选择 B，并补充自己的做法'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(bridge.insertDraft('选择 C')).toEqual({
      ok: false,
      error: expect.stringMatching(/已修改/),
    })
    expect(input.value).toBe('选择 B，并补充自己的做法')
  })

  it('首次选择不会覆盖用户已有草稿，dispose 也不清空输入框', () => {
    const input = mountComposer('用户自己的草稿')
    const bridge = createComposerBridge()

    expect(bridge.insertDraft('卡片行动')).toMatchObject({ ok: false })
    bridge.dispose()
    expect(input.value).toBe('用户自己的草稿')
  })

  it('renderer 草稿发送或清空后允许写入下一次选择', () => {
    const input = mountComposer()
    const bridge = createComposerBridge()
    expect(bridge.insertDraft('第一次选择')).toEqual({ ok: true })

    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))

    expect(bridge.insertDraft('下一次选择')).toEqual({ ok: true })
    expect(input.value).toBe('下一次选择')
  })
})
