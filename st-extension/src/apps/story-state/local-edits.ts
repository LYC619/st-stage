import type { AppHost } from '../../../../core/phone-registry'
import { storyIdentity } from '../shared/chat-metadata'
import { normalize, readStoryState, writeLocalState, type StoryState } from './store'

export function localRowIndex(rows: Array<Record<string, unknown>>, id: string, field: string, name: string): number {
  const matches = rows.flatMap((row, index) => (id ? row.id === id : (row[field] ?? row.名称) === name) ? [index] : [])
  if (matches.length !== 1) throw new Error('这条记录已变化，请刷新后重试。')
  return matches[0]
}

/** One writer per mounted editor; every queued action reads the latest committed state. */
export function createLocalEdits(host: AppHost, callbacks: {
  saved: (before: StoryState, after: StoryState, summary?: string) => Promise<void>
  failed: (error: unknown) => void
}) {
  let alive = true, revision = 0, queue = Promise.resolve()
  return {
    enqueue(mutator: (working: Record<string, unknown>) => void, summary?: string): Promise<void> {
      const key = storyIdentity(host), token = revision
      const valid = () => alive && token === revision && key === storyIdentity(host)
      queue = queue.then(async () => {
        if (!valid()) return
        try {
          const latest = await readStoryState(host)
          if (!valid() || latest.key !== key || latest.backend !== 'local') return
          const working = structuredClone({ ...normalize({}), ...latest.raw }) as Record<string, unknown>
          mutator(working)
          const saved = await writeLocalState(host, latest, working)
          if (!valid()) return
          if (!saved) throw new Error('无法写入当前聊天记录，请确认已打开角色聊天。')
          await callbacks.saved(latest.state, normalize(working), summary)
        } catch (error) {
          console.warn('[st-stage] 保存剧情手账失败', error)
          if (valid()) callbacks.failed(error)
        }
      })
      return queue
    },
    invalidate() { revision++ },
    dispose() { alive = false; revision++ },
  }
}
