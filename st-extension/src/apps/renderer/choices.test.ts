// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createChoicePersistence, normalizeChoiceHistory, type ChoiceHostContext } from './choices'
import { parseRendererBlocks } from './parser'

const source = '<STStageRender>'+JSON.stringify({ version: 1, mode: 'cards', title: 'Paths', cards: [
  { id: 'a', title: 'A', description: 'A', action: 'Take A' }, { id: 'b', title: 'B', description: 'B', action: 'Take B' },
] })+'</STStageRender>'
afterEach(() => document.body.replaceChildren())
function fixture() {
  const context: ChoiceHostContext = { characterId: 0, characters: [{ avatar: 'a.png' }], chatId: 'first', chat: [{ mes: source, send_date: 'unique-time', swipe_id: 0 }] }
  let data: unknown
  const persistence = createChoicePersistence({ getContext: () => context, getData: () => data, setData: value => { data = value } })
  const message = document.createElement('div'); message.className = 'mes'; message.setAttribute('mesid', '0')
  const root = document.createElement('div'); root.textContent = source; message.append(root); document.body.append(message)
  const memory = () => persistence.forBlock(root, parseRendererBlocks(source)[0], 0)!
  return { context, memory, root, data: () => data }
}
describe('persistent card choices', () => {
  it('restores a choice without saving message text and keeps chat, character, swipe and content separate', () => {
    const h = fixture(), memory = h.memory()
    expect(memory.write('a')).toEqual({ ok: true })
    expect(h.memory().read()).toBe('a')
    expect(JSON.stringify(h.data())).not.toContain('Take A')
    h.context.chatId = 'second'; expect(h.memory().read()).toBeNull()
    expect(memory.write('b').ok).toBe(false)
    h.context.chatId = 'first'; h.context.characters![0].avatar = 'b.png'; expect(h.memory().read()).toBeNull()
    h.context.characters![0].avatar = 'a.png'; h.context.chat![0].swipe_id = 1; expect(h.memory().read()).toBeNull()
    h.context.chat![0].swipe_id = 0; h.context.chat![0].mes = 'edited\n'+source; expect(h.memory().read()).toBeNull()
    h.context.chat![0].mes = source; expect(h.memory().read()).toBe('a')
    expect(h.memory().write(null)).toEqual({ ok: true }); expect(h.memory().read()).toBeNull()
  })
  it('rejects unknown cards, detached roots and missing stable identity', () => {
    const h = fixture(), memory = h.memory()
    expect(memory.write('unknown').ok).toBe(false)
    h.context.characterId = ''; expect(h.memory()).toBeUndefined()
    h.context.characterId = 0
    h.root.remove(); expect(memory.write('a').ok).toBe(false)
    h.context.characters![0].avatar = undefined; expect(h.memory()).toBeUndefined()
  })
  it('bounds stored choices and skips malformed or duplicate entries', () => {
    const entries = Array.from({ length: 220 }, (_, index) => ({ key: String(index), cardId: 'a' }))
    const history = normalizeChoiceHistory({ version: 1, entries: [...entries, null, { key: '219', cardId: 'b' }, { key: '__proto__', cardId: {} }] })
    expect(history.entries).toHaveLength(200)
    expect(history.entries.at(-1)).toEqual({ key: '219', cardId: 'b' })
    expect(normalizeChoiceHistory({ version: 99, entries })).toEqual({ version: 1, entries: [] })
  })
})
