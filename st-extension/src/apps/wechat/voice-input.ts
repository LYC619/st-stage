import { browserRecognition, type BrowserRecognition } from './bridge'

/** Browser recognition supplies a draft only. Sending always requires a separate user action. */
export function createVoiceInput(container: HTMLElement, saveDraft: () => void) {
  const el = <T extends HTMLElement>(id: string) => container.querySelector<T>('#' + id)!
  const input = el<HTMLInputElement>('wt-input-text'), toggle = el<HTMLButtonElement>('wt-voice-mode')
  const record = el<HTMLButtonElement>('wt-record'), edit = el<HTMLButtonElement>('wt-voice-edit')
  const feedback = el<HTMLElement>('wt-voice-feedback'), status = el<HTMLElement>('wt-voice-status'), send = el<HTMLButtonElement>('wt-send-btn')
  const Constructor = browserRecognition()
  let voice = false, busy = false, disposed = false, session: BrowserRecognition | undefined, timer: ReturnType<typeof setTimeout> | undefined
  const supported = !!Constructor
  function sync() {
    toggle.textContent = voice ? '⌨️' : '🎙️'; toggle.setAttribute('aria-pressed', String(voice))
    toggle.setAttribute('aria-label', voice ? '切换为文字消息' : '切换为语音消息')
    input.setAttribute('aria-label', voice ? '语音文字' : '消息'); input.placeholder = voice ? '确认语音文字…' : '发消息…'
    feedback.hidden = !voice; record.hidden = !voice || !input.hidden
    record.textContent = session ? '结束录音' : '点击录音'; record.setAttribute('aria-label', record.textContent)
    record.disabled = busy; edit.textContent = input.hidden ? '输入文字' : '重新录音'
    edit.hidden = !supported; edit.disabled = busy
    send.disabled = busy || input.hidden || !!session
  }
  function cancel() {
    const previous = session; session = undefined; clearTimeout(timer)
    if (previous) { previous.onend = null; previous.onerror = null; previous.onresult = null; previous.abort() }
  }
  function textMode() {
    cancel(); voice = false; input.hidden = false; status.textContent = ''; sync()
  }
  function draftMode(message: string) {
    const restoreFocus = document.activeElement === record || document.activeElement === edit
    input.hidden = false; status.textContent = message; sync()
    if (restoreFocus) input.focus({ preventScroll: true })
  }
  toggle.onclick = () => {
    if (voice) textMode()
    else {
      voice = true; input.hidden = supported && !input.value.trim()
      status.textContent = supported ? '点击录音，结束后确认文字再发送。' : '当前浏览器无法语音识别，可手动输入语音文字。'
      sync()
    }
    ;(input.hidden ? record : input).focus()
  }
  edit.onclick = () => {
    if (input.hidden) { cancel(); draftMode('输入语音文字，确认后发送。') }
    else { input.hidden = true; status.textContent = '再次录音会追加到现有草稿。'; sync(); record.focus() }
  }
  record.onclick = () => {
    if (disposed || busy || !supported || !Constructor) return
    if (session) { session.stop(); return }
    const base = input.value
    let transcript = ''
    try {
      const recognition = new Constructor(); session = recognition
      recognition.lang = 'zh-CN'; recognition.continuous = false; recognition.interimResults = true
      recognition.onresult = event => {
        if (disposed || session !== recognition) return
        const results = Array.from(event.results)
        transcript = results.filter(result => result.isFinal).map(result => result[0].transcript).join('')
        const heard = results.map(result => result[0].transcript).join('').slice(0, 120)
        status.textContent = heard ? '正在识别：' + heard : '正在聆听…点击结束录音。'
      }
      recognition.onerror = event => {
        if (session !== recognition) return
        cancel()
        draftMode(event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? '麦克风或语音识别未获授权，可手动输入或重试。'
          : event.error === 'no-speech' ? '未识别到语音，可手动输入或重试。' : '语音识别不可用，可手动输入或重试。')
      }
      recognition.onend = () => {
        if (disposed || session !== recognition) return
        session = undefined; clearTimeout(timer)
        recognition.onresult = null; recognition.onerror = null; recognition.onend = null
        if (transcript.trim()) {
          input.value = (base + (base && !/\s$/.test(base) ? ' ' : '') + transcript.trim()).slice(0, 8000)
          try { saveDraft() } catch { draftMode('语音文字未保存，请保留文字后重试。'); return }
        }
        draftMode(transcript.trim() ? '请确认识别文字后发送。' : '未识别到语音，可手动输入或重试。')
      }
      status.textContent = '正在聆听…点击结束录音。'; sync(); recognition.start()
      timer = setTimeout(() => { if (session === recognition) { cancel(); draftMode('语音识别超时，可手动输入或重试。') } }, 60000)
    } catch { cancel(); draftMode('无法开始语音识别，可手动输入或重试。') }
  }
  return {
    isVoice: () => voice,
    setBusy(value: boolean) { busy = value; sync() },
    textMode,
    interrupt() { if (session) { cancel(); draftMode('录音已取消，原草稿已保留。') } },
    sent() { if (voice) { input.hidden = supported; status.textContent = supported ? '点击录音，结束后确认文字再发送。' : '可继续输入语音文字。'; sync() } },
    dispose() { disposed = true; cancel() },
  }
}
