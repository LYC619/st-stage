// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { STAdapter } from './st-adapter'

afterEach(() => {
  delete window.SillyTavern
})

describe('STAdapter story context', () => {
  it('uses chatId as the direct-chat title when chat metadata has no filename', () => {
    window.SillyTavern = {
      getContext: () => ({
        characterId: '3',
        chatId: '第一章',
        name2: '小雪',
        characters: [],
      }),
    } as never

    expect(new STAdapter().getStoryContext()).toEqual({
      key: '3::第一章',
      title: '第一章',
      characterName: '小雪',
    })
  })
})
