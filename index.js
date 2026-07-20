"use strict";
(() => {
  // core/tag-parser.ts
  var TAG_REGEX = /[[【]\s*立绘\s*[:：]\s*([^\]】]+?)\s*[\]】]/g;
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
  function stripTags(text) {
    return text.replace(new RegExp(TAG_REGEX.source, "g"), "").replace(/[ \t]+$/gm, "");
  }
  function replaceTags(text, replacer) {
    return text.replace(new RegExp(TAG_REGEX.source, "g"), (raw, address) => {
      const trimmed = address.trim();
      if (!trimmed) return raw;
      const out = replacer(trimmed, raw);
      return out === null ? raw : out;
    });
  }
  function hasTag(text) {
    return new RegExp(TAG_REGEX.source).test(text);
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
  function buildMultiRolePrompt(entries, mode) {
    if (entries.length === 0) return "";
    const groups = [];
    const tags = [];
    for (const e of entries) {
      if (e.group && !groups.includes(e.group)) groups.push(e.group);
      if (!tags.includes(e.tag)) tags.push(e.tag);
    }
    if (groups.length === 0) return buildInjectionPrompt(tags);
    if (mode === "repeat") {
      return [
        "[角色立绘系统]",
        `可用角色/分组：${groups.join("、")}`,
        `每个角色的可用表情：${tags.join("、")}`,
        "请在每次回复的末尾，选择一个角色和一个表情，",
        `以 [立绘:角色/表情] 的格式单独标注（例如 [立绘:${groups[0]}/${tags[0]}]）。`,
        "角色与表情都只能取自上述清单，每次回复标注一个。"
      ].join("\n");
    }
    const addresses = entries.map((e) => e.group ? `${e.group}/${e.tag}` : e.tag);
    return [
      "[角色立绘系统]",
      `可用立绘（角色/表情）：${addresses.join("、")}`,
      "请在每次回复的末尾，从上述列表中选择一个最贴合当前情境的立绘，",
      `以 [立绘:名称] 的格式单独标注（例如 [立绘:${addresses[0]}]）。`,
      "只能使用列表中存在的名称，每次回复只标注一个。"
    ].join("\n");
  }

  // core/naming.ts
  var TAG_MAX_LENGTH = 20;
  var PACK_NAME_MAX_LENGTH = 30;
  var DESCRIPTION_MAX_LENGTH = 200;
  var CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]", "g");
  var TAG_FORBIDDEN = /[[\]【】|=,，:：@/\\<>"'`]/g;
  var PACK_NAME_FORBIDDEN = /[|=@<>"'`]/g;
  var PATH_SEGMENT_ALLOWED = /[^0-9A-Za-z一-鿿぀-ヿ .\-_]/g;
  function normalizeTag(raw) {
    return raw.replace(CONTROL_CHARS, "").replace(TAG_FORBIDDEN, "").replace(/\s+/g, " ").trim().slice(0, TAG_MAX_LENGTH).trim();
  }
  function fileNameToTag(fileName) {
    return normalizeTag(fileName.replace(/\.[^.]+$/, ""));
  }
  function parseUploadName(fileName, fallbackGroup = "") {
    const base = fileName.replace(/\.[^.]+$/, "");
    const sep = base.indexOf("_");
    if (sep > 0 && sep < base.length - 1) {
      const group = normalizeTag(base.slice(0, sep));
      const tag = normalizeTag(base.slice(sep + 1));
      if (group && tag) return { group, tag };
    }
    return { group: normalizeTag(fallbackGroup), tag: fileNameToTag(fileName) };
  }
  function sanitizePackName(raw) {
    return raw.replace(CONTROL_CHARS, "").replace(PACK_NAME_FORBIDDEN, "").replace(/\s+/g, " ").trim().slice(0, PACK_NAME_MAX_LENGTH).trim();
  }
  function sanitizeDescription(raw) {
    return raw.replace(CONTROL_CHARS, "").replace(/[<>]/g, "").trim().slice(0, DESCRIPTION_MAX_LENGTH).trim();
  }
  function sanitizePathSegment(raw) {
    return raw.replace(CONTROL_CHARS, "").replace(PATH_SEGMENT_ALLOWED, "").replace(/\.{2,}/g, ".").replace(/^[. ]+|[. ]+$/g, "").slice(0, 40).trim();
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
  function spriteGroup(sprite) {
    return sprite.group ?? "";
  }
  function getGroups(pack) {
    const seen = [];
    for (const s of pack.sprites) {
      const g = spriteGroup(s);
      if (g && !seen.includes(g)) seen.push(g);
    }
    return seen;
  }
  function matchInGroup(pack, group, tag) {
    const g = group.trim();
    const pool = pack.sprites.filter((s) => {
      const sg = spriteGroup(s);
      if (!g) return sg === "";
      if (!sg) return false;
      return sg === g || sg.includes(g) || g.includes(sg);
    });
    const exact = pool.find((s) => s.tag === tag);
    if (exact) return exact;
    return pool.find((s) => s.tag.includes(tag) || tag.includes(s.tag)) ?? null;
  }
  function matchAddress(pack, address) {
    const raw = address.trim();
    if (!raw) return null;
    const slash = raw.indexOf("/");
    if (slash >= 0) {
      const group = raw.slice(0, slash).trim();
      const tag = raw.slice(slash + 1).trim();
      const inGroup = matchInGroup(pack, group, tag);
      if (inGroup) return inGroup;
      return matchSprite(pack, tag) ?? matchSprite(pack, raw);
    }
    return matchSprite(pack, raw);
  }
  function matchSprites(pack, addresses) {
    const out = [];
    for (const address of addresses) {
      const sprite = matchAddress(pack, address);
      if (sprite && out[out.length - 1] !== sprite) {
        out.push(sprite);
      }
    }
    return out;
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
  function touchPack(pack, sprites) {
    return { ...pack, sprites, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  }
  function upsertSprite(pack, sprite) {
    const g = spriteGroup(sprite);
    const idx = pack.sprites.findIndex((s) => s.tag === sprite.tag && spriteGroup(s) === g);
    const sprites = idx >= 0 ? pack.sprites.map((s, i) => i === idx ? sprite : s) : [...pack.sprites, sprite];
    return touchPack(pack, sprites);
  }
  function removeSprite(pack, tag, group = "") {
    const next = touchPack(
      pack,
      pack.sprites.filter((s) => !(s.tag === tag && spriteGroup(s) === group))
    );
    if (next.coverTag === tag && !next.sprites.some((s) => s.tag === tag)) delete next.coverTag;
    return next;
  }
  function renameSprite(pack, oldTag, newTagRaw, group = "") {
    const newTag = normalizeTag(newTagRaw);
    if (!newTag) throw new Error("表情名不能为空，且不能包含 [ ] / : | = @ 等符号");
    if (newTag === oldTag) return pack;
    if (pack.sprites.some((s) => s.tag === newTag && spriteGroup(s) === group)) {
      throw new Error(`表情名「${newTag}」在该分组中已存在`);
    }
    const sprites = pack.sprites.map(
      (s) => s.tag === oldTag && spriteGroup(s) === group ? { ...s, tag: newTag } : s
    );
    const next = touchPack(pack, sprites);
    if (next.coverTag === oldTag) next.coverTag = newTag;
    return next;
  }
  function setSpriteGroup(pack, tag, fromGroup, toGroupRaw) {
    const toGroup = normalizeTag(toGroupRaw);
    if (toGroup === fromGroup) return pack;
    if (pack.sprites.some((s) => s.tag === tag && spriteGroup(s) === toGroup)) {
      throw new Error(`分组「${toGroup || "未分组"}」中已存在表情「${tag}」`);
    }
    const sprites = pack.sprites.map((s) => {
      if (!(s.tag === tag && spriteGroup(s) === fromGroup)) return s;
      const next = { ...s };
      if (toGroup) next.group = toGroup;
      else delete next.group;
      return next;
    });
    return touchPack(pack, sprites);
  }
  function moveSprite(pack, fromIndex, toIndex) {
    const len = pack.sprites.length;
    if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= len || toIndex < 0 || toIndex >= len) {
      return pack;
    }
    const sprites = [...pack.sprites];
    const [moved] = sprites.splice(fromIndex, 1);
    sprites.splice(toIndex, 0, moved);
    return touchPack(pack, sprites);
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

  // core/phone-registry.ts
  var APP_ID_REGEX = /^[a-z][a-z0-9-]{1,31}$/;
  var PhoneAppRegistry = class {
    constructor() {
      this.apps = /* @__PURE__ */ new Map();
      this.listeners = /* @__PURE__ */ new Set();
    }
    /** 注册 App；id 非法或重复时抛错（第三方 App 装载失败不应拖垮框架，调用方自行 catch） */
    register(app) {
      if (!APP_ID_REGEX.test(app.id)) {
        throw new Error(`App id「${app.id}」非法：需匹配 ${APP_ID_REGEX}`);
      }
      if (this.apps.has(app.id)) {
        throw new Error(`App id「${app.id}」已被注册`);
      }
      this.apps.set(app.id, app);
      this.notify();
    }
    unregister(id) {
      if (this.apps.delete(id)) this.notify();
    }
    get(id) {
      return this.apps.get(id);
    }
    /** 按 order 升序返回全部 App */
    list() {
      return [...this.apps.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    }
    /** 订阅注册表变化（Home 屏据此重绘），返回退订函数 */
    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    notify() {
      for (const l of this.listeners) l();
    }
  };

  // core/phone-shell.ts
  var DRAG_THRESHOLD = 6;
  function createPhoneShell(initialState, deps) {
    let state = { ...initialState };
    let activeApp = null;
    let hidden = false;
    const fab = document.createElement("div");
    fab.className = "so-phone-fab";
    fab.title = "打开手机";
    fab.textContent = "📱";
    fab.setAttribute("role", "button");
    fab.setAttribute("aria-label", "打开手机面板");
    const shell = document.createElement("div");
    shell.className = "so-phone-shell";
    shell.style.display = "none";
    const statusBar2 = document.createElement("div");
    statusBar2.className = "so-phone-status";
    const backBtn = document.createElement("div");
    backBtn.className = "so-phone-back";
    backBtn.textContent = "‹";
    backBtn.title = "返回主屏";
    backBtn.setAttribute("role", "button");
    backBtn.setAttribute("aria-label", "返回主屏");
    backBtn.tabIndex = 0;
    backBtn.addEventListener("click", () => goHome());
    backBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        goHome();
      }
    });
    const statusTitle = document.createElement("span");
    statusTitle.className = "so-phone-status-title";
    statusTitle.textContent = "st-stage";
    const clock = document.createElement("span");
    clock.className = "so-phone-clock";
    statusBar2.append(backBtn, statusTitle, clock);
    const screen = document.createElement("div");
    screen.className = "so-phone-screen";
    const homeBar = document.createElement("div");
    homeBar.className = "so-phone-homebar";
    homeBar.title = "返回主屏 / 收起手机";
    homeBar.setAttribute("role", "button");
    homeBar.setAttribute("aria-label", "返回主屏或收起手机");
    homeBar.tabIndex = 0;
    const homeBtn = document.createElement("div");
    homeBtn.className = "so-phone-homebtn";
    homeBar.append(homeBtn);
    shell.append(statusBar2, screen, homeBar);
    document.body.append(fab, shell);
    const clockTimer = setInterval(updateClock, 3e4);
    updateClock();
    function updateClock() {
      clock.textContent = (/* @__PURE__ */ new Date()).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit"
      });
    }
    function applyLayout() {
      if (hidden) {
        fab.style.display = "none";
        shell.style.display = "none";
        return;
      }
      const clampedX = Math.max(0, Math.min(state.x, window.innerWidth - 56));
      const clampedY = Math.max(0, Math.min(state.y, window.innerHeight - 56));
      fab.style.left = `${clampedX}px`;
      fab.style.top = `${clampedY}px`;
      fab.style.display = state.open ? "none" : "flex";
      shell.style.display = state.open ? "flex" : "none";
      if (state.open) {
        const shellW = 320;
        const shellH = Math.min(580, window.innerHeight - 32);
        shell.style.height = `${shellH}px`;
        shell.style.left = `${Math.max(8, Math.min(clampedX, window.innerWidth - shellW - 8))}px`;
        shell.style.top = `${Math.max(8, Math.min(clampedY, window.innerHeight - shellH - 8))}px`;
      }
    }
    applyLayout();
    window.addEventListener("resize", applyLayout);
    function commitState(next) {
      state = next;
      applyLayout();
      deps.onStateChange(state);
    }
    fab.addEventListener("pointerdown", (startEvent) => {
      startEvent.preventDefault();
      const startX = startEvent.clientX;
      const startY = startEvent.clientY;
      const origin = { ...state };
      let moved = false;
      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        moved = true;
        state = { ...origin, x: origin.x + dx, y: origin.y + dy };
        applyLayout();
      };
      const onUp = () => {
        cleanup();
        if (moved) {
          commitState(state);
        } else {
          commitState({ ...state, open: true });
          renderScreen();
        }
      };
      const onCancel = () => {
        cleanup();
        if (moved) commitState(state);
      };
      function cleanup() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    });
    const onHomePress = () => {
      if (activeApp) {
        leaveApp();
        renderScreen();
      } else {
        commitState({ ...state, open: false });
      }
    };
    homeBar.addEventListener("click", onHomePress);
    homeBar.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onHomePress();
      }
    });
    const unsubscribe = deps.registry.subscribe(() => {
      if (state.open && !activeApp) renderScreen();
    });
    function leaveApp() {
      if (activeApp) {
        try {
          activeApp.unmount?.();
        } catch (err) {
          console.error(`[sprite-overlay] App「${activeApp.id}」unmount 失败`, err);
        }
        activeApp = null;
      }
    }
    function renderScreen() {
      screen.innerHTML = "";
      backBtn.style.display = activeApp ? "flex" : "none";
      if (activeApp) {
        statusTitle.textContent = activeApp.name;
        const container = document.createElement("div");
        container.className = "so-phone-app-container";
        screen.append(container);
        try {
          activeApp.mount(container, deps.createAppContext(activeApp.id, goHome));
        } catch (err) {
          console.error(`[sprite-overlay] App「${activeApp.id}」mount 失败`, err);
          const errBox = document.createElement("div");
          errBox.className = "so-phone-app-error";
          errBox.textContent = "App 打开失败，详见控制台";
          container.append(errBox);
        }
        return;
      }
      statusTitle.textContent = "st-stage";
      const grid = document.createElement("div");
      grid.className = "so-phone-home-grid";
      for (const app of deps.registry.list()) {
        grid.append(renderAppIcon(app));
      }
      screen.append(grid);
    }
    function renderAppIcon(app) {
      const cell = document.createElement("div");
      cell.className = "so-phone-app-icon";
      cell.setAttribute("role", "button");
      cell.tabIndex = 0;
      cell.setAttribute("aria-label", `打开 ${app.name}`);
      const icon = document.createElement("div");
      icon.className = "so-phone-app-glyph";
      icon.textContent = app.icon;
      const label = document.createElement("div");
      label.className = "so-phone-app-label";
      label.textContent = app.name;
      cell.append(icon, label);
      const openThis = () => {
        activeApp = app;
        renderScreen();
      };
      cell.addEventListener("click", openThis);
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openThis();
        }
      });
      return cell;
    }
    function goHome() {
      leaveApp();
      renderScreen();
    }
    return {
      setState(next) {
        state = { ...next };
        applyLayout();
        if (state.open) renderScreen();
      },
      openApp(appId) {
        const app = deps.registry.get(appId);
        if (!app) return;
        leaveApp();
        activeApp = app;
        if (!state.open) commitState({ ...state, open: true });
        renderScreen();
      },
      setVisible(visible) {
        hidden = !visible;
        applyLayout();
      },
      destroy() {
        clearInterval(clockTimer);
        window.removeEventListener("resize", applyLayout);
        unsubscribe();
        leaveApp();
        fab.remove();
        shell.remove();
      }
    };
  }

  // core/types.ts
  var SETTINGS_VERSION = 2;
  var DEFAULT_IMAGE_HOST = "https://files.catbox.moe/";
  function getSpriteSource(sprite) {
    if (sprite.url.startsWith("data:")) return "embedded";
    if (/^https?:\/\//.test(sprite.url)) return "hosted";
    return "local";
  }
  function getPackCover(pack) {
    if (pack.coverTag) {
      const cover = pack.sprites.find((s) => s.tag === pack.coverTag);
      if (cover) return cover;
    }
    return pack.sprites[0] ?? null;
  }
  function createDefaultSettings() {
    return {
      settingsVersion: SETTINGS_VERSION,
      enabled: true,
      hideTagInMessage: false,
      spriteDisplayMode: "overlay",
      renderInlineImages: false,
      imageHost: DEFAULT_IMAGE_HOST,
      overlay: { x: 24, y: 80, width: 220 },
      phone: { x: 24, y: 320, open: false },
      showPhone: true,
      autoSwitch: false,
      autoSwitchSeconds: 3,
      multiRole: false,
      multiRolePromptMode: "full",
      imgbbApiKey: "",
      autoUpload: false,
      packs: [],
      bindings: [],
      apps: {}
    };
  }

  // core/share-code.ts
  var SHARE_PREFIX = "stpack1:";
  var CODE_REGEX = /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/;
  function isValidImageCode(code) {
    return CODE_REGEX.test(code) && !code.includes("..");
  }
  function extractImageCode(url) {
    if (!/^https?:\/\//.test(url)) return null;
    const withoutQuery = url.split(/[?#]/)[0];
    const seg = withoutQuery.split("/").pop() ?? "";
    return isValidImageCode(seg) ? seg : null;
  }
  function encodeShareString(pack) {
    const entries = [];
    const skipped = [];
    let host = null;
    for (const sprite of pack.sprites) {
      const code = sprite.code ?? extractImageCode(sprite.url);
      if (!code || !sprite.url.startsWith("http") || !sprite.url.endsWith(code)) {
        skipped.push(sprite.tag);
        continue;
      }
      const prefix = sprite.url.slice(0, sprite.url.length - code.length);
      if (host === null) host = prefix;
      if (prefix !== host) {
        skipped.push(sprite.tag);
        continue;
      }
      entries.push({ tag: sprite.tag, code });
    }
    if (entries.length === 0 || host === null) return null;
    const segments = [sanitizePackName(pack.name) || "分享立绘包"];
    if (host !== DEFAULT_IMAGE_HOST) segments.push(`@host=${host}`);
    if (pack.author) segments.push(`@author=${sanitizePackName(pack.author)}`);
    for (const e of entries) segments.push(`${e.tag}=${e.code}`);
    return { text: SHARE_PREFIX + segments.join("|"), included: entries.length, skipped };
  }
  function decodeShareString(raw) {
    const text = raw.trim();
    const prefixIndex = text.indexOf(SHARE_PREFIX);
    if (prefixIndex === -1) {
      throw new Error(`导入失败：没有找到 ${SHARE_PREFIX} 开头的分享串`);
    }
    const body = text.slice(prefixIndex + SHARE_PREFIX.length).trim();
    const segments = body.split("|");
    const name = sanitizePackName(segments[0] ?? "") || "分享立绘包";
    let host = DEFAULT_IMAGE_HOST;
    let author;
    const sprites = [];
    const seenTags = /* @__PURE__ */ new Set();
    for (const segment of segments.slice(1)) {
      const part = segment.trim();
      if (!part) continue;
      if (part.startsWith("@")) {
        const eq2 = part.indexOf("=");
        if (eq2 === -1) continue;
        const key = part.slice(1, eq2).trim().toLowerCase();
        const value = part.slice(eq2 + 1).trim();
        if (key === "host" && /^https?:\/\/.+/.test(value)) {
          host = value.endsWith("/") ? value : `${value}/`;
        } else if (key === "author") {
          author = sanitizePackName(value) || void 0;
        }
        continue;
      }
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const tag = normalizeTag(part.slice(0, eq));
      const code = part.slice(eq + 1).trim();
      if (!tag || !isValidImageCode(code) || seenTags.has(tag)) continue;
      seenTags.add(tag);
      sprites.push({ tag, url: host + code, code });
    }
    if (sprites.length === 0) {
      throw new Error("导入失败：分享串中没有可用的「表情=编码」条目");
    }
    const finalSprites = sprites.map((s) => ({ ...s, url: host + s.code }));
    return { id: genId(), name, author, sprites: finalSprites, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  }

  // core/migrate.ts
  function migrateSettings(saved) {
    const defaults = createDefaultSettings();
    if (!saved || typeof saved !== "object") return defaults;
    const raw = saved;
    return {
      settingsVersion: SETTINGS_VERSION,
      enabled: typeof raw.enabled === "boolean" ? raw.enabled : defaults.enabled,
      hideTagInMessage: typeof raw.hideTagInMessage === "boolean" ? raw.hideTagInMessage : defaults.hideTagInMessage,
      spriteDisplayMode: raw.spriteDisplayMode === "overlay" || raw.spriteDisplayMode === "inline" || raw.spriteDisplayMode === "both" ? raw.spriteDisplayMode : defaults.spriteDisplayMode,
      renderInlineImages: typeof raw.renderInlineImages === "boolean" ? raw.renderInlineImages : defaults.renderInlineImages,
      imageHost: typeof raw.imageHost === "string" && /^https?:\/\//.test(raw.imageHost) ? raw.imageHost : defaults.imageHost,
      overlay: migrateOverlay(raw.overlay, defaults.overlay),
      phone: migratePhone(raw.phone, defaults.phone),
      showPhone: typeof raw.showPhone === "boolean" ? raw.showPhone : defaults.showPhone,
      autoSwitch: typeof raw.autoSwitch === "boolean" ? raw.autoSwitch : defaults.autoSwitch,
      autoSwitchSeconds: typeof raw.autoSwitchSeconds === "number" && Number.isFinite(raw.autoSwitchSeconds) ? Math.min(60, Math.max(1, Math.round(raw.autoSwitchSeconds))) : defaults.autoSwitchSeconds,
      multiRole: typeof raw.multiRole === "boolean" ? raw.multiRole : defaults.multiRole,
      multiRolePromptMode: raw.multiRolePromptMode === "full" || raw.multiRolePromptMode === "repeat" ? raw.multiRolePromptMode : defaults.multiRolePromptMode,
      imgbbApiKey: typeof raw.imgbbApiKey === "string" ? raw.imgbbApiKey : defaults.imgbbApiKey,
      autoUpload: typeof raw.autoUpload === "boolean" ? raw.autoUpload : defaults.autoUpload,
      packs: Array.isArray(raw.packs) ? raw.packs.flatMap((p) => migratePack(p) ?? []) : [],
      bindings: Array.isArray(raw.bindings) ? raw.bindings.filter(
        (b) => b && typeof b.characterName === "string" && typeof b.packId === "string" && typeof b.enabled === "boolean"
      ) : [],
      apps: raw.apps && typeof raw.apps === "object" && !Array.isArray(raw.apps) ? raw.apps : {}
    };
  }
  function migrateOverlay(raw, fallback) {
    if (raw && typeof raw.x === "number" && typeof raw.y === "number" && typeof raw.width === "number" && Number.isFinite(raw.x + raw.y + raw.width)) {
      return { x: raw.x, y: raw.y, width: raw.width };
    }
    return fallback;
  }
  function migratePhone(raw, fallback) {
    if (raw && typeof raw.x === "number" && typeof raw.y === "number" && Number.isFinite(raw.x + raw.y)) {
      return { x: raw.x, y: raw.y, open: typeof raw.open === "boolean" ? raw.open : fallback.open };
    }
    return fallback;
  }
  function migratePack(raw) {
    if (!raw || typeof raw !== "object") return null;
    const p = raw;
    if (typeof p.id !== "string" || !p.id || !Array.isArray(p.sprites)) return null;
    const name = sanitizePackName(typeof p.name === "string" ? p.name : "") || "未命名立绘包";
    const sprites = p.sprites.flatMap((s) => {
      if (!s || typeof s.tag !== "string" || typeof s.url !== "string" || !s.url) return [];
      const tag = normalizeTag(s.tag) || s.tag.trim();
      if (!tag) return [];
      const code = typeof s.code === "string" && s.code ? s.code : extractImageCode(s.url) ?? void 0;
      const group = typeof s.group === "string" ? normalizeTag(s.group) : "";
      return [{ tag, url: s.url, ...code ? { code } : {}, ...group ? { group } : {} }];
    });
    return {
      id: p.id,
      name,
      ...typeof p.author === "string" && p.author ? { author: p.author } : {},
      ...typeof p.description === "string" && p.description ? { description: p.description } : {},
      ...typeof p.coverTag === "string" && p.coverTag ? { coverTag: p.coverTag } : {},
      ...typeof p.updatedAt === "string" && p.updatedAt ? { updatedAt: p.updatedAt } : {},
      sprites
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
        const merged = migrateSettings(saved);
        const customPacks = merged.packs.filter((p) => !isPresetPack(p.id));
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
      const baseName = sanitizePathSegment(fileName.replace(/\.[^.]+$/, "")) || `sprite_${Date.now()}`;
      const folder = sanitizePathSegment(characterName) || "shared";
      if (typeof ctx.saveBase64AsFile === "function") {
        return await ctx.saveBase64AsFile(data, `sprite-overlay/${folder}`, baseName, ext);
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
  var DRAG_THRESHOLD2 = 6;
  function createOverlay(initialLayout, onLayoutChange, onManage) {
    let layout = { ...initialLayout };
    let sprites = [];
    let index = 0;
    let autoEnabled = false;
    let autoSeconds = 3;
    let autoTimer = null;
    let fadeTimer = null;
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
    const dots = document.createElement("div");
    dots.className = "sprite-overlay-dots";
    dots.style.display = "none";
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
    frame.append(img, placeholder, tagBadge, dots, gearBtn, resizeHandle);
    root.append(frame);
    document.body.append(root);
    function applyLayout() {
      root.style.left = `${Math.max(0, Math.min(layout.x, window.innerWidth - 48))}px`;
      root.style.top = `${Math.max(0, Math.min(layout.y, window.innerHeight - 48))}px`;
      root.style.width = `${Math.min(layout.width, Math.max(100, window.innerWidth - 16))}px`;
    }
    applyLayout();
    window.addEventListener("resize", applyLayout);
    function showImage(url, tag) {
      placeholder.style.display = "none";
      img.style.display = "block";
      tagBadge.style.display = "";
      if (img.src === url) {
        tagBadge.textContent = tag;
        return;
      }
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
    }
    function renderDots() {
      dots.replaceChildren();
      if (sprites.length <= 1) {
        dots.style.display = "none";
        return;
      }
      sprites.forEach((_, i) => {
        const dot = document.createElement("span");
        if (i === index) dot.className = "active";
        dots.append(dot);
      });
      dots.style.display = "flex";
    }
    function renderCurrent() {
      const cur = sprites[index];
      if (!cur) return;
      showImage(cur.url, cur.tag);
      Array.from(dots.children).forEach(
        (el3, i) => el3.classList.toggle("active", i === index)
      );
    }
    function stopAuto() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    }
    function startAuto() {
      stopAuto();
      if (autoEnabled && sprites.length > 1) {
        autoTimer = setInterval(() => {
          index = (index + 1) % sprites.length;
          renderCurrent();
        }, Math.max(1, autoSeconds) * 1e3);
      }
    }
    function advanceManually() {
      if (sprites.length <= 1) return;
      index = (index + 1) % sprites.length;
      renderCurrent();
      startAuto();
    }
    function applySprites(list) {
      if (list.length === 0) return;
      sprites = list;
      index = 0;
      renderDots();
      renderCurrent();
      startAuto();
    }
    function startDrag(mode, startEvent) {
      startEvent.preventDefault();
      const startX = startEvent.clientX;
      const startY = startEvent.clientY;
      const origin = { ...layout };
      let moved = false;
      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD2) return;
        moved = true;
        if (mode === "move") {
          layout = { ...origin, x: Math.max(0, origin.x + dx), y: Math.max(0, origin.y + dy) };
        } else {
          layout = {
            ...origin,
            width: Math.min(600, window.innerWidth - 16, Math.max(100, origin.width + dx))
          };
        }
        applyLayout();
      };
      const onUp = () => {
        cleanup();
        if (moved) {
          onLayoutChange(layout);
        } else if (mode === "move") {
          advanceManually();
        }
      };
      const onCancel = () => {
        cleanup();
        if (moved) onLayoutChange(layout);
      };
      function cleanup() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    }
    frame.addEventListener("pointerdown", (e) => {
      if (e.target === resizeHandle) return;
      startDrag("move", e);
    });
    resizeHandle.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      startDrag("resize", e);
    });
    return {
      setImage(url, tag) {
        applySprites([{ url, tag }]);
      },
      setSprites(list) {
        applySprites(list);
      },
      setAutoSwitch(enabled, seconds) {
        autoEnabled = enabled;
        autoSeconds = Math.max(1, seconds);
        startAuto();
      },
      setPlaceholder(text) {
        stopAuto();
        sprites = [];
        index = 0;
        dots.replaceChildren();
        dots.style.display = "none";
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
        stopAuto();
        if (fadeTimer) clearTimeout(fadeTimer);
        window.removeEventListener("resize", applyLayout);
        root.remove();
      }
    };
  }

  // core/pack-io.ts
  async function exportPack(pack, embedHosted = false) {
    const sprites = [];
    for (const sprite of pack.sprites) {
      const source = getSpriteSource(sprite);
      const group = sprite.group ? { group: sprite.group } : {};
      if (source === "embedded") {
        sprites.push({ tag: sprite.tag, data: sprite.url, ...group });
      } else if (source === "local" || embedHosted) {
        try {
          const data = await urlToDataUri(sprite.url);
          sprites.push({ tag: sprite.tag, data, ...group });
        } catch {
          sprites.push({ tag: sprite.tag, url: sprite.url, ...codeField(sprite.url, sprite.code), ...group });
        }
      } else {
        sprites.push({ tag: sprite.tag, url: sprite.url, ...codeField(sprite.url, sprite.code), ...group });
      }
    }
    return {
      format: "sprite-pack@2",
      name: pack.name,
      author: pack.author,
      description: pack.description,
      coverTag: pack.coverTag,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      sprites
    };
  }
  function codeField(url, code) {
    const resolved = code ?? extractImageCode(url);
    return resolved ? { code: resolved } : {};
  }
  function importPack(jsonText) {
    let raw;
    try {
      raw = JSON.parse(jsonText);
    } catch {
      throw new Error("导入失败：不是合法的 JSON 文件");
    }
    const file = raw;
    if (file.format !== "sprite-pack@2" && file.format !== "sprite-pack@1") {
      throw new Error("导入失败：不是 sprite-pack@1 / @2 格式的立绘包");
    }
    if (typeof file.name !== "string" || !file.name || !Array.isArray(file.sprites) || file.sprites.length === 0) {
      throw new Error("导入失败：立绘包缺少名称或立绘列表为空");
    }
    const seen = /* @__PURE__ */ new Set();
    const sprites = [];
    for (const item of file.sprites) {
      if (!item || typeof item.tag !== "string") continue;
      const url = typeof item.data === "string" && item.data ? item.data : typeof item.url === "string" ? item.url : "";
      if (!url) continue;
      const tag = normalizeTag(item.tag);
      if (!tag) continue;
      const group = typeof item.group === "string" ? normalizeTag(item.group) : "";
      const key = group ? `${group}/${tag}` : tag;
      if (seen.has(key)) continue;
      seen.add(key);
      const code = typeof item.code === "string" && item.code ? item.code : extractImageCode(url) ?? void 0;
      sprites.push({ tag, url, ...code ? { code } : {}, ...group ? { group } : {} });
    }
    if (sprites.length === 0) {
      throw new Error("导入失败：没有可用的立绘条目（表情名可能全部为空或重复）");
    }
    const normalizedCover = typeof file.coverTag === "string" ? normalizeTag(file.coverTag) : "";
    const coverTag = sprites.some((s) => s.tag === normalizedCover) ? normalizedCover : void 0;
    return {
      id: genId(),
      name: sanitizePackName(file.name) || "导入立绘包",
      author: typeof file.author === "string" ? sanitizePackName(file.author) || void 0 : void 0,
      description: typeof file.description === "string" ? sanitizeDescription(file.description) || void 0 : void 0,
      coverTag,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
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

  // core/image-compress.ts
  function blobToDataUri(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
  function estimateDataUriBytes(dataUri) {
    const comma = dataUri.indexOf(",");
    const payload = comma >= 0 ? dataUri.length - comma - 1 : dataUri.length;
    return Math.round(payload * 0.75);
  }
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  async function compressImage(file, options = {}) {
    const { maxDimension = 1024, quality = 0.85 } = options;
    const originalUri = await blobToDataUri(file);
    const original = {
      dataUri: originalUri,
      compressed: false,
      bytes: estimateDataUriBytes(originalUri)
    };
    if (file.type === "image/gif" || file.type === "image/svg+xml") return original;
    if (typeof document === "undefined") return original;
    try {
      const img = await loadImage(originalUri);
      const longest = Math.max(img.naturalWidth, img.naturalHeight);
      if (longest === 0) return original;
      const scale = Math.min(1, maxDimension / longest);
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return original;
      ctx.drawImage(img, 0, 0, width, height);
      const compressedUri = canvas.toDataURL("image/webp", quality);
      if (!compressedUri.startsWith("data:image/webp") || compressedUri.length >= originalUri.length) {
        return original;
      }
      return {
        dataUri: compressedUri,
        compressed: true,
        bytes: estimateDataUriBytes(compressedUri)
      };
    } catch {
      return original;
    }
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("图片解码失败"));
      img.src = src;
    });
  }

  // core/imgbb.ts
  async function uploadToImgbb(apiKey, base64DataUri, fetchImpl = fetch) {
    const key = apiKey.trim();
    if (!key) throw new Error("未配置 imgbb API Key");
    const rawBase64 = base64DataUri.replace(/^data:[^;]*;base64,/, "");
    const form = new FormData();
    form.append("key", key);
    form.append("image", rawBase64);
    const res = await fetchImpl("https://api.imgbb.com/1/upload", { method: "POST", body: form });
    const json = await res.json().catch(() => null);
    if (!json?.success || !json.data?.image) {
      throw new Error(`imgbb 上传失败：${json?.error?.message ?? `HTTP ${res.status}`}`);
    }
    return { url: json.data.url ?? "", code: json.data.image.filename ?? "" };
  }

  // st-extension/src/sprite-manager.ts
  function createSpriteManager(deps) {
    let backdrop = null;
    let view = { kind: "list" };
    function applyBackdropSize() {
      if (!backdrop) return;
      backdrop.style.left = "0";
      backdrop.style.top = "0";
      backdrop.style.width = `${window.innerWidth}px`;
      backdrop.style.height = `${window.innerHeight}px`;
    }
    function open() {
      if (backdrop) {
        render();
        return;
      }
      view = { kind: "list" };
      backdrop = el("div", "so-manager-backdrop");
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) close();
      });
      document.addEventListener("keydown", onEscape);
      window.addEventListener("resize", applyBackdropSize);
      applyBackdropSize();
      const dialog = el("div", "so-manager");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-label", "立绘包管理");
      const header = el("div", "so-manager-header");
      const backBtn = el("div", "menu_button so-manager-back");
      backBtn.title = "返回列表";
      backBtn.textContent = "‹";
      backBtn.setAttribute("role", "button");
      backBtn.tabIndex = 0;
      const goBack = () => {
        view = { kind: "list" };
        render();
      };
      backBtn.addEventListener("click", goBack);
      backBtn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goBack();
        }
      });
      const title = el("b", "so-manager-title");
      const closeBtn = el("div", "menu_button so-manager-close");
      closeBtn.title = "关闭";
      closeBtn.textContent = "✕";
      closeBtn.addEventListener("click", () => close());
      header.append(backBtn, title, closeBtn);
      const body = el("div", "so-manager-body");
      dialog.append(header, body);
      backdrop.append(dialog);
      document.body.append(backdrop);
      render();
    }
    function onEscape(e) {
      if (e.key !== "Escape") return;
      if (view.kind === "pack") {
        view = { kind: "list" };
        render();
      } else {
        close();
      }
    }
    function close() {
      document.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", applyBackdropSize);
      backdrop?.remove();
      backdrop = null;
    }
    function refreshIfOpen() {
      if (backdrop) render();
    }
    function commit(next) {
      deps.updateSettings(next);
      render();
    }
    function commitPack(pack) {
      commit(upsertPack(deps.getSettings(), pack));
    }
    function render() {
      if (!backdrop) return;
      const backBtn = backdrop.querySelector(".so-manager-back");
      const title = backdrop.querySelector(".so-manager-title");
      const body = backdrop.querySelector(".so-manager-body");
      body.innerHTML = "";
      try {
        if (view.kind === "pack") {
          const packId = view.packId;
          const pack = deps.getSettings().packs.find((p) => p.id === packId);
          if (pack) {
            backBtn.style.display = "inline-flex";
            title.textContent = pack.name;
            renderPackDetail(body, pack);
            return;
          }
          view = { kind: "list" };
        }
        backBtn.style.display = "none";
        title.textContent = "立绘包管理";
        renderList(body);
      } catch (err) {
        console.error("[sprite-overlay] 管理弹窗渲染失败", err);
        const msg = el("div", "so-status");
        msg.textContent = `界面渲染出错：${err instanceof Error ? err.message : String(err)}`;
        body.append(msg);
      }
    }
    function renderList(body) {
      const settings = deps.getSettings();
      const characterName = deps.adapter.getCurrentCharacterName();
      const binding = settings.bindings.find((b) => b.characterName === characterName);
      const bindSection = el("div", "so-section");
      const bindTitle = el("div", "so-section-title");
      bindTitle.textContent = characterName ? `当前角色：${characterName}` : "当前角色绑定";
      bindSection.append(bindTitle);
      if (characterName) {
        const bindRow = el("div", "so-row so-bind-row");
        const select = document.createElement("select");
        select.className = "text_pole";
        select.setAttribute("aria-label", `为「${characterName}」绑定立绘包`);
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "选择立绘包…";
        select.append(placeholder);
        for (const p of settings.packs) {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = `${p.name}（${p.sprites.length} 张）`;
          opt.selected = binding?.packId === p.id;
          select.append(opt);
        }
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
        bindSection.append(bindRow);
      } else {
        const tip = el("div", "so-status");
        tip.textContent = "请先打开一个角色聊天，再回来绑定立绘包。";
        bindSection.append(tip);
      }
      body.append(bindSection);
      const grid = el("div", "so-pack-grid");
      for (const pack of settings.packs) {
        const bound = binding?.packId === pack.id ? binding.enabled ? "active" : "off" : null;
        grid.append(renderPackCard(pack, bound));
      }
      body.append(grid);
      const addSection = el("div", "so-section");
      const addTitle = el("div", "so-section-title");
      addTitle.textContent = "新建 / 导入";
      const createRow = el("div", "so-row");
      const nameInput = textInput("新立绘包名称…");
      nameInput.classList.add("so-grow");
      const createBtn = button("新建立绘包", () => {
        const name = sanitizePackName(nameInput.value);
        if (!name) {
          toast(body, "包名不能为空（| = @ < > 等符号会被剔除）");
          return;
        }
        const pack = { id: genId(), name, author: "我", sprites: [] };
        deps.updateSettings(upsertPack(deps.getSettings(), pack));
        view = { kind: "pack", packId: pack.id };
        render();
      });
      nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.isComposing) createBtn.click();
      });
      createRow.append(nameInput, createBtn);
      const importRow = el("div", "so-row");
      const shareInput = textInput("粘贴 stpack1: 开头的分享串…");
      shareInput.classList.add("so-grow");
      const shareBtn = button("导入分享串", () => {
        if (!shareInput.value.trim()) return;
        try {
          const pack = decodeShareString(shareInput.value);
          deps.updateSettings(upsertPack(deps.getSettings(), pack));
          shareInput.value = "";
          view = { kind: "pack", packId: pack.id };
          render();
        } catch (err) {
          toast(body, err instanceof Error ? err.message : "分享串解析失败");
        }
      });
      importRow.append(
        shareInput,
        shareBtn,
        button("导入 JSON 文件", () => {
          pickFile(".json,application/json", false, async (files) => {
            try {
              const pack = importPack(await files[0].text());
              deps.updateSettings(upsertPack(deps.getSettings(), pack));
              view = { kind: "pack", packId: pack.id };
              render();
            } catch (err) {
              toast(body, err instanceof Error ? err.message : "导入失败");
            }
          });
        })
      );
      addSection.append(addTitle, createRow, importRow);
      body.append(addSection);
      body.append(statusBar());
    }
    function renderPackCard(pack, bound) {
      const card = el("div", "so-pack-card");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `打开立绘包「${pack.name}」`);
      card.title = "点击进入管理";
      const coverBox = el("div", "so-card-cover");
      const cover = getPackCover(pack);
      if (cover) {
        const img = document.createElement("img");
        img.src = cover.url;
        img.alt = cover.tag;
        img.loading = "lazy";
        coverBox.append(img);
      } else {
        coverBox.textContent = "暂无立绘";
      }
      if (bound) {
        const badge = el("span", bound === "active" ? "so-card-badge" : "so-card-badge so-card-badge-off");
        badge.textContent = bound === "active" ? "使用中" : "已停用";
        coverBox.append(badge);
      }
      if (isPresetPack(pack.id)) {
        const chip = el("span", "so-card-chip");
        chip.textContent = "预设";
        coverBox.append(chip);
      }
      const info = el("div", "so-card-info");
      const nameEl = el("b");
      nameEl.textContent = pack.name;
      const metaEl = el("small");
      metaEl.textContent = `${pack.sprites.length} 张 · ${pack.author ?? "未知作者"}`;
      info.append(nameEl, metaEl);
      card.append(coverBox, info);
      const enter = () => {
        view = { kind: "pack", packId: pack.id };
        render();
      };
      card.addEventListener("click", enter);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          enter();
        }
      });
      return card;
    }
    function renderPackDetail(body, pack) {
      const readonly = isPresetPack(pack.id);
      const topRow = el("div", "so-row so-detail-top");
      topRow.append(
        button("导出 JSON", async () => {
          const file = await exportPack(pack);
          downloadJson(file, `${pack.name}.sprite-pack.json`);
          toast(body, `已导出「${pack.name}」`);
        }),
        button("复制分享串", async () => {
          const result = encodeShareString(pack);
          if (!result) {
            toast(body, "该包没有图床图片，无法生成分享串（本地/内嵌图请用「导出 JSON」）");
            return;
          }
          const ok = await copyText(result.text);
          const skipNote = result.skipped.length > 0 ? `；跳过非图床立绘：${result.skipped.join("、")}` : "";
          toast(body, ok ? `已复制分享串（${result.included} 张）${skipNote}` : "复制失败，请手动复制弹出的文本");
          if (!ok) window.prompt("手动复制分享串：", result.text);
        })
      );
      const spacer = el("div", "so-spacer");
      topRow.append(spacer);
      if (!readonly) {
        topRow.append(
          button("删除立绘包", () => {
            if (!window.confirm(`确定删除立绘包「${pack.name}」？绑定关系会一并清除。`)) return;
            view = { kind: "list" };
            commit(removePack(deps.getSettings(), pack.id));
          }, "so-btn-danger")
        );
      }
      body.append(topRow);
      if (readonly) {
        const note = el("div", "so-status");
        note.textContent = "预设包随扩展分发、只读；想改动可先「导出 JSON」再导入为自定义包。";
        body.append(note);
      } else {
        const metaSection = el("div", "so-section");
        const metaTitle = el("div", "so-section-title");
        metaTitle.textContent = "包信息";
        const metaRow = el("div", "so-row so-meta-row");
        const nameInput = textInput("包名");
        nameInput.value = pack.name;
        const authorInput = textInput("作者");
        authorInput.value = pack.author ?? "";
        const descInput = textInput("描述（可选）");
        descInput.value = pack.description ?? "";
        metaRow.append(
          labeled("包名", nameInput),
          labeled("作者", authorInput),
          labeled("描述", descInput),
          button("保存信息", () => {
            const name = sanitizePackName(nameInput.value);
            if (!name) {
              toast(body, "包名不能为空");
              return;
            }
            commitPack({
              ...pack,
              name,
              author: sanitizePackName(authorInput.value) || void 0,
              description: sanitizeDescription(descInput.value) || void 0
            });
          })
        );
        metaSection.append(metaTitle, metaRow);
        body.append(metaSection);
      }
      if (pack.sprites.length === 0) {
        const empty = el("div", "so-status");
        empty.textContent = "还没有立绘，用下方按钮上传图片（文件名即表情名）。";
        body.append(empty);
      } else {
        const groups = getGroups(pack);
        const sections = groups.length === 0 ? [""] : [...groups];
        if (groups.length > 0 && pack.sprites.some((s) => spriteGroup(s) === "")) sections.push("");
        for (const g of sections) {
          if (groups.length > 0) {
            const head = el("div", "so-group-head");
            head.textContent = g === "" ? "未分组" : g;
            body.append(head);
          }
          const grid = el("div", "so-sprite-grid");
          pack.sprites.forEach((sprite, index) => {
            if (spriteGroup(sprite) === g) {
              grid.append(renderSpriteCell(body, pack, sprite, index, readonly));
            }
          });
          body.append(grid);
        }
      }
      if (!readonly) {
        const addSection = el("div", "so-section");
        const addTitle = el("div", "so-section-title");
        addTitle.textContent = "添加立绘";
        addSection.append(addTitle);
        const addRow = el("div", "so-row");
        const batchGroupInput = textInput("本批分组，可空");
        addRow.append(
          labeled("分组", batchGroupInput),
          button("上传图片（自动压缩）", () => {
            pickFile(
              "image/*",
              true,
              (files) => void handleUpload(body, pack.id, files, batchGroupInput.value)
            );
          })
        );
        const upHint = el("div", "so-status");
        upHint.textContent = "文件名含下划线自动拆分组：鸣人_微笑.png → 分组「鸣人」表情「微笑」；否则用「本批分组」。";
        addSection.append(addRow, upHint);
        const codeRow = el("div", "so-row so-code-row");
        const tagInput = textInput("表情名，如 微笑");
        const codeInput = textInput("图床编码，如 ab12cd.png");
        const codeGroupInput = textInput("分组，可空");
        codeRow.append(
          labeled("表情", tagInput),
          labeled("编码", codeInput),
          labeled("分组", codeGroupInput),
          button("按编码添加", () => {
            const tag = normalizeTag(tagInput.value);
            const code = codeInput.value.trim();
            if (!tag) {
              toast(body, "表情名不能为空（[ ] / : | = @ 等符号会被剔除）");
              return;
            }
            if (!isValidImageCode(code)) {
              toast(body, "编码格式不对：应为图床文件名，如 ab12cd.png");
              return;
            }
            const current = deps.getSettings();
            const target = current.packs.find((p) => p.id === pack.id);
            if (!target) return;
            const host = current.imageHost.endsWith("/") ? current.imageHost : `${current.imageHost}/`;
            const group = normalizeTag(codeGroupInput.value);
            commitPack(upsertSprite(target, { tag, url: host + code, code, ...group ? { group } : {} }));
            tagInput.value = "";
            codeInput.value = "";
            codeGroupInput.value = "";
          })
        );
        const codeHint = el("div", "so-status");
        codeHint.textContent = `编码将拼接当前图床前缀：${deps.getSettings().imageHost}`;
        addSection.append(codeRow, codeHint);
        body.append(addSection);
      }
      body.append(statusBar());
    }
    function renderSpriteCell(body, pack, sprite, index, readonly) {
      const cell = el("div", "so-sprite-cell");
      if (pack.coverTag === sprite.tag) cell.classList.add("so-cover");
      const img = document.createElement("img");
      img.src = sprite.url;
      img.alt = sprite.tag;
      img.title = sprite.tag;
      img.loading = "lazy";
      const tagEl = el("div", "so-sprite-tag");
      tagEl.textContent = sprite.tag;
      tagEl.title = sprite.tag;
      cell.append(img, tagEl);
      if (readonly) return cell;
      const latestPack = () => deps.getSettings().packs.find((p) => p.id === pack.id);
      const bar = el("div", "so-sprite-actions");
      bar.append(
        iconButton("✎", "重命名", () => {
          const next = window.prompt(`「${sprite.tag}」改名为：`, sprite.tag);
          if (next === null) return;
          const target = latestPack();
          if (!target) return;
          try {
            commitPack(renameSprite(target, sprite.tag, next, spriteGroup(sprite)));
          } catch (err) {
            toast(body, err instanceof Error ? err.message : "改名失败");
          }
        }),
        iconButton("🏷", "设分组", () => {
          const cur = spriteGroup(sprite);
          const next = window.prompt(`「${sprite.tag}」的分组（留空=移出分组）：`, cur);
          if (next === null) return;
          const target = latestPack();
          if (!target) return;
          try {
            commitPack(setSpriteGroup(target, sprite.tag, cur, next));
          } catch (err) {
            toast(body, err instanceof Error ? err.message : "改分组失败");
          }
        }),
        iconButton("🖼", "替换图片", () => {
          pickFile("image/*", false, async (files) => {
            try {
              const result = await compressImage(files[0]);
              const url = await deps.adapter.saveImage(
                `${sprite.tag}.webp`,
                result.dataUri,
                deps.adapter.getCurrentCharacterName() || pack.name
              );
              const target = latestPack();
              if (!target) return;
              const g = spriteGroup(sprite);
              commitPack(upsertSprite(target, { tag: sprite.tag, url, ...g ? { group: g } : {} }));
              toast(body, `已替换「${sprite.tag}」（${formatBytes(result.bytes)}）`);
            } catch (err) {
              toast(body, err instanceof Error ? err.message : "替换失败");
            }
          });
        }),
        iconButton("★", "设为封面", () => {
          const target = latestPack();
          if (!target) return;
          commitPack({ ...target, coverTag: sprite.tag });
        }),
        iconButton("◀", "前移", () => {
          const target = latestPack();
          if (!target) return;
          commitPack(moveSprite(target, index, index - 1));
        }),
        iconButton("▶", "后移", () => {
          const target = latestPack();
          if (!target) return;
          commitPack(moveSprite(target, index, index + 1));
        }),
        iconButton("✕", "删除", () => {
          if (!window.confirm(`删除立绘「${sprite.tag}」？`)) return;
          const target = latestPack();
          if (!target) return;
          commitPack(removeSprite(target, sprite.tag, spriteGroup(sprite)));
        })
      );
      cell.append(bar);
      return cell;
    }
    async function handleUpload(body, packId, files, batchGroup) {
      let added = 0;
      let skipped = 0;
      let hosted = 0;
      let hostFailed = 0;
      let savedBytes = "";
      const { autoUpload, imgbbApiKey } = deps.getSettings();
      const useImgbb = autoUpload && imgbbApiKey.trim() !== "";
      for (const file of Array.from(files)) {
        const { group, tag } = parseUploadName(file.name, batchGroup);
        if (!tag) {
          skipped++;
          continue;
        }
        try {
          const result = await compressImage(file);
          savedBytes = formatBytes(result.bytes);
          const url = await deps.adapter.saveImage(
            file.name,
            result.dataUri,
            deps.adapter.getCurrentCharacterName() || packId
          );
          const target = deps.getSettings().packs.find((p) => p.id === packId);
          if (!target) return;
          const sprite = group ? { tag, url, group } : { tag, url };
          deps.updateSettings(upsertPack(deps.getSettings(), upsertSprite(target, sprite)));
          added++;
          if (useImgbb) {
            try {
              const up = await uploadToImgbb(imgbbApiKey, result.dataUri);
              const latest = deps.getSettings().packs.find((p) => p.id === packId);
              if (latest) {
                const hostedSprite = group ? { tag, url: up.url, code: up.code, group } : { tag, url: up.url, code: up.code };
                deps.updateSettings(upsertPack(deps.getSettings(), upsertSprite(latest, hostedSprite)));
                hosted++;
              }
            } catch (err) {
              console.warn("[sprite-overlay] imgbb 上传失败（图片保留本地）", err);
              hostFailed++;
            }
          }
        } catch (err) {
          console.error("[sprite-overlay] 上传失败", err);
          skipped++;
        }
      }
      render();
      const note = skipped > 0 ? `，跳过 ${skipped} 张（文件名无效或保存失败）` : "";
      const hostNote = useImgbb ? `，imgbb 成功 ${hosted} 张${hostFailed > 0 ? `、失败 ${hostFailed} 张（已保留本地，可稍后手动补编号）` : ""}` : "";
      toast(
        backdrop?.querySelector(".so-manager-body"),
        `已添加 ${added} 张立绘${added === 1 ? `（${savedBytes}）` : ""}${note}${hostNote}`
      );
    }
    return { open, close, refreshIfOpen };
  }
  function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }
  function textInput(placeholder) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "text_pole";
    input.placeholder = placeholder;
    return input;
  }
  function labeled(label, input) {
    const wrap = el("label", "so-labeled");
    const span = el("span", "so-labeled-text");
    span.textContent = label;
    wrap.append(span, input);
    return wrap;
  }
  function checkboxRow(label, checked, onChange) {
    const row = el("label", "so-row checkbox_label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));
    const span = document.createElement("span");
    span.textContent = label;
    row.append(input, span);
    return row;
  }
  function button(label, onClick, extraClass = "") {
    const btn = el("div", `menu_button so-btn ${extraClass}`.trim());
    btn.setAttribute("role", "button");
    btn.tabIndex = 0;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    });
    return btn;
  }
  function iconButton(icon, title, onClick) {
    const btn = el("div", "so-icon-btn");
    btn.textContent = icon;
    btn.title = title;
    btn.setAttribute("role", "button");
    btn.setAttribute("aria-label", title);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }
  function statusBar() {
    return el("div", "so-status so-toast");
  }
  function toast(scope, msg) {
    const bar = scope?.querySelector(".so-toast");
    if (!bar) return;
    bar.textContent = msg;
    setTimeout(() => {
      if (bar.textContent === msg) bar.textContent = "";
    }, 4e3);
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
  function downloadJson(data, fileName) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.append(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    }
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
        (v) => deps.updateSettings({ ...deps.getSettings(), enabled: v }),
        "总开关：把可用立绘清单注入给 AI，并根据回复中的 [立绘:xxx] 标签在悬浮窗展示对应立绘。关闭后两者都停用。"
      ),
      checkboxRow2(
        "显示手机框（关闭则回退纯悬浮窗）",
        settings.showPhone,
        (v) => deps.updateSettings({ ...deps.getSettings(), showPhone: v }),
        "在屏幕上显示可拖动的 📱 图标，点击展开手机面板（立绘 / 图库 / 设置 App）。关闭后仅保留立绘悬浮窗本体。"
      ),
      checkboxRow2(
        "消息中隐藏 [立绘:xxx] 标签",
        settings.hideTagInMessage,
        (v) => deps.updateSettings({ ...deps.getSettings(), hideTagInMessage: v }),
        "[立绘:xxx] 是 AI 用来切换立绘的控制标签。开启后聊天气泡里不再显示这串文字，仅在后台生效；消息原文不变，可随时关闭。"
      ),
      selectRow(
        "立绘显示位置",
        settings.spriteDisplayMode,
        [
          { value: "overlay", label: "悬浮窗（默认）" },
          { value: "inline", label: "楼层内（消息里原位显示）" },
          { value: "both", label: "两者都显示" }
        ],
        (v) => deps.updateSettings({
          ...deps.getSettings(),
          spriteDisplayMode: v === "inline" || v === "both" ? v : "overlay"
        }),
        "楼层内：把消息中的 [立绘:xxx] 标签原位替换成立绘图片，本地上传、内嵌和图床图源都支持；此模式下悬浮窗隐藏。匹配不到的标签仍按上面「隐藏标签」设置处理。只影响显示，消息原文不变。"
      ),
      checkboxRow2(
        "渲染消息内插图（<img>编码</img>）",
        settings.renderInlineImages,
        (v) => deps.updateSettings({ ...deps.getSettings(), renderInlineImages: v }),
        "把 AI 回复中的 <img>图床编码</img> 渲染成真实图片，编码会自动拼接下方「图床前缀」。适合让 AI 在正文里插图。"
      ),
      checkboxRow2(
        "多立绘自动轮播（一条消息含多张立绘时）",
        settings.autoSwitch,
        (v) => deps.updateSettings({ ...deps.getSettings(), autoSwitch: v }),
        "一条回复命中多张立绘时，悬浮窗按下方间隔自动逐张播放；关闭后需点击悬浮窗手动切换。"
      ),
      numberRow(
        "轮播间隔（秒）",
        settings.autoSwitchSeconds,
        (v) => deps.updateSettings({ ...deps.getSettings(), autoSwitchSeconds: v }),
        "自动轮播时每张立绘的停留时长，范围 1–60 秒。"
      ),
      checkboxRow2(
        "多角色/分组模式（按 [立绘:分组/图名] 寻址）",
        settings.multiRole,
        (v) => deps.updateSettings({ ...deps.getSettings(), multiRole: v }),
        "立绘包内用「分组」区分多个角色或形态时开启：AI 会用 [立绘:分组/图名]（如 [立绘:鸣人/微笑]）精确指定立绘。单角色包保持关闭即可。"
      ),
      selectRow(
        "分组 prompt 模式",
        settings.multiRolePromptMode,
        [
          { value: "full", label: "全量（枚举全部组合）" },
          { value: "repeat", label: "重复（分组×共享情绪名·省 token）" }
        ],
        (v) => deps.updateSettings({
          ...deps.getSettings(),
          multiRolePromptMode: v === "repeat" ? "repeat" : "full"
        }),
        "注入给 AI 的立绘清单写法。全量：逐一列出每个「分组/图名」组合，最直观；重复：只列分组名和共享的表情名，各分组图名一致时更省 token。"
      ),
      hostRow(
        settings.imageHost,
        (v) => deps.updateSettings({ ...deps.getSettings(), imageHost: v }),
        "拼在「图床编码」前面的 URL，用于按编码添加立绘、分享串和消息内插图。默认 catbox，一般无需修改。"
      )
    );
    const imgbbHint = document.createElement("div");
    imgbbHint.className = "so-status";
    imgbbHint.textContent = "自动上传需 imgbb API Key（免费申请：https://api.imgbb.com/）";
    const autoRow = document.createElement("label");
    autoRow.className = "so-row checkbox_label";
    const autoInput = document.createElement("input");
    autoInput.type = "checkbox";
    autoInput.checked = settings.autoUpload;
    autoInput.addEventListener("change", () => {
      const cur = deps.getSettings();
      if (autoInput.checked && !cur.imgbbApiKey.trim()) {
        autoInput.checked = false;
        imgbbHint.textContent = "请先填写 imgbb API Key（免费申请：https://api.imgbb.com/）";
        return;
      }
      if (autoInput.checked) {
        imgbbHint.textContent = "API Key 仅存储在本地浏览器中，不会上传到任何服务器；申请：https://api.imgbb.com/";
      }
      deps.updateSettings({ ...cur, autoUpload: autoInput.checked });
    });
    const autoSpan = document.createElement("span");
    autoSpan.textContent = "导入时自动上传到 imgbb 图床并绑定编号";
    autoSpan.append(
      helpIcon(
        "上传立绘时自动同步到 imgbb 图床并记录编号，这样「复制分享串」分享给别人时对方才能看到图。上传失败时图片仍保留在本地。"
      )
    );
    autoRow.append(autoInput, autoSpan);
    content.append(
      passwordRow(
        "imgbb API Key",
        settings.imgbbApiKey,
        (v) => deps.updateSettings({ ...deps.getSettings(), imgbbApiKey: v }),
        "开启「自动上传」所需的 imgbb 账号密钥，仅保存在本地浏览器、不会上传到别处。免费申请：api.imgbb.com"
      ),
      autoRow,
      imgbbHint
    );
    const hint = document.createElement("div");
    hint.className = "so-status";
    hint.textContent = "立绘包管理与角色绑定：点击聊天界面悬浮窗右上角的 ⚙ 按钮。";
    content.append(hint);
  }
  function helpIcon(tip) {
    const icon = document.createElement("span");
    icon.className = "so-help";
    icon.textContent = "?";
    icon.tabIndex = 0;
    icon.setAttribute("aria-label", tip);
    icon.dataset.tip = tip;
    icon.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    return icon;
  }
  function checkboxRow2(label, checked, onChange, help) {
    const row = document.createElement("label");
    row.className = "so-row checkbox_label";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));
    const span = document.createElement("span");
    span.textContent = label;
    if (help) span.append(helpIcon(help));
    row.append(input, span);
    return row;
  }
  function numberRow(label, value, onChange, help, min = 1, max = 60) {
    const row = document.createElement("div");
    row.className = "so-row";
    const span = document.createElement("span");
    span.textContent = label;
    if (help) span.append(helpIcon(help));
    const input = document.createElement("input");
    input.type = "number";
    input.className = "text_pole";
    input.min = String(min);
    input.max = String(max);
    input.step = "1";
    input.value = String(value);
    input.style.maxWidth = "90px";
    input.addEventListener("change", () => {
      const n = Math.round(Number(input.value));
      const clamped = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
      input.value = String(clamped);
      onChange(clamped);
    });
    row.append(span, input);
    return row;
  }
  function passwordRow(label, value, onChange, help) {
    const row = document.createElement("div");
    row.className = "so-row";
    const span = document.createElement("span");
    span.textContent = label;
    if (help) span.append(helpIcon(help));
    const input = document.createElement("input");
    input.type = "password";
    input.className = "text_pole";
    input.value = value;
    input.autocomplete = "off";
    input.addEventListener("change", () => onChange(input.value.trim()));
    const eye = document.createElement("div");
    eye.className = "menu_button";
    eye.textContent = "👁";
    eye.title = "显示/隐藏 Key";
    eye.setAttribute("role", "button");
    eye.setAttribute("aria-label", "显示或隐藏 API Key");
    eye.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
    });
    row.append(span, input, eye);
    return row;
  }
  function selectRow(label, value, options, onChange, help) {
    const row = document.createElement("div");
    row.className = "so-row";
    const span = document.createElement("span");
    span.textContent = label;
    if (help) span.append(helpIcon(help));
    const select = document.createElement("select");
    select.className = "text_pole";
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === value) o.selected = true;
      select.append(o);
    }
    select.addEventListener("change", () => onChange(select.value));
    row.append(span, select);
    return row;
  }
  function hostRow(value, onChange, help) {
    const row = document.createElement("div");
    row.className = "so-row";
    const span = document.createElement("span");
    span.textContent = "图床前缀";
    if (help) span.append(helpIcon(help));
    const input = document.createElement("input");
    input.type = "text";
    input.className = "text_pole";
    input.value = value;
    input.placeholder = DEFAULT_IMAGE_HOST;
    input.addEventListener("blur", () => {
      const raw = input.value.trim() || DEFAULT_IMAGE_HOST;
      if (!/^https?:\/\/.+/.test(raw)) {
        input.value = DEFAULT_IMAGE_HOST;
        onChange(DEFAULT_IMAGE_HOST);
        return;
      }
      const normalized = raw.endsWith("/") ? raw : `${raw}/`;
      input.value = normalized;
      onChange(normalized);
    });
    row.append(span, input);
    return row;
  }

  // core/inline-image.ts
  var HTML_STYLE_SOURCE = "<\\s*(img|illustration)\\s*>\\s*([^<]+?)\\s*<\\/\\s*\\1\\s*>";
  var BRACKET_STYLE_SOURCE = "[\\[【]\\s*(插图|图)\\s*[:：]\\s*([^\\]】]+?)\\s*[\\]】]";
  var COMBINED_SOURCE = `${HTML_STYLE_SOURCE}|${BRACKET_STYLE_SOURCE}`;
  function hasInlineImageMarkup(text) {
    return new RegExp(COMBINED_SOURCE, "i").test(text);
  }
  function replaceInlineImages(text, replacer) {
    const regex = new RegExp(COMBINED_SOURCE, "gi");
    return text.replace(regex, (raw, ...groups) => {
      const code = (groups[1] ?? groups[3] ?? "").trim();
      if (!isValidImageCode(code)) return raw;
      const out = replacer({ raw, code });
      return out === null ? raw : out;
    });
  }

  // st-extension/src/message-postprocess.ts
  var PROCESSED_ATTR = "data-so-processed";
  function mountMessagePostprocess(deps) {
    const st = window.SillyTavern;
    if (!st) return () => {
    };
    const ctx = st.getContext();
    const renderedEvents = [
      ctx.eventTypes?.CHARACTER_MESSAGE_RENDERED,
      ctx.eventTypes?.USER_MESSAGE_RENDERED
    ].filter((e) => typeof e === "string" && e.length > 0);
    const handler = (...args) => {
      const messageId = typeof args[0] === "number" || typeof args[0] === "string" ? args[0] : null;
      queueMicrotask(() => processMessages(deps.getSettings(), messageId));
    };
    if (renderedEvents.length > 0) {
      for (const event of renderedEvents) ctx.eventSource.on(event, handler);
      return () => {
        for (const event of renderedEvents) ctx.eventSource.removeListener(event, handler);
      };
    }
    const fallbackEvent = ctx.eventTypes?.MESSAGE_RECEIVED ?? "message_received";
    const fallbackHandler = (...args) => {
      const messageId = typeof args[0] === "number" || typeof args[0] === "string" ? args[0] : null;
      setTimeout(() => processMessages(deps.getSettings(), messageId), 150);
    };
    ctx.eventSource.on(fallbackEvent, fallbackHandler);
    return () => ctx.eventSource.removeListener(fallbackEvent, fallbackHandler);
  }
  function processMessages(settings, messageId = null) {
    if (!settings.enabled) return;
    if (!settings.hideTagInMessage && !settings.renderInlineImages && settings.spriteDisplayMode === "overlay")
      return;
    const scope = messageId !== null && messageId !== void 0 && `${messageId}` !== "" ? document.querySelectorAll(`#chat .mes[mesid="${CSS.escape(`${messageId}`)}"] .mes_text`) : document.querySelectorAll("#chat .mes .mes_text");
    for (const node of Array.from(scope)) {
      processMessageElement(node, settings);
    }
  }
  function reprocessAllMessages(settings) {
    for (const node of Array.from(document.querySelectorAll(`#chat .mes .mes_text[${PROCESSED_ATTR}]`))) {
      node.removeAttribute(PROCESSED_ATTR);
    }
    processMessages(settings);
  }
  function processMessageElement(root, settings) {
    const inlineSprites = settings.spriteDisplayMode !== "overlay";
    const fingerprint = `${settings.hideTagInMessage ? "T" : ""}${settings.renderInlineImages ? "I" : ""}${inlineSprites ? "S" : ""}`;
    if (root.getAttribute(PROCESSED_ATTR) === fingerprint) return;
    const host = settings.imageHost.endsWith("/") ? settings.imageHost : `${settings.imageHost}/`;
    const chName = inlineSprites ? root.closest(".mes")?.getAttribute("ch_name") ?? "" : "";
    const pack = chName ? getActivePack(settings, chName) : null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let current;
    while (current = walker.nextNode()) {
      textNodes.push(current);
    }
    for (const textNode of textNodes) {
      const text = textNode.nodeValue ?? "";
      if (!text) continue;
      const tagged = hasTag(text);
      const needsSprites = inlineSprites && pack !== null && tagged;
      const needsStrip = settings.hideTagInMessage && tagged && !needsSprites;
      const needsImages = settings.renderInlineImages && hasInlineImageMarkup(text);
      if (!needsSprites && !needsStrip && !needsImages) continue;
      let processed = needsStrip ? stripTags(text) : text;
      const elements = [];
      const marker = (el3) => `\0${elements.push(el3) - 1}\0`;
      if (needsSprites && pack) {
        processed = replaceTags(processed, (address) => {
          const sprite = matchAddress(pack, address);
          if (!sprite) return settings.hideTagInMessage ? "" : null;
          return marker(createImage(sprite.url, sprite.tag, "so-inline-sprite"));
        });
      }
      if (needsImages) {
        processed = replaceInlineImages(processed, (m) => marker(createImage(host + m.code, m.code)));
      }
      if (elements.length === 0) {
        if (processed !== text) textNode.nodeValue = processed;
        continue;
      }
      const fragment = document.createDocumentFragment();
      processed.split("\0").forEach((part, i) => {
        if (i % 2 === 1) fragment.append(elements[Number(part)]);
        else if (part) fragment.append(document.createTextNode(part));
      });
      textNode.replaceWith(fragment);
    }
    root.setAttribute(PROCESSED_ATTR, fingerprint);
  }
  function createImage(src, alt, extraClass = "") {
    const wrap = document.createElement("span");
    wrap.className = extraClass ? `so-inline-image ${extraClass}` : "so-inline-image";
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    img.loading = "lazy";
    img.addEventListener("error", () => wrap.classList.add("so-inline-image-error"), { once: true });
    wrap.append(img);
    return wrap;
  }

  // st-extension/src/phone-apps.ts
  function createBuiltinApps(deps) {
    return [spritesApp(deps), galleryApp(deps), settingsApp()];
  }
  function spritesApp(deps) {
    return {
      id: "sprites",
      name: "立绘",
      icon: "🎭",
      order: 1,
      mount(container, ctx) {
        const settings = ctx.getSettings();
        const characterName = ctx.getCharacterName();
        const pack = getActivePack(settings, characterName);
        const info = el2("div", "so-app-section");
        const title = el2("div", "so-app-title");
        title.textContent = characterName ? `当前角色：${characterName}` : "尚未打开角色聊天";
        const detail = el2("div", "so-app-desc");
        detail.textContent = pack ? `已绑定「${pack.name}」（${pack.sprites.length} 个表情）` : "未绑定立绘包 — 到「图库」App 里绑定";
        info.append(title, detail);
        const actions = el2("div", "so-app-section");
        actions.append(
          appButton("把立绘窗拉回视口", () => {
            const next = { ...ctx.getSettings(), overlay: { x: 24, y: 80, width: ctx.getSettings().overlay.width } };
            ctx.updateSettings(next);
            deps.overlay.setLayout(next.overlay);
            deps.overlay.setVisible(true);
          }),
          appButton(settings.enabled ? "关闭立绘悬浮窗" : "开启立绘悬浮窗", () => {
            ctx.updateSettings({ ...ctx.getSettings(), enabled: !ctx.getSettings().enabled });
            ctx.goHome();
          })
        );
        container.append(info, actions);
        if (pack && pack.sprites.length > 0) {
          const grid = el2("div", "so-app-sprite-strip");
          for (const sprite of pack.sprites) {
            const img = document.createElement("img");
            img.src = sprite.url;
            img.alt = sprite.tag;
            img.title = `点击预览「${sprite.tag}」`;
            img.loading = "lazy";
            img.addEventListener("click", () => {
              deps.overlay.setImage(sprite.url, sprite.tag);
              deps.overlay.setVisible(true);
            });
            grid.append(img);
          }
          container.append(grid);
          const hint = el2("div", "so-app-desc");
          hint.textContent = "点缩略图可直接预览表情。";
          container.append(hint);
        }
      }
    };
  }
  function galleryApp(deps) {
    return {
      id: "gallery",
      name: "图库",
      icon: "🗂",
      order: 2,
      mount(container, ctx) {
        const section = el2("div", "so-app-section");
        const desc = el2("div", "so-app-desc");
        desc.textContent = "立绘包管理：新建/上传/导入导出/分享串/角色绑定。";
        section.append(
          desc,
          appButton("打开立绘包管理", () => {
            deps.collapsePhone();
            deps.manager.open();
          })
        );
        container.append(section);
        const settings = ctx.getSettings();
        const list = el2("div", "so-app-section");
        const title = el2("div", "so-app-title");
        title.textContent = `共 ${settings.packs.length} 个立绘包`;
        list.append(title);
        for (const pack of settings.packs) {
          const row = el2("div", "so-app-desc");
          row.textContent = `· ${pack.name}（${pack.sprites.length} 张）`;
          list.append(row);
        }
        container.append(list);
      }
    };
  }
  function settingsApp() {
    return {
      id: "settings",
      name: "设置",
      icon: "⚙️",
      order: 90,
      mount(container, ctx) {
        const settings = ctx.getSettings();
        const section = el2("div", "so-app-section");
        section.append(
          toggleRow(
            "启用立绘悬浮窗",
            settings.enabled,
            (v) => ctx.updateSettings({ ...ctx.getSettings(), enabled: v })
          ),
          toggleRow(
            "隐藏 [立绘:xxx] 标签",
            settings.hideTagInMessage,
            (v) => ctx.updateSettings({ ...ctx.getSettings(), hideTagInMessage: v })
          ),
          selectRow2(
            "立绘显示位置",
            settings.spriteDisplayMode,
            [
              { value: "overlay", label: "悬浮窗（默认）" },
              { value: "inline", label: "楼层内（消息里原位显示）" },
              { value: "both", label: "两者都显示" }
            ],
            (v) => ctx.updateSettings({
              ...ctx.getSettings(),
              spriteDisplayMode: v === "inline" || v === "both" ? v : "overlay"
            })
          ),
          toggleRow(
            "渲染消息内插图",
            settings.renderInlineImages,
            (v) => ctx.updateSettings({ ...ctx.getSettings(), renderInlineImages: v })
          )
        );
        const hostSection = el2("div", "so-app-section");
        const hostLabel = el2("div", "so-app-title");
        hostLabel.textContent = "图床前缀";
        const hostInput = document.createElement("input");
        hostInput.type = "text";
        hostInput.className = "text_pole so-app-input";
        hostInput.value = settings.imageHost;
        hostInput.placeholder = DEFAULT_IMAGE_HOST;
        hostInput.addEventListener("blur", () => {
          const raw = hostInput.value.trim() || DEFAULT_IMAGE_HOST;
          const value = /^https?:\/\/.+/.test(raw) ? raw.endsWith("/") ? raw : `${raw}/` : DEFAULT_IMAGE_HOST;
          hostInput.value = value;
          ctx.updateSettings({ ...ctx.getSettings(), imageHost: value });
        });
        hostSection.append(hostLabel, hostInput);
        container.append(section, hostSection);
      }
    };
  }
  function el2(tag, className) {
    const node = document.createElement(tag);
    node.className = className;
    return node;
  }
  function appButton(label, onClick) {
    const btn = el2("div", "menu_button so-app-btn");
    btn.setAttribute("role", "button");
    btn.tabIndex = 0;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    });
    return btn;
  }
  function toggleRow(label, checked, onChange) {
    const row = el2("label", "so-app-toggle checkbox_label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));
    const span = document.createElement("span");
    span.textContent = label;
    row.append(input, span);
    return row;
  }
  function selectRow2(label, value, options, onChange) {
    const row = el2("label", "so-app-toggle");
    const span = document.createElement("span");
    span.textContent = label;
    const select = document.createElement("select");
    select.className = "text_pole so-app-input";
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === value) o.selected = true;
      select.append(o);
    }
    select.addEventListener("change", () => onChange(select.value));
    row.append(span, select);
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
      const displayChanged = next.hideTagInMessage !== settings.hideTagInMessage || next.renderInlineImages !== settings.renderInlineImages || next.spriteDisplayMode !== settings.spriteDisplayMode || next.imageHost !== settings.imageHost || next.enabled !== settings.enabled;
      const autoChanged = next.autoSwitch !== settings.autoSwitch || next.autoSwitchSeconds !== settings.autoSwitchSeconds;
      settings = next;
      adapter.saveSettings(settings);
      overlay.setLayout(settings.overlay);
      phone.setVisible(settings.showPhone);
      if (autoChanged) overlay.setAutoSwitch(settings.autoSwitch, settings.autoSwitchSeconds);
      refresh();
      if (displayChanged) reprocessAllMessages(settings);
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
    overlay.setAutoSwitch(settings.autoSwitch, settings.autoSwitchSeconds);
    const registry = new PhoneAppRegistry();
    function createAppContext(appId, goHome) {
      return {
        getSettings: () => settings,
        updateSettings,
        getCharacterName: () => adapter.getCurrentCharacterName(),
        getAppData: () => settings.apps[appId],
        setAppData: (data) => {
          updateSettings({ ...settings, apps: { ...settings.apps, [appId]: data } });
        },
        goHome
      };
    }
    const phone = createPhoneShell(settings.phone, {
      registry,
      createAppContext,
      onStateChange: (state) => {
        settings = { ...settings, phone: state };
        adapter.saveSettings(settings);
      }
    });
    function collapsePhone() {
      settings = { ...settings, phone: { ...settings.phone, open: false } };
      adapter.saveSettings(settings);
      phone.setState(settings.phone);
    }
    for (const app of createBuiltinApps({ overlay, manager, collapsePhone })) {
      registry.register(app);
    }
    window.stStage = {
      registerApp: (app) => registry.register(app)
    };
    function refresh() {
      if (!settings.enabled) {
        adapter.injectPrompt("");
        overlay.setVisible(false);
        return;
      }
      const characterName = adapter.getCurrentCharacterName();
      const pack = getActivePack(settings, characterName);
      const prompt = settings.multiRole && pack ? buildMultiRolePrompt(
        pack.sprites.map((s) => ({ group: s.group ?? "", tag: s.tag })),
        settings.multiRolePromptMode
      ) : buildInjectionPrompt(getAvailableTags(settings, characterName));
      adapter.injectPrompt(prompt);
      if (pack && pack.sprites.length > 0) {
        preloadPack(pack);
        overlay.setImage(pack.sprites[0].url, pack.sprites[0].tag);
      } else if (characterName) {
        overlay.setPlaceholder("未绑定立绘包\n点击 ⚙ 进行绑定");
      } else {
        overlay.setPlaceholder("打开角色聊天后\n点击 ⚙ 绑定立绘包");
      }
      overlay.setVisible(settings.spriteDisplayMode !== "inline");
    }
    adapter.onMessageReceived((text) => {
      if (!settings.enabled || settings.spriteDisplayMode === "inline") return;
      const characterName = adapter.getCurrentCharacterName();
      const pack = getActivePack(settings, characterName);
      if (!pack) return;
      const seq = matchSprites(pack, extractTags(text));
      if (seq.length > 0) {
        overlay.setSprites(seq);
        overlay.setVisible(true);
      }
    });
    mountMessagePostprocess({ getSettings: () => settings });
    adapter.onCharacterChanged(() => {
      refresh();
      manager.refreshIfOpen();
    });
    mountSettingsPanel({
      getSettings: () => settings,
      updateSettings
    });
    refresh();
    phone.setState(settings.phone);
    phone.setVisible(settings.showPhone);
    console.log("[sprite-overlay] 角色立绘悬浮窗扩展已加载（含手机框架）");
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
