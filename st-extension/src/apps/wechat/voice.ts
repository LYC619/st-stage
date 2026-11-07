import { speakWeChatText } from './bridge'

export interface VoiceBubbleController {
  element: HTMLElement
  dispose(): void
}

/** Voice is a readable transcript, played only by an explicit user gesture. */
export function createVoiceBubble(text: string, author: string): VoiceBubbleController {
  const wrap = document.createElement('div'); wrap.className = 'wt-bubble wt-voice'
  const play = document.createElement('button'); play.type = 'button'
  play.textContent = '▶ 语音'; play.setAttribute('aria-label', '播放' + author + '的语音')
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.textContent = '转文字'; toggle.setAttribute('aria-expanded', 'false')
  const transcript = document.createElement('p'); transcript.hidden = true; transcript.textContent = text
  const status = document.createElement('small'); status.setAttribute('role','status')
  let disposed = false, request = 0, timeout: ReturnType<typeof setTimeout> | undefined
  const expand = () => { transcript.hidden = false; toggle.setAttribute('aria-expanded','true'); toggle.textContent = '收起文字' }
  toggle.onclick = () => { transcript.hidden = !transcript.hidden; toggle.setAttribute('aria-expanded', String(!transcript.hidden)); toggle.textContent = transcript.hidden ? '转文字' : '收起文字' }
  play.onclick = async () => {
    if (disposed || play.disabled) return
    const current = ++request
    const valid = () => !disposed && current === request
    expand(); play.disabled = true; status.textContent = '正在请求酒馆朗读，文字已展开…'
    timeout = setTimeout(() => {
      if (!valid()) return
      request++; timeout = undefined; play.disabled = false
      status.textContent = '酒馆响应超时，无法确认播放状态；可阅读文字或重试。'
    }, 15000)
    try {
      const handedOff = await speakWeChatText(text, author)
      if (!valid()) return
      if (!handedOff) status.textContent = 'TTS 未启用或朗读接口不可用，已展开文字。'
      else status.textContent = '已请求酒馆朗读，无法确认播放状态；未听到声音时可阅读文字并检查 TTS 设置。'
    } catch {
      if (!valid()) return
      expand(); status.textContent = '朗读请求失败，已展开文字，可重试。'
    } finally {
      if (valid()) { clearTimeout(timeout); timeout = undefined; play.disabled = false }
    }
  }
  wrap.append(play, toggle, transcript, status)
  return { element: wrap, dispose() {
    disposed = true; request++; clearTimeout(timeout); timeout = undefined
    play.disabled = false; play.onclick = null; toggle.onclick = null
  } }
}
