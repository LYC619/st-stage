/**
 * 《小登同居生活》微信对话 App —— 适用于 SillyTavern st-stage 插件
 * 遵循 docs/APP-SPEC.md 标准规范，深度整合当前对话角色、RAG 与两阶段状态管线
 */

import type { PhoneApp, PhoneAppContext, AppHost } from '../../../../core/phone-registry'
import type {
  ChatMessage,
  WeChatAppData,
  CharacterConversation,
  SisterState,
  SisterLocation,
} from './types'
import {
  DEFAULT_PLAYER_AVATAR,
  DEFAULT_SISTER_AVATAR,
  PLAYER_EMOJIS,
  SISTER_EMOJIS,
  SISTER_PHOTOS,
  FALLBACK_DIALOGUES,
} from './manifest-data'
import { resolveWeChatAssetUrl } from './assets'
import { WeChatPipeline } from './pipeline'
import { simulateTypingDelay } from './typing'
import {
  resolveConversationScopeSync,
  readExternalCharacterState,
  resolveCharacterAvatarUrl,
  extractRecentSTMessages,
  subscribeExternalContextEvents,
  type ConversationScope,
} from './bridge'

function createDefaultSisterState(): SisterState {
  return {
    hasExternalState: false,
    mood: 60.0,
    interest: 15.0,
    sisterLocation: 'SISTER_ROOM',
    playerLocation: 'COMPANY',
    money: 5200,
  }
}

/**
 * 按角色与聊天唯一标识（scopeKey）隔离并维护会话存储
 */
export function getScopedConversation(
  appData: WeChatAppData,
  scopeOrName: ConversationScope | string,
): CharacterConversation {
  if (!appData.conversations) {
    appData.conversations = {}
  }

  const isScope = typeof scopeOrName === 'object' && scopeOrName !== null
  const characterName = isScope ? scopeOrName.characterName : scopeOrName || '妹妹'
  const scopeKey = isScope ? scopeOrName.scopeKey : (characterName.trim() || 'default')
  const externalState = isScope ? scopeOrName.externalState : undefined
  const characterId = isScope ? scopeOrName.characterId : undefined
  const chatId = isScope ? scopeOrName.chatId : undefined

  let conv = appData.conversations[scopeKey]

  // 1. 兼容迁移：旧版本只有角色名键（如 'Alice'），迁移到复合 scopeKey（如 'Alice::first-chat'）
  if (!conv && characterName && appData.conversations[characterName]) {
    conv = appData.conversations[characterName]
    delete appData.conversations[characterName] // 移除旧的单名键，防止后续新建的会话被错误关联
    conv.scopeKey = scopeKey
    conv.characterName = characterName
    if (characterId) conv.characterId = characterId
    if (chatId) conv.chatId = chatId
    appData.conversations[scopeKey] = conv
  }

  // 2. 兼容迁移：最老版扁平根数据（appData.messages）迁移
  if (!conv && appData.messages && appData.messages.length > 0) {
    conv = {
      characterName,
      characterId,
      chatId,
      scopeKey,
      messages: [...appData.messages],
      state: appData.state ? { ...appData.state } : createDefaultSisterState(),
      currentDay: appData.currentDay || 1,
    }
    appData.conversations[scopeKey] = conv
    delete appData.messages
    delete appData.state
    delete appData.currentDay
  }

  // 3. 首次新建独立会话
  if (!conv) {
    const isSister = !characterName || characterName === '妹妹'
    conv = {
      characterName,
      characterId,
      chatId,
      scopeKey,
      messages: [
        {
          sender: 'sister',
          content: isSister ? '哥，下班没？今天晚上想吃什么呀？' : '在吗？发个微信聊聊。',
          type: 'text',
          time: { day: 1, hour: 18, minute: 30 },
        },
      ],
      state: createDefaultSisterState(),
      currentDay: 1,
    }
    appData.conversations[scopeKey] = conv
  }

  // 4. 同步外部状态（MVU / 酒馆助手 / host）
  if (externalState && externalState.source !== 'none' && externalState.mappedFields && Object.values(externalState.mappedFields).some(Boolean)) {
    conv.state.hasExternalState = true
    conv.state.externalSource = externalState.source
    conv.state.externalFields = { ...externalState.mappedFields }
    if (externalState.mood !== undefined) conv.state.mood = externalState.mood
    if (externalState.interest !== undefined) conv.state.interest = externalState.interest
    if (externalState.money !== undefined) conv.state.money = externalState.money
    if (externalState.location !== undefined) conv.state.sisterLocation = externalState.location
  } else if (externalState && externalState.source === 'none') {
    // 失去外部状态源时清理
    conv.state.hasExternalState = false
    conv.state.externalSource = undefined
    conv.state.externalFields = undefined
  }

  return conv
}

