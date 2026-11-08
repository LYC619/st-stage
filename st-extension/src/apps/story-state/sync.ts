import type { AppHost } from '../../../../core/phone-registry'
import { abortable, captureStory, storyIdentity } from '../wechat/memory'
import { getStoryAiConfig, requestChat } from '../shared/story-ai'
import { applyCommands, extractCommands, isNoUpdate } from './commands'
import { normalize, readStoryState, readSyncSettings, writeLocalState } from './store'

// Based on WeiMeng variable-updater.js (MIT); license preserved in commands.ts.
const PROMPT = `你是幕后剧情状态整理助手。根据已经发生的对话和现有 stat_data 更新记录，不推进剧情。
仅输出 <UpdateVariable> 区块，每行一条指令，不输出分析或 Markdown；无需更新则只输出 NO_UPDATE。
可用 _.set('路径', 新值)、_.add('路径', 数字)、_.insert('数组路径', 对象)、_.remove('数组路径', 值)。对象用 JSON。
只整理以下字段：时间 {显示,年,月,日,时,分,星期}，位置 {区域,地点,细节,座标}，任务 [{id,标题,描述,状态,时间,奖励}]，背包 [{id,名称,数量,描述,稀有度}]，技能 [{id,名称,等级,熟练度,类型,描述}]。
任务状态用进行中、完成或失败；技能记录超常能力，熟练度为 0–100。更新已有记录，避免重复新增。
例如：<UpdateVariable>
_.set('位置.地点', '港口');
_.insert('背包', {"id":"ticket","名称":"船票","数量":1,"描述":"登船凭证","稀有度":"普通"});
</UpdateVariable>`

export function createStorySync(host: AppHost) {
  let alive = true, job: AbortController | undefined, queued = false
  let status = { busy: false, error: '' }
  const listeners = new Set<() => void>()
  const notify = () => { for (const fn of listeners) fn() }
  function cancel() { job?.abort(); job = undefined; queued = false; status = { busy: false, error: '' }; notify() }
  async function trigger() {
    const settings = readSyncSettings(host), config = getStoryAiConfig(host)
    if (!alive || !settings.autoSync || !config) return
    if (job) { queued = true; return }
    const current = new AbortController(); job = current
    const story = captureStory(host)
    const valid = () => alive && job === current && !current.signal.aborted && storyIdentity(host) === story.key && readSyncSettings(host).autoSync
    status = { busy: true, error: '' }; notify()
    const timeout = setTimeout(() => current.abort(new Error('后台整理超时，请在下一次回复后重试。')), 120000)
    try {
      const snapshot = await readStoryState(host)
      if (!valid() || snapshot.backend === 'mvu') return
      const reply = await abortable(requestChat(config, [{ role: 'system', content: PROMPT }, { role: 'user', content:
        `当前 stat_data：${JSON.stringify(snapshot.raw)}\n最近对话：\n${story.messages.slice(-settings.contextMessages).map(m => `${m.name}：${m.text}`).join('\n')}` }], current.signal, false), current.signal)
      if (!valid() || isNoUpdate(reply)) return
      const commands = extractCommands(reply)
      if (!commands.length) throw new Error('后台整理未返回有效指令。')
      // Re-read before writing so a newly available MVU backend remains read-only.
      const latest = await readStoryState(host)
      if (!valid() || latest.backend === 'mvu') return
      const working = { ...normalize({}), ...latest.raw }
      if (applyCommands(working, commands)) await writeLocalState(host, latest, working)
    } catch (error) {
      if (alive && job === current) status.error = (error as Error).message
    } finally {
      clearTimeout(timeout)
      if (job === current) { job = undefined; status.busy = false; notify(); if (queued) { queued = false; void trigger() } }
    }
  }
  const offMessage = host.onMessageReceived(() => { void trigger() }), offChange = host.onCharacterChanged(cancel)
  return { trigger, cancel, status: () => status,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
    destroy() { alive = false; cancel(); offMessage(); offChange(); listeners.clear() },
  }
}
