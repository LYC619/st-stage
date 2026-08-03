import { describe, expect, it } from 'vitest'
import { createDefaultSettings } from './types'
import { storyArchiveKey, upsertStorySprite } from './story-archive'

describe('storyArchiveKey', () => {
  it('builds stable direct and group chat keys', () => {
    expect(storyArchiveKey({ chatId: 'chat/1', characterId: 'c1' })).toBe('c1::chat/1')
    expect(storyArchiveKey({ chatId: 'group-chat', groupId: 'g7', characterId: 'ignored' }))
      .toBe('group:g7::group-chat')
  })

  it('falls back deterministically when the chat ID is missing', () => {
    expect(storyArchiveKey({ characterId: 'c1', title: '第一章' })).toBe('c1::title:第一章')
    expect(storyArchiveKey({ characterName: '小雪' })).toBe('name:小雪::current')
  })
})

describe('upsertStorySprite', () => {
  const story = { key: 'c1::chat/1', title: '第一章', characterName: '小雪' }

  it('creates one stable story pack and reuses it for later images', () => {
    const settings = createDefaultSettings()
    const first = upsertStorySprite(settings, story, {
      tag: '场景图',
      url: '/user/story/one.webp',
      remoteUrl: 'https://img.test/one.png',
    })
    const second = upsertStorySprite(first, story, {
      tag: '第二张',
      url: '/user/story/two.webp',
      remoteUrl: 'https://img.test/two.png',
    })

    expect(second.packs).toHaveLength(1)
    expect(second.packs[0]).toMatchObject({
      name: 'Story - 第一章',
      roleName: '小雪',
      sourceStoryKey: story.key,
    })
    expect(second.packs[0].sprites.map((sprite) => sprite.tag)).toEqual(['场景图', '第二张'])
  })

  it('is idempotent for a repeated source URL', () => {
    const first = upsertStorySprite(createDefaultSettings(), story, {
      tag: '场景图',
      url: '/user/story/one.webp',
      remoteUrl: 'https://img.test/one.png',
    })

    expect(upsertStorySprite(first, story, {
      tag: '另一个标题',
      url: 'https://img.test/one.png',
    })).toBe(first)
  })

  it('deduplicates when either local or remote source URL matches', () => {
    const first = upsertStorySprite(createDefaultSettings(), story, {
      tag: '场景图',
      url: '/user/story/one.webp',
      remoteUrl: 'https://img.test/one.png',
    })

    expect(upsertStorySprite(first, story, {
      tag: '镜像标题',
      url: '/user/story/one.webp',
      remoteUrl: 'https://mirror.test/one.png',
    })).toBe(first)
  })

  it('generates safe unique tags for invalid and colliding titles', () => {
    let settings = createDefaultSettings()
    settings = upsertStorySprite(settings, story, { tag: '<script>[/]', url: 'https://img.test/1.png' })
    settings = upsertStorySprite(settings, story, { tag: '<script>[/]', url: 'https://img.test/2.png' })
    settings = upsertStorySprite(settings, story, { tag: '', url: 'https://img.test/3.png' })

    const tags = settings.packs[0].sprites.map((sprite) => sprite.tag)
    expect(tags).toEqual(['script', 'script 2', 'Generated image 3'])
    expect(tags.every((tag) =>
      tag.length > 0 && !Array.from(tag).some((char) => '<>{}[]/'.includes(char)),
    )).toBe(true)
  })
})
