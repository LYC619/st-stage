/** Scoped styles keep the phone usable under host themes and narrow viewports. */
export const WECHAT_VIEW = `
<div class="wechat-root">
  <style>
    .wechat-root{--wt-green:#087b3e;display:flex;flex-direction:column;height:100%;width:100%;min-height:0;min-width:0;overflow:hidden;position:relative;background:#ededed;color:#181818;font:13px/1.5 -apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;isolation:isolate}
    .wechat-root *{box-sizing:border-box}
    .wechat-root [hidden]{display:none!important}
    .wechat-root button,.wechat-root input,.wechat-root select,.wechat-root textarea{font:inherit;color:#222;border:1px solid #c8c8c8;border-radius:6px;background:#fff;min-width:0;max-width:100%;box-shadow:none;text-shadow:none}
    .wechat-root button{min-height:40px;padding:7px 11px;cursor:pointer;white-space:normal}
    .wechat-root button:disabled{opacity:.55;cursor:default}
    .wechat-root :is(button,input,select,textarea,summary,[tabindex]):focus-visible{outline:2px solid #155a96;outline-offset:2px}
    .wechat-root input,.wechat-root select,.wechat-root textarea{width:100%;padding:8px;min-height:40px}
    .wechat-root input::placeholder,.wechat-root textarea::placeholder{color:#686868;opacity:1}
    .wechat-root input[type=checkbox]{width:22px;height:22px;min-height:22px;accent-color:var(--wt-green)}
    .wechat-root textarea{resize:vertical}
    .wechat-root .wt-primary{background:var(--wt-green);color:white;border-color:var(--wt-green)}
    .wechat-nav{display:flex;align-items:center;gap:6px;min-height:54px;padding:6px 10px;border-bottom:1px solid #d8d8d8;flex-shrink:0}
    .wechat-nav button{border:0;background:transparent;flex-shrink:0}
    #wt-contact-name{font-size:16px;font-weight:600;flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
    #wt-conversations{overflow:auto;flex:1;min-height:0;background:#fff}
    .wechat-root .wt-conversation{display:flex;align-items:center;gap:11px;width:100%;border:0;border-bottom:1px solid #ededed;border-radius:0;padding:14px 12px;text-align:left;background:#fff}
    .wt-avatar{width:44px;height:44px;border-radius:7px;object-fit:cover;background:#e1e9e3;flex-shrink:0}
    .wt-conversation-copy{flex:1;min-width:0}
    .wt-conversation-title{display:block;font-size:15px;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
    .wt-conversation-preview{display:block;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
    .wt-conversation-meta{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0;align-self:flex-start;padding-top:2px}
    .wt-conversation-time{font-size:11px;color:#707070;white-space:nowrap;font-variant-numeric:tabular-nums}
    .wt-unread{border-radius:20px;background:#bc2c2c;color:#fff;padding:1px 6px;font-size:11px;line-height:16px}
    #wt-chat{flex:1;min-height:0;display:flex;flex-direction:column}
    #wt-state{background:#f7f7f7;border-bottom:1px solid #ddd;padding:7px 12px;font-size:12px;max-height:30%;overflow:auto;flex-shrink:0}
    #wt-state summary{cursor:pointer;min-height:26px;overflow-wrap:anywhere;color:#4a4a4a}
    #wt-state p{margin:6px 0;white-space:pre-wrap;overflow-wrap:anywhere}
    .wt-scroll-wrap{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}
    #wt-scroll{flex:1;min-height:0;overflow:auto;padding:14px 10px;display:flex;flex-direction:column;gap:14px;overscroll-behavior:contain}
    .wt-chat-empty{margin:auto;padding:24px 12px;color:#595959;font-size:12px;text-align:center}
    .wechat-root .wt-jump-latest{position:absolute;right:12px;bottom:10px;z-index:3;min-height:32px;padding:4px 12px;border:0;border-radius:16px;background:#fff;color:#087b3e;font-size:12px;box-shadow:0 2px 10px #0003}
    .wt-message{display:flex;align-items:flex-start;gap:8px;flex-shrink:0}
    .wt-message-player{flex-direction:row-reverse}
    .wt-message .wt-avatar{width:34px;height:34px}
    .wt-bubble{background:#fff;border-radius:7px;padding:9px 11px;max-width:76%;white-space:pre-wrap;overflow-wrap:anywhere;color:#181818}
    .wt-message-player .wt-bubble{background:#95ec69}
    .wt-bubble img{max-width:100%;height:auto;max-height:220px;object-fit:contain;display:block;border-radius:5px}
    .wechat-root .wt-media{background:transparent;border:0;padding:0;max-width:min(72%,220px);min-width:120px}
    .wechat-root .wt-media.wt-emoji{width:110px;min-width:0;max-width:110px}
    .wt-emoji img{width:110px;height:110px;object-fit:contain}
    .wt-image-failure{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:100px;padding:12px;border:1px solid #c8c8c8;border-radius:7px;background:#f5f5f5;color:#595959;font-size:12px;white-space:normal;overflow-wrap:anywhere}
    .wechat-root .wt-gift{background:#f4ac58;color:#432100;min-width:140px}
    .wechat-root .wt-gift small{display:block;margin-top:7px;font-size:12px;color:#432100;opacity:1}
    .wechat-input-bar{display:flex;align-items:center;gap:5px;padding:8px;background:#f7f7f7;border-top:1px solid #ddd;flex-shrink:0}
    .wt-compose-field{flex:1;min-width:0;display:flex}
    .wt-compose-field input,.wt-compose-field button{flex:1;width:100%;min-width:0}
    .wechat-input-bar button{flex-shrink:0;padding:6px 9px}
    .wechat-input-bar #wt-voice-mode,.wechat-input-bar #wt-emoji-btn,.wechat-input-bar #wt-packet-btn{width:34px;padding:4px}
    #wt-voice-feedback{display:flex;gap:6px;align-items:center;padding:4px 8px;background:#f7f7f7;flex-shrink:0;font-size:12px}
    #wt-voice-status{flex:1;min-width:0;overflow-wrap:anywhere;color:#595959}
    #wt-voice-edit{font-size:12px;padding:3px 6px}
    #wt-record{font-size:12px;padding:4px;overflow-wrap:anywhere;touch-action:manipulation}
    .wt-chat-status{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;min-height:36px;padding:3px 10px;background:#f7f7f7;border-top:1px solid #e3e3e3;flex-shrink:0;font-size:12px}
    #wt-typing-badge{flex:1 1 auto;min-width:0;color:#087b3e;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
    .wechat-root .wt-chat-status button{min-height:30px;padding:3px 12px;font-size:12px;border-radius:15px}
    #wt-emoji-drawer{height:210px;max-height:38%;display:flex;flex-direction:column;flex-shrink:0;background:#f7f7f7;border-top:1px solid #ddd}
    .wt-tabs{display:flex;gap:4px;padding:4px;flex-shrink:0}
    .wt-tabs button{flex:1;padding:5px;font-size:12px}
    .wt-tabs [aria-pressed=true]{border-color:var(--wt-green);color:var(--wt-green)}
    #wt-emoji-grid,.wt-asset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(58px,1fr));gap:6px;overflow:auto;padding:6px}
    #wt-emoji-grid button,.wt-asset-grid button{padding:4px;font-size:10px;overflow-wrap:anywhere}
    #wt-emoji-grid img,.wt-asset-grid img{display:block;width:100%;height:46px;object-fit:contain;margin:0 auto 3px}
    .wt-asset-grid{max-height:240px}
    .wt-asset-grid [aria-pressed=true]{outline:2px solid var(--wt-green);outline-offset:-2px}
    .wt-asset-preview{width:100px;height:100px;object-fit:contain}
    .wt-modal{position:absolute;inset:0;z-index:30;display:flex;align-items:flex-end;background:#0007;padding-top:12px}
    .wt-modal-card{display:flex;flex-direction:column;gap:12px;width:100%;max-height:100%;padding:14px;background:#fff;border-radius:14px 14px 0 0;overflow:auto;min-height:0;color:#222}
    .wt-modal-header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0}
    .wt-modal-header h2{font-size:16px;margin:0}
    .wt-field{display:flex;flex-direction:column;gap:5px;margin:10px 0;min-width:0;color:#333;font-size:12px}
    .wt-hint{font-size:12px;color:#595959;line-height:1.6;overflow-wrap:anywhere;margin:6px 0}
    .wechat-root details{flex-shrink:0}
    .wt-modal-card details{border:1px solid #dedede;border-radius:8px;padding:10px;margin:8px 0}
    .wt-modal-card summary{cursor:pointer;font-weight:600;min-height:28px}
    .wt-modal-card details>button{margin:4px 4px 4px 0}
    #wt-settings-actions{position:sticky;bottom:-14px;padding:8px 0 10px;background:#fff;display:flex;flex-wrap:wrap;gap:8px;z-index:2;flex-shrink:0}
    #wt-settings-actions button{flex:1}
    #wt-settings-feedback{margin:0;padding:0;color:#16683d;font-size:12px;overflow-wrap:anywhere;flex:0 0 100%}
    #wt-settings-feedback:empty{display:none}
    #wt-settings-feedback[data-kind=error]{color:#a32323}
    .wt-notice-bar{display:flex;align-items:center;gap:8px;background:#f7f7f7;padding:3px 8px 3px 12px;flex-shrink:0;border-bottom:1px solid #e6e6e6}
    #wt-notice{flex:1;min-width:0;font-size:12px;color:#555;overflow-wrap:anywhere}
    .wechat-root #wt-connect-ai{flex-shrink:0;min-height:30px;padding:3px 10px;font-size:12px;border-radius:15px;border-color:var(--wt-green);color:var(--wt-green)}
    .wt-settings-heading{margin:4px 0 -2px;font-size:13px;font-weight:600;color:#333}
    .wt-modal-card p.wt-hint:empty,.wt-profile-settings>p:empty{display:none}
    .wt-empty{padding:30px 18px;text-align:center;color:#666}
    #wt-photo-lightbox{background:#000e;align-items:center}
    #wt-photo-lightbox .wt-modal-card{background:transparent;color:white;align-items:center}
    #wt-lightbox-img{max-width:100%;max-height:65vh;object-fit:contain}
    @media(max-width:360px){.wechat-nav{padding:5px 7px}.wechat-nav button{padding:5px 7px}.wt-modal-card{padding:12px}.wechat-input-bar{gap:4px;padding:6px}.wechat-input-bar button{padding:6px 7px}}
    .wt-social-nav{display:flex;gap:6px;padding:5px 10px;flex-shrink:0;flex-wrap:wrap;background:#f7f7f7}
    .wt-social-nav button{flex:1}
    .wt-recovery{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex:0 1 auto;min-width:0;margin-left:auto}
    .wt-recovery:has(#wt-reply-error:not(:empty)){flex:1 1 100%}
    #wt-reply-error{flex:1 1 auto;min-width:0;margin:0;color:#9b2222;overflow-wrap:anywhere}
    #wt-reply-error:empty{display:none}
    .wt-group-avatar{display:grid;grid-template-columns:repeat(3,13px);grid-auto-rows:13px;gap:1px;padding:1px;align-content:center;justify-content:center;overflow:hidden}
    .wt-group-avatar .wt-avatar{width:13px;height:13px;border-radius:2px}
    .wt-group-avatar[data-columns="2"]{grid-template-columns:repeat(2,18px);grid-auto-rows:18px;gap:2px;padding:3px}
    .wt-group-avatar[data-columns="2"] .wt-avatar{width:18px;height:18px}
    .wt-member-choice{display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid #ddd}
    .wt-message-author{font-size:11px;color:#555;display:block}.wt-message-content{min-width:0;max-width:76%}.wt-message-content .wt-bubble{max-width:100%}
    .wt-message-content:has(.wt-media:not(.wt-emoji)){width:min(72%,220px)}
    .wechat-root .wt-message-content .wt-media:not(.wt-emoji){max-width:100%}
    .wt-voice button{padding:5px;font-size:12px}.wechat-root .wt-voice small{display:block;color:#595959;opacity:1}.wt-voice p{margin:7px 0}
    #wt-chat-tools{display:flex;flex-shrink:0}#wt-chat-tools select{width:auto;max-width:100%;min-height:30px;padding:3px 8px;border-radius:15px;font-size:12px}
    .wt-moment{display:grid;grid-template-columns:40px minmax(0,1fr);column-gap:10px;padding:12px 0;border-bottom:1px solid #e6e6e6}
    .wt-moment>.wt-avatar{width:40px;height:40px;border-radius:5px}
    .wt-moment-body{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:5px}
    .wt-moment-name{color:#576b95;font-size:14px;font-weight:600}
    .wt-moment p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55}
    .wt-moment-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;align-self:stretch}
    .wt-moment time{color:#707070;font-size:11px}
    .wechat-root .wt-moment-like{min-height:32px;padding:3px 10px;border:0;border-radius:4px;background:#f3f3f5;color:#576b95;font-size:12px}
    .wechat-root .wt-moment-like[aria-pressed=true]{color:#c0392b}
    .wt-moment-image{display:block;max-width:100%;height:auto;max-height:220px;object-fit:contain}
    #wt-moments-page{display:flex;flex-direction:column;flex:1;min-height:0;background:#fff;overflow:hidden}
    .wt-moments-cover{display:flex;align-items:center;gap:10px;background:#e5eee6;padding:10px 14px;flex-shrink:0;border-bottom:1px solid #dce4dd}
    .wt-moments-cover>div{flex:1;min-width:0}
    .wt-moments-cover h2{font-size:17px;letter-spacing:1px;margin:0;font-weight:600;color:#244b35}
    .wt-moments-cover p{margin:2px 0 0;color:#4c6154;font-size:12px}
    .wechat-root .wt-moments-cover button{flex-shrink:0;min-height:32px;padding:3px 12px;border:0;border-radius:16px;background:#fff;color:#16663b;font-size:12px}
    #wt-address-book{flex:1;min-height:0;overflow:auto;background:#fff}
    .wt-directory-heading{margin:0;padding:7px 14px;font-size:12px;font-weight:500;color:#626962;background:#f1f3f1}
    #wt-bottom-nav{display:flex;flex-shrink:0;border-top:1px solid #d8d8d8;background:#f7f7f7;padding:4px 6px max(4px,env(safe-area-inset-bottom));gap:4px}
    .wechat-root #wt-bottom-nav button{flex:1;border:0;background:transparent;border-radius:5px;min-height:52px;font-size:11px;color:#606060;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:4px}
    .wechat-root #wt-bottom-nav button[aria-selected=true]{color:#087b3e;background:#e9f1e9;font-weight:600}
    .wt-nav-icon{font-size:21px;line-height:25px}
    #wt-plus-menu{position:absolute;right:10px;top:53px;z-index:25;width:150px;padding:6px;background:#fff;border:1px solid #ddd;border-radius:10px;box-shadow:0 6px 24px #0002}
    .wechat-root #wt-plus-menu button{display:block;width:100%;border:0;text-align:left;padding:10px;min-height:44px}
    .wechat-root #wt-plus{font-size:25px;min-width:44px;padding:0}
    .wt-moment-private{display:inline-block;color:#72522b;background:#fbf1df;border-radius:4px;padding:2px 6px;font-size:11px}
    #wt-moments-composer{margin:0;max-height:45%;overflow:auto;padding:6px 10px}
    #wt-moments-composer>summary{min-height:32px;display:list-item;align-content:center}
    #wt-moments-composer .wt-field{margin:6px 0}
    #wt-moments-feedback{margin:0;padding:6px 16px 0;font-size:12px;color:#4a4a4a;overflow-wrap:anywhere;flex-shrink:0}
    #wt-moments-feedback:empty{display:none}
    #wt-moments-feed{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;overflow-anchor:none;padding:0 16px 16px}
    .wt-moment-media{height:220px;display:flex;align-items:center;max-width:100%;align-self:stretch}
    .wt-moment-media .wt-image-failure{width:100%}
    @media(max-height:480px){
      .wechat-nav{min-height:38px;padding:2px 7px}.wechat-root button{min-height:30px;padding:3px 7px}
      .wechat-root input,.wechat-root select{min-height:30px;padding:3px 7px}
      .wt-social-nav{padding:2px 7px}.wt-notice-bar{padding:1px 7px}#wt-notice{font-size:11px}
      #wt-state{padding:2px 7px}.wt-chat-status{min-height:30px;padding:2px 7px}.wechat-root .wt-chat-status button{min-height:26px}.wechat-input-bar{padding:3px}
      #wt-emoji-drawer{position:absolute;left:0;right:0;bottom:39px;height:min(190px,calc(100% - 45px));max-height:none;z-index:10}
      #wt-emoji-grid{min-height:0;flex:1}.wt-tabs{padding:3px}
      .wt-moments-cover{padding:6px 14px}.wt-moments-cover h2{font-size:15px}.wt-moments-cover p{display:none}
      .wechat-root #wt-bottom-nav button{min-height:40px;flex-direction:row;gap:5px}.wt-nav-icon{font-size:18px}
    }
  </style>
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
    <details id="wt-state"><summary id="wt-state-summary">角色状态 · 等待更新</summary><p><strong>内心想法</strong><br><span id="wt-inner-thought">等待角色回复</span></p><p><strong>当前状态</strong><br><span id="wt-current-status">等待角色回复</span></p></details>
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
    <p class="wt-hint">用于角色互动的虚构礼物。</p><p id="wt-packet-feedback" role="status"></p><button id="wt-confirm-packet" class="wt-primary">发送红包</button>
  </div></div>
  <div id="wt-group-modal" class="wt-modal" role="dialog" aria-modal="true" aria-labelledby="wt-group-heading" hidden><div class="wt-modal-card">
    <div class="wt-modal-header"><h2 id="wt-group-heading">群聊成员</h2><button id="wt-close-group" aria-label="关闭群成员">关闭</button></div>
    <label class="wt-field">群名称<input id="wt-group-title" maxlength="60"></label><p class="wt-hint">选择 2–50 位角色；发送消息后群成员依次回复，也可用 @ 选择发言者。</p><div id="wt-group-options"></div><p id="wt-group-feedback" role="status"></p><button id="wt-save-group" class="wt-primary">保存群聊</button>
  </div></div>
  <div id="wt-photo-lightbox" class="wt-modal" role="dialog" aria-modal="true" aria-label="查看图片" hidden><div class="wt-modal-card"><button id="wt-close-lightbox" aria-label="关闭图片">关闭</button><div id="wt-lightbox-media"></div><p id="wt-lightbox-desc"></p></div></div>
</div>`
