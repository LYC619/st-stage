/** Scoped styles keep the phone usable under host themes and narrow viewports. */
export const WECHAT_VIEW = `
<div class="wechat-root">
  <header class="wechat-nav">
    <button id="wt-back" aria-label="返回会话列表" hidden>‹</button>
    <span id="wt-contact-name">微信</span>
    <button id="wt-group-edit" hidden>群成员</button>
    <button id="wt-plus" aria-label="添加好友或群聊" aria-haspopup="menu" aria-expanded="false" aria-controls="wt-plus-menu">+</button>
    <button id="wt-settings-btn" aria-label="微信设置">⚙ 设置</button>
  </header>
  <div id="wt-notice-bar" class="wt-notice-bar" hidden><span id="wt-notice" role="status"></span><button id="wt-connect-ai" hidden>连接 AI</button></div>
  <div id="wt-plus-menu" role="menu" aria-label="添加" hidden><button id="wt-add-contact" role="menuitem">添加好友</button><button id="wt-new-group" role="menuitem">发起群聊</button></div>
  <div id="wt-conversations" role="tabpanel" aria-labelledby="wt-tab-chats" tabindex="0"></div>
  <section id="wt-address-book" role="tabpanel" aria-labelledby="wt-tab-contacts" tabindex="0" hidden></section>
  <section id="wt-moments-page" role="tabpanel" aria-labelledby="wt-moments" tabindex="0" hidden>
    <div class="wt-moments-cover"><div><h2>朋友们的此刻</h2><p>故事继续，生活也在更新。</p></div><button id="wt-refresh-moments">刷新近况</button><button id="wt-stop-auto-moments" hidden>取消</button></div>
    <p id="wt-moments-feedback" role="status"></p>
    <div id="wt-moments-feed" role="region" aria-label="朋友圈动态" tabindex="0"></div>
  </section>
  <section id="wt-chat" aria-label="微信聊天" hidden>
    <details id="wt-state"><summary id="wt-state-summary">TA 的此刻 · 待感知</summary><p><strong>内心想法</strong><br><span id="wt-inner-thought">聊上两句后，就能悄悄看见 TA 此刻的心思啦</span></p><p><strong>当前状态</strong><br><span id="wt-current-status">聊上两句后，就能看见 TA 眼下正在忙什么</span></p></details>
    <div class="wt-scroll-wrap"><div id="wt-scroll" role="log" aria-label="聊天消息" tabindex="0"></div><button id="wt-jump-latest" class="wt-jump-latest" hidden>↓ 新消息</button></div>
    <div id="wt-chat-status" class="wt-chat-status" hidden>
      <div id="wt-chat-tools" hidden><select id="wt-mention" aria-label="提及群成员" hidden></select></div>
      <span id="wt-typing-badge" role="status" hidden>对方正在输入…</span>
      <div class="wt-recovery" id="wt-recovery" hidden><p id="wt-reply-error" role="status"></p><button id="wt-cancel-reply" aria-label="取消回复" hidden>取消</button><button id="wt-retry-reply" aria-label="重试回复" hidden>重试</button></div>
    </div>
    <div id="wt-emoji-drawer" aria-label="表情包" role="region" hidden>
      <div class="wt-tabs"><button id="wt-tab-player">我的表情</button><button id="wt-tab-contact">联系人表情</button><button id="wt-manage-emojis">管理</button></div>
      <div id="wt-emoji-grid"></div>
    </div>
    <div id="wt-voice-feedback" hidden><span id="wt-voice-status" role="status"></span><button id="wt-voice-edit">输入文字</button></div>
    <div class="wechat-input-bar"><button id="wt-voice-mode" aria-label="切换为语音消息" aria-pressed="false" aria-controls="wt-compose-field">🎙️</button><button id="wt-emoji-btn" aria-label="表情包" aria-expanded="false" aria-controls="wt-emoji-drawer">😀</button><button id="wt-packet-btn" aria-label="发红包或礼物">🧧</button><div id="wt-compose-field" class="wt-compose-field"><input id="wt-input-text" aria-label="消息" placeholder="发消息…" maxlength="8000"><button id="wt-record" aria-label="点击录音" hidden>点击录音</button></div><button id="wt-send-btn" class="wt-primary">发送</button></div>
  </section>
  <nav id="wt-bottom-nav" role="tablist" aria-label="微信主导航">
    <button id="wt-tab-chats" role="tab" aria-selected="true" aria-controls="wt-conversations"><span class="wt-nav-icon" aria-hidden="true">💬</span>微信</button>
    <button id="wt-tab-contacts" role="tab" aria-selected="false" aria-controls="wt-address-book" tabindex="-1"><span class="wt-nav-icon" aria-hidden="true">👥</span>通讯录</button>
    <button id="wt-moments" role="tab" aria-selected="false" aria-controls="wt-moments-page" tabindex="-1"><span class="wt-nav-icon" aria-hidden="true">⭕</span>朋友圈</button>
  </nav>
  <div id="wt-settings-modal" class="wt-modal" role="dialog" aria-modal="true" aria-labelledby="wt-modal-title" hidden>
    <div class="wt-modal-card">
      <div class="wt-modal-header"><h2 id="wt-modal-title">微信设置</h2><button id="wt-close-settings" aria-label="关闭微信设置">✕</button></div>
      <details id="wt-ai-settings"><summary id="wt-ai-summary">AI 连接 · 所有联系人共用</summary>
        <p class="wt-hint">填写兼容 OpenAI 的连接；留空时仅使用本地演示回复。此连接独立于酒馆主聊天。</p>
        <label class="wt-field">API Key<input id="wt-cfg-key" type="password" autocomplete="off"></label>
        <label class="wt-field">API URL<input id="wt-cfg-url" type="url" placeholder="https://…/chat/completions"></label>
        <label class="wt-field">Model<input id="wt-cfg-model" placeholder="模型名称"></label>
      </details>
      <h3 class="wt-settings-heading">联系人设定</h3>
      <div id="wt-profile-container"></div>
      <details id="wt-moments-composer"><summary>朋友圈偏好</summary>
        <label class="wt-field">随剧情自动更新动态<input id="wt-auto-moments" type="checkbox"></label>
        <label class="wt-field">允许角色偶尔发布仅你可见的动态<input id="wt-private-moments" type="checkbox"></label>
        <p class="wt-hint">连接 AI 后，进入微信或主线新消息会触发活跃角色近况，每批最多两条，两分钟内合并更新。会使用微信的 AI 连接。</p>
        <label class="wt-field">手动查看指定角色近况<select id="wt-moments-author"></select></label><button id="wt-generate-moment">生成新动态</button><button id="wt-cancel-moment" hidden>取消生成</button>
        <p id="wt-manual-moment-feedback" role="status"></p>
        <details><summary>动态提示词</summary><label class="wt-field">朋友圈提示词<textarea id="wt-moments-prompt" maxlength="8000" rows="5"></textarea></label><button id="wt-reset-moments-prompt">恢复默认</button><button id="wt-save-moments-prompt">保存提示词</button></details>
      </details>
      <details id="wt-history-actions"><summary>聊天记录</summary><p class="wt-hint">只清空当前微信会话。酒馆主聊天不受影响。</p><button id="wt-btn-clear-chat">清空此会话记录</button></details>
      <div id="wt-settings-actions"><p id="wt-settings-feedback" role="status" aria-live="polite"></p><button id="wt-cancel-settings">关闭</button><button id="wt-btn-save-settings" class="wt-primary">保存设置</button></div>
    </div>
  </div>
  <div id="wt-contacts-modal" class="wt-modal" role="dialog" aria-modal="true" aria-labelledby="wt-contacts-title" hidden><div class="wt-modal-card">
    <div class="wt-modal-header"><h2 id="wt-contacts-title">选择联系人</h2><button id="wt-close-contacts" aria-label="关闭联系人选择">✕</button></div>
    <p class="wt-hint">从酒馆角色卡建立独立微信会话，不切换正在进行的主聊天。</p>
    <input id="wt-contact-search" aria-label="搜索角色卡" placeholder="搜索角色名…">
    <div id="wt-contact-options"></div><p id="wt-contact-feedback" role="status"></p>
  </div></div>
  <div id="wt-packet-modal" class="wt-modal" role="dialog" aria-modal="true" aria-labelledby="wt-packet-title" hidden><div class="wt-modal-card">
    <div class="wt-modal-header"><h2 id="wt-packet-title">🧧 红包 / 礼物</h2><button id="wt-packet-close" aria-label="关闭红包">✕</button></div>
    <p id="wt-packet-target" class="wt-hint"></p>
    <label class="wt-field">发送什么<input id="wt-custom-amt" placeholder="例如：一杯奶茶、520 元、一张船票" maxlength="120"></label>
    <label class="wt-field">附言（可选）<textarea id="wt-packet-note" rows="2" maxlength="300" placeholder="想对 TA 说的话…"></textarea></label>
    <p class="wt-hint">给 TA 捎一份小礼物或红包心意，看看对方会怎么收下吧。</p><p id="wt-packet-feedback" role="status"></p><button id="wt-confirm-packet" class="wt-primary">发送红包</button>
  </div></div>
  <div id="wt-group-modal" class="wt-modal" role="dialog" aria-modal="true" aria-labelledby="wt-group-heading" hidden><div class="wt-modal-card">
    <div class="wt-modal-header"><h2 id="wt-group-heading">群聊成员</h2><button id="wt-close-group" aria-label="关闭群成员">关闭</button></div>
    <label class="wt-field">群名称<input id="wt-group-title" maxlength="60"></label><p class="wt-hint">选择 2–50 位角色；发送消息后群成员依次回复，也可用 @ 选择发言者。</p><div id="wt-group-options"></div><p id="wt-group-feedback" role="status"></p><button id="wt-save-group" class="wt-primary">保存群聊</button>
  </div></div>
  <div id="wt-photo-lightbox" class="wt-modal" role="dialog" aria-modal="true" aria-label="查看图片" hidden><div class="wt-modal-card"><button id="wt-close-lightbox" aria-label="关闭图片">关闭</button><div id="wt-lightbox-media"></div><p id="wt-lightbox-desc"></p></div></div>
</div>`
