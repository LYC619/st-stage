import { describe, expect, it } from 'vitest'
import { WeChatPipeline } from './pipeline'
import { DEFAULT_REPLY_PROMPT, DEFAULT_STATE_PROMPT } from './prompts'

describe('editable prompts and single response state', () => {
  it('uses displayed defaults, renders custom templates and accepts only bounded state strings', () => {
    const pipe = new WeChatPipeline({ profile: { replyPrompt: 'Custom {角色} {人设}', statePrompt: 'State {状态}' } }, {}, {}, {})
    const state = { mood: 60, interest: 15, money: 0, sisterLocation: '', playerLocation: '', currentStatus: 'reading' }
    expect(DEFAULT_REPLY_PROMPT).toContain('{角色}')
    expect(DEFAULT_STATE_PROMPT).toContain('inner_thought')
    const prompt = pipe.buildSystemPrompt(state, '20:00', { scopeKey: 'b', characterName: 'B', card: { description: 'B persona' }, externalState: { source: 'none' } })
    expect(prompt).toContain('Custom B B persona')
    expect(prompt).toContain('reading')
    expect(pipe.parseReplyJson(JSON.stringify({ messages: [{ type: 'text', content: 'Hi' }], inner_thought: 'thinking', current_status: 'busy' }))).toEqual({ messages: [{ type: 'text', content: 'Hi' }], innerThought: 'thinking', currentStatus: 'busy' })
    const bad = pipe.parseReplyJson(JSON.stringify({ messages: [{ type: 'text', content: 'Hi' }], inner_thought: {}, current_status: 'x'.repeat(501) }))
    expect(bad.innerThought).toBeUndefined(); expect(bad.currentStatus).toBeUndefined()
  })
})
