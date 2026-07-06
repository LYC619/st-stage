"use strict";
(() => {
  // core/tag-parser.ts
  var TAG_REGEX = /[\[【]\s*立绘\s*[:：]\s*([^\]】]+?)\s*[\]】]/g;
  function extractTags(text) {
    const tags = [];
    let match;
    const regex = new RegExp(TAG_REGEX.source, "g");
    while ((match = regex.exec(text)) !== null) {
      const tag = match[1].trim();
      if (tag) tags.push(tag);
    }
    return tags;
  }
  function extractLastTag(text) {
    const tags = extractTags(text);
    return tags.length > 0 ? tags[tags.length - 1] : null;
  }

  // core/prompt-builder.ts
  function buildInjectionPrompt(tags) {
    if (tags.length === 0) return "";
    const list = tags.join("、");
    return [
      "[角色立绘系统]",
      `可用立绘表情：${list}`,
      "请在每次回复的末尾，从上述列表中选择一个最贴合当前情境与角色情绪的标签，",
      "以 [立绘:标签名] 的格式单独标注（例如 [立绘:" + tags[0] + "]）。",
      "只能使用列表中存在的标签，每次回复只标注一个。"
    ].join("\n");
  }

  // core/sprite-store.ts
  function genId() {
    return `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  function getActivePack(settings, characterName) {
    const binding = settings.bindings.find((b) => b.characterName === characterName && b.enabled);
    if (!binding) return null;
    return settings.packs.find((p) => p.id === binding.packId) ?? null;
  }
  function getAvailableTags(settings, characterName) {
    const pack = getActivePack(settings, characterName);
    return pack ? pack.sprites.map((s) => s.tag) : [];
  }
  function matchSprite(pack, tag) {
    const normalized = tag.trim();
    if (!normalized) return null;
    const exact = pack.sprites.find((s) => s.tag === normalized);
    if (exact) return exact;
    const partial = pack.sprites.find(
      (s) => s.tag.includes(normalized) || normalized.includes(s.tag)
    );
    return partial ?? null;
  }
  function upsertPack(settings, pack) {
    const exists = settings.packs.some((p) => p.id === pack.id);
    return {
      ...settings,
      packs: exists ? settings.packs.map((p) => p.id === pack.id ? pack : p) : [...settings.packs, pack]
    };
  }
  function removePack(settings, packId) {
    return {
      ...settings,
      packs: settings.packs.filter((p) => p.id !== packId),
      bindings: settings.bindings.filter((b) => b.packId !== packId)
    };
  }
  function bindCharacter(settings, characterName, packId) {
    const others = settings.bindings.filter((b) => b.characterName !== characterName);
    return {
      ...settings,
      bindings: [...others, { characterName, packId, enabled: true }]
    };
  }
  function toggleBinding(settings, characterName, enabled) {
    return {
      ...settings,
      bindings: settings.bindings.map(
        (b) => b.characterName === characterName ? { ...b, enabled } : b
      )
    };
  }
  function preloadPack(pack) {
    if (typeof window === "undefined" || typeof Image === "undefined") return;
    for (const sprite of pack.sprites) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = sprite.url;
    }
  }

  // core/types.ts
  function createDefaultSettings() {
    return {
      enabled: true,
      hideTagInMessage: false,
      overlay: { x: 24, y: 80, width: 220 },
      packs: [],
      bindings: []
    };
  }

  // core/presets.ts
  var PRESET_DEFS = [
    {
      id: "preset_silver_loli",
      name: "银发萝莉",
      description: "内置预设 · 银发双马尾萝莉，8 个常用表情",
      dir: "silver-loli",
      tags: ["微笑", "害羞", "恼怒", "惊讶", "哭泣", "得意", "无奈", "开心"]
    },
    {
      id: "preset_raven_onee",
      name: "黑长直御姐",
      description: "内置预设 · 黑长直冷艳御姐，8 个常用表情",
      dir: "raven-onee",
      tags: ["微笑", "害羞", "恼怒", "惊讶", "哭泣", "得意", "冷淡", "温柔"]
    }
  ];
  function getPresetPacks(baseUrl = "") {
    return PRESET_DEFS.map((def) => ({
      id: def.id,
      name: def.name,
      author: "内置预设",
      description: def.description,
      sprites: def.tags.map((tag) => ({
        tag,
        url: `${baseUrl}/presets/${def.dir}/${encodeURIComponent(tag)}.png`
      }))
    }));
  }
  function isPresetPack(packId) {
    return PRESET_DEFS.some((d) => d.id === packId);
  }

  // st-extension/src/st-adapter.ts
  var MODULE_NAME = "sprite_overlay";
  var DEFAULT_EXTENSION_FOLDER = "st-stage";
  function getExtensionBaseUrl() {
    try {
      const stack = new Error().stack ?? "";
      const match = stack.match(/\/scripts\/extensions\/third-party\/([^/]+)\//);
      if (match) {
        return `/scripts/extensions/third-party/${match[1]}`;
      }
    } catch {
    }
    return `/scripts/extensions/third-party/${DEFAULT_EXTENSION_FOLDER}`;
  }
  function getContext() {
    const st = window.SillyTavern;
    if (!st) throw new Error("[sprite-overlay] SillyTavern 全局对象不存在，扩展只能在 ST 内运行");
    return st.getContext();
  }
  var STAdapter = class {
    async loadSettings() {
      const ctx = getContext();
      const saved = ctx.extensionSettings[MODULE_NAME];
      const presets = getPresetPacks(`${getExtensionBaseUrl()}/public`);
      if (saved && typeof saved === "object") {
        const merged = { ...createDefaultSettings(), ...saved };
        const customPacks = (merged.packs ?? []).filter((p) => !isPresetPack(p.id));
        merged.packs = [...presets, ...customPacks];
        return merged;
      }
      const defaults = createDefaultSettings();
      defaults.packs = presets;
      ctx.extensionSettings[MODULE_NAME] = defaults;
      ctx.saveSettingsDebounced();
      return defaults;
    }
    async saveSettings(settings) {
      const ctx = getContext();
      ctx.extensionSettings[MODULE_NAME] = {
        ...settings,
        packs: settings.packs.filter((p) => !isPresetPack(p.id))
      };
      ctx.saveSettingsDebounced();
    }
    async saveImage(fileName, base64Data, characterName) {
      const ctx = getContext();
      const match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/s);
      if (!match) throw new Error("图片数据格式不正确");
      const [, ext, data] = match;
      const baseName = fileName.replace(/\.[^.]+$/, "");
      if (typeof ctx.saveBase64AsFile === "function") {
        return await ctx.saveBase64AsFile(data, `sprite-overlay/${characterName}`, baseName, ext);
      }
      return base64Data;
    }
    getCurrentCharacterName() {
      const ctx = getContext();
      const id = ctx.characterId;
      if (id !== void 0 && id !== null && `${id}` !== "") {
        const byId = ctx.characters[Number(id)]?.name;
        if (byId) return byId;
      }
      return ctx.name2 ?? "";
    }
    injectPrompt(prompt) {
      const ctx = getContext();
      ctx.setExtensionPrompt(MODULE_NAME, prompt, 1, 4);
    }
    onMessageReceived(handler) {
      const ctx = getContext();
      const eventName = ctx.eventTypes?.MESSAGE_RECEIVED ?? ctx.event_types?.MESSAGE_RECEIVED ?? "message_received";
      const wrapped = (...args) => {
        try {
          const messageId = args[0];
          const chat = getContext().chat;
          const message = typeof messageId === "number" ? chat[messageId] : chat[chat.length - 1];
          if (message && !message.is_user && typeof message.mes === "string") {
            handler(message.mes);
          }
        } catch (err) {
          console.error("[sprite-overlay] 处理消息事件失败", err);
        }
      };
      ctx.eventSource.on(eventName, wrapped);
      return () => ctx.eventSource.removeListener(eventName, wrapped);
    }
    /** 订阅角色切换事件 */
    onCharacterChanged(handler) {
      const ctx = getContext();
      const eventName = ctx.eventTypes?.CHAT_CHANGED ?? "chat_id_changed";
      ctx.eventSource.on(eventName, handler);
      return () => ctx.eventSource.removeListener(eventName, handler);
    }
  };

  // st-extension/src/overlay-dom.ts
  function createOverlay(initialLayout, onLayoutChange, onManage) {
    let layout = { ...initialLayout };
    const root = document.createElement("div");
    root.id = "sprite-overlay-root";
    root.style.display = "none";
    const frame = document.createElement("div");
    frame.className = "sprite-overlay-frame";
    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    const tagBadge = document.createElement("div");
    tagBadge.className = "sprite-overlay-tag";
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "sprite-overlay-resize";
    const placeholder = document.createElement("div");
    placeholder.className = "sprite-overlay-placeholder";
    placeholder.style.display = "none";
    const gearBtn = document.createElement("div");
    gearBtn.className = "sprite-overlay-gear";
    gearBtn.title = "立绘包管理";
    gearBtn.textContent = "⚙";
    gearBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    gearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onManage?.();
    });
    frame.append(img, placeholder, tagBadge, gearBtn, resizeHandle);
    root.append(frame);
    document.body.append(root);
    function applyLayout() {
      root.style.left = `${layout.x}px`;
      root.style.top = `${layout.y}px`;
      root.style.width = `${layout.width}px`;
    }
    applyLayout();
    function startDrag(mode, startEvent) {
      startEvent.preventDefault();
      const startX = startEvent.clientX;
      const startY = startEvent.clientY;
      const origin = { ...layout };
      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (mode === "move") {
          layout = { ...origin, x: Math.max(0, origin.x + dx), y: Math.max(0, origin.y + dy) };
        } else {
          layout = { ...origin, width: Math.min(600, Math.max(100, origin.width + dx)) };
        }
        applyLayout();
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        onLayoutChange(layout);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }
    frame.addEventListener("pointerdown", (e) => {
      if (e.target === resizeHandle) return;
      startDrag("move", e);
    });
    resizeHandle.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      startDrag("resize", e);
    });
    let fadeTimer = null;
    return {
      setImage(url, tag) {
        placeholder.style.display = "none";
        img.style.display = "block";
        tagBadge.style.display = "";
        if (img.src === url) return;
        img.style.opacity = "0";
        if (fadeTimer) clearTimeout(fadeTimer);
        fadeTimer = setTimeout(() => {
          img.src = url;
          tagBadge.textContent = tag;
          img.onload = () => {
            img.style.opacity = "1";
          };
          if (img.complete) img.style.opacity = "1";
        }, 180);
      },
      setPlaceholder(text) {
        img.style.display = "none";
        tagBadge.style.display = "none";
        placeholder.textContent = text;
        placeholder.style.display = "flex";
      },
      setVisible(visible) {
        root.style.display = visible ? "block" : "none";
      },
      setLayout(next) {
        layout = { ...next };
        applyLayout();
      },
      destroy() {
        root.remove();
      }
    };
  }

  // core/pack-io.ts
  async function exportPack(pack, embedBase64 = false) {
    const sprites = [];
    for (const sprite of pack.sprites) {
      if (sprite.url.startsWith("data:")) {
        sprites.push({ tag: sprite.tag, data: sprite.url });
      } else if (embedBase64) {
        try {
          const data = await urlToDataUri(sprite.url);
          sprites.push({ tag: sprite.tag, data });
        } catch {
          sprites.push({ tag: sprite.tag, url: sprite.url });
        }
      } else {
        sprites.push({ tag: sprite.tag, url: sprite.url });
      }
    }
    return {
      format: "sprite-pack@1",
      name: pack.name,
      author: pack.author,
      description: pack.description,
      sprites
    };
  }
  function importPack(jsonText) {
    let raw;
    try {
      raw = JSON.parse(jsonText);
    } catch {
      throw new Error("导入失败：不是合法的 JSON 文件");
    }
    const file = raw;
    if (file.format !== "sprite-pack@1") {
      throw new Error("导入失败：不是 sprite-pack@1 格式的立绘包");
    }
    if (!file.name || !Array.isArray(file.sprites) || file.sprites.length === 0) {
      throw new Error("导入失败：立绘包缺少名称或立绘列表为空");
    }
    const sprites = file.sprites.filter((s) => s && typeof s.tag === "string" && (s.url || s.data)).map((s) => ({ tag: s.tag.trim(), url: s.data ?? s.url }));
    if (sprites.length === 0) {
      throw new Error("导入失败：没有可用的立绘条目");
    }
    return {
      id: genId(),
      name: file.name,
      author: file.author,
      description: file.description,
      sprites
    };
  }
  async function urlToDataUri(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  // st-extension/src/sprite-manager.ts
  function createSpriteManager(deps) {
    let backdrop = null;
    function open() {
      if (backdrop) {
        renderBody();
        return;
      }
      backdrop = document.createElement("div");
      backdrop.className = "so-manager-backdrop";
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) close();
      });
      const dialog = document.createElement("div");
      dialog.className = "so-manager";
      dialog.innerHTML = `
      <div class="so-manager-header">
        <b>立绘包管理</b>
        <div class="menu_button so-manager-close" title="关闭">✕</div>
      </div>
      <div class="so-manager-body"></div>
    `;
      dialog.querySelector(".so-manager-close")?.addEventListener("click", () => close());
      backdrop.append(dialog);
      document.body.append(backdrop);
      renderBody();
    }
    function close() {
      backdrop?.remove();
      backdrop = null;
    }
    function refreshIfOpen() {
      if (backdrop) renderBody();
    }
    function renderBody() {
      const body = backdrop?.querySelector(".so-manager-body");
      if (!body) return;
      const settings = deps.getSettings();
      const characterName = deps.adapter.getCurrentCharacterName();
      const binding = settings.bindings.find((b) => b.characterName === characterName);
      body.innerHTML = "";
      const bindRow = document.createElement("div");
      bindRow.className = "so-row";
      const bindLabel = document.createElement("span");
      bindLabel.textContent = characterName ? `角色「${characterName}」绑定：` : "请先打开一个角色聊天再绑定立绘包";
      bindRow.append(bindLabel);
      if (characterName) {
        const select = document.createElement("select");
        select.className = "text_pole";
        select.innerHTML = '<option value="">选择立绘包…</option>' + settings.packs.map(
          (p) => `<option value="${p.id}" ${binding?.packId === p.id ? "selected" : ""}>${p.name}（${p.sprites.length} 张）</option>`
        ).join("");
        select.addEventListener("change", () => {
          if (!select.value) return;
          commit(bindCharacter(deps.getSettings(), characterName, select.value));
        });
        bindRow.append(select);
        if (binding) {
          bindRow.append(
            checkboxRow(
              "启用",
              binding.enabled,
              (v) => commit(toggleBinding(deps.getSettings(), characterName, v))
            )
          );
        }
      }
      body.append(bindRow);
      const list = document.createElement("div");
      list.className = "so-pack-list";
      for (const pack of settings.packs) {
        list.append(renderPackItem(pack, characterName));
      }
      body.append(list);
      const actions = document.createElement("div");
      actions.className = "so-row";
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "text_pole";
      nameInput.placeholder = "新立绘包名称…";
      const createBtn = button("新建立绘包", () => {
        const name = nameInput.value.trim();
        if (!name) return;
        commit(upsertPack(deps.getSettings(), { id: genId(), name, author: "我", sprites: [] }));
        nameInput.value = "";
      });
      const importBtn = button("导入立绘包", () => {
        pickFile(".json,application/json", false, async (files) => {
          try {
            const text = await files[0].text();
            const pack = importPack(text);
            commit(upsertPack(deps.getSettings(), pack));
            toast(`已导入「${pack.name}」（${pack.sprites.length} 张）`);
          } catch (err) {
            toast(err instanceof Error ? err.message : "导入失败");
          }
        });
      });
      actions.append(nameInput, createBtn, importBtn);
      body.append(actions);
      const status = document.createElement("div");
      status.className = "so-status";
      body.append(status);
      function toast(msg) {
        status.textContent = msg;
        setTimeout(() => {
          if (status.textContent === msg) status.textContent = "";
        }, 3e3);
      }
      function commit(next) {
        deps.updateSettings(next);
        renderBody();
      }
      function renderPackItem(pack, charName) {
        const item = document.createElement("div");
        item.className = "so-pack-item";
        const info = document.createElement("div");
        info.className = "so-pack-info";
        info.innerHTML = `<b>${pack.name}</b> <small>${pack.sprites.length} 张 · ${pack.author ?? ""}</small>`;
        const btns = document.createElement("div");
        btns.className = "so-btn-row";
        btns.append(
          button("上传图片", () => {
            pickFile("image/*", true, async (files) => {
              const current = deps.getSettings();
              const target = current.packs.find((p) => p.id === pack.id);
              if (!target) return;
              const sprites = [...target.sprites];
              for (const file of Array.from(files)) {
                const tag = file.name.replace(/\.[^.]+$/, "").trim();
                if (!tag) continue;
                const dataUri = await fileToDataUri(file);
                const url = await deps.adapter.saveImage(file.name, dataUri, charName || pack.name);
                const idx = sprites.findIndex((s) => s.tag === tag);
                if (idx >= 0) sprites[idx] = { tag, url };
                else sprites.push({ tag, url });
              }
              commit(upsertPack(current, { ...target, sprites }));
            });
          }),
          button("导出", async () => {
            const file = await exportPack(pack, false);
            const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${pack.name}.sprite-pack.json`;
            a.click();
            URL.revokeObjectURL(url);
          }),
          button("删除", () => {
            if (!window.confirm(`确定删除立绘包「${pack.name}」？`)) return;
            commit(removePack(deps.getSettings(), pack.id));
          })
        );
        const top = document.createElement("div");
        top.className = "so-pack-top";
        top.append(info, btns);
        item.append(top);
        if (pack.sprites.length > 0) {
          const thumbs = document.createElement("div");
          thumbs.className = "so-thumbs";
          for (const s of pack.sprites) {
            const img = document.createElement("img");
            img.src = s.url;
            img.alt = s.tag;
            img.title = s.tag;
            img.loading = "lazy";
            thumbs.append(img);
          }
          item.append(thumbs);
        }
        return item;
      }
    }
    return { open, close, refreshIfOpen };
  }
  function checkboxRow(label, checked, onChange) {
    const row = document.createElement("label");
    row.className = "so-row checkbox_label";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));
    const span = document.createElement("span");
    span.textContent = label;
    row.append(input, span);
    return row;
  }
  function button(label, onClick) {
    const btn = document.createElement("div");
    btn.className = "menu_button so-btn";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }
  function pickFile(accept, multiple, onPick) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener("change", () => {
      if (input.files && input.files.length > 0) onPick(input.files);
    });
    input.click();
  }
  function fileToDataUri(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // st-extension/src/settings-panel.ts
  function mountSettingsPanel(deps) {
    const container = document.getElementById("extensions_settings");
    if (!container) {
      console.warn("[sprite-overlay] 未找到 #extensions_settings，设置面板未挂载");
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "sprite-overlay-settings";
    wrapper.innerHTML = `
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>角色立绘悬浮窗</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
      </div>
      <div class="inline-drawer-content" id="so-panel-content"></div>
    </div>
  `;
    container.append(wrapper);
    const content = wrapper.querySelector("#so-panel-content");
    const settings = deps.getSettings();
    content.append(
      checkboxRow2(
        "启用立绘悬浮窗",
        settings.enabled,
        (v) => deps.updateSettings({ ...deps.getSettings(), enabled: v })
      ),
      checkboxRow2(
        "消息中隐藏 [立绘:xxx] 标签",
        settings.hideTagInMessage,
        (v) => deps.updateSettings({ ...deps.getSettings(), hideTagInMessage: v })
      )
    );
    const hint = document.createElement("div");
    hint.className = "so-status";
    hint.textContent = "立绘包管理与角色绑定：点击聊天界面悬浮窗右上角的 ⚙ 按钮。";
    content.append(hint);
  }
  function checkboxRow2(label, checked, onChange) {
    const row = document.createElement("label");
    row.className = "so-row checkbox_label";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));
    const span = document.createElement("span");
    span.textContent = label;
    row.append(input, span);
    return row;
  }

  // st-extension/src/index.ts
  async function init() {
    const adapter = new STAdapter();
    let settings;
    try {
      settings = await adapter.loadSettings();
    } catch (err) {
      console.error("[sprite-overlay] 初始化失败", err);
      return;
    }
    function updateSettings(next) {
      settings = next;
      adapter.saveSettings(settings);
      overlay.setLayout(settings.overlay);
      refresh();
    }
    const manager = createSpriteManager({
      adapter,
      getSettings: () => settings,
      updateSettings
    });
    const overlay = createOverlay(
      settings.overlay,
      (layout) => {
        settings = { ...settings, overlay: layout };
        adapter.saveSettings(settings);
      },
      () => manager.open()
    );
    function refresh() {
      if (!settings.enabled) {
        adapter.injectPrompt("");
        overlay.setVisible(false);
        return;
      }
      const characterName = adapter.getCurrentCharacterName();
      const tags = getAvailableTags(settings, characterName);
      adapter.injectPrompt(buildInjectionPrompt(tags));
      const pack = getActivePack(settings, characterName);
      if (pack && pack.sprites.length > 0) {
        preloadPack(pack);
        overlay.setImage(pack.sprites[0].url, pack.sprites[0].tag);
      } else if (characterName) {
        overlay.setPlaceholder("未绑定立绘包\n点击 ⚙ 进行绑定");
      } else {
        overlay.setPlaceholder("打开角色聊天后\n点击 ⚙ 绑定立绘包");
      }
      overlay.setVisible(true);
    }
    adapter.onMessageReceived((text) => {
      if (!settings.enabled) return;
      const characterName = adapter.getCurrentCharacterName();
      const pack = getActivePack(settings, characterName);
      if (!pack) return;
      const tag = extractLastTag(text);
      if (!tag) return;
      const sprite = matchSprite(pack, tag);
      if (sprite) {
        overlay.setImage(sprite.url, sprite.tag);
        overlay.setVisible(true);
      }
    });
    adapter.onCharacterChanged(() => {
      refresh();
      manager.refreshIfOpen();
    });
    mountSettingsPanel({
      getSettings: () => settings,
      updateSettings
    });
    refresh();
    console.log("[sprite-overlay] 角色立绘悬浮窗扩展已加载");
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
