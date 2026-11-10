// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost } from '../../../../core/phone-registry'
import { diaryCard, mergeDiary } from './diary'
import { generateTheater, normalizeFeeds } from './generate'
import * as ai from '../shared/story-ai'
import * as dates from '../shared/story-date'

const entry = (role: string, date = '2026-01-01', content = '我在等人。') => ({ role, date, content })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren() })
describe('NPC diary', () => {
  it('replaces the whole batch on a date change', () => {
    expect(mergeDiary([entry('甲')], [entry('乙', '2026-01-02')])).toEqual([entry('乙', '2026-01-02')])
  })
  it('overwrites the same role, appends newcomers and removes the oldest above five', () => {
    const previous = ['甲', '乙', '丙', '丁', '戊'].map(role => entry(role))
    expect(mergeDiary(previous, [entry('乙', '2026-01-01', '新日记')])[1].content).toBe('新日记')
    expect(mergeDiary(previous, [entry('己')]).map(row => row.role)).toEqual(['乙', '丙', '丁', '戊', '己'])
  })
  it('keeps only the latest batch without a known date and normalizes old stores', () => {
    expect(mergeDiary([entry('甲', '')], [entry('乙', '')])).toEqual([entry('乙', '')])
    expect(normalizeFeeds({ square: [] }).diary).toEqual([])
    expect(normalizeFeeds({ diary: [{ role: '甲', content: ' ' }, { role: '', content: '日记' }, entry('乙')] }).diary).toEqual([entry('乙')])
  })
  it('renders strikeouts and PS/PPS footers as inert text', () => {
    const card = diaryCard(entry('阿青', '2026-01-01', '我~~很想她~~没事。<img src=x>\nPS: ~~紧张~~吧。 PPS: <script>私语</script>'))
    document.body.append(card)
    expect(card.querySelector('del')!.textContent).toBe('很想她')
    expect(card.querySelectorAll('footer p')).toHaveLength(2)
    expect(card.querySelector('footer del')!.textContent).toBe('紧张')
    expect(card.querySelector('footer')!.textContent).toContain('PPS: <script>私语</script>')
    expect(card.querySelector('img,script')).toBeNull()
  })
  it('adds diary to the same theater request and stamps the story date in code', async () => {
    vi.spyOn(dates, 'storyToday').mockResolvedValue(new Date(2026, 0, 2))
    const request = vi.spyOn(ai, 'requestChat').mockResolvedValue(JSON.stringify({ diary: [entry('阿青', '1999-01-01')] }))
    const host = { getCharacterName: () => '主角', getChatContext: () => ({ chatId: 'one', chat: [{ mes: '到了码头', is_user: false }] }),
      getSettings: () => ({ apps: { 'wechat-sister': { config: { apiKey: 'test', profile: { includeWorldbook: false } } } } }),
    } as unknown as AppHost
    const result = await generateTheater(host, { square: [], forum: [], live: null, diary: [] }, new AbortController().signal)
    expect(request).toHaveBeenCalledOnce(); expect(result.diary[0].date).toBe('2026-01-02')
    const system = request.mock.calls[0][1][0].content
    for (const field of ['square', 'forum', 'live', 'diary', '不得全知', 'PS/PPS']) expect(system).toContain(field)
  })
})