export function createWeChatApp(): PhoneApp {
  let pipeline: WeChatPipeline | null = null
  let mountSessionId = 0
  let activeScopeSessionId = 0
  let unbindEvents: (() => void) | null = null

  return {
    id: 'wechat-sister',
    name: '微信',
    icon: '💬',
    order: 25,
    fullbleed: true,

    setup(host: AppHost) {
      const existing = host.getAppData<WeChatAppData>()
      if (!existing || !existing.conversations) {
        const initialConversations: Record<string, CharacterConversation> = {}
        const initial: WeChatAppData = {
          config: {
            apiKey: '',
            apiUrl: 'https://api.deepseek.com/chat/completions',
            model: 'deepseek-chat',
          },
          conversations: initialConversations,
        }

        const syncScope = resolveConversationScopeSync(host)
        const initialKey = syncScope.scopeKey
        if (existing?.messages && existing.messages.length > 0) {
          initialConversations[initialKey] = {
            characterName: syncScope.characterName,
            characterId: syncScope.characterId,
            chatId: syncScope.chatId,
            scopeKey: initialKey,
            messages: existing.messages,
            state: existing.state || createDefaultSisterState(),
            currentDay: existing.currentDay || 1,
          }
          if (existing.config) initial.config = existing.config
        } else {
          getScopedConversation(initial, syncScope)
        }

        host.setAppData<WeChatAppData>(initial)
      }
    },

    mount(container: HTMLElement, ctx: PhoneAppContext) {
      const currentMountSession = ++mountSessionId
      const isCurrent = () => currentMountSession === mountSessionId && pipeline !== null

      activeScopeSessionId++
      let latestRefreshReq = 0
      let latestAppliedRefresh = 0

      const appData: WeChatAppData = ctx.getAppData<WeChatAppData>() || {
        config: {
          apiKey: '',
          apiUrl: 'https://api.deepseek.com/chat/completions',
          model: 'deepseek-chat',
        },
        conversations: {},
      }
      if (!appData.conversations) {
        appData.conversations = {}
      }
      const conversations = appData.conversations

      // 同步提取初始作用域（保证挂载首帧即时呈现正确角色与对话）
      let currentScope: ConversationScope = resolveConversationScopeSync(ctx)
      let activeConv = getScopedConversation(appData, currentScope)

      pipeline = new WeChatPipeline(
        appData.config,
        PLAYER_EMOJIS,
        SISTER_EMOJIS,
        SISTER_PHOTOS,
        FALLBACK_DIALOGUES,
      )

      container.classList.add('so-phone-app-fullbleed')

      // 构建微信界面主体 DOM
      container.innerHTML = `
        <div class="wechat-root" style="display:flex; flex-direction:column; height:100%; width:100%; background:#ededed; font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif; color:#181818; box-sizing:border-box; overflow:hidden; position:relative;">
          
          <!-- 微信顶部导航栏 -->
          <div class="wechat-nav" style="display:flex; align-items:center; justify-content:space-between; height:46px; padding:0 12px; background:#ededed; border-bottom:1px solid #dcdcdc; flex-shrink:0; z-index:10;">
            <div style="font-weight:600; font-size:15px; display:flex; align-items:center; gap:6px; min-width:0; overflow:hidden;">
              <span id="wt-contact-name" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:120px;"></span>
              <span id="wt-typing-badge" style="display:none; font-size:11px; font-weight:normal; color:#07c160; flex-shrink:0; animation:wtPulse 1.2s infinite ease-in-out;">(对方正在输入...)</span>
            </div>
            
            <!-- 状态胶囊：心情与好感监控 -->
            <div id="wt-status-pill" style="display:flex; align-items:center; gap:6px; font-size:11px; color:#444; background:#e0e0e0; padding:4px 9px; border-radius:12px; cursor:pointer; flex-shrink:0; transition:background 0.15s ease;" title="点击打开状态面板与 API 设置">
              <span id="wt-pill-mood">😊 <b id="val-mood">--</b></span>
              <span id="wt-pill-divider" style="opacity:0.4;">|</span>
              <span id="wt-pill-interest">💖 <b id="val-interest">--</b></span>
              <span id="wt-pill-badge" style="font-size:10px; color:#666; display:none;"></span>
              <span style="font-size:10px; opacity:0.6;">⚙️</span>
            </div>
          </div>

          <!-- 消息流区域 -->
          <div id="wt-scroll" style="flex:1; overflow-y:auto; padding:12px 10px; display:flex; flex-direction:column; gap:12px; min-height:0; -webkit-overflow-scrolling:touch;"></div>

          <!-- 表情包抽屉 (默认收起) -->
          <div id="wt-emoji-drawer" style="display:none; flex-direction:column; height:180px; background:#f7f7f7; border-top:1px solid #d9d9d9; flex-shrink:0; z-index:20;">
            <div style="display:flex; border-bottom:1px solid #e0e0e0; background:#eeeeee;">
              <button id="wt-tab-player" style="flex:1; padding:6px; font-size:12px; font-weight:600; border:none; background:#f7f7f7; color:#07c160; cursor:pointer;">沙雕熊猫头 (15)</button>
              <button id="wt-tab-sister" style="flex:1; padding:6px; font-size:12px; font-weight:normal; border:none; background:#eeeeee; color:#666; cursor:pointer;">妹妹专属 (19)</button>
            </div>
            <div id="wt-emoji-grid" style="flex:1; overflow-y:auto; padding:8px; display:grid; grid-template-columns:repeat(5, 1fr); gap:6px;"></div>
          </div>

          <!-- 底部输入栏 (W7: min-width:0 杜绝窄屏裁切) -->
          <div class="wechat-input-bar" style="display:flex; align-items:center; gap:6px; padding:7px 10px; background:#f7f7f7; border-top:1px solid #dcdcdc; flex-shrink:0; z-index:15;">
            <button id="wt-emoji-btn" style="background:none; border:none; font-size:20px; cursor:pointer; padding:2px; line-height:1; opacity:0.85; flex-shrink:0;" title="表情包">😀</button>
            <button id="wt-packet-btn" style="background:none; border:none; font-size:19px; cursor:pointer; padding:2px; line-height:1; opacity:0.85; flex-shrink:0;" title="发红包">🧧</button>
            <input id="wt-input-text" type="text" placeholder="发消息..." style="flex:1; min-width:0; height:34px; padding:0 10px; border:1px solid #d0d0d0; border-radius:5px; background:#fff; font-size:13px; outline:none; box-sizing:border-box;" />
            <button id="wt-send-btn" style="background:#07c160; color:#fff; border:none; border-radius:5px; height:34px; padding:0 12px; font-size:13px; font-weight:500; cursor:pointer; white-space:nowrap; flex-shrink:0; transition:opacity 0.15s ease;">发送</button>
          </div>

          <!-- 状态面板 & API 配置弹窗 -->
          <div id="wt-settings-modal" style="display:none; position:absolute; inset:0; background:rgba(0,0,0,0.55); z-index:50; backdrop-filter:blur(3px); align-items:flex-end; justify-content:center;">
            <div style="background:#fff; width:100%; border-radius:16px 16px 0 0; padding:16px 16px 20px; box-sizing:border-box; max-height:88%; overflow-y:auto; display:flex; flex-direction:column; gap:14px; animation:wtSlideUp 0.2s ease;">
              
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:8px;">
                <span id="wt-modal-title" style="font-weight:600; font-size:15px; color:#222;">角色状态监控与设置</span>
                <button id="wt-close-settings" style="border:none; background:#eee; border-radius:50%; width:26px; height:26px; cursor:pointer; font-size:13px; color:#666;">✕</button>
              </div>

              <!-- 状态源展示 (W1: 明确区分外部变量 vs 独立数值) -->
              <div id="wt-modal-state-source" style="font-size:11px; color:#666; background:#f0f2f5; padding:6px 10px; border-radius:6px;">
                状态来源：检测中...
              </div>

              <!-- 数值调节 -->
              <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                  <span>😊 当前心情：<b id="wt-set-mood-val">60</b> / 100</span>
                  <span id="wt-set-mood-tag" style="font-size:11px; color:#07c160; font-weight:500;">普通</span>
                </div>
                <input id="wt-set-mood-range" type="range" min="0" max="100" value="60" style="width:100%; accent-color:#07c160;" />

                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-top:4px;">
                  <span>💖 当前好感/性趣：<b id="wt-set-interest-val">15</b> / 100</span>
                  <span id="wt-set-interest-tag" style="font-size:11px; color:#fa5151; font-weight:500;">嫌弃警告</span>
                </div>
                <input id="wt-set-interest-range" type="range" min="0" max="100" value="15" style="width:100%; accent-color:#fa5151;" />
              </div>

              <!-- 场景与钱包 -->
              <div style="background:#f9f9f9; padding:10px; border-radius:8px; font-size:12px; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span>📍 角色位置：</span>
                  <select id="wt-set-sister-loc" style="padding:3px 6px; border:1px solid #ccc; border-radius:4px; font-size:12px; background:#fff;">
                    <option value="SISTER_ROOM">卧室</option>
                    <option value="TOILET">厕所</option>
                    <option value="LIVING_ROOM">客厅</option>
                    <option value="SCHOOL">学校</option>
                  </select>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span>💰 钱包余额：</span>
                  <span>¥ <b id="wt-wallet-bal">5200</b></span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span>📅 当前天数：</span>
                  <span>第 <b id="wt-day-num">1</b> 天</span>
                </div>
              </div>

              <!-- API 设置 -->
              <div style="display:flex; flex-direction:column; gap:6px;">
                <span style="font-size:12px; font-weight:600; color:#333;">DeepSeek / OpenAI API 配置</span>
                <input id="wt-cfg-key" type="password" placeholder="API Key (留空使用离线智能词库)" value="" style="height:32px; padding:0 8px; border:1px solid #ddd; border-radius:4px; font-size:12px;" />
                <input id="wt-cfg-url" type="text" placeholder="API URL" value="" style="height:32px; padding:0 8px; border:1px solid #ddd; border-radius:4px; font-size:12px;" />
                <input id="wt-cfg-model" type="text" placeholder="Model" value="" style="height:32px; padding:0 8px; border:1px solid #ddd; border-radius:4px; font-size:12px;" />
              </div>

              <!-- 快捷操作按钮 -->
              <div style="display:flex; gap:8px;">
                <button id="wt-btn-next-day" style="flex:1; background:#f0f0f0; border:1px solid #ccc; border-radius:6px; padding:8px 0; font-size:12px; cursor:pointer;">进入下一天 ☀️</button>
                <button id="wt-btn-clear-chat" style="flex:1; background:#f0f0f0; border:1px solid #ccc; border-radius:6px; padding:8px 0; font-size:12px; color:#c00; cursor:pointer;">清空记录 🗑️</button>
                <button id="wt-btn-save-settings" style="flex:1.2; background:#07c160; color:#fff; border:none; border-radius:6px; padding:8px 0; font-size:12px; font-weight:600; cursor:pointer;">保存设置</button>
              </div>

            </div>
          </div>

          <!-- 发红包弹窗 -->
          <div id="wt-packet-modal" style="display:none; position:absolute; inset:0; background:rgba(0,0,0,0.6); z-index:50; backdrop-filter:blur(3px); align-items:center; justify-content:center; padding:16px;">
            <div style="background:#cf3b35; width:260px; border-radius:14px; padding:20px 16px; box-sizing:border-box; color:#fff; display:flex; flex-direction:column; align-items:center; gap:12px; position:relative; box-shadow:0 12px 30px rgba(0,0,0,0.4);">
              <button id="wt-packet-close" style="position:absolute; top:8px; right:8px; background:none; border:none; color:rgba(255,255,255,0.7); font-size:16px; cursor:pointer;">✕</button>
              <div style="font-size:32px;">🧧</div>
              <div style="font-weight:600; font-size:15px; color:#fde3b3;">给<span id="wt-packet-target">妹妹</span>发微信红包</div>
              <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; width:100%; margin-top:4px;">
                <button class="wt-amt-pill" data-amt="20" style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); border-radius:6px; padding:8px 0; color:#fff; font-size:13px; font-weight:bold; cursor:pointer;">¥20</button>
                <button class="wt-amt-pill" data-amt="50" style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); border-radius:6px; padding:8px 0; color:#fff; font-size:13px; font-weight:bold; cursor:pointer;">¥50</button>
                <button class="wt-amt-pill" data-amt="200" style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); border-radius:6px; padding:8px 0; color:#fff; font-size:13px; font-weight:bold; cursor:pointer;">¥200</button>
              </div>
              <input id="wt-custom-amt" type="number" placeholder="自定义金额 (¥)" style="width:100%; height:32px; border-radius:6px; border:none; padding:0 10px; font-size:13px; box-sizing:border-box; color:#333;" />
              <button id="wt-confirm-packet" style="background:#fde3b3; color:#a12621; border:none; border-radius:6px; width:100%; height:36px; font-weight:bold; font-size:14px; cursor:pointer; margin-top:4px;">塞钱进红包</button>
            </div>
          </div>

          <!-- 查看大图灯箱 -->
          <div id="wt-photo-lightbox" style="display:none; position:absolute; inset:0; background:rgba(0,0,0,0.88); z-index:100; flex-direction:column; align-items:center; justify-content:center; padding:16px;">
            <button id="wt-close-lightbox" style="position:absolute; top:12px; right:12px; background:none; border:none; color:#fff; font-size:24px; cursor:pointer;">✕</button>
            <img id="wt-lightbox-img" src="" alt="Photo" style="max-width:92%; max-height:80%; border-radius:8px; object-fit:contain; box-shadow:0 10px 30px rgba(0,0,0,0.5);" />
            <div id="wt-lightbox-desc" style="color:#eee; font-size:13px; margin-top:12px; text-align:center;"></div>
          </div>

        </div>
      `

      // 绑定 DOM 引用
      const contactNameEl = container.querySelector('#wt-contact-name') as HTMLElement
      const scrollEl = container.querySelector('#wt-scroll') as HTMLElement
      const inputEl = container.querySelector('#wt-input-text') as HTMLInputElement
      const sendBtn = container.querySelector('#wt-send-btn') as HTMLElement
      const emojiBtn = container.querySelector('#wt-emoji-btn') as HTMLElement
      const packetBtn = container.querySelector('#wt-packet-btn') as HTMLElement
      const emojiDrawer = container.querySelector('#wt-emoji-drawer') as HTMLElement
      const emojiGrid = container.querySelector('#wt-emoji-grid') as HTMLElement
      const tabPlayer = container.querySelector('#wt-tab-player') as HTMLElement
      const tabSister = container.querySelector('#wt-tab-sister') as HTMLElement
      const typingBadge = container.querySelector('#wt-typing-badge') as HTMLElement
      const statusPill = container.querySelector('#wt-status-pill') as HTMLElement
      const valMood = container.querySelector('#val-mood') as HTMLElement
      const valInterest = container.querySelector('#val-interest') as HTMLElement
      const pillBadge = container.querySelector('#wt-pill-badge') as HTMLElement
      const modalStateSource = container.querySelector('#wt-modal-state-source') as HTMLElement

      // 设置模态框元素
      const settingsModal = container.querySelector('#wt-settings-modal') as HTMLElement
      const closeSettings = container.querySelector('#wt-close-settings') as HTMLElement
      const setMoodRange = container.querySelector('#wt-set-mood-range') as HTMLInputElement
      const setMoodVal = container.querySelector('#wt-set-mood-val') as HTMLElement
      const setMoodTag = container.querySelector('#wt-set-mood-tag') as HTMLElement
      const setInterestRange = container.querySelector('#wt-set-interest-range') as HTMLInputElement
      const setInterestVal = container.querySelector('#wt-set-interest-val') as HTMLElement
      const setInterestTag = container.querySelector('#wt-set-interest-tag') as HTMLElement
      const setSisterLoc = container.querySelector('#wt-set-sister-loc') as HTMLSelectElement
      const cfgKey = container.querySelector('#wt-cfg-key') as HTMLInputElement
      const cfgUrl = container.querySelector('#wt-cfg-url') as HTMLInputElement
      const cfgModel = container.querySelector('#wt-cfg-model') as HTMLInputElement
      const btnSaveSettings = container.querySelector('#wt-btn-save-settings') as HTMLElement
      const btnNextDay = container.querySelector('#wt-btn-next-day') as HTMLElement
      const btnClearChat = container.querySelector('#wt-btn-clear-chat') as HTMLElement
      const modalTitle = container.querySelector('#wt-modal-title') as HTMLElement

      // 红包模态框元素
      const packetModal = container.querySelector('#wt-packet-modal') as HTMLElement
      const packetClose = container.querySelector('#wt-packet-close') as HTMLElement
      const customAmt = container.querySelector('#wt-custom-amt') as HTMLInputElement
      const confirmPacket = container.querySelector('#wt-confirm-packet') as HTMLElement
      const packetTarget = container.querySelector('#wt-packet-target') as HTMLElement

      // 灯箱元素
      const photoLightbox = container.querySelector('#wt-photo-lightbox') as HTMLElement
      const closeLightbox = container.querySelector('#wt-close-lightbox') as HTMLElement
      const lightboxImg = container.querySelector('#wt-lightbox-img') as HTMLImageElement
      const lightboxDesc = container.querySelector('#wt-lightbox-desc') as HTMLElement

      // 切换当前联系人与作用域视图
      const syncActiveView = () => {
        contactNameEl.textContent = activeConv.characterName
        packetTarget.textContent = activeConv.characterName
        modalTitle.textContent = `${activeConv.characterName} 状态监控与设置`

        valMood.textContent = activeConv.state.mood.toFixed(0)
        valInterest.textContent = activeConv.state.interest.toFixed(0)
        setMoodRange.value = String(activeConv.state.mood)
        setInterestRange.value = String(activeConv.state.interest)
        setSisterLoc.value = String(activeConv.state.sisterLocation)
        container.querySelector('#wt-wallet-bal')!.textContent = String(activeConv.state.money)
        container.querySelector('#wt-day-num')!.textContent = String(activeConv.currentDay)

        if (activeConv.state.hasExternalState) {
          if (pillBadge) pillBadge.style.display = 'none'
          if (modalStateSource) {
            const fields = activeConv.state.externalFields
            const fieldLabels: string[] = []
            if (fields?.mood) fieldLabels.push('心情')
            if (fields?.interest) fieldLabels.push('好感')
            if (fields?.money) fieldLabels.push('金钱')
            if (fields?.location) fieldLabels.push('地点')
            const fieldsStr = fieldLabels.length > 0 ? ` [${fieldLabels.join('/')}]` : ''
            modalStateSource.textContent = `状态来源：已连接外部变量（${activeConv.state.externalSource || 'ST/MVU'}${fieldsStr}）`
          }
        } else {
          if (pillBadge) {
            pillBadge.style.display = 'inline'
            pillBadge.textContent = '独立'
          }
          if (modalStateSource) {
            modalStateSource.textContent = '状态来源：未接入外部状态（使用独立会话数值）'
          }
        }

        updateLadderTags()
        renderMessages()
      }

      // 更新阶梯标签文字
      const updateLadderTags = () => {
        const mood = parseFloat(setMoodRange.value)
        const interest = parseFloat(setInterestRange.value)
        setMoodVal.textContent = mood.toFixed(0)
        setInterestVal.textContent = interest.toFixed(0)

        if (mood < 40) setMoodTag.textContent = '心情低落 🌧️'
        else if (mood < 80) setMoodTag.textContent = '平淡普通 ⛅'
        else setMoodTag.textContent = '心情愉悦 ☀️'

        if (interest < 25) setInterestTag.textContent = '嫌弃警告 🚫'
        else if (interest < 50) setInterestTag.textContent = '要零花钱 💸'
        else if (interest < 75) setInterestTag.textContent = '半推半就 🌸'
        else setInterestTag.textContent = '老夫老妻 🔥'
      }

      setMoodRange.oninput = updateLadderTags
      setInterestRange.oninput = updateLadderTags

      // 切换当前作用域（W1, W2, W4）
      const switchScope = (nextScope: ConversationScope) => {
        if (!isCurrent()) return
        activeScopeSessionId++ // 递增代次，使前一会话所有在途异步请求即刻失效
        latestRefreshReq++
        latestAppliedRefresh = latestRefreshReq
        currentScope = nextScope
        activeConv = getScopedConversation(appData, currentScope)
        syncActiveView()
      }

      // 异步刷新上下文与状态（绑定发起时的 mountSessionId, activeScopeSessionId, scopeKey 及刷新序号）
      const refreshContextAndState = async (targetScope?: ConversationScope) => {
        const reqMountId = mountSessionId
        const reqScopeId = activeScopeSessionId
        const reqScopeKey = (targetScope || currentScope).scopeKey
        const reqCharName = (targetScope || currentScope).characterName
        const reqRefreshSeq = ++latestRefreshReq

        const latestMsgs = extractRecentSTMessages(ctx)
        const extState = await readExternalCharacterState(ctx, reqCharName)

        if (!isCurrent() || reqMountId !== mountSessionId || reqScopeId !== activeScopeSessionId || reqScopeKey !== currentScope.scopeKey) {
          return
        }

        // 检查同会话内刷新时序（W4 / P2）：若已有较新的刷新请求完成，丢弃本陈旧结果
        if (reqRefreshSeq < latestAppliedRefresh) {
          return
        }
        latestAppliedRefresh = reqRefreshSeq

        if (latestMsgs) {
          currentScope.stRecentMessages = latestMsgs
        }

        currentScope.externalState = extState
        activeConv = getScopedConversation(appData, currentScope)
        syncActiveView()
      }

      // 挂载初始异步读取外部状态
      refreshContextAndState()

      // W1 / W2 / W4：监听 ST 角色/聊天切换，支持同名卡及多聊天作用域隔离
      ctx.onCharacterChanged(() => {
        if (!isCurrent()) return
        const syncScope = resolveConversationScopeSync(ctx)
        if (syncScope.scopeKey !== currentScope.scopeKey) {
          switchScope(syncScope)
        }
        refreshContextAndState(syncScope)
      })

      // W1 / W1b: 订阅 ST 消息与 MVU 变量更新事件，随状态更新同步外部变量
      unbindEvents = subscribeExternalContextEvents(ctx, () => {
        if (!isCurrent()) return
        refreshContextAndState()
      })

      // 安全 DOM 渲染消息流
      const renderMessages = () => {
        scrollEl.replaceChildren()

        for (const msg of activeConv.messages) {
          const isPlayer = msg.sender === 'player'
          const row = document.createElement('div')
          row.style.cssText = `display:flex; gap:9px; align-items:flex-start; ${isPlayer ? 'flex-direction:row-reverse;' : ''}`

          const avatar = document.createElement('img')
          avatar.style.cssText = 'width:38px; height:38px; border-radius:5px; object-fit:cover; flex-shrink:0; background:#ddd;'
          const resolvedAvatar = isPlayer
            ? DEFAULT_PLAYER_AVATAR
            : (resolveCharacterAvatarUrl(currentScope.card?.avatar) || DEFAULT_SISTER_AVATAR)
          avatar.src = resolvedAvatar
          avatar.onerror = () => {
            avatar.src = isPlayer ? DEFAULT_PLAYER_AVATAR : DEFAULT_SISTER_AVATAR
          }
          avatar.alt = isPlayer ? 'User' : activeConv.characterName

          const bubble = document.createElement('div')

          if (msg.type === 'text') {
            bubble.style.cssText = `padding:9px 12px; font-size:14px; line-height:1.4; border-radius:5px; max-width:72%; word-break:break-word; box-shadow:0 1px 2px rgba(0,0,0,0.05); ${
              isPlayer ? 'background:#95ec69; color:#000;' : 'background:#fff; color:#181818;'
            }`
            bubble.textContent = msg.content
          } else if (msg.type === 'emoji') {
            bubble.style.cssText = 'background:none; border:none; padding:2px;'
            const emojiItem = (isPlayer ? PLAYER_EMOJIS : SISTER_EMOJIS)[msg.content]
            if (emojiItem) {
              const img = document.createElement('img')
              img.src = resolveWeChatAssetUrl(emojiItem.file)
              img.alt = emojiItem.name
              img.style.cssText = 'width:110px; height:110px; object-fit:contain; border-radius:4px;'
              bubble.appendChild(img)
            } else {
              bubble.style.cssText = 'background:#fff; border-radius:5px; padding:8px 12px; font-size:13px; color:#666;'
              bubble.textContent = `[表情: ${msg.content}]`
            }
          } else if (msg.type === 'image') {
            bubble.style.cssText = 'background:#fff; border-radius:6px; padding:4px; max-width:65%; box-shadow:0 1px 3px rgba(0,0,0,0.1); cursor:pointer;'
            const photo = SISTER_PHOTOS[msg.content]
            if (photo) {
              const photoUrl = resolveWeChatAssetUrl(photo.file)
              const img = document.createElement('img')
              img.src = photoUrl
              img.alt = photo.name
              img.style.cssText = 'width:100%; max-height:220px; border-radius:4px; object-fit:cover; display:block;'
              bubble.appendChild(img)

              bubble.onclick = () => {
                lightboxImg.src = photoUrl
                lightboxDesc.textContent = `${photo.name}：${photo.description}`
                photoLightbox.style.display = 'flex'
              }
            } else {
              bubble.textContent = `[图片: ${msg.content}]`
            }
          } else if (msg.type === 'red_packet') {
            bubble.style.cssText = 'background:#fa9d3b; color:#fff; border-radius:7px; padding:10px 14px; width:160px; box-shadow:0 2px 6px rgba(250,157,59,0.3);'
            const rowDiv = document.createElement('div')
            rowDiv.style.cssText = 'display:flex; align-items:center; gap:10px;'
            const iconSpan = document.createElement('span')
            iconSpan.style.fontSize = '24px'
            iconSpan.textContent = '🧧'
            const textWrap = document.createElement('div')
            const amtDiv = document.createElement('div')
            amtDiv.style.cssText = 'font-size:15px; font-weight:bold;'
            amtDiv.textContent = `¥ ${msg.content}`
            const subDiv = document.createElement('div')
            subDiv.style.cssText = 'font-size:10px; opacity:0.85;'
            subDiv.textContent = '微信红包 · 已存入钱包'
            textWrap.append(amtDiv, subDiv)
            rowDiv.append(iconSpan, textWrap)
            bubble.append(rowDiv)
          }

          row.appendChild(avatar)
          row.appendChild(bubble)
          scrollEl.appendChild(row)
        }

        scrollEl.scrollTop = scrollEl.scrollHeight
      }

      // 渲染表情抽屉标签页
      let activeTab: 'player' | 'sister' = 'player'
      const renderEmojiDrawer = () => {
        emojiGrid.replaceChildren()
        const emojis = activeTab === 'player' ? PLAYER_EMOJIS : SISTER_EMOJIS

        for (const [id, item] of Object.entries(emojis)) {
          const btn = document.createElement('div')
          btn.style.cssText = 'background:#fff; border:1px solid #ddd; border-radius:6px; padding:4px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; gap:2px; transition:transform 0.1s ease;'
          btn.title = item.description

          const imgPath = resolveWeChatAssetUrl(item.file)
          const img = document.createElement('img')
          img.src = imgPath
          img.alt = item.name
          img.style.cssText = 'width:34px; height:34px; object-fit:contain;'

          const lbl = document.createElement('span')
          lbl.style.cssText = 'font-size:10px; color:#555; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:44px;'
          lbl.textContent = item.name

          btn.append(img, lbl)
          btn.onclick = () => {
            emojiDrawer.style.display = 'none'
            handleSendMessage(id, 'emoji')
          }
          emojiGrid.appendChild(btn)
        }
      }

      tabPlayer.onclick = () => {
        activeTab = 'player'
        tabPlayer.style.background = '#f7f7f7'
        tabPlayer.style.color = '#07c160'
        tabSister.style.background = '#eeeeee'
        tabSister.style.color = '#666'
        renderEmojiDrawer()
      }

      tabSister.onclick = () => {
        activeTab = 'sister'
        tabSister.style.background = '#f7f7f7'
        tabSister.style.color = '#07c160'
        tabPlayer.style.background = '#eeeeee'
        tabPlayer.style.color = '#666'
        renderEmojiDrawer()
      }

      emojiBtn.onclick = () => {
        const isHidden = emojiDrawer.style.display === 'none'
        emojiDrawer.style.display = isHidden ? 'flex' : 'none'
        if (isHidden) renderEmojiDrawer()
      }

      // 发红包交互
      packetBtn.onclick = () => {
        packetModal.style.display = 'flex'
      }
      packetClose.onclick = () => {
        packetModal.style.display = 'none'
      }

      container.querySelectorAll('.wt-amt-pill').forEach((pill) => {
        pill.addEventListener('click', () => {
          const amt = (pill as HTMLElement).dataset.amt || '50'
          sendRedPacket(parseInt(amt, 10))
        })
      })

      confirmPacket.onclick = () => {
        const amt = parseInt(customAmt.value, 10)
        if (isNaN(amt) || amt <= 0) {
          ctx.toast('error', '请输入有效的红包金额')
          return
        }
        sendRedPacket(amt)
      }

      const sendRedPacket = (amt: number) => {
        if (activeConv.state.money < amt) {
          ctx.toast('error', `钱包余额不足（当前余额：¥${activeConv.state.money}）`)
          return
        }
        // W1c / P2：外部金钱快照保持只读，仅在独立模拟模式下扣减本地钱包余额
        const hasExternalMoney = Boolean(activeConv.state.hasExternalState && activeConv.state.externalFields?.money)
        if (!hasExternalMoney) {
          activeConv.state.money -= amt
        }
        packetModal.style.display = 'none'
        customAmt.value = ''
        handleSendMessage(String(amt), 'red_packet')
      }

      // 关闭灯箱
      closeLightbox.onclick = () => {
        photoLightbox.style.display = 'none'
      }
      photoLightbox.onclick = (e) => {
        if (e.target === photoLightbox) photoLightbox.style.display = 'none'
      }

      // W4 / P1: 发送消息核心逻辑（全链路会话会话代次校验，彻底杜绝切角色/卸载在途串写）
      const handleSendMessage = async (content: string, type: 'text' | 'emoji' | 'red_packet' = 'text') => {
        if (!content.trim() || !isCurrent()) return

        // 固定本次发送的目标挂载代次、作用域代次与键
        const targetMountSession = mountSessionId
        const targetScopeSession = activeScopeSessionId
        const targetScopeKey = currentScope.scopeKey
        const targetConv = activeConv
        const targetScopeObj = currentScope
        const isRequestValid = () =>
          isCurrent() &&
          targetMountSession === mountSessionId &&
          targetScopeSession === activeScopeSessionId &&
          targetScopeKey === currentScope.scopeKey

        // 保证发送前所用 ST 聊天上下文为最新快照
        const latestMsgs = extractRecentSTMessages(ctx)
        if (latestMsgs) {
          targetScopeObj.stRecentMessages = latestMsgs
        }

        // 玩家消息入库
        const playerMsg: ChatMessage = {
          sender: 'player',
          content,
          type,
          time: { day: targetConv.currentDay, hour: 19, minute: 0 },
        }
        targetConv.messages.push(playerMsg)
        if (currentScope.scopeKey === targetScopeKey) {
          renderMessages()
          typingBadge.style.display = 'inline'
        }
        if (type === 'text') inputEl.value = ''

        // 阶段一：请求回复
        const replyPayload = await pipeline!.requestSisterReply(
          targetConv.messages,
          targetConv.state,
          targetConv.currentDay,
          '19:00',
          targetScopeObj,
        )

        // 检查生命周期与会话是否已被切换
        if (!isRequestValid()) return

        // 拟真打字延迟
        const firstText = replyPayload.messages.find((m) => m.type === 'text')?.content || '嗯嗯。'
        await simulateTypingDelay(firstText)

        if (!isRequestValid()) return
        if (currentScope.scopeKey === targetScopeKey) {
          typingBadge.style.display = 'none'
        }

        // 角色消息入库（只写入目标 targetConv）
        for (const item of replyPayload.messages) {
          targetConv.messages.push({
            sender: 'sister',
            content: (item.content || item.emoji_id || item.pic_id || '') as string,
            type: item.type,
            time: { day: targetConv.currentDay, hour: 19, minute: 1 },
          })
        }
        // 持久化存储目标会话
        conversations[targetScopeKey] = targetConv
        ctx.setAppData(appData)

        if (currentScope.scopeKey === targetScopeKey) {
          renderMessages()
        }

        // 阶段二：评估好感/心情状态变化（W1c / P2：外部状态源为真实基准，不在本地模拟覆盖外部已接管的读入值）
        const preMoodExternal = Boolean(targetConv.state.hasExternalState && targetConv.state.externalFields?.mood)
        const preInterestExternal = Boolean(targetConv.state.hasExternalState && targetConv.state.externalFields?.interest)

        if (!preMoodExternal || !preInterestExternal) {
          const impact = await pipeline!.requestStatImpact(
            type === 'text' ? content : `[${type}] ${content}`,
            firstText,
            targetConv.state,
          )

          // 再次检查生命周期与会话是否已被切换
          if (!isRequestValid()) return

          // 重新确认当前字段所有权（W1c / P2：防止等待期间变量事件新接管了外部字段）
          const curMoodExternal = Boolean(targetConv.state.hasExternalState && targetConv.state.externalFields?.mood)
          const curInterestExternal = Boolean(targetConv.state.hasExternalState && targetConv.state.externalFields?.interest)

          let stateChanged = false
          if (!curMoodExternal) {
            targetConv.state.mood = Math.max(0, Math.min(100, targetConv.state.mood + impact.mood))
            stateChanged = true
          }
          if (!curInterestExternal) {
            targetConv.state.interest = Math.max(0, Math.min(100, targetConv.state.interest + impact.interest))
            stateChanged = true
          }

          if (stateChanged) {
            // 持久化存储目标会话
            conversations[targetScopeKey] = targetConv
            ctx.setAppData(appData)

            // 仅当用户依然停留在该会话视图时，才更新界面组件
            if (currentScope.scopeKey === targetScopeKey) {
              syncActiveView()
            }
          }
        }
      }

      sendBtn.onclick = () => handleSendMessage(inputEl.value, 'text')

      // W6 / P2: 输入法 composition 状态保护
      let isComposing = false
      inputEl.addEventListener('compositionstart', () => {
        isComposing = true
      })
      inputEl.addEventListener('compositionend', () => {
        isComposing = false
      })

      inputEl.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          if (isComposing || e.isComposing || e.keyCode === 229) {
            return
          }
          e.preventDefault()
          handleSendMessage(inputEl.value, 'text')
        }
      }

      // 打开与保存配置
      statusPill.onclick = () => {
        cfgKey.value = appData.config.apiKey || ''
        cfgUrl.value = appData.config.apiUrl || 'https://api.deepseek.com/chat/completions'
        cfgModel.value = appData.config.model || 'deepseek-chat'
        settingsModal.style.display = 'flex'
      }

      closeSettings.onclick = () => {
        settingsModal.style.display = 'none'
      }

      btnSaveSettings.onclick = () => {
        appData.config.apiKey = cfgKey.value.trim()
        appData.config.apiUrl = cfgUrl.value.trim() || 'https://api.deepseek.com/chat/completions'
        appData.config.model = cfgModel.value.trim() || 'deepseek-chat'

        activeConv.state.mood = parseFloat(setMoodRange.value)
        activeConv.state.interest = parseFloat(setInterestRange.value)
        activeConv.state.sisterLocation = setSisterLoc.value as SisterLocation

        // 用户手动调整数值保存后，转为独立模拟数值，清理外部状态标记
        if (activeConv.state.hasExternalState) {
          activeConv.state.hasExternalState = false
          activeConv.state.externalSource = undefined
          activeConv.state.externalFields = undefined
          currentScope.externalState = { source: 'none' }
        }

        conversations[currentScope.scopeKey] = activeConv
        ctx.setAppData(appData)
        pipeline = new WeChatPipeline(
          appData.config,
          PLAYER_EMOJIS,
          SISTER_EMOJIS,
          SISTER_PHOTOS,
          FALLBACK_DIALOGUES,
        )

        settingsModal.style.display = 'none'
        syncActiveView()
        ctx.toast('success', '微信设置与数值已保存')
      }

      // 下一天与清空记录
      btnNextDay.onclick = () => {
        activeConv.currentDay += 1
        // 仅在未从外部接入金钱时发放独立零花钱
        const hasExternalMoney = Boolean(activeConv.state.hasExternalState && activeConv.state.externalFields?.money)
        if (!hasExternalMoney) {
          activeConv.state.money += 200
        }
        conversations[currentScope.scopeKey] = activeConv
        ctx.setAppData(appData)
        syncActiveView()
        ctx.toast('info', `已进入第 ${activeConv.currentDay} 天${!hasExternalMoney ? '，发放生活费 ¥200' : ''}`)
      }

      btnClearChat.onclick = () => {
        activeConv.messages = []
        conversations[currentScope.scopeKey] = activeConv
        ctx.setAppData(appData)
        renderMessages()
        settingsModal.style.display = 'none'
        ctx.toast('info', '微信聊天记录已清空')
      }

      // 首次视图渲染
      syncActiveView()
    },

    unmount() {
      mountSessionId++
      activeScopeSessionId++
      pipeline = null
      if (unbindEvents) {
        unbindEvents()
        unbindEvents = null
      }
    },
  }
}
