import { describe, expect, it, vi } from 'vitest'
import { registerPhoneCommand, type PhoneCommandActions } from './slash-commands'

function fixture() {
  let open = false
  const phone: PhoneCommandActions = {
    isOpen: () => open,
    expand: vi.fn(() => { open = true }),
    collapse: vi.fn(() => { open = false }),
    hasApp: id => id === 'wechat-sister',
    openApp: vi.fn(),
    statusSummary: vi.fn(() => '当前在白鸥酒馆 · 傍晚'),
  }
  const addCommandObject = vi.fn(), fromProps = vi.fn((props: unknown) => props), argument = vi.fn((props: unknown) => props)
  registerPhoneCommand({ SlashCommandParser: { addCommandObject }, SlashCommand: { fromProps }, SlashCommandNamedArgument: { fromProps: argument }, ARGUMENT_TYPE: { STRING: 'string' } }, phone)
  const command = addCommandObject.mock.calls[0][0] as { name: string; helpString: string; callback: (args: Record<string, unknown>) => string | Promise<string> }
  return { command, phone, argument }
}

describe('baigong slash command', () => {
  it('registers the command, Chinese help and optional app/action arguments', () => {
    const f = fixture()
    expect(f.command.name).toBe('baigong')
    expect(f.command.helpString).toContain('百工手机')
    expect(f.argument).toHaveBeenCalledWith(expect.objectContaining({ name: 'app', isRequired: false, typeList: ['string'] }))
    expect(f.argument).toHaveBeenCalledWith(expect.objectContaining({ name: 'action', isRequired: false, typeList: ['string'] }))
  })
  it('toggles the phone without parameters', () => {
    const f = fixture()
    expect(f.command.callback({})).toBe('')
    expect(f.phone.expand).toHaveBeenCalledOnce()
    f.command.callback({})
    expect(f.phone.collapse).toHaveBeenCalledOnce()
  })
  it('expands and opens a known app, including from hidden state', () => {
    const f = fixture()
    f.command.callback({ app: 'wechat-sister' })
    expect(f.phone.expand).toHaveBeenCalledOnce()
    expect(f.phone.openApp).toHaveBeenCalledWith('wechat-sister')
  })
  it('supports action=status without toggling phone visibility', () => {
    const f = fixture()
    expect(f.command.callback({ action: 'status' })).toBe('当前在白鸥酒馆 · 傍晚')
    expect(f.phone.expand).not.toHaveBeenCalled()
  })
  it('returns text for an unknown app without changing phone state', () => {
    const f = fixture()
    expect(f.command.callback({ app: 'missing' })).toContain('未找到 App')
    expect(f.phone.expand).not.toHaveBeenCalled()
    expect(f.phone.openApp).not.toHaveBeenCalled()
  })
})
