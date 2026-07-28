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
function countInstruction(count) {
  if (count <= 1) {
    return "请在每次回复的末尾，选择一个最贴合当前情境与角色情绪的立绘，以 [立绘:名称] 的格式单独标注。";
  }
  return `请根据回复内容，按情节顺序选择 ${count} 张立绘。每个 [立绘:...] 标签单独占一行，插在触发它的剧情段落之后——随剧情分散在正文中，不要集中堆在回复结尾。`;
}
function sceneKey(a) {
  return `${a.role}|${a.outfit}`;
}
function sceneLabel(a) {
  if (a.role && a.outfit) return `${a.role}/${a.outfit}`;
  if (a.role) return a.role;
  return "默认";
}
function scenePrefix(a) {
  if (a.role && a.outfit) return `${a.role}/${a.outfit}`;
  if (a.role) return a.role;
  return "";
}
function buildScenes(addresses) {
  const scenes = /* @__PURE__ */ new Map();
  for (const address of addresses) {
    const key = sceneKey(address);
    let scene = scenes.get(key);
    if (!scene) {
      scene = {
        key,
        label: sceneLabel(address),
        prefix: scenePrefix(address),
        tags: [],
        seen: /* @__PURE__ */ new Set()
      };
      scenes.set(key, scene);
    }
    if (!scene.seen.has(address.tag)) {
      scene.seen.add(address.tag);
      scene.tags.push(address.tag);
    }
  }
  return [...scenes.values()].map(({ seen: _seen, ...scene }) => scene);
}
function fewShotExample(scenes, count) {
  if (count <= 1) return [];
  const scene = scenes[0];
  if (!scene || scene.tags.length === 0) return [];
  const addr = (tag) => scene.prefix ? `${scene.prefix}/${tag}` : tag;
  const first = scene.tags[0];
  const second = scene.tags[1] ?? scene.tags[0];
  return [
    "插入位置示例（省略号代表你的正文段落）：",
    "…剧情段落一…",
    `[立绘:${addr(first)}]`,
    "…剧情段落二…",
    `[立绘:${addr(second)}]`
  ];
}
function buildGroupedFull(addresses, count) {
  const scenes = buildScenes(addresses);
  return [
    "[角色立绘系统]",
    "可用立绘（按场景）：",
    ...scenes.map((scene) => `- ${scene.label}：${scene.tags.join("、")}`),
    "输出格式：默认场景直接写 [立绘:表情]；其他场景写 [立绘:场景/表情]。两段地址表示无服装，三级地址表示指定服装。",
    countInstruction(count),
    ...fewShotExample(scenes, count),
    "只能使用上述场景中实际列出的表情，不要自行拼造不存在的角色/服装/表情组合。"
  ].join("\n");
}
function buildShared(addresses, count) {
  const scenes = buildScenes(addresses);
  if (scenes.length <= 1) return buildGroupedFull(addresses, count);
  const allTags = [];
  const seenTags = /* @__PURE__ */ new Set();
  for (const scene of scenes) {
    for (const tag of scene.tags) {
      if (seenTags.has(tag)) continue;
      seenTags.add(tag);
      allTags.push(tag);
    }
  }
  const sharedTags = allTags.filter((tag) => scenes.every((scene) => scene.tags.includes(tag)));
  if (sharedTags.length === 0) return buildGroupedFull(addresses, count);
  const sharedSet = new Set(sharedTags);
  const remainders = scenes.map((scene) => ({
    scene,
    tags: scene.tags.filter((tag) => !sharedSet.has(tag))
  }));
  const labels = scenes.map(
    (scene) => scene.prefix ? scene.label : `${scene.label}（直接写表情）`
  );
  const lines = [
    "[角色立绘系统]",
    `可用场景：${labels.join("、")}`,
    `共有表情（适用于全部场景）：${sharedTags.join("、")}`
  ];
  const withRemainder = remainders.filter((item) => item.tags.length > 0);
  if (withRemainder.length > 0) {
    lines.push("各场景其余表情：");
    lines.push(...withRemainder.map(({ scene, tags }) => `- ${scene.label}：${tags.join("、")}`));
  }
  lines.push("共有表情可与任一已列场景组合；各场景其余表情只按所在行使用。默认场景直接写 [立绘:表情]，其他场景写 [立绘:场景/表情]。");
  lines.push(countInstruction(count));
  lines.push(...fewShotExample(scenes, count));
  lines.push("只能使用实际存在的组合，不要自行拼造不存在的角色/服装/表情。");
  return lines.join("\n");
}
function chooseShorterPrompt(grouped, shared) {
  return shared.length < grouped.length ? shared : grouped;
}
var BUILTIN_TEMPLATE = [
  "[角色立绘系统]",
  "可用立绘（按场景）：",
  "{清单}",
  "输出格式：默认场景直接写 [立绘:表情]；其他场景写 [立绘:场景/表情]。两段地址表示无服装，三级地址表示指定服装。",
  "请根据回复内容，按情节顺序选择 {数量} 张立绘。每个 [立绘:...] 标签单独占一行，插在触发它的剧情段落之后——随剧情分散在正文中，不要集中堆在回复结尾。",
  "只能使用上述场景中实际列出的表情，不要自行拼造不存在的角色/服装/表情组合。"
].join("\n");
function buildPrompt(addresses, mode, count, template = "") {
  if (addresses.length === 0) return "";
  const n = Math.max(1, Math.round(count) || 1);
  const custom = template.trim();
  if (custom) {
    const list = buildScenes(addresses).map((scene) => `- ${scene.label}：${scene.tags.join("、")}`).join("\n");
    return custom.replace(/\{清单\}/g, list).replace(/\{数量\}/g, String(n));
  }
  const grouped = buildGroupedFull(addresses, n);
  if (mode === "full") return grouped;
  return chooseShorterPrompt(grouped, buildShared(addresses, n));
}

// core/types.ts
var SETTINGS_VERSION = 3;
var RECENT_FLOORS_DEFAULT = 6;
var RECENT_FLOORS_MIN = 1;
var RECENT_FLOORS_MAX = 50;
var SPRITE_COUNT_DEFAULT = 1;
var SPRITE_COUNT_MIN = 1;
var SPRITE_COUNT_MAX = 10;
var INJECTION_DEPTH_DEFAULT = 4;
var INJECTION_DEPTH_MIN = 0;
var INJECTION_DEPTH_MAX = 100;
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
function spriteRole(pack, sprite) {
  return (sprite.group ?? "").trim() || (pack.roleName ?? "").trim();
}
function spriteOutfit(pack, sprite) {
  return (sprite.outfit ?? "").trim() || (pack.outfit ?? "").trim();
}
function spriteAddress(pack, sprite) {
  return { role: spriteRole(pack, sprite), outfit: spriteOutfit(pack, sprite), tag: sprite.tag };
}
function formatAddress(a) {
  if (a.role && a.outfit) return `${a.role}/${a.outfit}/${a.tag}`;
  if (a.role) return `${a.role}/${a.tag}`;
  return a.tag;
}
function parseAddress(address) {
  const parts = address.split("/").map((s) => s.trim());
  if (parts.length >= 3) {
    return { role: parts[0], outfit: parts[1], tag: parts.slice(2).join("/") };
  }
  if (parts.length === 2) return { role: parts[0], outfit: "", tag: parts[1] };
  return { role: "", outfit: "", tag: parts[0] ?? "" };
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
    overlayHidden: false,
    recentFloors: RECENT_FLOORS_DEFAULT,
    phone: { x: 24, y: 320, open: false },
    showPhone: true,
    autoSwitch: false,
    autoSwitchSeconds: 3,
    multiRole: false,
    multiRolePromptMode: "full",
    spriteCount: SPRITE_COUNT_DEFAULT,
    injectionDepth: INJECTION_DEPTH_DEFAULT,
    promptTemplate: "",
    imgbbApiKey: "",
    autoUpload: false,
    packs: [],
    bindings: [],
    apps: {}
  };
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
var NAME_SEPARATOR = /[_\-–—\s]+/;
function stripExt(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}
function parseSpriteFileName(fileName) {
  const base = stripExt(fileName).trim();
  const parts = splitAtMost(base, NAME_SEPARATOR, 3);
  if (parts.length >= 3) {
    const role = normalizeTag(parts[0]);
    const outfit = normalizeTag(parts[1]);
    const tag = normalizeTag(parts[2]);
    if (role && outfit && tag) return { role, outfit, tag };
    if (role && tag) return { role, outfit: "", tag };
    return { role: "", outfit: "", tag: fileNameToTag(base) };
  }
  if (parts.length === 2) {
    const role = normalizeTag(parts[0]);
    const tag = normalizeTag(parts[1]);
    if (role && tag) return { role, outfit: "", tag };
    return { role: "", outfit: "", tag: fileNameToTag(base) };
  }
  return { role: "", outfit: "", tag: fileNameToTag(base) };
}
function splitAtMost(text, sep, n) {
  const out = [];
  let rest = text;
  const single = new RegExp(sep.source);
  while (out.length < n - 1) {
    const m = single.exec(rest);
    if (!m || m.index < 0) break;
    out.push(rest.slice(0, m.index));
    rest = rest.slice(m.index + m[0].length);
  }
  out.push(rest);
  return out;
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

// core/address-policy.ts
function addressConflictKey(address) {
  return JSON.stringify([address.role, address.outfit, address.tag]);
}
function effectiveSpriteAddress(pack, sprite, multiPack) {
  const outfit = spriteOutfit(pack, sprite);
  const semanticRole = (sprite.group ?? "").trim() || (pack.roleName ?? "").trim();
  const role = semanticRole || (multiPack || outfit ? normalizeTag(pack.name) : "");
  return { role, outfit, tag: sprite.tag };
}
function findAddressConflicts(packs) {
  const multiPack = packs.length > 1;
  const grouped = /* @__PURE__ */ new Map();
  for (const pack of packs) {
    for (const sprite of pack.sprites) {
      const address = effectiveSpriteAddress(pack, sprite, multiPack);
      const key = addressConflictKey(address);
      let entry = grouped.get(key);
      if (!entry) {
        entry = { address, owners: /* @__PURE__ */ new Map() };
        grouped.set(key, entry);
      }
      if (!entry.owners.has(pack.id)) {
        entry.owners.set(pack.id, {
          packId: pack.id,
          packName: pack.name,
          spriteUrl: sprite.url
        });
      }
    }
  }
  const conflicts = [];
  for (const [key, entry] of grouped) {
    if (entry.owners.size < 2) continue;
    conflicts.push({
      key,
      address: entry.address,
      formattedAddress: formatAddress(entry.address),
      owners: [...entry.owners.values()]
    });
  }
  return conflicts;
}

// core/sprite-store.ts
function genId() {
  return `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function getActivePacks(settings, characterName) {
  const binding = settings.bindings.find((b) => b.characterName === characterName && b.enabled);
  if (!binding) return [];
  const byId = new Map(settings.packs.map((p) => [p.id, p]));
  return binding.packIds.map((id) => byId.get(id)).filter((p) => p != null);
}
function packBaseAlias(pack) {
  return normalizeTag(pack.name ?? "") || "包";
}
function getActiveAddresses(settings, characterName) {
  const packs = getActivePacks(settings, characterName);
  const conflicted = new Set(findAddressConflicts(packs).map((conflict) => conflict.key));
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const c of flatten(packs)) {
    const address = { role: c.role, outfit: c.outfit, tag: c.sprite.tag };
    if (conflicted.has(addressConflictKey(address))) continue;
    const key = formatAddress(address);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(address);
  }
  return out;
}
function spriteGroup(sprite) {
  return sprite.group ?? "";
}
function spriteOutfitTag(sprite) {
  return sprite.outfit ?? "";
}
function effectiveRole(pack, group) {
  return group.trim() || (pack.roleName ?? "").trim();
}
function effectiveOutfitOf(pack, outfit) {
  return outfit.trim() || (pack.outfit ?? "").trim();
}
function normalizeIdentityFields(pack, sprite) {
  const next = { ...sprite };
  if ((next.group ?? "").trim() === (pack.roleName ?? "").trim()) delete next.group;
  if ((next.outfit ?? "").trim() === (pack.outfit ?? "").trim()) delete next.outfit;
  return next;
}
function sameIdentity(pack, s, tag, group, outfit) {
  return s.tag === tag && effectiveRole(pack, spriteGroup(s)) === effectiveRole(pack, group) && effectiveOutfitOf(pack, spriteOutfitTag(s)) === effectiveOutfitOf(pack, outfit);
}
function identityKey(pack, sprite) {
  return JSON.stringify([
    effectiveRole(pack, spriteGroup(sprite)),
    effectiveOutfitOf(pack, spriteOutfitTag(sprite)),
    sprite.tag
  ]);
}
function dedupeSprites(pack, sprites) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const raw of sprites) {
    const sprite = normalizeIdentityFields(pack, raw);
    const key = identityKey(pack, sprite);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sprite);
  }
  return out;
}
function previewBindingAddressChanges(before, after, characterName) {
  const oldAddresses = getActiveAddresses(before, characterName).map(formatAddress);
  const newAddresses = getActiveAddresses(after, characterName).map(formatAddress);
  const oldSet = new Set(oldAddresses);
  const newSet = new Set(newAddresses);
  return {
    removed: oldAddresses.filter((address) => !newSet.has(address)),
    added: newAddresses.filter((address) => !oldSet.has(address))
  };
}
function getGroups(pack) {
  const seen = [];
  for (const s of pack.sprites) {
    const g = spriteGroup(s);
    if (g && !seen.includes(g)) seen.push(g);
  }
  return seen;
}
function flatten(packs) {
  const multiPack = packs.length > 1;
  const out = [];
  for (const pack of packs) {
    const base = packBaseAlias(pack);
    for (const sprite of pack.sprites) {
      const address = effectiveSpriteAddress(pack, sprite, multiPack);
      out.push({
        pack,
        sprite,
        role: address.role,
        outfit: address.outfit,
        baseAlias: base
      });
    }
  }
  return out;
}
function nameMatches(actual, query) {
  if (actual === query) return true;
  return actual.length > 0 && (actual.includes(query) || query.includes(actual));
}
function filterByName(pool, query, of) {
  const exact = pool.filter((c) => of(c) === query);
  if (exact.length > 0) return exact;
  return pool.filter((c) => nameMatches(of(c), query));
}
function lockByRole(pool, query) {
  if (/[@=]/.test(query)) return [];
  const roleMatches = filterByName(pool, query, (c) => c.role);
  if (roleMatches.length > 0) return roleMatches;
  return filterByName(pool, query, (c) => c.baseAlias);
}
function matchUniqueTagInPool(pool, tag) {
  const exact = pool.filter((c) => c.sprite.tag === tag);
  if (exact.length === 1) return exact[0].sprite;
  if (exact.length > 1) {
    const packIds = new Set(exact.map((c) => c.pack.id));
    return packIds.size === 1 ? exact[0].sprite : null;
  }
  const fuzzy = pool.filter((c) => nameMatches(c.sprite.tag, tag));
  if (fuzzy.length === 1) return fuzzy[0].sprite;
  if (fuzzy.length > 1) {
    const packIds = new Set(fuzzy.map((c) => c.pack.id));
    return packIds.size === 1 ? fuzzy[0].sprite : null;
  }
  return null;
}
function resolveSprite(packs, address) {
  const raw = address.trim();
  if (!raw) return null;
  const { role, outfit, tag } = parseAddress(raw);
  if (!tag) return null;
  let pool = flatten(packs);
  if (role) {
    pool = lockByRole(pool, role);
    if (pool.length === 0) return null;
    if (!outfit) {
      pool = pool.filter((c) => c.outfit === "");
      if (pool.length === 0) return null;
    }
  }
  if (outfit) {
    pool = filterByName(pool, outfit, (c) => c.outfit);
    if (pool.length === 0) return null;
  }
  return matchUniqueTagInPool(pool, tag);
}
function resolveSprites(packs, addresses) {
  const out = [];
  for (const address of addresses) {
    const sprite = resolveSprite(packs, address);
    if (sprite && out[out.length - 1] !== sprite) out.push(sprite);
  }
  return out;
}
function success(settings) {
  return { ok: true, settings };
}
function conflictsForBinding(settings, characterName, packIds) {
  const byId = new Map(settings.packs.map((pack) => [pack.id, pack]));
  const packs = packIds.map((id) => byId.get(id)).filter((pack) => pack != null);
  return findAddressConflicts(packs).map((conflict) => ({ ...conflict, characterName }));
}
function uniquePackIds(packIds) {
  const ids = [];
  for (const id of packIds) if (id && !ids.includes(id)) ids.push(id);
  return ids;
}
function withBinding(settings, characterName, packIds, enabled) {
  const others = settings.bindings.filter((binding) => binding.characterName !== characterName);
  if (packIds.length === 0) return { ...settings, bindings: others };
  return {
    ...settings,
    bindings: [...others, { characterName, packIds, enabled }]
  };
}
function upsertPack(settings, pack) {
  const exists = settings.packs.some((p) => p.id === pack.id);
  const next = {
    ...settings,
    packs: exists ? settings.packs.map((p) => p.id === pack.id ? pack : p) : [...settings.packs, pack]
  };
  const conflicts = [];
  for (const binding of next.bindings) {
    if (!binding.enabled || !binding.packIds.includes(pack.id)) continue;
    conflicts.push(...conflictsForBinding(next, binding.characterName, binding.packIds));
  }
  return conflicts.length > 0 ? { ok: false, conflicts } : success(next);
}
function removePack(settings, packId) {
  const bindings = settings.bindings.map((b) => ({ ...b, packIds: b.packIds.filter((id) => id !== packId) })).filter((b) => b.packIds.length > 0);
  return {
    ...settings,
    packs: settings.packs.filter((p) => p.id !== packId),
    bindings
  };
}
function bindPack(settings, characterName, packId) {
  const existing = settings.bindings.find((b) => b.characterName === characterName);
  const ids = uniquePackIds([...existing?.packIds ?? [], packId]);
  const conflicts = conflictsForBinding(settings, characterName, ids);
  if (conflicts.length > 0) return { ok: false, conflicts };
  return success(withBinding(settings, characterName, ids, true));
}
function unbindPack(settings, characterName, packId) {
  const bindings = settings.bindings.map(
    (b) => b.characterName === characterName ? { ...b, packIds: b.packIds.filter((id) => id !== packId) } : b
  ).filter((b) => b.packIds.length > 0);
  return { ...settings, bindings };
}
function setBinding(settings, characterName, packIds) {
  const ids = uniquePackIds(packIds);
  const conflicts = conflictsForBinding(settings, characterName, ids);
  if (conflicts.length > 0) return { ok: false, conflicts };
  const prev = settings.bindings.find((b) => b.characterName === characterName);
  return success(withBinding(settings, characterName, ids, prev?.enabled ?? true));
}
function reorderBinding(settings, characterName, fromIndex, toIndex) {
  return {
    ...settings,
    bindings: settings.bindings.map((b) => {
      if (b.characterName !== characterName) return b;
      const ids = [...b.packIds];
      if (fromIndex < 0 || fromIndex >= ids.length || toIndex < 0 || toIndex >= ids.length) return b;
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, moved);
      return { ...b, packIds: ids };
    })
  };
}
function touchPack(pack, sprites) {
  return { ...pack, sprites, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function upsertSprite(pack, sprite) {
  const stored = normalizeIdentityFields(pack, sprite);
  const g = spriteGroup(stored);
  const o = spriteOutfitTag(stored);
  const sprites = [];
  let replaced = false;
  for (const current of pack.sprites) {
    if (sameIdentity(pack, current, stored.tag, g, o)) {
      if (!replaced) {
        sprites.push(stored);
        replaced = true;
      }
      continue;
    }
    sprites.push(current);
  }
  if (!replaced) sprites.push(stored);
  return touchPack(pack, dedupeSprites(pack, sprites));
}
function removeSprite(pack, tag, group = "", outfit = "") {
  const next = touchPack(
    pack,
    pack.sprites.filter((s) => !sameIdentity(pack, s, tag, group, outfit))
  );
  if (next.coverTag === tag && !next.sprites.some((s) => s.tag === tag)) delete next.coverTag;
  return next;
}
function renameSprite(pack, oldTag, newTagRaw, group = "", outfit = "") {
  const newTag = normalizeTag(newTagRaw);
  if (!newTag) throw new Error("表情名不能为空，且不能包含 [ ] / : | = @ 等符号");
  if (newTag === oldTag) return pack;
  if (pack.sprites.some((s) => sameIdentity(pack, s, newTag, group, outfit))) {
    throw new Error(`表情名「${newTag}」在该分组中已存在`);
  }
  const sprites = pack.sprites.map(
    (s) => sameIdentity(pack, s, oldTag, group, outfit) ? { ...s, tag: newTag } : s
  );
  const next = touchPack(pack, sprites);
  if (next.coverTag === oldTag) next.coverTag = newTag;
  return next;
}
function setSpriteGroup(pack, tag, fromGroup, toGroupRaw, outfit = "") {
  const toGroup = normalizeTag(toGroupRaw);
  const sources = new Set(
    pack.sprites.filter((s) => sameIdentity(pack, s, tag, fromGroup, outfit))
  );
  if (pack.sprites.some(
    (s) => !sources.has(s) && sameIdentity(pack, s, tag, toGroup, outfit)
  )) {
    throw new Error(`分组「${toGroup || "未分组"}」中已存在表情「${tag}」`);
  }
  const sprites = pack.sprites.map((s) => {
    if (!sources.has(s)) return s;
    const next = { ...s };
    if (toGroup) next.group = toGroup;
    else delete next.group;
    return normalizeIdentityFields(pack, next);
  });
  return touchPack(pack, dedupeSprites(pack, sprites));
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
  const binding = settings.bindings.find((item) => item.characterName === characterName);
  if (enabled && binding) {
    const conflicts = conflictsForBinding(settings, characterName, binding.packIds);
    if (conflicts.length > 0) return { ok: false, conflicts };
  }
  return success({
    ...settings,
    bindings: settings.bindings.map(
      (b) => b.characterName === characterName ? { ...b, enabled } : b
    )
  });
}

// core/sprite-preload.ts
var PRELOAD_ON_ACTIVATE_MAX = 4;
var PRELOAD_MATCH_MAX = 10;
function preloadSprites(sprites, max) {
  if (typeof Image === "undefined" || max <= 0) return;
  const seen = /* @__PURE__ */ new Set();
  let loaded = 0;
  for (const sprite of sprites) {
    const url = sprite.url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = url;
    loaded++;
    if (loaded >= max) break;
  }
}
function preloadOnActivate(packs) {
  const firstSprites = [];
  for (const pack of packs) {
    const first = pack.sprites[0];
    if (first) firstSprites.push(first);
  }
  preloadSprites(firstSprites, PRELOAD_ON_ACTIVATE_MAX);
}
function preloadMatchedSprites(sprites) {
  preloadSprites(sprites, PRELOAD_MATCH_MAX);
}

// core/phone-registry.ts
function createPhoneAppContext(deps) {
  return {
    getSettings: () => deps.getSettings(),
    updateSettings: (next) => deps.updateSettings(next),
    getCharacterName: () => deps.getCharacterName(),
    getAppData: () => deps.getSettings().apps[deps.appId],
    setAppData: (data) => deps.saveSettingsOnly({
      ...deps.getSettings(),
      apps: { ...deps.getSettings().apps, [deps.appId]: data }
    }),
    goHome: deps.goHome
  };
}
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
  const closeBtn = document.createElement("div");
  closeBtn.className = "so-phone-close";
  closeBtn.textContent = "✕";
  closeBtn.title = "收起手机";
  closeBtn.setAttribute("role", "button");
  closeBtn.setAttribute("aria-label", "收起手机");
  closeBtn.tabIndex = 0;
  const collapse = () => {
    leaveApp();
    commitState({ ...state, open: false });
  };
  closeBtn.addEventListener("click", collapse);
  closeBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      collapse();
    }
  });
  statusBar2.append(backBtn, statusTitle, clock, closeBtn);
  const screen = document.createElement("div");
  screen.className = "so-phone-screen";
  const homeBar = document.createElement("div");
  homeBar.className = "so-phone-homebar";
  const homeBtn = document.createElement("div");
  homeBtn.className = "so-phone-homebtn";
  homeBtn.title = "返回主屏";
  homeBtn.setAttribute("role", "button");
  homeBtn.setAttribute("aria-label", "返回主屏");
  homeBtn.tabIndex = 0;
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
  function viewportSize() {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    return {
      w: Math.round(vv?.width ?? window.innerWidth),
      h: Math.round(vv?.height ?? window.innerHeight)
    };
  }
  function applyLayout() {
    if (hidden) {
      fab.style.display = "none";
      shell.style.display = "none";
      return;
    }
    const { w: vw, h: vh } = viewportSize();
    const clampedX = Math.max(0, Math.min(state.x, vw - 56));
    const clampedY = Math.max(0, Math.min(state.y, vh - 56));
    fab.style.left = `${clampedX}px`;
    fab.style.top = `${clampedY}px`;
    fab.style.display = state.open ? "none" : "flex";
    shell.style.display = state.open ? "flex" : "none";
    if (state.open) {
      const shellW = Math.min(320, vw - 16);
      const shellH = Math.min(580, vh - 16);
      shell.style.width = `${shellW}px`;
      shell.style.height = `${shellH}px`;
      shell.style.left = `${Math.max(8, Math.min(clampedX, vw - shellW - 8))}px`;
      shell.style.top = `${Math.max(8, Math.min(clampedY, vh - shellH - 8))}px`;
    }
  }
  applyLayout();
  window.addEventListener("resize", applyLayout);
  window.visualViewport?.addEventListener("resize", applyLayout);
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
        const swallowGhostClick = (e) => {
          e.stopPropagation();
          e.preventDefault();
        };
        window.addEventListener("click", swallowGhostClick, { capture: true, once: true });
        setTimeout(
          () => window.removeEventListener("click", swallowGhostClick, { capture: true }),
          400
        );
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
    }
  };
  homeBtn.addEventListener("click", onHomePress);
  homeBtn.addEventListener("keydown", (e) => {
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
      const wasOpen = state.open;
      state = { ...next };
      if (wasOpen && !state.open) leaveApp();
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
      if (hidden) leaveApp();
      applyLayout();
      if (!hidden && state.open) renderScreen();
    },
    destroy() {
      clearInterval(clockTimer);
      window.removeEventListener("resize", applyLayout);
      window.visualViewport?.removeEventListener("resize", applyLayout);
      unsubscribe();
      leaveApp();
      fab.remove();
      shell.remove();
    }
  };
}

// core/share-code.ts
var SHARE_PREFIX = "stpack1:";
var SHARE_PREFIX_V2 = "stpack2:";
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
function decodeShareString(raw) {
  const text = raw.trim();
  if (text.indexOf(SHARE_PREFIX_V2) !== -1) return decodeShareStringV2(text);
  return decodeShareStringV1(text);
}
function decodeShareStringV1(raw) {
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
function shareableUrl(sprite) {
  if (sprite.remoteUrl && /^https?:\/\//.test(sprite.remoteUrl)) return sprite.remoteUrl;
  if (/^https?:\/\//.test(sprite.url)) return sprite.url;
  return null;
}
function encodeShareStringV2(pack) {
  const entries = [];
  const missing = [];
  for (const sprite of pack.sprites) {
    const addr = formatAddress(spriteAddress(pack, sprite));
    const url = shareableUrl(sprite);
    if (!url) {
      missing.push(addr);
      continue;
    }
    entries.push(`${addr}=${url}`);
  }
  if (entries.length === 0) return null;
  const segments = [sanitizePackName(pack.name) || "分享立绘包"];
  if (pack.author) segments.push(`@author=${sanitizePackName(pack.author)}`);
  segments.push(...entries);
  return {
    text: SHARE_PREFIX_V2 + segments.join("|"),
    included: entries.length,
    total: pack.sprites.length,
    missing
  };
}
function decodeShareStringV2(raw) {
  const text = raw.trim();
  const prefixIndex = text.indexOf(SHARE_PREFIX_V2);
  if (prefixIndex === -1) {
    throw new Error(`导入失败：没有找到 ${SHARE_PREFIX_V2} 开头的分享串`);
  }
  const body = text.slice(prefixIndex + SHARE_PREFIX_V2.length).trim();
  const segments = body.split("|");
  const name = sanitizePackName(segments[0] ?? "") || "分享立绘包";
  let author;
  const sprites = [];
  const seen = /* @__PURE__ */ new Set();
  for (const segment of segments.slice(1)) {
    const part = segment.trim();
    if (!part) continue;
    if (part.startsWith("@")) {
      const eq2 = part.indexOf("=");
      if (eq2 === -1) continue;
      const key2 = part.slice(1, eq2).trim().toLowerCase();
      const value = part.slice(eq2 + 1).trim();
      if (key2 === "author") author = sanitizePackName(value) || void 0;
      continue;
    }
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const addr = part.slice(0, eq).trim();
    const url = part.slice(eq + 1).trim();
    if (!/^https?:\/\//.test(url)) continue;
    const { role, outfit, tag: rawTag } = parseAddress(addr);
    const tag = normalizeTag(rawTag);
    const cleanRole = normalizeTag(role);
    const cleanOutfit = normalizeTag(outfit);
    if (!tag) continue;
    const key = `${cleanRole}|${cleanOutfit}|${tag}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const code = extractImageCode(url) ?? void 0;
    sprites.push({
      tag,
      url,
      remoteUrl: url,
      ...code ? { code } : {},
      ...cleanRole ? { group: cleanRole } : {},
      ...cleanOutfit ? { outfit: cleanOutfit } : {}
    });
  }
  if (sprites.length === 0) {
    throw new Error("导入失败：分享串中没有可用的「地址=URL」条目");
  }
  const commonRole = sprites.every((s) => (s.group ?? "") === (sprites[0].group ?? "")) ? sprites[0].group ?? "" : "";
  const commonOutfit = sprites.every((s) => (s.outfit ?? "") === (sprites[0].outfit ?? "")) ? sprites[0].outfit ?? "" : "";
  for (const s of sprites) {
    if (commonRole) delete s.group;
    if (commonOutfit) delete s.outfit;
  }
  return {
    id: genId(),
    name,
    author,
    ...commonRole ? { roleName: commonRole } : {},
    ...commonOutfit ? { outfit: commonOutfit } : {},
    sprites,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
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
    overlayHidden: typeof raw.overlayHidden === "boolean" ? raw.overlayHidden : defaults.overlayHidden,
    recentFloors: typeof raw.recentFloors === "number" && Number.isFinite(raw.recentFloors) ? Math.min(RECENT_FLOORS_MAX, Math.max(RECENT_FLOORS_MIN, Math.round(raw.recentFloors))) : defaults.recentFloors,
    phone: migratePhone(raw.phone, defaults.phone),
    showPhone: typeof raw.showPhone === "boolean" ? raw.showPhone : defaults.showPhone,
    autoSwitch: typeof raw.autoSwitch === "boolean" ? raw.autoSwitch : defaults.autoSwitch,
    autoSwitchSeconds: typeof raw.autoSwitchSeconds === "number" && Number.isFinite(raw.autoSwitchSeconds) ? Math.min(60, Math.max(1, Math.round(raw.autoSwitchSeconds))) : defaults.autoSwitchSeconds,
    multiRole: typeof raw.multiRole === "boolean" ? raw.multiRole : defaults.multiRole,
    multiRolePromptMode: raw.multiRolePromptMode === "full" || raw.multiRolePromptMode === "repeat" ? raw.multiRolePromptMode : defaults.multiRolePromptMode,
    spriteCount: typeof raw.spriteCount === "number" && Number.isFinite(raw.spriteCount) ? Math.min(SPRITE_COUNT_MAX, Math.max(SPRITE_COUNT_MIN, Math.round(raw.spriteCount))) : defaults.spriteCount,
    injectionDepth: typeof raw.injectionDepth === "number" && Number.isFinite(raw.injectionDepth) ? Math.min(INJECTION_DEPTH_MAX, Math.max(INJECTION_DEPTH_MIN, Math.round(raw.injectionDepth))) : defaults.injectionDepth,
    promptTemplate: typeof raw.promptTemplate === "string" ? raw.promptTemplate : defaults.promptTemplate,
    imgbbApiKey: typeof raw.imgbbApiKey === "string" ? raw.imgbbApiKey : defaults.imgbbApiKey,
    autoUpload: typeof raw.autoUpload === "boolean" ? raw.autoUpload : defaults.autoUpload,
    packs: Array.isArray(raw.packs) ? raw.packs.flatMap((p) => migratePack(p) ?? []) : [],
    bindings: Array.isArray(raw.bindings) ? raw.bindings.flatMap((b) => migrateBinding(b) ?? []) : [],
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
function migrateBinding(raw) {
  if (!raw || typeof raw !== "object") return null;
  const b = raw;
  if (typeof b.characterName !== "string" || !b.characterName) return null;
  const ids = [];
  if (Array.isArray(b.packIds)) {
    for (const id of b.packIds) if (typeof id === "string" && id && !ids.includes(id)) ids.push(id);
  }
  if (typeof b.packId === "string" && b.packId && !ids.includes(b.packId)) ids.push(b.packId);
  if (ids.length === 0) return null;
  return {
    characterName: b.characterName,
    packIds: ids,
    enabled: typeof b.enabled === "boolean" ? b.enabled : true
  };
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
    const outfit2 = typeof s.outfit === "string" ? normalizeTag(s.outfit) : "";
    const remoteUrl = typeof s.remoteUrl === "string" && /^https?:\/\//.test(s.remoteUrl) ? s.remoteUrl : "";
    return [
      {
        tag,
        url: s.url,
        ...code ? { code } : {},
        ...group ? { group } : {},
        ...outfit2 ? { outfit: outfit2 } : {},
        ...remoteUrl ? { remoteUrl } : {}
      }
    ];
  });
  const roleName = typeof p.roleName === "string" ? normalizeTag(p.roleName) : "";
  const outfit = typeof p.outfit === "string" ? normalizeTag(p.outfit) : "";
  return {
    id: p.id,
    name,
    ...typeof p.author === "string" && p.author ? { author: p.author } : {},
    ...typeof p.description === "string" && p.description ? { description: p.description } : {},
    ...roleName ? { roleName } : {},
    ...outfit ? { outfit } : {},
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
  injectPrompt(prompt, depth = INJECTION_DEPTH_DEFAULT) {
    const ctx = getContext();
    ctx.setExtensionPrompt(MODULE_NAME, prompt, 1, depth);
  }
  injectChannel(channel, prompt, depth = INJECTION_DEPTH_DEFAULT) {
    const ctx = getContext();
    ctx.setExtensionPrompt(`st-stage::${channel}`, prompt, 1, depth);
  }
  onMessageReceived(handler) {
    const ctx = getContext();
    const eventName = ctx.eventTypes?.MESSAGE_RECEIVED ?? ctx.event_types?.MESSAGE_RECEIVED ?? "message_received";
    const wrapped = (...args) => {
      try {
        const messageId = args[0];
        const chat = getContext().chat;
        const idNum = typeof messageId === "number" ? messageId : typeof messageId === "string" && messageId.trim() !== "" ? Number(messageId) : NaN;
        const message = Number.isInteger(idNum) && idNum >= 0 && idNum < chat.length ? chat[idNum] : chat[chat.length - 1];
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
function createOverlay(initialLayout, onLayoutChange, onManage, onClose) {
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
  const closeBtn = document.createElement("div");
  closeBtn.className = "sprite-overlay-close";
  closeBtn.title = "关闭悬浮窗（立绘功能不受影响，可在手机「立绘」App 重新打开）";
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("role", "button");
  closeBtn.setAttribute("aria-label", "关闭悬浮窗");
  closeBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClose?.();
  });
  frame.append(img, placeholder, tagBadge, dots, gearBtn, closeBtn, resizeHandle);
  root.append(frame);
  document.body.append(root);
  function applyLayout() {
    const w = Math.min(layout.width, Math.max(100, window.innerWidth - 16));
    root.style.width = `${w}px`;
    const h = Math.min(root.offsetHeight || 48, window.innerHeight - 8);
    root.style.left = `${Math.max(0, Math.min(layout.x, window.innerWidth - w))}px`;
    root.style.top = `${Math.max(0, Math.min(layout.y, window.innerHeight - h))}px`;
  }
  applyLayout();
  window.addEventListener("resize", applyLayout);
  window.visualViewport?.addEventListener("resize", applyLayout);
  img.addEventListener("load", applyLayout);
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
      window.visualViewport?.removeEventListener("resize", applyLayout);
      root.remove();
    }
  };
}

// core/pack-merge.ts
var PackMergeChoiceError = class extends Error {
  constructor() {
    super(...arguments);
    this.name = "PackMergeChoiceError";
  }
};
function mergeAddress(pack, sprite) {
  return {
    role: (sprite.group ?? "").trim() || (pack.roleName ?? "").trim(),
    outfit: spriteOutfit(pack, sprite),
    tag: sprite.tag
  };
}
function buildGroups(packs) {
  const groups = /* @__PURE__ */ new Map();
  for (const pack of packs) {
    for (const sprite of pack.sprites) {
      const address = mergeAddress(pack, sprite);
      const key = addressConflictKey(address);
      let group = groups.get(key);
      if (!group) {
        group = { key, address, candidates: [] };
        groups.set(key, group);
      }
      group.candidates.push({
        sourcePackId: pack.id,
        sourcePackName: pack.name,
        address,
        sprite
      });
    }
  }
  return [...groups.values()];
}
function isAutomatic(group) {
  return new Set(group.candidates.map((candidate) => candidate.sprite.url)).size <= 1;
}
function previewPackMerge(packs) {
  const names = packs.map((pack) => pack.name.trim()).filter(Boolean);
  const sameName = new Set(names).size < names.length;
  const automatic = [];
  const conflicts = [];
  let overlapCount = 0;
  for (const group of buildGroups(packs)) {
    if (group.candidates.length > 1) overlapCount++;
    if (isAutomatic(group)) automatic.push(group.candidates[0]);
    else conflicts.push({ key: group.key, address: group.address, candidates: group.candidates });
  }
  return { sameName, overlapCount, automatic, conflicts };
}
function inspectPackImport(existing, incoming) {
  return {
    sameName: existing.name.trim() === incoming.name.trim(),
    conflicts: findAddressConflicts([existing, incoming])
  };
}
function commonNonEmpty(values) {
  if (values.length === 0 || !values[0]) return "";
  return values.every((value) => value === values[0]) ? values[0] : "";
}
function validateChoicesForGroups(groups, choices) {
  const conflicts = groups.filter((group) => !isAutomatic(group));
  const conflictByKey = new Map(conflicts.map((group) => [group.key, group]));
  const choiceByKey = /* @__PURE__ */ new Map();
  for (const choice of choices) {
    const group = conflictByKey.get(choice.key);
    if (!group) {
      throw new PackMergeChoiceError(`未知冲突选择 key：${choice.key}`);
    }
    if (choiceByKey.has(choice.key)) {
      throw new PackMergeChoiceError(`地址「${group.address.tag}」存在重复选择`);
    }
    if (!Number.isSafeInteger(choice.candidateIndex) || choice.candidateIndex < 0 || choice.candidateIndex >= group.candidates.length) {
      throw new PackMergeChoiceError(`地址「${group.address.tag}」的候选序号无效`);
    }
    choiceByKey.set(choice.key, choice.candidateIndex);
  }
  for (const group of conflicts) {
    if (!choiceByKey.has(group.key)) {
      throw new PackMergeChoiceError(`地址「${group.address.tag}」的冲突图片尚未选择`);
    }
  }
  return choiceByKey;
}
function validatePackMergeChoices(packs, choices) {
  validateChoicesForGroups(buildGroups(packs), choices);
}
function applyPackMerge(packs, choices, result) {
  const groups = buildGroups(packs);
  const choiceByKey = validateChoicesForGroups(groups, choices);
  const selected = [];
  for (const group of groups) {
    if (isAutomatic(group)) {
      selected.push(group.candidates[0]);
      continue;
    }
    selected.push(group.candidates[choiceByKey.get(group.key)]);
  }
  const commonRole = commonNonEmpty(selected.map((candidate) => candidate.address.role));
  const commonOutfit = commonNonEmpty(selected.map((candidate) => candidate.address.outfit));
  const sprites = selected.map((candidate) => {
    const sprite = { ...candidate.sprite };
    delete sprite.group;
    delete sprite.outfit;
    if (!commonRole && candidate.address.role) sprite.group = candidate.address.role;
    if (!commonOutfit && candidate.address.outfit) sprite.outfit = candidate.address.outfit;
    return sprite;
  });
  const first = packs[0];
  const coverTag = first?.coverTag && sprites.some((sprite) => sprite.tag === first.coverTag) ? first.coverTag : sprites[0]?.tag;
  return {
    id: result.id,
    name: result.name,
    ...first?.author ? { author: first.author } : {},
    ...first?.description ? { description: first.description } : {},
    ...commonRole ? { roleName: commonRole } : {},
    ...commonOutfit ? { outfit: commonOutfit } : {},
    ...coverTag ? { coverTag } : {},
    sprites,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
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
async function recompressDataUri(dataUri, options = {}) {
  if (typeof document === "undefined") return dataUri;
  const mime = /^data:([^;,]+)/.exec(dataUri)?.[1] ?? "";
  if (!mime.startsWith("image/")) return dataUri;
  if (mime === "image/webp" || mime === "image/gif" || mime === "image/svg+xml") return dataUri;
  try {
    const blob = await (await fetch(dataUri)).blob();
    return (await compressImage(blob, options)).dataUri;
  } catch {
    return dataUri;
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

// core/pack-io.ts
async function exportPack(pack, embedHosted = false) {
  const sprites = [];
  for (const sprite of pack.sprites) {
    const source = getSpriteSource(sprite);
    const extra = {
      ...remoteField(sprite),
      ...sprite.group ? { group: sprite.group } : {},
      ...sprite.outfit ? { outfit: sprite.outfit } : {}
    };
    if (source === "embedded") {
      sprites.push({ tag: sprite.tag, data: await recompressDataUri(sprite.url), ...extra });
    } else if (source === "local" || embedHosted) {
      try {
        const data = await recompressDataUri(await urlToDataUri(sprite.url));
        sprites.push({ tag: sprite.tag, data, ...extra });
      } catch {
        sprites.push({ tag: sprite.tag, url: sprite.url, ...codeField(sprite.url, sprite.code), ...extra });
      }
    } else {
      sprites.push({ tag: sprite.tag, url: sprite.url, ...codeField(sprite.url, sprite.code), ...extra });
    }
  }
  return {
    format: "sprite-pack@2",
    name: pack.name,
    author: pack.author,
    description: pack.description,
    ...pack.roleName ? { roleName: pack.roleName } : {},
    ...pack.outfit ? { outfit: pack.outfit } : {},
    coverTag: pack.coverTag,
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    sprites
  };
}
function codeField(url, code) {
  const resolved = code ?? extractImageCode(url);
  return resolved ? { code: resolved } : {};
}
function remoteField(sprite) {
  const r = sprite.remoteUrl;
  return r && /^https:\/\/.+/i.test(r) ? { remoteUrl: r } : {};
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
    const outfit2 = typeof item.outfit === "string" ? normalizeTag(item.outfit) : "";
    const key = `${group}|${outfit2}|${tag}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const code = typeof item.code === "string" && item.code ? item.code : extractImageCode(url) ?? void 0;
    const remoteUrl = typeof item.remoteUrl === "string" && /^https?:\/\/.+/i.test(item.remoteUrl) ? item.remoteUrl : "";
    sprites.push({
      tag,
      url,
      ...code ? { code } : {},
      ...remoteUrl ? { remoteUrl } : {},
      ...group ? { group } : {},
      ...outfit2 ? { outfit: outfit2 } : {}
    });
  }
  if (sprites.length === 0) {
    throw new Error("导入失败：没有可用的立绘条目（表情名可能全部为空或重复）");
  }
  const normalizedCover = typeof file.coverTag === "string" ? normalizeTag(file.coverTag) : "";
  const coverTag = sprites.some((s) => s.tag === normalizedCover) ? normalizedCover : void 0;
  const roleName = typeof file.roleName === "string" ? normalizeTag(file.roleName) : "";
  const outfit = typeof file.outfit === "string" ? normalizeTag(file.outfit) : "";
  return {
    id: genId(),
    name: sanitizePackName(file.name) || "导入立绘包",
    author: typeof file.author === "string" ? sanitizePackName(file.author) || void 0 : void 0,
    description: typeof file.description === "string" ? sanitizeDescription(file.description) || void 0 : void 0,
    ...roleName ? { roleName } : {},
    ...outfit ? { outfit } : {},
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

// core/pack-split.ts
function previewGroupSplit(pack) {
  const groups = /* @__PURE__ */ new Map();
  for (const s of pack.sprites) {
    const g = (s.group ?? "").trim();
    if (!g) continue;
    const arr = groups.get(g) ?? [];
    arr.push(s);
    groups.set(g, arr);
  }
  if (groups.size < 2) return [];
  return [...groups.entries()].map(([roleName, sprites]) => ({
    roleName,
    packName: sanitizePackName(`${pack.name}·${roleName}`) || roleName,
    count: sprites.length,
    tags: sprites.map((s) => s.tag)
  }));
}
function splitPackByGroup(pack) {
  const preview = previewGroupSplit(pack);
  if (preview.length === 0) return [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return preview.map((item) => {
    const sprites = pack.sprites.filter((s) => (s.group ?? "").trim() === item.roleName).map((s) => {
      const next = { ...s };
      delete next.group;
      return next;
    });
    return {
      id: genId(),
      name: item.packName,
      author: pack.author,
      roleName: item.roleName,
      ...pack.outfit ? { outfit: pack.outfit } : {},
      sprites,
      updatedAt: now
    };
  });
}
function packNameFor(role, outfit, batchPackName) {
  if (role && outfit) return sanitizePackName(`${role}·${outfit}`) || `${role}·${outfit}`;
  if (role) return sanitizePackName(role) || role;
  return batchPackName;
}
function findPackFor(packs, role, outfit) {
  return packs.find(
    (p) => (p.roleName ?? "") === role && (p.outfit ?? "") === outfit && (role !== "" || outfit !== "")
  ) ?? null;
}
function autoRenameTag(taken, desired) {
  if (!taken.has(desired)) return desired;
  for (let i = 2; i < 1e3; i++) {
    const candidate = `${desired}_${i}`.slice(0, 20);
    if (!taken.has(candidate)) return candidate;
  }
  return `${desired}_${Date.now().toString(36)}`;
}
function planUploads(entries, packs, strategy, batchPackName, defaultPack) {
  const takenByPack = /* @__PURE__ */ new Map();
  const newPackKey = (role, outfit, name) => `new:${role}|${outfit}|${name}`;
  const keyTaken = (key, pack) => {
    let set = takenByPack.get(key);
    if (!set) {
      set = new Set(pack ? pack.sprites.map((s) => s.tag) : []);
      takenByPack.set(key, set);
    }
    return set;
  };
  const plans = [];
  for (const entry of entries) {
    const role = normalizeTag(entry.role);
    const outfit = normalizeTag(entry.outfit);
    const tag = normalizeTag(entry.tag);
    const roleless = !role && !outfit;
    const existing = roleless ? defaultPack ?? null : findPackFor(packs, role, outfit);
    const packName = existing ? existing.name : packNameFor(role, outfit, batchPackName);
    const key = existing ? `pack:${existing.id}` : newPackKey(role, outfit, packName);
    const taken = keyTaken(key, existing);
    const conflict = taken.has(tag);
    let finalTag = tag;
    let action = "add";
    if (conflict) {
      if (strategy === "skip") {
        action = "skip";
      } else if (strategy === "overwrite") {
        action = "overwrite";
      } else {
        finalTag = autoRenameTag(taken, tag);
        action = "add";
      }
    }
    if (action !== "skip") taken.add(finalTag);
    plans.push({
      entry: { fileName: entry.fileName, role, outfit, tag },
      targetPackId: existing?.id ?? null,
      targetPackName: packName,
      conflict,
      finalTag,
      action
    });
  }
  return plans;
}

// core/imgbb.ts
function isValidImgbbResult(result) {
  if (!result.url || !/^https:\/\/.+/i.test(result.url)) return false;
  if (!result.code) return false;
  return /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/.test(result.code) && !result.code.includes("..");
}
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
  const result = { url: json.data.url ?? "", code: json.data.image.filename ?? "" };
  if (!isValidImgbbResult(result)) {
    throw new Error("imgbb 返回无效：缺少合法的 HTTPS 直链或文件名");
  }
  return result;
}

// st-extension/src/sprite-manager.ts
function createSpriteManager(deps) {
  let backdrop = null;
  let view = { kind: "list" };
  let openedFrom = "overlay";
  let closeLightbox = null;
  function applyBackdropSize() {
    if (!backdrop) return;
    backdrop.style.left = "0";
    backdrop.style.top = "0";
    backdrop.style.width = `${window.innerWidth}px`;
    backdrop.style.height = `${window.innerHeight}px`;
  }
  function open(source = "overlay") {
    openedFrom = source;
    if (backdrop) {
      render3();
      return;
    }
    view = { kind: "list" };
    backdrop = el("div", "so-manager-backdrop");
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
      render3();
    };
    backBtn.addEventListener("click", goBack);
    backBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        goBack();
      }
    });
    const title = el("b", "so-manager-title");
    const actions = el("div", "so-manager-actions");
    const closeBtn = el("div", "menu_button so-manager-close");
    closeBtn.title = "关闭";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => close());
    header.append(backBtn, title, actions, closeBtn);
    const body = el("div", "so-manager-body");
    dialog.append(header, body);
    backdrop.append(dialog);
    document.body.append(backdrop);
    render3();
  }
  function onEscape(e) {
    if (e.key !== "Escape") return;
    if (backdrop?.querySelector(".so-lightbox")) return;
    if (backdrop?.querySelector(".so-popover")) {
      closePopovers();
      return;
    }
    if (view.kind === "pack") {
      view = { kind: "list" };
      render3();
    } else {
      close();
    }
  }
  function close() {
    if (!backdrop) return;
    closeLightbox?.();
    document.removeEventListener("keydown", onEscape);
    window.removeEventListener("resize", applyBackdropSize);
    backdrop.remove();
    backdrop = null;
    deps.onClosed?.(openedFrom);
  }
  function refreshIfOpen() {
    if (backdrop) render3();
  }
  function commit(next) {
    deps.updateSettings(next);
    render3();
  }
  function conflictText(conflicts) {
    return conflicts.slice(0, 3).map(
      (conflict) => `${conflict.characterName}：${conflict.formattedAddress}（${conflict.owners.map((owner) => owner.packName).join(" / ")}）`
    ).join("；");
  }
  function showConflicts(conflicts) {
    const message = `操作未生效，存在地址冲突：${conflictText(conflicts)}`;
    const body = backdrop?.querySelector(".so-manager-body");
    if (body) toast(body, message);
    else window.alert(message);
  }
  function rejectConflicts(conflicts) {
    render3();
    showConflicts(conflicts);
    return false;
  }
  function checkedSettings(result) {
    if (!result.ok) {
      showConflicts(result.conflicts);
      return null;
    }
    return result.settings;
  }
  function updateChecked(result) {
    const next = checkedSettings(result);
    if (!next) return false;
    deps.updateSettings(next);
    return true;
  }
  function commitChecked(result) {
    if (!result.ok) return rejectConflicts(result.conflicts);
    commit(result.settings);
    return true;
  }
  function rejectPackMergeError(error, body) {
    if (error instanceof PackMergeChoiceError) {
      toast(body, `合并已取消：选择无效（${error.message}）`);
      return null;
    }
    console.error("合并立绘包失败", error);
    toast(body, "合并失败，请查看控制台日志");
    return null;
  }
  function mergeWithPrompts(packs, defaultName, body) {
    const preview = previewPackMerge(packs);
    const choices = [];
    for (const conflict of preview.conflicts) {
      const options = conflict.candidates.map((candidate, index) => `${index + 1}. ${candidate.sourcePackName} — ${candidate.sprite.url}`).join("\n");
      const raw = window.prompt(
        `地址「${formatAddress(conflict.address)}」有不同图片，请输入要保留的序号：
${options}`,
        "1"
      );
      if (raw === null) return null;
      choices.push({ key: conflict.key, candidateIndex: Number(raw) - 1 });
    }
    try {
      validatePackMergeChoices(packs, choices);
    } catch (error) {
      return rejectPackMergeError(error, body);
    }
    const rawName = window.prompt("合并结果的包名：", defaultName);
    if (rawName === null) return null;
    const name = sanitizePackName(rawName);
    if (!name) {
      toast(body, "合并已取消：包名不能为空");
      return null;
    }
    try {
      return applyPackMerge(packs, choices, { id: genId(), name });
    } catch (error) {
      return rejectPackMergeError(error, body);
    }
  }
  function installImportedPack(pack, body) {
    const settings = deps.getSettings();
    const related = settings.packs.filter((existing) => {
      const inspection = inspectPackImport(existing, pack);
      return inspection.sameName || inspection.conflicts.length > 0;
    });
    if (related.length === 0) {
      if (!updateChecked(upsertPack(settings, pack))) return false;
      toast(body, `已导入立绘包「${pack.name}」（${pack.sprites.length} 张）`);
      return true;
    }
    const answer = window.prompt(
      `检测到同名或地址重叠：${related.map((item) => item.name).join("、")}
输入 1 合并进现有包，2 重命名后安装，3 仅安装（之后可按需启用）；其他输入取消。`,
      "1"
    );
    if (answer === "1") {
      const target = related[0];
      const mode = window.prompt(
        `合并到哪里？
1 并入旧包「${target.name}」（推荐：角色绑定不变，重叠源包移除）
2 合并为新包（所有源包保留）
其他输入取消。`,
        "1"
      );
      if (mode === "1") {
        const merged = mergeWithPrompts([...related, pack], target.name, body);
        if (!merged) return false;
        let next = settings;
        for (const other of related.slice(1)) next = removePack(next, other.id);
        if (!updateChecked(upsertPack(next, { ...merged, id: target.id }))) return false;
        toast(body, `已合并进「${merged.name}」（${merged.sprites.length} 张）`);
        return true;
      }
      if (mode === "2") {
        const merged = mergeWithPrompts([...related, pack], `${target.name} 合并`, body);
        if (!merged || !updateChecked(upsertPack(settings, merged))) return false;
        toast(body, `已生成合并包「${merged.name}」（${merged.sprites.length} 张），源包仍保留`);
        return true;
      }
      return false;
    }
    if (answer === "2") {
      const rawName = window.prompt("请输入新的包名：", `${pack.name} 新`);
      if (rawName === null) return false;
      const name = sanitizePackName(rawName);
      if (!name || settings.packs.some((existing) => existing.name === name)) {
        toast(body, "未安装：新包名为空或仍与现有包同名");
        return false;
      }
      if (!updateChecked(upsertPack(settings, { ...pack, name }))) return false;
      toast(body, `已重命名并安装「${name}」（未启用）`);
      return true;
    }
    if (answer === "3") {
      if (!updateChecked(upsertPack(settings, pack))) return false;
      toast(body, `已安装「${pack.name}」，未加入当前角色`);
      return true;
    }
    return false;
  }
  function bindPackWithChoices(characterName, packId, body) {
    const settings = deps.getSettings();
    const result = bindPack(settings, characterName, packId);
    if (result.ok) {
      const changes = previewBindingAddressChanges(settings, result.settings, characterName);
      if (changes.removed.length > 0 && !window.confirm(
        `启用后以下旧地址将变化：${changes.removed.slice(0, 6).join("、")}
新地址示例：${changes.added.slice(0, 6).join("、")}
仍要继续吗？`
      )) return;
      commit(result.settings);
      return;
    }
    const answer = window.prompt(
      `启用会产生地址冲突：${conflictText(result.conflicts)}
输入 1 替换当前冲突包，2 合并为新包后启用；其他输入取消。`,
      "1"
    );
    const sourceIds = new Set(result.conflicts.flatMap((conflict) => conflict.owners.map((owner) => owner.packId)));
    sourceIds.add(packId);
    const binding = settings.bindings.find((item) => item.characterName === characterName);
    const boundIds = binding?.packIds ?? [];
    if (answer === "1") {
      sourceIds.delete(packId);
      const nextIds = boundIds.filter((id) => !sourceIds.has(id));
      if (!nextIds.includes(packId)) nextIds.push(packId);
      commitChecked(setBinding(settings, characterName, nextIds));
      return;
    }
    if (answer === "2") {
      const sources = settings.packs.filter((candidate) => sourceIds.has(candidate.id));
      const incoming = settings.packs.find((candidate) => candidate.id === packId);
      const merged = mergeWithPrompts(sources, incoming ? `${incoming.name} 合并` : "合并立绘包", body);
      if (!merged) return;
      const installed = upsertPack(settings, merged);
      if (!installed.ok) {
        rejectConflicts(installed.conflicts);
        return;
      }
      const nextIds = boundIds.filter((id) => !sourceIds.has(id));
      nextIds.push(merged.id);
      const rebound = setBinding(installed.settings, characterName, nextIds);
      if (!rebound.ok) {
        rejectConflicts(rebound.conflicts);
        return;
      }
      commit(rebound.settings);
      toast(body, `已生成并启用合并包「${merged.name}」；源包仍保留`);
    }
  }
  function commitPack(pack) {
    commitChecked(upsertPack(deps.getSettings(), pack));
  }
  function closePopovers() {
    backdrop?.querySelectorAll(".so-popover").forEach((n) => n.remove());
  }
  function dropdownButton(label, build) {
    const btn = button(`${label} ▾`, () => {
      const header = backdrop?.querySelector(".so-manager-header");
      if (!header) return;
      const existing = header.querySelector(`.so-popover[data-pop="${label}"]`);
      closePopovers();
      if (existing) return;
      const panel = el("div", "so-popover");
      panel.dataset.pop = label;
      build(panel);
      header.append(panel);
      panel.querySelector("input, textarea")?.focus();
      const onDocClick = (e) => {
        if (panel.contains(e.target) || btn.contains(e.target)) return;
        panel.remove();
        document.removeEventListener("click", onDocClick, true);
      };
      document.addEventListener("click", onDocClick, true);
    });
    return btn;
  }
  function render3() {
    if (!backdrop) return;
    const backBtn = backdrop.querySelector(".so-manager-back");
    const title = backdrop.querySelector(".so-manager-title");
    const actions = backdrop.querySelector(".so-manager-actions");
    const body = backdrop.querySelector(".so-manager-body");
    body.innerHTML = "";
    actions.innerHTML = "";
    closePopovers();
    try {
      if (view.kind === "pack") {
        const packId = view.packId;
        const pack = deps.getSettings().packs.find((p) => p.id === packId);
        if (pack) {
          backBtn.style.display = "inline-flex";
          title.textContent = pack.name;
          renderPackDetail(body, actions, pack);
          return;
        }
        view = { kind: "list" };
      }
      backBtn.style.display = "none";
      title.textContent = "立绘包管理";
      renderList(body, actions);
    } catch (err) {
      console.error("[sprite-overlay] 管理弹窗渲染失败", err);
      const msg = el("div", "so-status");
      msg.textContent = `界面渲染出错：${err instanceof Error ? err.message : String(err)}`;
      body.append(msg);
    }
  }
  function collapsible(titleText, open2 = false) {
    const box = document.createElement("details");
    box.className = "so-section so-collapse";
    box.open = open2;
    const summary = document.createElement("summary");
    summary.className = "so-section-title";
    summary.textContent = titleText;
    const inner = el("div", "so-collapse-body");
    box.append(summary, inner);
    return { box, body: inner };
  }
  function renderList(body, actions) {
    const settings = deps.getSettings();
    const characterName = deps.adapter.getCurrentCharacterName();
    const binding = settings.bindings.find((b) => b.characterName === characterName);
    const boundIds = binding?.packIds ?? [];
    if (characterName) {
      const select = document.createElement("select");
      select.className = "text_pole so-header-select";
      select.setAttribute("aria-label", `为「${characterName}」添加启用立绘包`);
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = boundIds.length > 0 ? "再启用一个包…" : "选择要启用的包…";
      select.append(placeholder);
      for (const p of settings.packs) {
        if (boundIds.includes(p.id)) continue;
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.name}（${p.sprites.length} 张）`;
        select.append(opt);
      }
      select.addEventListener("change", () => {
        const packId = select.value;
        if (!packId) return;
        select.value = "";
        bindPackWithChoices(characterName, packId, body);
      });
      actions.append(select);
    }
    actions.append(
      dropdownButton("新建", (panel) => {
        const heading = el("div", "so-popover-title");
        heading.textContent = "新建立绘包";
        const nameInput = textInput("输入新包名称…");
        nameInput.maxLength = 40;
        const createBtn = button("创建", () => {
          const name = sanitizePackName(nameInput.value);
          if (!name) {
            toast(body, "包名不能为空（| = @ < > 等符号会被剔除）");
            return;
          }
          const pack = { id: genId(), name, author: "我", sprites: [] };
          if (!updateChecked(upsertPack(deps.getSettings(), pack))) return;
          view = { kind: "pack", packId: pack.id };
          render3();
        });
        nameInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.isComposing) createBtn.click();
        });
        panel.append(heading, nameInput, createBtn);
      }),
      dropdownButton("导入", (panel) => {
        const shareHeading = el("div", "so-popover-title");
        shareHeading.textContent = "从分享字符串导入";
        const shareInput = document.createElement("textarea");
        shareInput.className = "text_pole";
        shareInput.rows = 3;
        shareInput.placeholder = "粘贴 stpack2:/stpack1: 分享串…";
        const shareBtn = button("导入", () => {
          if (!shareInput.value.trim()) return;
          try {
            const pack = decodeShareString(shareInput.value);
            if (!installImportedPack(pack, body)) return;
            const installed = deps.getSettings().packs.find((item) => item.id === pack.id);
            if (installed) view = { kind: "pack", packId: installed.id };
            render3();
          } catch (err) {
            toast(body, err instanceof Error ? err.message : "分享串解析失败");
          }
        });
        const jsonHeading = el("div", "so-popover-title");
        jsonHeading.textContent = "从 JSON 文件导入";
        const jsonBtn = button("选择 JSON 文件…", () => {
          pickFile(".json,application/json", false, async (files) => {
            try {
              const text = await files[0].text();
              if (text.length > 2 * 1024 * 1024 && !window.confirm(
                `这个 JSON 有 ${(text.length / 1024 / 1024).toFixed(1)}MB（内嵌 base64 图）。云端部署的酒馆导入大包容易内存爆满，建议让对方先传图床再发分享串。仍要导入吗？`
              ))
                return;
              const pack = importPack(text);
              if (!installImportedPack(pack, body)) return;
              const installed = deps.getSettings().packs.find((item) => item.id === pack.id);
              if (installed) view = { kind: "pack", packId: installed.id };
              render3();
            } catch (err) {
              toast(body, err instanceof Error ? err.message : "导入失败");
            }
          });
        });
        panel.append(shareHeading, shareInput, shareBtn, jsonHeading, jsonBtn);
      })
    );
    const strip = el("div", "so-row so-bind-strip");
    if (characterName) {
      const label = el("span", "so-bind-label");
      label.textContent = boundIds.length > 0 ? `${characterName} · 已启用 ${boundIds.length} 个：` : `${characterName} · 尚未启用立绘包（用右上角选择启用）`;
      strip.append(label);
      boundIds.forEach((id, index) => {
        const pack = settings.packs.find((p) => p.id === id);
        const chip = el("span", "so-chip");
        const name = el("span", "so-chip-name");
        name.textContent = pack ? `${index + 1}. ${pack.name}（${pack.sprites.length} 张）` : `（已删除的包 ${id}）`;
        chip.append(name);
        if (boundIds.length > 1) {
          chip.append(
            iconButton("◀", "前移（多包寻址优先级更高）", () => {
              if (index > 0) commit(reorderBinding(deps.getSettings(), characterName, index, index - 1));
            }, "so-chip-btn"),
            iconButton("▶", "后移", () => {
              commit(reorderBinding(deps.getSettings(), characterName, index, index + 1));
            }, "so-chip-btn")
          );
        }
        chip.append(
          iconButton("✕", "停用此包", () => {
            commit(unbindPack(deps.getSettings(), characterName, id));
          }, "so-chip-btn")
        );
        strip.append(chip);
      });
      if (binding) {
        strip.append(
          el("span", "so-spacer"),
          checkboxRow(
            "全部启用",
            binding.enabled,
            (v) => commitChecked(toggleBinding(deps.getSettings(), characterName, v))
          )
        );
      }
    } else {
      const tip = el("span", "so-status");
      tip.textContent = "请先打开一个角色聊天，再回来启用立绘包。";
      strip.append(tip);
    }
    body.append(strip);
    const grid = el("div", "so-pack-grid");
    for (const pack of settings.packs) {
      const bound = boundIds.includes(pack.id) ? binding?.enabled ? "active" : "off" : null;
      grid.append(renderPackCard(pack, bound));
    }
    body.append(grid);
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
      if (bound === "active") card.classList.add("so-card-active");
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
      render3();
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
  function renderPackDetail(body, actions, pack) {
    const readonly = isPresetPack(pack.id);
    if (!readonly) {
      actions.append(
        dropdownButton("添加立绘", (panel) => {
          const upHeading = el("div", "so-popover-title");
          upHeading.textContent = "直接上传";
          const upBtn = button("选择图片（自动压缩+解析预览）", () => {
            closePopovers();
            pickFile("image/*", true, (files) => openUploadPreview(pack.id, files));
          });
          const upHint = el("div", "so-status");
          upHint.textContent = "文件名按 _ - – — 空格拆「人名/服装/图名」（如 鸣人-居家服-微笑.png），上传前可预览修正。";
          const codeHeading = el("div", "so-popover-title");
          codeHeading.textContent = "按编码添加";
          const codeInput = document.createElement("textarea");
          codeInput.className = "text_pole";
          codeInput.rows = 3;
          codeInput.placeholder = "粘贴编码，可多个（空格/逗号/换行分隔）";
          const codeBtn = button("添加", () => {
            const codes = codeInput.value.split(/[\s,，、;；|]+/).filter(Boolean);
            if (codes.length === 0) {
              toast(body, "请填写图床编码，如 ab12cd.png（可一次粘贴多个）");
              return;
            }
            const bad = codes.filter((c) => !isValidImageCode(c));
            if (bad.length > 0) {
              toast(body, `编码格式不对：${bad.slice(0, 3).join("、")}${bad.length > 3 ? " 等" : ""}`);
              return;
            }
            const current = deps.getSettings();
            const target = current.packs.find((p) => p.id === pack.id);
            if (!target) return;
            const host = current.imageHost.endsWith("/") ? current.imageHost : `${current.imageHost}/`;
            let next = target;
            let added = 0;
            for (const code of codes) {
              const tag = normalizeTag(code.replace(/\.[^.]+$/, ""));
              if (!tag) continue;
              next = upsertSprite(next, { tag, url: host + code, code });
              added++;
            }
            commitPack(next);
            toast(body, `已按编码添加 ${added} 张（图名取编码名，可在图卡上改名）`);
          });
          const codeHint = el("div", "so-status");
          codeHint.textContent = `编码拼接图床前缀 ${deps.getSettings().imageHost} 成直链，图名自动取编码名；改名/分组用图卡上的 ✎ / 🏷。`;
          panel.append(upHeading, upBtn, upHint, codeHeading, codeInput, codeBtn, codeHint);
        })
      );
    }
    const topRow = el("div", "so-row so-detail-top");
    topRow.append(
      button("导出 JSON", async () => {
        const file = await exportPack(pack);
        downloadJson(file, `${pack.name}.sprite-pack.json`);
        toast(body, `已导出「${pack.name}」`);
      }),
      button("复制分享串", async () => {
        const result = encodeShareStringV2(pack);
        if (!result) {
          toast(body, "该包没有可分享的远程图片（本地/内嵌图请用「导出 JSON」，或先上传 imgbb）");
          return;
        }
        if (result.missing.length > 0) {
          const preview = result.missing.slice(0, 8).join("、");
          const more = result.missing.length > 8 ? ` 等 ${result.missing.length} 项` : "";
          const go = window.confirm(
            `分享串不完整：${result.included}/${result.total} 张有远程地址。
缺少远程地址（不会包含在分享串里）：${preview}${more}

这些图片对方将看不到。仍要复制残缺分享串吗？`
          );
          if (!go) return;
        }
        const ok = await copyText(result.text);
        const note = result.missing.length > 0 ? `（${result.included}/${result.total} 张，缺 ${result.missing.length} 张）` : `（${result.included} 张，完整）`;
        toast(body, ok ? `已复制分享串${note}` : "复制失败，请手动复制弹出的文本");
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
      const metaPanel = collapsible("包信息");
      const metaRow = el("div", "so-row so-meta-row");
      const nameInput = textInput("包名");
      nameInput.value = pack.name;
      const authorInput = textInput("作者");
      authorInput.value = pack.author ?? "";
      const descInput = textInput("描述（可选）");
      descInput.value = pack.description ?? "";
      const roleInput = textInput("人名（可空）");
      roleInput.value = pack.roleName ?? "";
      const outfitInput = textInput("服装（可空）");
      outfitInput.value = pack.outfit ?? "";
      metaRow.append(
        labeled("包名", nameInput),
        labeled("作者", authorInput),
        labeled("人名", roleInput),
        labeled("服装", outfitInput),
        labeled("描述", descInput),
        button("保存", () => {
          const name = sanitizePackName(nameInput.value);
          if (!name) {
            toast(body, "包名不能为空");
            return;
          }
          const roleName = normalizeTag(roleInput.value);
          const outfit = normalizeTag(outfitInput.value);
          commitPack({
            ...pack,
            name,
            author: sanitizePackName(authorInput.value) || void 0,
            description: sanitizeDescription(descInput.value) || void 0,
            roleName: roleName || void 0,
            outfit: outfit || void 0
          });
        })
      );
      const metaHint = el("div", "so-status");
      metaHint.textContent = "人名/服装用于三级寻址 [立绘:人名/服装/图名]：整包同一角色时填人名，包内立绘用纯图名即可。";
      metaPanel.body.append(metaRow, metaHint);
      body.append(metaPanel.box);
    }
    if (pack.sprites.length === 0) {
      const empty = el("div", "so-status");
      empty.textContent = "还没有立绘：点右上角「添加立绘」上传图片或粘贴编码。";
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
      const pending = pack.sprites.filter(
        (s) => getSpriteSource(s) !== "hosted" && !(s.remoteUrl && /^https?:\/\//.test(s.remoteUrl))
      );
      const { imgbbApiKey } = deps.getSettings();
      if (pending.length > 0 && imgbbApiKey.trim()) {
        const upSection = el("div", "so-section");
        const upTitle = el("div", "so-section-title");
        upTitle.textContent = "图床补传";
        const upDesc = el("div", "so-status");
        upDesc.textContent = `${pending.length} 张立绘还没有远程地址（分享时对方看不到）。补传到 imgbb 后本地图仍保留。`;
        upSection.append(
          upTitle,
          upDesc,
          button(`补传 ${pending.length} 张到 imgbb（失败可重试）`, () => {
            void retryPendingUploads(body, pack.id);
          })
        );
        body.append(upSection);
      }
      const splitPreview = previewGroupSplit(pack);
      if (splitPreview.length >= 2) {
        const splitPanel = collapsible("按分组拆成立绘包");
        const splitDesc = el("div", "so-status");
        splitDesc.textContent = `检测到 ${splitPreview.length} 个分组：${splitPreview.map((s) => `${s.roleName}(${s.count})`).join("、")}。拆分会新建这些包（原包与绑定保留，可稍后自行删除）。`;
        splitPanel.body.append(
          splitDesc,
          button("拆分（保留原包）", () => {
            const preview = splitPreview.map((s) => `${s.roleName}：${s.count} 张`).join("\n");
            if (!window.confirm(`将新建以下立绘包（原包保留）：
${preview}

确认拆分？`)) return;
            const newPacks = splitPackByGroup(pack);
            let next = deps.getSettings();
            for (const np of newPacks) {
              const updated = checkedSettings(upsertPack(next, np));
              if (!updated) return;
              next = updated;
            }
            commit(next);
            toast(body, `已拆出 ${newPacks.length} 个新包（原包「${pack.name}」保留）`);
          })
        );
        body.append(splitPanel.box);
      }
    }
    body.append(statusBar());
  }
  function openLightbox(packId, startIndex) {
    if (!backdrop) return;
    const sprites = deps.getSettings().packs.find((p) => p.id === packId)?.sprites ?? [];
    if (sprites.length === 0) return;
    let idx = Math.min(startIndex, sprites.length - 1);
    const box = el("div", "so-lightbox");
    const img = document.createElement("img");
    const caption = el("div", "so-lightbox-caption");
    const show = () => {
      const sprite = sprites[idx];
      img.src = sprite.url;
      img.alt = sprite.tag;
      caption.textContent = `${sprite.tag}（${idx + 1}/${sprites.length}）`;
    };
    const step = (d) => {
      idx = (idx + d + sprites.length) % sprites.length;
      show();
    };
    const closeBox = () => {
      document.removeEventListener("keydown", onKey, true);
      box.remove();
      closeLightbox = null;
    };
    closeLightbox = closeBox;
    const onKey = (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "Escape") {
        e.stopPropagation();
        closeBox();
      }
    };
    document.addEventListener("keydown", onKey, true);
    box.addEventListener("click", (e) => {
      if (e.target === box) closeBox();
    });
    box.append(img, caption);
    if (sprites.length > 1) {
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        const rect = img.getBoundingClientRect();
        step(e.clientX < rect.left + rect.width / 2 ? -1 : 1);
      });
      box.append(
        iconButton("◀", "上一张（← 方向键）", () => step(-1), "so-lightbox-nav so-lightbox-prev"),
        iconButton("▶", "下一张（→ 方向键）", () => step(1), "so-lightbox-nav so-lightbox-next")
      );
    }
    box.append(iconButton("✕", "关闭（Esc）", () => closeBox(), "so-lightbox-close"));
    show();
    backdrop.append(box);
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
    cell.addEventListener("click", () => openLightbox(pack.id, index));
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
          commitPack(renameSprite(target, sprite.tag, next, spriteGroup(sprite), sprite.outfit ?? ""));
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
          commitPack(setSpriteGroup(target, sprite.tag, cur, next, sprite.outfit ?? ""));
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
            const o = sprite.outfit;
            const base = {
              tag: sprite.tag,
              url,
              ...g ? { group: g } : {},
              ...o ? { outfit: o } : {}
            };
            commitPack(upsertSprite(target, base));
            const { autoUpload, imgbbApiKey } = deps.getSettings();
            if (autoUpload && imgbbApiKey.trim()) {
              try {
                const up = await uploadToImgbb(imgbbApiKey, result.dataUri);
                if (isValidImgbbResult(up)) {
                  const latest = latestPack();
                  if (latest) {
                    commitPack(
                      upsertSprite(latest, { ...base, code: up.code, remoteUrl: up.url })
                    );
                    toast(body, `已替换「${sprite.tag}」并重传图床（${formatBytes(result.bytes)}）`);
                    return;
                  }
                }
                toast(body, `已替换「${sprite.tag}」，但图床响应无效，标记为待上传`);
              } catch {
                toast(body, `已替换「${sprite.tag}」，图床上传失败，标记为待上传`);
              }
            } else {
              toast(body, `已替换「${sprite.tag}」（${formatBytes(result.bytes)}），远程地址待上传`);
            }
          } catch (err) {
            toast(body, err instanceof Error ? err.message : "替换失败");
          }
        });
      }),
      iconButton("🔗", "远程地址", () => {
        const remote = sprite.remoteUrl || (getSpriteSource(sprite) === "hosted" ? sprite.url : "");
        if (!remote) {
          toast(body, `「${sprite.tag}」还没有远程地址（未上传图床，分享时对方看不到）`);
          return;
        }
        window.prompt(`「${sprite.tag}」编号：${sprite.code || "无"}
远程地址（Ctrl+C 复制）：`, remote);
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
        commitPack(removeSprite(target, sprite.tag, spriteGroup(sprite), sprite.outfit ?? ""));
      })
    );
    cell.append(bar);
    return cell;
  }
  function openUploadPreview(currentPackId, files) {
    const fileArr = Array.from(files);
    const parsed = fileArr.map((f) => parseSpriteFileName(f.name));
    let autoSplit = true;
    let strategy = "skip";
    const modal = el("div", "so-upload-modal");
    const panel = el("div", "so-upload-panel");
    const head = el("div", "so-upload-head");
    const title = el("b");
    title.textContent = `批量上传预览（${fileArr.length} 张）`;
    head.append(title);
    const rows = el("div", "so-upload-rows");
    const inputs = [];
    function buildRows() {
      rows.innerHTML = "";
      inputs.length = 0;
      fileArr.forEach((file, i) => {
        const row = el("div", "so-upload-row");
        const name = el("div", "so-upload-fname");
        name.textContent = file.name;
        name.title = file.name;
        const roleIn = textInput("人名");
        const outfitIn = textInput("服装");
        const tagIn = textInput("图名");
        if (autoSplit) {
          roleIn.value = parsed[i].role;
          outfitIn.value = parsed[i].outfit;
          tagIn.value = parsed[i].tag;
        } else {
          roleIn.value = "";
          outfitIn.value = "";
          tagIn.value = normalizeTag(file.name.replace(/\.[^.]+$/, ""));
        }
        roleIn.disabled = !autoSplit;
        outfitIn.disabled = !autoSplit;
        inputs.push({ role: roleIn, outfit: outfitIn, tag: tagIn });
        row.append(
          name,
          labeled("人名", roleIn),
          labeled("服装", outfitIn),
          labeled("图名", tagIn)
        );
        rows.append(row);
      });
    }
    buildRows();
    const opts = el("div", "so-upload-opts");
    opts.append(
      checkboxRow("自动拆分人名/服装（关闭则整名作图名落当前包）", autoSplit, (v) => {
        autoSplit = v;
        buildRows();
      })
    );
    const stratWrap = el("div", "so-row");
    const stratLabel = el("span");
    stratLabel.textContent = "重名时：";
    const stratSel = document.createElement("select");
    stratSel.className = "text_pole";
    for (const [val, lab] of [
      ["skip", "跳过（默认）"],
      ["rename", "自动改名"],
      ["overwrite", "覆盖"]
    ]) {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = lab;
      stratSel.append(o);
    }
    stratSel.addEventListener("change", () => strategy = stratSel.value);
    stratWrap.append(stratLabel, stratSel);
    opts.append(stratWrap);
    const status = el("div", "so-upload-status");
    const actions = el("div", "so-row so-upload-actions");
    const confirmBtn = button("开始上传", () => {
      const entries = fileArr.map((file, i) => ({
        fileName: file.name,
        role: autoSplit ? inputs[i].role.value : "",
        outfit: autoSplit ? inputs[i].outfit.value : "",
        tag: inputs[i].tag.value
      }));
      void applyUploadPlan(currentPackId, fileArr, entries, strategy, status, () => modal.remove());
    });
    actions.append(
      confirmBtn,
      button("取消", () => modal.remove(), "so-btn-danger")
    );
    panel.append(head, rows, opts, status, actions);
    modal.append(panel);
    (backdrop ?? document.body).append(modal);
  }
  async function applyUploadPlan(currentPackId, files, entries, strategy, status, done) {
    const current = deps.getSettings().packs.find((p) => p.id === currentPackId) ?? null;
    const plans = planUploads(entries, deps.getSettings().packs, strategy, current?.name ?? "新包", current);
    const { autoUpload, imgbbApiKey } = deps.getSettings();
    const useImgbb = autoUpload && imgbbApiKey.trim() !== "";
    let added = 0;
    let skipped = 0;
    let failed = 0;
    let hosted = 0;
    let hostFailed = 0;
    const newPackIds = /* @__PURE__ */ new Map();
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      const file = files[i];
      status.textContent = `处理中 ${i + 1}/${plans.length}：${file.name}`;
      if (plan.action === "skip" || !plan.finalTag) {
        skipped++;
        continue;
      }
      try {
        const result = await compressImage(file);
        const url = await deps.adapter.saveImage(
          file.name,
          result.dataUri,
          deps.adapter.getCurrentCharacterName() || plan.targetPackName
        );
        let targetId = plan.targetPackId;
        if (!targetId) {
          const role = plan.entry.role;
          const outfit = plan.entry.outfit;
          const key = `${role}|${outfit}|${plan.targetPackName}`;
          targetId = newPackIds.get(key) ?? null;
          if (!targetId) {
            const np = {
              id: genId(),
              name: plan.targetPackName,
              author: "我",
              ...role ? { roleName: role } : {},
              ...outfit ? { outfit } : {},
              sprites: []
            };
            if (!updateChecked(upsertPack(deps.getSettings(), np))) return;
            targetId = np.id;
            newPackIds.set(key, targetId);
          }
        }
        const target = deps.getSettings().packs.find((p) => p.id === targetId);
        if (!target) {
          failed++;
          continue;
        }
        const sprite = { tag: plan.finalTag, url };
        if (!updateChecked(upsertPack(deps.getSettings(), upsertSprite(target, sprite)))) return;
        added++;
        if (useImgbb) {
          try {
            const up = await uploadToImgbb(imgbbApiKey, result.dataUri);
            if (isValidImgbbResult(up)) {
              const latest = deps.getSettings().packs.find((p) => p.id === targetId);
              if (latest) {
                const hostedSprite = { tag: plan.finalTag, url, code: up.code, remoteUrl: up.url };
                if (!updateChecked(upsertPack(deps.getSettings(), upsertSprite(latest, hostedSprite)))) return;
                hosted++;
              }
            } else {
              hostFailed++;
            }
          } catch (err) {
            console.warn("[sprite-overlay] imgbb 上传失败（图片保留本地）", err);
            hostFailed++;
          }
        }
      } catch (err) {
        console.error("[sprite-overlay] 上传失败", err);
        failed++;
      }
    }
    done();
    render3();
    const parts = [`已添加 ${added} 张`];
    if (skipped > 0) parts.push(`跳过 ${skipped} 张（重名/无效）`);
    if (failed > 0) parts.push(`失败 ${failed} 张`);
    if (useImgbb) parts.push(`imgbb 成功 ${hosted}${hostFailed > 0 ? `、失败 ${hostFailed}` : ""}`);
    toast(backdrop?.querySelector(".so-manager-body"), parts.join("，"));
  }
  async function retryPendingUploads(body, packId) {
    const { imgbbApiKey } = deps.getSettings();
    if (!imgbbApiKey.trim()) {
      toast(body, "请先在「图库」App 配置 imgbb API Key");
      return;
    }
    const pack = deps.getSettings().packs.find((p) => p.id === packId);
    if (!pack) return;
    const pending = pack.sprites.filter(
      (s) => getSpriteSource(s) !== "hosted" && !(s.remoteUrl && /^https?:\/\//.test(s.remoteUrl))
    );
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < pending.length; i++) {
      const sprite = pending[i];
      toast(body, `补传中 ${i + 1}/${pending.length}：${sprite.tag}`);
      try {
        const dataUri = sprite.url.startsWith("data:") ? sprite.url : await urlToDataUri(sprite.url);
        const up = await uploadToImgbb(imgbbApiKey, dataUri);
        if (!isValidImgbbResult(up)) {
          fail++;
          continue;
        }
        const latest = deps.getSettings().packs.find((p) => p.id === packId);
        const target = latest?.sprites.find(
          (s) => s.tag === sprite.tag && (s.group ?? "") === (sprite.group ?? "") && (s.outfit ?? "") === (sprite.outfit ?? "")
        );
        if (!latest || !target) {
          fail++;
          continue;
        }
        if (!updateChecked(
          upsertPack(
            deps.getSettings(),
            upsertSprite(latest, { ...target, code: up.code, remoteUrl: up.url })
          )
        )) return;
        ok++;
      } catch (err) {
        console.warn("[sprite-overlay] 补传失败", err);
        fail++;
      }
    }
    render3();
    toast(
      backdrop?.querySelector(".so-manager-body"),
      `补传完成：成功 ${ok} 张${fail > 0 ? `，失败 ${fail} 张（可再次点击重试）` : ""}`
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
function iconButton(icon, title, onClick, className = "so-icon-btn") {
  const btn = el("div", className);
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
        <b>掌柜的</b>
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
      "启用立绘功能",
      settings.enabled,
      (v) => deps.updateSettings({ ...deps.getSettings(), enabled: v }),
      "总开关：注入立绘清单给 AI 并展示回复中的立绘。关闭后清空注入、停止解析、隐藏悬浮窗并把楼层恢复原文；手机与其他工具不受影响。"
    ),
    checkboxRow2(
      "显示手机",
      settings.showPhone,
      (v) => deps.updateSettings({ ...deps.getSettings(), showPhone: v }),
      "屏幕上显示可拖动的 📱 图标，点击展开小手机（st-stage 各功能的统一入口）。"
    )
  );
  const hint = document.createElement("div");
  hint.className = "so-status";
  const version = false ? "" : ` v${"0.6.1"}（构建 ${"2026-07-28 13:14"}）`;
  hint.textContent = `酒馆里的事，掌柜的都管。立绘显示/轮播/Prompt 设置在手机「立绘」App；图包管理与图床设置在手机「图库」App。${version}`;
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
var FP_ATTR = "data-so-fp";
var MARKER_CLASS = "so-processed-marker";
var snapshots = /* @__PURE__ */ new WeakMap();
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
function anyFeatureOn(settings) {
  return settings.enabled && (settings.hideTagInMessage || settings.renderInlineImages || settings.spriteDisplayMode !== "overlay");
}
function clampFloors(settings) {
  const n = Math.round(settings.recentFloors);
  if (!Number.isFinite(n)) return RECENT_FLOORS_MIN;
  return Math.min(RECENT_FLOORS_MAX, Math.max(RECENT_FLOORS_MIN, n));
}
function originalTextOf(el3) {
  return snapshots.get(el3)?.originalText ?? el3.textContent ?? "";
}
function collectCandidates() {
  const out = [];
  for (const mes of Array.from(document.querySelectorAll("#chat .mes"))) {
    if (mes.getAttribute("is_user") === "true" || mes.getAttribute("is_system") === "true") continue;
    const textEl = mes.querySelector(".mes_text");
    if (!textEl) continue;
    const text = originalTextOf(textEl);
    if (hasTag(text) || hasInlineImageMarkup(text)) out.push(textEl);
  }
  return out;
}
function processMessages(settings, messageId = null) {
  if (!anyFeatureOn(settings)) return;
  if (messageId !== null && messageId !== void 0 && `${messageId}` !== "") {
    const idStr = `${messageId}`;
    const allMes = Array.from(document.querySelectorAll("#chat .mes"));
    const scope = allMes.filter((m) => m.getAttribute("mesid") === idStr).map((m) => m.querySelector(".mes_text")).filter((el3) => el3 !== null);
    const lastMes = allMes.length > 0 ? allMes[allMes.length - 1] : null;
    let windowSet = null;
    for (const el3 of scope) {
      if (lastMes !== null && el3.closest(".mes") === lastMes) {
        processMessageElement(el3, settings);
        continue;
      }
      windowSet ?? (windowSet = new Set(collectCandidates().slice(-clampFloors(settings))));
      if (windowSet.has(el3)) processMessageElement(el3, settings);
    }
    return;
  }
  for (const el3 of collectCandidates().slice(-clampFloors(settings))) {
    processMessageElement(el3, settings);
  }
}
function reprocessAllMessages(settings) {
  restoreAllMessages();
  if (anyFeatureOn(settings)) processMessages(settings);
}
function restoreAllMessages() {
  for (const node of Array.from(document.querySelectorAll(`#chat .mes_text[${FP_ATTR}]`))) {
    restoreElement(node);
  }
}
function restoreElement(root) {
  const snap = snapshots.get(root);
  const isOurs = root.querySelector(`.${MARKER_CLASS}`) !== null;
  if (snap && isOurs) {
    root.replaceChildren(...snap.nodes);
  }
  snapshots.delete(root);
  root.removeAttribute(FP_ATTR);
}
function hashText(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = (h << 5) + h + text.charCodeAt(i) | 0;
  }
  return (h >>> 0).toString(36);
}
function processMessageElement(root, settings) {
  const inlineSprites = settings.spriteDisplayMode !== "overlay";
  const host = settings.imageHost.endsWith("/") ? settings.imageHost : `${settings.imageHost}/`;
  const snap = snapshots.get(root);
  const contentIsOurs = snap !== void 0 && root.querySelector(`.${MARKER_CLASS}`) !== null;
  const originalText = contentIsOurs ? snap.originalText : root.textContent ?? "";
  const fingerprint = `${settings.hideTagInMessage ? "T" : ""}${settings.renderInlineImages ? "I" : ""}${inlineSprites ? "S" : ""}|${hashText(host)}|${hashText(originalText)}`;
  if (contentIsOurs && root.getAttribute(FP_ATTR) === fingerprint) return;
  if (contentIsOurs) {
    root.replaceChildren(...snap.nodes);
  }
  snapshots.delete(root);
  root.removeAttribute(FP_ATTR);
  const chName = inlineSprites ? root.closest(".mes")?.getAttribute("ch_name") ?? "" : "";
  const packs = chName ? getActivePacks(settings, chName) : [];
  const hasPacks = packs.length > 0;
  const freshText = root.textContent ?? "";
  const tagged = hasTag(freshText);
  const needsWork = settings.hideTagInMessage && tagged || inlineSprites && hasPacks && tagged || settings.renderInlineImages && hasInlineImageMarkup(freshText);
  if (!needsWork) return;
  snapshots.set(root, {
    nodes: Array.from(root.childNodes).map((n) => n.cloneNode(true)),
    originalText: freshText
  });
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let current;
  while (current = walker.nextNode()) {
    textNodes.push(current);
  }
  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? "";
    if (!text) continue;
    const nodeTagged = hasTag(text);
    const needsSprites = inlineSprites && hasPacks && nodeTagged;
    const needsStrip = settings.hideTagInMessage && nodeTagged && !needsSprites;
    const needsImages = settings.renderInlineImages && hasInlineImageMarkup(text);
    if (!needsSprites && !needsStrip && !needsImages) continue;
    let processed = needsStrip ? stripTags(text) : text;
    const elements = [];
    const marker = (el3) => `\0${elements.push(el3) - 1}\0`;
    if (needsSprites && hasPacks) {
      processed = replaceTags(processed, (address) => {
        const sprite = resolveSprite(packs, address);
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
  const processedMark = document.createElement("span");
  processedMark.className = MARKER_CLASS;
  processedMark.hidden = true;
  root.prepend(processedMark);
  root.setAttribute(FP_ATTR, fingerprint);
}
function createImage(src, alt, extraClass = "") {
  const wrap = document.createElement("span");
  wrap.className = extraClass ? `so-inline-image ${extraClass}` : "so-inline-image";
  const img = document.createElement("img");
  img.src = src;
  img.alt = alt;
  img.loading = "lazy";
  img.addEventListener("error", () => {
    wrap.classList.add("so-inline-image-error");
    wrap.title = "图片加载失败，点击重试";
  });
  img.addEventListener("load", () => {
    wrap.classList.remove("so-inline-image-error");
    wrap.removeAttribute("title");
  });
  wrap.addEventListener("click", () => {
    if (!wrap.classList.contains("so-inline-image-error")) return;
    img.src = src.startsWith("data:") ? src : `${src}${src.includes("?") ? "&" : "?"}so_retry=${Date.now()}`;
  });
  wrap.append(img);
  return wrap;
}

// st-extension/src/apps/widgets.ts
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
function selectRow(label, value, options, onChange) {
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
function numberRow(label, value, min, max, onChange) {
  const row = el2("label", "so-app-toggle");
  const span = document.createElement("span");
  span.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.className = "text_pole so-app-num";
  input.min = String(min);
  input.max = String(max);
  input.step = "1";
  input.value = String(value);
  input.addEventListener("change", () => {
    const n = Math.round(Number(input.value));
    const clamped = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
    input.value = String(clamped);
    onChange(clamped);
  });
  row.append(span, input);
  return row;
}
function foldSection(title, open = false) {
  const box = document.createElement("details");
  box.className = "so-app-section so-app-fold";
  box.open = open;
  const summary = document.createElement("summary");
  summary.className = "so-app-title";
  summary.textContent = title;
  const body = el2("div", "so-app-fold-body");
  box.append(summary, body);
  return { box, body };
}
function textareaRow(label, value, placeholder, onCommit) {
  const wrap = el2("div", "so-app-field");
  const title = el2("div", "so-app-title");
  title.textContent = label;
  const input = document.createElement("textarea");
  input.className = "text_pole so-app-input";
  input.rows = 5;
  input.value = value;
  input.placeholder = placeholder;
  input.addEventListener("change", () => onCommit(input.value));
  wrap.append(title, input);
  return wrap;
}
function hintField(row, hint) {
  const wrap = el2("div", "so-app-hintwrap");
  const line = el2("div", "so-app-hintrow");
  row.classList.add("so-app-hintrow-main");
  const badge = document.createElement("button");
  badge.type = "button";
  badge.className = "so-app-hint-badge";
  badge.textContent = "ⓘ";
  badge.title = hint;
  badge.setAttribute("aria-label", "说明");
  badge.setAttribute("aria-expanded", "false");
  const detail = el2("div", "so-app-hint");
  detail.textContent = hint;
  detail.hidden = true;
  badge.addEventListener("click", (e) => {
    e.preventDefault();
    detail.hidden = !detail.hidden;
    badge.classList.toggle("so-app-hint-badge-on", !detail.hidden);
    badge.setAttribute("aria-expanded", String(!detail.hidden));
  });
  line.append(row, badge);
  wrap.append(line, detail);
  return wrap;
}
function textRow(label, value, placeholder, onCommit, type = "text") {
  const wrap = el2("div", "so-app-field");
  const title = el2("div", "so-app-title");
  title.textContent = label;
  const input = document.createElement("input");
  input.type = type;
  input.className = "text_pole so-app-input";
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = "off";
  input.addEventListener("change", () => onCommit(input.value));
  wrap.append(title, input);
  return wrap;
}

// st-extension/src/apps/sprite-app.ts
function spriteApp() {
  return {
    id: "sprites",
    name: "立绘",
    icon: "🎭",
    order: 1,
    mount(container, ctx) {
      const settings = ctx.getSettings();
      const characterName = ctx.getCharacterName();
      const packs = getActivePacks(settings, characterName);
      const pack = packs[0] ?? null;
      const stateSection = el2("div", "so-app-section");
      const title = el2("div", "so-app-title");
      title.textContent = characterName ? `当前角色：${characterName}` : "尚未打开角色聊天";
      const detail = el2("div", "so-app-desc");
      detail.textContent = settings.enabled ? pack ? packs.length > 1 ? `立绘功能运行中 — 已启用 ${packs.length} 个包（${packs.reduce((n, p) => n + p.sprites.length, 0)} 张）` : `立绘功能运行中 — 已绑定「${pack.name}」（${pack.sprites.length} 张）` : "立绘功能已开启，但当前角色未绑定立绘包（到「图库」绑定）" : "立绘功能已关闭：不注入 Prompt、不解析标签，旧楼层已恢复原文";
      stateSection.append(
        title,
        toggleRow(
          "启用立绘功能",
          settings.enabled,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), enabled: v })
        ),
        detail
      );
      const displaySection = foldSection("显示");
      displaySection.body.append(
        selectRow(
          "显示位置",
          settings.spriteDisplayMode,
          [
            { value: "overlay", label: "悬浮窗" },
            { value: "inline", label: "仅楼层" },
            { value: "both", label: "两者" }
          ],
          (v) => ctx.updateSettings({
            ...ctx.getSettings(),
            spriteDisplayMode: v === "inline" || v === "both" ? v : "overlay"
          })
        ),
        toggleRow(
          "显示悬浮窗",
          !settings.overlayHidden,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), overlayHidden: !v })
        ),
        appButton("把悬浮窗拉回视口", () => {
          const cur = ctx.getSettings();
          if (cur.spriteDisplayMode === "inline") return;
          ctx.updateSettings({
            ...cur,
            overlayHidden: false,
            overlay: { ...cur.overlay, x: 24, y: 80 }
          });
        }),
        numberRow(
          "最近渲染楼层数",
          settings.recentFloors,
          RECENT_FLOORS_MIN,
          RECENT_FLOORS_MAX,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), recentFloors: v })
        ),
        toggleRow(
          "隐藏 [立绘:xxx] 标签",
          settings.hideTagInMessage,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), hideTagInMessage: v })
        ),
        toggleRow(
          "渲染消息内插图",
          settings.renderInlineImages,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), renderInlineImages: v })
        )
      );
      const displayHint = el2("div", "so-app-desc");
      displayHint.textContent = "「仅楼层」把 [立绘:xxx] 原位替换为图片且不弹悬浮窗；楼层数限制加载聊天时补渲染的范围（新回复不受限）。";
      displaySection.body.append(displayHint);
      const autoSection = foldSection("多立绘轮播");
      autoSection.body.append(
        toggleRow(
          "自动轮播（一条回复多张立绘时）",
          settings.autoSwitch,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), autoSwitch: v })
        ),
        numberRow(
          "轮播间隔（秒）",
          settings.autoSwitchSeconds,
          1,
          60,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), autoSwitchSeconds: v })
        )
      );
      const promptSection = foldSection("Prompt");
      promptSection.body.append(
        numberRow(
          "每次回复立绘数量",
          settings.spriteCount,
          SPRITE_COUNT_MIN,
          SPRITE_COUNT_MAX,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), spriteCount: v })
        ),
        numberRow(
          "注入深度（距末尾楼层数）",
          settings.injectionDepth,
          INJECTION_DEPTH_MIN,
          INJECTION_DEPTH_MAX,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), injectionDepth: v })
        ),
        selectRow(
          "Prompt 模式",
          settings.multiRolePromptMode,
          [
            { value: "full", label: "全量（枚举全部地址）" },
            { value: "repeat", label: "智能精简（共有表情 + 场景其余）" }
          ],
          (v) => ctx.updateSettings({
            ...ctx.getSettings(),
            multiRolePromptMode: v === "repeat" ? "repeat" : "full"
          })
        )
      );
      const promptHint = el2("div", "so-app-desc");
      promptHint.textContent = "多个包/含人名服装时，Prompt 用完整地址 [立绘:人名/服装/图名]；单包纯图名时用简写 [立绘:图名]。智能精简按实际长度自动取更短的一版：场景/表情较少时仍会显示全量格式，属正常现象。";
      promptSection.body.append(promptHint);
      const tplRow = textareaRow(
        "自定义提示词（留空=用内置）",
        settings.promptTemplate,
        "整体替换内置提示词。占位符：{清单}=按场景分组的立绘清单，{数量}=每次回复立绘数",
        (v) => ctx.updateSettings({ ...ctx.getSettings(), promptTemplate: v })
      );
      const tplInput = tplRow.querySelector("textarea");
      promptSection.body.append(
        tplRow,
        appButton("填入内置提示词底稿（在此基础上改）", () => {
          if (tplInput.value.trim() && !window.confirm("用内置底稿覆盖当前已填写的自定义提示词？")) return;
          tplInput.value = BUILTIN_TEMPLATE;
          ctx.updateSettings({ ...ctx.getSettings(), promptTemplate: BUILTIN_TEMPLATE });
        })
      );
      container.append(stateSection, displaySection.box, autoSection.box, promptSection.box);
    }
  };
}

// st-extension/src/apps/gallery-app.ts
function galleryApp(deps) {
  return {
    id: "gallery",
    name: "图库",
    icon: "🗂",
    order: 2,
    mount(container, ctx) {
      const settings = ctx.getSettings();
      const section = el2("div", "so-app-section");
      const desc = el2("div", "so-app-desc");
      desc.textContent = "立绘包管理：新建/上传/导入导出/分享串/角色绑定。";
      section.append(desc, appButton("打开立绘包管理", () => deps.openManager()));
      container.append(section);
      const list = el2("div", "so-app-section");
      const title = el2("div", "so-app-title");
      title.textContent = `共 ${settings.packs.length} 个立绘包`;
      list.append(title);
      const boundIds = new Set(settings.bindings.flatMap((b) => b.packIds));
      const sorted = [...settings.packs].sort(
        (a, b) => Number(boundIds.has(b.id)) - Number(boundIds.has(a.id))
      );
      const MAX_SHOWN = 5;
      for (const pack of sorted.slice(0, MAX_SHOWN)) {
        const row = el2("div", "so-app-desc");
        row.textContent = `· ${pack.name}（${pack.sprites.length} 张）${boundIds.has(pack.id) ? "　使用中" : ""}`;
        list.append(row);
      }
      if (settings.packs.length > MAX_SHOWN) {
        const more = el2("div", "so-app-desc");
        more.textContent = `…还有 ${settings.packs.length - MAX_SHOWN} 个，全部在「立绘包管理」查看`;
        list.append(more);
      }
      container.append(list);
      const hostSection = el2("div", "so-app-section");
      const hostTitle = el2("div", "so-app-title");
      hostTitle.textContent = "图床（两条通道，互不影响）";
      hostSection.append(hostTitle);
      const autoDesc = el2("div", "so-app-desc");
      autoDesc.textContent = "① 自动直传（imgbb）：上传/替换图片时自动传 imgbb 并绑定编号，本地图保留作显示保底，直链用于分享串。";
      const hint = el2("div", "so-app-desc");
      hint.textContent = "Key 明文保存在 ST 扩展设置里（随 ST 服务端 settings.json 落盘），不会写入分享串或导出文件；上传失败时图片仍保留本地，可稍后补传。";
      hostSection.append(
        autoDesc,
        textRow(
          "imgbb API Key（存 ST 设置，明文）",
          settings.imgbbApiKey,
          "免费申请：api.imgbb.com",
          (raw) => ctx.updateSettings({ ...ctx.getSettings(), imgbbApiKey: raw.trim() }),
          "password"
        ),
        toggleRow("上传时自动直传 imgbb 并绑定编号", settings.autoUpload, (v) => {
          const cur = ctx.getSettings();
          if (v && !cur.imgbbApiKey.trim()) {
            hint.textContent = "请先填写 imgbb API Key（免费申请：https://api.imgbb.com/）";
            ctx.updateSettings({ ...cur, autoUpload: false });
            return;
          }
          ctx.updateSettings({ ...cur, autoUpload: v });
        }),
        hint
      );
      const manualDesc = el2("div", "so-app-desc");
      manualDesc.textContent = "② 手动编码通道：「按编码添加」和分享串/插图编码解析时，用下面前缀拼接完整地址（默认 catbox）。";
      hostSection.append(
        manualDesc,
        textRow("图床前缀", settings.imageHost, DEFAULT_IMAGE_HOST, (raw) => {
          const v = raw.trim() || DEFAULT_IMAGE_HOST;
          const value = /^https?:\/\/.+/.test(v) ? v.endsWith("/") ? v : `${v}/` : DEFAULT_IMAGE_HOST;
          ctx.updateSettings({ ...ctx.getSettings(), imageHost: value });
        })
      );
      container.append(hostSection);
    }
  };
}

// st-extension/src/apps/butler/bridge.ts
function getST() {
  try {
    return window.SillyTavern?.getContext();
  } catch {
    return void 0;
  }
}
function readBool(pu, key, dflt) {
  const v = pu[key];
  return typeof v === "boolean" ? v : dflt;
}
function readNum(pu, key, dflt) {
  const v = pu[key];
  return typeof v === "number" && Number.isFinite(v) ? v : dflt;
}
function readPerf() {
  const pu = getST()?.powerUserSettings;
  if (!pu) return null;
  return {
    fast_ui_mode: readBool(pu, "fast_ui_mode", true),
    reduced_motion: readBool(pu, "reduced_motion", false),
    noShadows: readBool(pu, "noShadows", false),
    smooth_streaming: readBool(pu, "smooth_streaming", false),
    stream_fade_in: readBool(pu, "stream_fade_in", false),
    streaming_fps: readNum(pu, "streaming_fps", 30),
    chat_truncation: readNum(pu, "chat_truncation", 100)
  };
}
function isMobile() {
  const st = getST();
  return typeof st?.isMobile === "function" && st.isMobile();
}
async function applyVisuals() {
  try {
    const modUrl = "/scripts/power-user.js";
    const mod = await import(modUrl);
    mod.applyPowerUserSettings?.();
  } catch (err) {
    console.warn("[st-stage] 管家：applyPowerUserSettings 不可用，视觉项将在刷新页面后生效", err);
  }
}
function applyReducedMotion(on) {
  const jq = window.jQuery;
  if (jq?.fx) jq.fx.off = on;
}
async function reloadChatSafe(st) {
  try {
    await Promise.resolve(st.reloadCurrentChat?.());
  } catch (err) {
    console.warn("[st-stage] 管家：重载当前对话失败，消息加载数将在切换对话后生效", err);
  }
}
async function writePerf(fields) {
  const st = getST();
  const pu = st?.powerUserSettings;
  if (!st || !pu) return;
  const prevTrunc = readNum(pu, "chat_truncation", 100);
  Object.assign(pu, fields);
  if (fields.reduced_motion !== void 0) applyReducedMotion(fields.reduced_motion);
  if (fields.fast_ui_mode !== void 0 || fields.noShadows !== void 0) await applyVisuals();
  st.saveSettingsDebounced?.();
  if (fields.chat_truncation !== void 0 && fields.chat_truncation !== prevTrunc) {
    await reloadChatSafe(st);
  }
}
function readHealth() {
  const ext = getST()?.extensionSettings ?? {};
  const disabled = ext["disabledExtensions"];
  const qr = ext["quickReply"];
  return {
    disabledExtensions: Array.isArray(disabled) ? disabled.length : 0,
    quickReplySets: Array.isArray(qr?.config?.setList) ? qr.config.setList.length : null
  };
}

// st-extension/src/apps/butler-app.ts
function ensureSnapshot(ctx, perf) {
  const data = ctx.getAppData() ?? {};
  if (data.snapshot) return data;
  const next = { ...data, snapshot: perf };
  ctx.setAppData(next);
  return next;
}
async function enablePerfMode(ctx) {
  const perf = readPerf();
  if (!perf) return;
  const data = ensureSnapshot(ctx, perf);
  ctx.setAppData({ ...data, perfOn: true });
  const target = isMobile() ? 20 : 50;
  const curTrunc = perf.chat_truncation;
  const nextTrunc = curTrunc > 0 && curTrunc < target ? curTrunc : target;
  await writePerf({
    fast_ui_mode: true,
    reduced_motion: true,
    noShadows: true,
    smooth_streaming: false,
    stream_fade_in: false,
    streaming_fps: 15,
    chat_truncation: nextTrunc
  });
}
async function restoreSnapshot(ctx) {
  const snap = (ctx.getAppData() ?? {}).snapshot;
  if (!readPerf() || !snap) return;
  await writePerf(snap);
  ctx.setAppData({ perfOn: false });
}
async function writeField(ctx, key, value) {
  const perf = readPerf();
  if (!perf) return;
  ensureSnapshot(ctx, perf);
  await writePerf({ [key]: value });
}
function descLine(parent, text) {
  const d = el2("div", "so-app-desc");
  d.textContent = text;
  parent.append(d);
}
function buildGuide() {
  const { box, body } = foldSection("优化指南（需手动操作）");
  descLine(body, "【浏览器】硬件加速是两面刃：本机同时跑本地模型（SD/本地 LLM）建议关，不跑建议开。");
  descLine(body, "【浏览器】Android 浏览器不要手动开 GPU rasterization 类实验项（反而有害）。");
  descLine(
    body,
    "【浏览器】桌面 Chrome 可试 chrome://flags 的 GPU rasterization / ANGLE D3D11（实验项名称随版本变化，搜不到说明已移除或改名）。"
  );
  descLine(body, "【浏览器】已知拖慢 ST 的浏览器扩展：iCloud 密码、DeepL、AI 语法纠正类、部分广告拦截器。");
  descLine(body, "【服务端 config.yaml，前端改不了】requestCompression 开启后长聊天弱网明显省流量。");
  descLine(body, "【服务端】lazyLoadCharacters：1.18 默认已开；老用户沿用的旧 config 可能还是 false，卡多必开。");
  descLine(body, "【服务端】memoryCacheCapacity：约每 3000 张角色卡 +100MB。");
  descLine(body, "【服务端】useDiskCache：仅磁盘极慢（如老 SD 卡）场景才考虑关。");
  return box;
}
function butlerApp() {
  return {
    id: "butler",
    name: "管家",
    icon: "🧹",
    order: 3,
    mount(container, ctx) {
      render(container, ctx);
    }
  };
}
function render(container, ctx) {
  container.textContent = "";
  const perf = readPerf();
  if (!perf) {
    const section = el2("div", "so-app-section");
    descLine(section, "未检测到 SillyTavern 运行时（Web 模拟器中仅可查看优化指南）。");
    container.append(section, buildGuide());
    return;
  }
  const data = ctx.getAppData() ?? {};
  const rerender = () => render(container, ctx);
  const mobile = isMobile();
  const main = el2("div", "so-app-section");
  const title = el2("div", "so-app-title");
  title.textContent = data.perfOn ? "一键性能模式（已开启）" : "一键性能模式";
  main.append(
    hintField(
      title,
      "第一次开启前会把你当前的这些设置整组拍成快照存起来；“还原”就是把快照原样写回。所以放心开——不满意随时一键还原到开启前的样子，不会丢你原来的偏好。"
    )
  );
  descLine(
    main,
    `关闭背景模糊/阴影/动画/平滑流式，流式帧率降到 15，消息加载数降到 ${mobile ? "20（移动端）" : "50"}。改动前自动保存原设置快照。`
  );
  main.append(
    appButton("开启性能模式", () => {
      void enablePerfMode(ctx).then(rerender);
    })
  );
  if (data.snapshot) {
    main.append(
      appButton("还原到改动前快照", () => {
        void restoreSnapshot(ctx).then(rerender);
      })
    );
    descLine(main, "已保存改动前快照，可随时一键还原。");
  }
  container.append(main);
  const tweak = foldSection("手动微调");
  tweak.body.append(
    hintField(
      toggleRow("No Blur（关背景模糊）", perf.fast_ui_mode, (v) => {
        void writeField(ctx, "fast_ui_mode", v);
      }),
      "关闭聊天框、弹窗背后的毛玻璃模糊。模糊很吃 GPU，几乎所有卡顿场景都建议开启（=关模糊）。官方公认最有效的提速项之一。"
    ),
    hintField(
      toggleRow("减少动画", perf.reduced_motion, (v) => {
        void writeField(ctx, "reduced_motion", v);
      }),
      "关闭界面过渡动画（展开/淡入等）。低端机、长聊天滚动卡顿时开。改此项需刷新页面才完全生效。"
    ),
    hintField(
      toggleRow("关闭阴影", perf.noShadows, (v) => {
        void writeField(ctx, "noShadows", v);
      }),
      "去掉界面元素投影，减少重绘。视觉略扁平，但换来更顺滑的滚动。追求性能可开。"
    ),
    hintField(
      toggleRow("平滑流式", perf.smooth_streaming, (v) => {
        void writeField(ctx, "smooth_streaming", v);
      }),
      "AI 回复逐字平滑吐字的动画。好看但持续占用渲染；出字卡顿、掉帧时建议关闭。"
    ),
    hintField(
      toggleRow("流式淡入", perf.stream_fade_in, (v) => {
        void writeField(ctx, "stream_fade_in", v);
      }),
      "新出的文字带淡入效果。同样是额外渲染开销，卡顿时关。"
    ),
    hintField(
      numberRow("流式帧率 FPS", perf.streaming_fps, 5, 100, (v) => {
        void writeField(ctx, "streaming_fps", v);
      }),
      "AI 回复刷新的帧率。越高越顺滑但越吃性能。默认约 30；低端机/手机官方建议降到 10–15，肉眼几乎无差却明显省电省算力。"
    ),
    hintField(
      numberRow("消息加载数", perf.chat_truncation, 0, 1e5, (v) => {
        void writeField(ctx, "chat_truncation", v);
      }),
      "打开对话时载入 DOM 的最近消息条数（0=全部）。长聊天最主要的卡顿来源。手机建议 15–20、桌面 50 左右；往上翻能继续加载更早的消息，不会丢。改后自动重载当前对话。"
    )
  );
  container.append(tweak.box);
  const check = foldSection("体检");
  const health = readHealth();
  descLine(check.body, `已禁用扩展：${health.disabledExtensions} 个。`);
  if (health.quickReplySets !== null) {
    descLine(check.body, `Quick Reply 集合：${health.quickReplySets} 个（社区反馈集合过多可能造成输入拖拽卡顿，卡则精简）。`);
  }
  descLine(check.body, "输入卡顿最常见元凶是第三方扩展：逐个禁用排查（扩展启停改动需刷新页面才真正生效）。");
  container.append(check.box);
  container.append(buildGuide());
}

// st-extension/src/apps/path-utils.ts
function splitPath(path) {
  return path.split(".").filter((seg) => seg.length > 0);
}
function getNested(obj, path) {
  let cur = obj;
  for (const seg of splitPath(path)) {
    if (cur == null || typeof cur !== "object") return void 0;
    cur = cur[seg];
  }
  return cur;
}
function setNested(obj, path, value) {
  const segs = splitPath(path);
  if (segs.length === 0) return;
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    const next = cur[seg];
    if (next == null || typeof next !== "object" || Array.isArray(next)) cur[seg] = {};
    cur = cur[seg];
  }
  cur[segs[segs.length - 1]] = value;
}
function deleteNested(obj, path) {
  const segs = splitPath(path);
  if (segs.length === 0) return;
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    if (cur == null || typeof cur !== "object") return;
    cur = cur[segs[i]];
  }
  if (cur != null && typeof cur === "object") delete cur[segs[segs.length - 1]];
}

// st-extension/src/apps/variable-tree.ts
function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}
function isTupleLeaf(v) {
  return Array.isArray(v) && v.length === 2 && typeof v[1] === "string" && !Array.isArray(v[0]);
}
function extractStatRootFrom(wrapper) {
  if (isPlainObject(wrapper.stat_data)) return { root: wrapper.stat_data, wrapped: true };
  return { root: wrapper, wrapped: false };
}
function formatValue(v) {
  if (typeof v === "string") return v;
  if (v === null) return "null";
  if (v === void 0) return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  }
  return String(v);
}
function parseInputValue(raw) {
  const t = raw.trim();
  if (t === "null") return null;
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      return JSON.parse(t);
    } catch {
    }
  }
  return raw;
}
function editKind(v) {
  if (typeof v === "boolean") return "boolean";
  if (v !== null && typeof v === "object") return "json";
  return "text";
}
function valueTypeLabel(v, tuple) {
  const inner = tuple ? v[0] : v;
  if (inner === null) return "null";
  if (Array.isArray(inner)) return `数组[${inner.length}]`;
  if (typeof inner === "object") return "对象";
  return typeof inner === "number" ? "数字" : typeof inner === "boolean" ? "布尔" : "文本";
}
function jsonEqual(a, b) {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
function computeDelta(current, prev, isMvu) {
  const delta = /* @__PURE__ */ new Map();
  if (!prev) return delta;
  const walk = (obj, prefix) => {
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      const path = prefix ? `${prefix}.${key}` : key;
      const tuple = isMvu && isTupleLeaf(val);
      if (!tuple && isPlainObject(val) && Object.keys(val).length > 0) {
        walk(val, path);
        continue;
      }
      const curLeaf = tuple ? val[0] : val;
      const prevRaw = getNested(prev, path);
      if (prevRaw === void 0) {
        delta.set(path, { kind: "added" });
        continue;
      }
      const prevLeaf = isMvu && isTupleLeaf(prevRaw) ? prevRaw[0] : prevRaw;
      if (typeof curLeaf === "number" && typeof prevLeaf === "number") {
        if (curLeaf !== prevLeaf) delta.set(path, { kind: curLeaf > prevLeaf ? "inc" : "dec", diff: curLeaf - prevLeaf });
      } else if (!jsonEqual(curLeaf, prevLeaf)) {
        delta.set(path, { kind: "changed" });
      }
    }
  };
  walk(current, "");
  return delta;
}
function createVariableTreeView(container, handlers) {
  let editingPath = null;
  const groupOpen = /* @__PURE__ */ new Map();
  let addOpen = false;
  function render3() {
    const model = handlers.getModel();
    container.textContent = "";
    const head = el2("div", "so-app-section vm-head");
    const line = el2("div", "vm-statusrow");
    const status = el2("div", "so-app-desc vm-status");
    status.textContent = model.statusText;
    const refreshBtn = el2("button", "menu_button vm-refresh");
    refreshBtn.setAttribute("role", "button");
    refreshBtn.textContent = "刷新";
    refreshBtn.addEventListener("click", () => handlers.requestRefresh());
    line.append(status, refreshBtn);
    head.append(line);
    container.append(head);
    if (model.noticeText) {
      appendNotice(model.noticeText);
      if (model.status === "unavailable") return;
    }
    const keys = Object.keys(model.data);
    if (keys.length === 0) {
      appendNotice(model.emptyText);
    } else {
      const tree = el2("div", "vm-tree");
      for (const key of keys) renderNode(model, tree, key, model.data[key], key, 0);
      container.append(tree);
    }
    container.append(buildAddSection(model));
  }
  function appendNotice(text) {
    const note = el2("div", "so-app-section");
    const d = el2("div", "so-app-desc");
    d.textContent = text;
    note.append(d);
    container.append(note);
  }
  function renderNode(model, parent, key, value, path, depth) {
    const tuple = model.isMvu && isTupleLeaf(value);
    if (!tuple && isPlainObject(value) && Object.keys(value).length > 0) {
      const details = document.createElement("details");
      details.className = "so-app-fold vm-group";
      details.open = groupOpen.get(path) ?? depth < 1;
      details.addEventListener("toggle", () => groupOpen.set(path, details.open));
      const summary = document.createElement("summary");
      summary.className = "so-app-title vm-group-title";
      summary.textContent = `${key}（${Object.keys(value).length}）`;
      const body = el2("div", "so-app-fold-body vm-group-body");
      for (const childKey of Object.keys(value)) {
        renderNode(model, body, childKey, value[childKey], `${path}.${childKey}`, depth + 1);
      }
      details.append(summary, body);
      parent.append(details);
      return;
    }
    renderLeaf(model, parent, key, value, path, tuple);
  }
  function renderLeaf(model, parent, key, value, path, tuple) {
    if (editingPath === path) {
      parent.append(buildEditForm(model, key, value, path, tuple));
      return;
    }
    const card = el2("div", "vm-leaf");
    const main = el2("div", "vm-leaf-main");
    const keyEl = el2("span", "vm-key");
    keyEl.textContent = key;
    const valEl = el2("span", "vm-val");
    const shown = formatValue(tuple ? value[0] : value);
    valEl.textContent = shown.length > 80 ? `${shown.slice(0, 80)}…` : shown;
    valEl.title = `类型：${valueTypeLabel(value, tuple)}`;
    main.append(keyEl, valEl);
    const d = model.delta.get(path);
    if (d) main.append(buildDeltaBadge(d));
    if (tuple) {
      const desc = el2("div", "vm-desc");
      desc.textContent = value[1];
      main.append(desc);
    }
    if (model.canWrite) {
      main.setAttribute("role", "button");
      main.tabIndex = 0;
      const enterEdit = () => {
        editingPath = path;
        render3();
      };
      main.addEventListener("click", enterEdit);
      main.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          enterEdit();
        }
      });
    }
    card.append(main);
    if (model.canWrite) {
      const del = el2("button", "vm-del");
      del.setAttribute("aria-label", "删除变量");
      del.title = "删除该变量";
      del.textContent = "✕";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!window.confirm(`删除变量「${path}」？此操作不可撤销。`)) return;
        editingPath = null;
        handlers.commitDelete(path);
      });
      card.append(del);
    }
    parent.append(card);
  }
  function buildDeltaBadge(d) {
    const badge = el2("span", `vm-badge vm-badge-${d.kind}`);
    if (d.kind === "inc" || d.kind === "dec") {
      const n = d.diff ?? 0;
      const shown = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
      badge.textContent = `${n > 0 ? "+" : ""}${shown}`;
    } else {
      badge.textContent = d.kind === "added" ? "新" : "改";
    }
    return badge;
  }
  function buildEditForm(model, key, value, path, tuple) {
    const inner = tuple ? value[0] : value;
    const kind = editKind(inner);
    const wrap = el2("div", "vm-leaf vm-editing");
    const title = el2("div", "so-app-title vm-edit-title");
    title.textContent = `${key} · ${valueTypeLabel(value, tuple)}`;
    wrap.append(title);
    if (tuple) {
      const desc = el2("div", "vm-desc");
      desc.textContent = `描述：${value[1]}（保留不变，仅编辑值）`;
      wrap.append(desc);
    }
    const err = el2("div", "so-app-desc vm-add-err");
    err.hidden = true;
    let readValue;
    if (kind === "boolean") {
      const sel = document.createElement("select");
      sel.className = "text_pole so-app-input vm-edit-input";
      for (const opt of [
        { v: "true", t: "真（true）" },
        { v: "false", t: "假（false）" }
      ]) {
        const o = document.createElement("option");
        o.value = opt.v;
        o.textContent = opt.t;
        if (inner === true === (opt.v === "true")) o.selected = true;
        sel.append(o);
      }
      wrap.append(sel);
      readValue = () => ({ ok: true, value: sel.value === "true" });
    } else if (kind === "json") {
      const ta = document.createElement("textarea");
      ta.className = "text_pole so-app-input vm-edit-input";
      ta.rows = 5;
      ta.value = formatValue(inner);
      wrap.append(ta);
      readValue = () => {
        try {
          return { ok: true, value: JSON.parse(ta.value) };
        } catch (e) {
          return { ok: false, msg: `JSON 格式错误：${e instanceof Error ? e.message : String(e)}` };
        }
      };
      setTimeout(() => ta.focus(), 0);
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "text_pole so-app-input vm-edit-input";
      input.value = formatValue(inner);
      input.autocomplete = "off";
      wrap.append(input);
      readValue = () => ({ ok: true, value: parseInputValue(input.value) });
      setTimeout(() => input.focus(), 0);
    }
    wrap.append(err);
    const actions = el2("div", "vm-actions");
    const save = el2("button", "menu_button vm-act");
    save.textContent = "保存";
    save.addEventListener("click", () => {
      const r = readValue();
      if (!r.ok) {
        err.textContent = r.msg ?? "输入无效。";
        err.hidden = false;
        return;
      }
      editingPath = null;
      handlers.commitSet(path, r.value);
    });
    const cancel = el2("button", "menu_button vm-act vm-act-ghost");
    cancel.textContent = "取消";
    cancel.addEventListener("click", () => {
      editingPath = null;
      render3();
    });
    actions.append(save, cancel);
    wrap.append(actions);
    return wrap;
  }
  function buildAddSection(model) {
    const box = document.createElement("details");
    box.className = "so-app-fold so-app-section";
    box.open = addOpen;
    box.addEventListener("toggle", () => addOpen = box.open);
    const summary = document.createElement("summary");
    summary.className = "so-app-title";
    summary.textContent = "＋ 新增变量";
    const body = el2("div", "so-app-fold-body");
    const hint = el2("div", "so-app-desc");
    hint.textContent = model.addHint;
    body.append(hint);
    const pathInput = document.createElement("input");
    pathInput.type = "text";
    pathInput.className = "text_pole so-app-input";
    pathInput.placeholder = "变量路径（如 状态.体力）";
    pathInput.autocomplete = "off";
    const valInput = document.createElement("input");
    valInput.type = "text";
    valInput.className = "text_pole so-app-input";
    valInput.placeholder = "值（如 80 / 健康 / true）";
    valInput.autocomplete = "off";
    body.append(pathInput, valInput);
    const err = el2("div", "so-app-desc vm-add-err");
    err.hidden = true;
    body.append(err);
    body.append(
      appButton("添加", () => {
        const path = pathInput.value.trim();
        if (!path) {
          err.textContent = "请填写变量路径。";
          err.hidden = false;
          return;
        }
        if (!model.canWrite) {
          err.textContent = "当前环境不可写入变量。";
          err.hidden = false;
          return;
        }
        handlers.commitSet(path, parseInputValue(valInput.value));
      })
    );
    box.append(summary, body);
    return box;
  }
  return {
    render: render3,
    resetEditing() {
      editingPath = null;
    },
    isEditing() {
      return editingPath !== null;
    }
  };
}

// st-extension/src/apps/mvu/bridge.ts
function getMvu() {
  const w = window;
  return w.parent?.Mvu ?? w.Mvu;
}
function getHelper() {
  const w = window;
  return w.parent?.TavernHelper ?? w.TavernHelper;
}
function getST2() {
  try {
    return window.SillyTavern?.getContext();
  } catch {
    return void 0;
  }
}
function isMvuAvailable() {
  const mvu = getMvu();
  return typeof mvu?.getMvuData === "function" && typeof mvu?.replaceMvuData === "function";
}
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function getLastMessageId() {
  const helper = getHelper();
  if (typeof helper?.getLastMessageId === "function") {
    try {
      const id = helper.getLastMessageId();
      if (Number.isInteger(id) && id >= 0) return id;
    } catch {
    }
  }
  const chat = getST2()?.chat;
  if (Array.isArray(chat) && chat.length > 0) return chat.length - 1;
  return -1;
}
async function waitForMvuInitialized(timeoutMs) {
  const w = window;
  const waitFn = w.parent?.waitGlobalInitialized ?? w.waitGlobalInitialized;
  if (typeof waitFn !== "function") return;
  await Promise.race([Promise.resolve(waitFn("Mvu")).catch(() => void 0), delay(timeoutMs)]);
}
async function readMvuDataWithRetry(scope, timeoutMs, intervalMs) {
  const mvu = getMvu();
  const start = Date.now();
  let attempts = 0;
  let data;
  for (; ; ) {
    attempts++;
    data = await Promise.resolve(mvu.getMvuData(scope)) ?? {};
    const stat = data.stat_data;
    if (stat && Object.keys(stat).length > 0) return { data, attempts };
    if (Date.now() - start >= timeoutMs) return { data, attempts };
    await delay(intervalMs);
  }
}
async function readHelperWrapper(scope) {
  const helper = getHelper();
  if (typeof helper?.getVariables !== "function") return null;
  const vars = await Promise.resolve(helper.getVariables(scope));
  return vars && typeof vars === "object" ? vars : {};
}
async function readStatRootAt(messageId) {
  if (messageId < 0) return null;
  const scope = { type: "message", message_id: messageId };
  try {
    if (isMvuAvailable()) {
      const data = await Promise.resolve(getMvu().getMvuData(scope)) ?? {};
      return isPlainObject(data.stat_data) ? data.stat_data : null;
    }
    const wrapper = await readHelperWrapper(scope);
    return wrapper ? extractStatRootFrom(wrapper).root : null;
  } catch {
    return null;
  }
}
async function findPrevStatRoot(fromId, maxScan = 20) {
  const stop = Math.max(0, fromId - maxScan + 1);
  for (let id = fromId; id >= stop; id--) {
    const root = await readStatRootAt(id);
    if (root && Object.keys(root).length > 0) return root;
  }
  return null;
}
async function readVariables(scope, messageId) {
  const meta = { source: "none", waitedMvu: false };
  const base = { isMvu: false, wrapped: true, messageId, meta };
  if (messageId < 0) return { status: "empty", data: {}, ...base };
  if (!isMvuAvailable()) {
    await waitForMvuInitialized(1200);
    meta.waitedMvu = true;
  }
  if (isMvuAvailable()) {
    try {
      const { data } = await readMvuDataWithRetry(scope, 1200, 120);
      const stat = data.stat_data ?? {};
      if (Object.keys(stat).length > 0) {
        meta.source = "mvu";
        return { status: "ready", data: stat, isMvu: true, wrapped: true, messageId, meta };
      }
      const fb = await readHelperFallback(scope, messageId, meta);
      if (fb) return fb;
      return { status: "empty", data: {}, isMvu: true, wrapped: true, messageId, meta };
    } catch (err) {
      const fb = await readHelperFallback(scope, messageId, meta);
      if (fb) return fb;
      return {
        status: "error",
        data: {},
        isMvu: false,
        wrapped: true,
        messageId,
        meta,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
  const wrapper = await readHelperWrapper(scope).catch(() => null);
  if (wrapper) {
    const { root, wrapped } = extractStatRootFrom(wrapper);
    meta.source = Object.keys(root).length > 0 ? "tavern-helper" : "none";
    return {
      status: Object.keys(root).length > 0 ? "ready" : "empty",
      data: root,
      isMvu: false,
      wrapped,
      messageId,
      meta
    };
  }
  return { status: "unavailable", data: {}, isMvu: false, wrapped: true, messageId, meta };
}
async function readHelperFallback(scope, messageId, meta) {
  const wrapper = await readHelperWrapper(scope).catch(() => null);
  if (!wrapper) return null;
  const { root, wrapped } = extractStatRootFrom(wrapper);
  if (Object.keys(root).length === 0) return null;
  meta.source = "tavern-helper";
  return { status: "ready", data: root, isMvu: false, wrapped, messageId, meta };
}
function fullPath(wrapped, path) {
  return wrapped ? `stat_data.${path}` : path;
}
function applySet(container, wrapped, path, value) {
  const fp = fullPath(wrapped, path);
  const old = getNested(container, fp);
  const final = isTupleLeaf(old) ? [value, old[1]] : value;
  setNested(container, fp, final);
}
async function setFloorVariable(scope, wrapped, path, value) {
  const mvu = getMvu();
  if (isMvuAvailable()) {
    const wrapper = await Promise.resolve(mvu.getMvuData(scope)) ?? {};
    applySet(wrapper, true, path, value);
    await Promise.resolve(mvu.replaceMvuData(wrapper, scope));
    return;
  }
  await writeHelper(scope, (vars) => applySet(vars, wrapped, path, value));
}
async function deleteFloorVariable(scope, wrapped, path) {
  const mvu = getMvu();
  if (isMvuAvailable()) {
    const wrapper = await Promise.resolve(mvu.getMvuData(scope)) ?? {};
    deleteNested(wrapper, fullPath(true, path));
    await Promise.resolve(mvu.replaceMvuData(wrapper, scope));
    return;
  }
  await writeHelper(scope, (vars) => deleteNested(vars, fullPath(wrapped, path)));
}
async function writeHelper(scope, mutate) {
  const helper = getHelper();
  if (typeof helper?.updateVariablesWith === "function") {
    await Promise.resolve(
      helper.updateVariablesWith((vars) => {
        const v = isPlainObject(vars) ? vars : {};
        mutate(v);
        return v;
      }, scope)
    );
    return;
  }
  if (typeof helper?.getVariables === "function" && typeof helper?.replaceVariables === "function") {
    const vars = await Promise.resolve(helper.getVariables(scope)) ?? {};
    mutate(vars);
    await Promise.resolve(helper.replaceVariables(vars, scope));
    return;
  }
  throw new Error("无可用的变量写入通道（MVU / 酒馆助手均不可用）");
}
function subscribeVarEvents(handler) {
  const st = getST2();
  const es = st?.eventSource;
  if (!es) return () => {
  };
  const mvu = getMvu();
  const names = /* @__PURE__ */ new Set([
    mvu?.events?.VARIABLE_UPDATE_ENDED ?? "mag_variable_update_ended",
    mvu?.events?.VARIABLE_INITIALIZED ?? "mag_variable_initialized",
    st?.eventTypes?.CHAT_CHANGED ?? "chat_id_changed",
    st?.eventTypes?.MESSAGE_SWIPED ?? "message_swiped",
    st?.eventTypes?.MESSAGE_DELETED ?? "message_deleted"
  ]);
  const offs = [];
  for (const name of names) {
    if (!name) continue;
    const h = () => handler();
    es.on(name, h);
    offs.push(() => {
      try {
        es.removeListener(name, h);
      } catch {
      }
    });
  }
  return () => {
    for (const off of offs) off();
  };
}

// st-extension/src/apps/mvu-app.ts
function createInstance(container, _ctx) {
  let disposed = false;
  let seq = 0;
  let lastResult = null;
  let delta = /* @__PURE__ */ new Map();
  let refreshTimer = null;
  let offEvents = null;
  const view = createVariableTreeView(container, {
    getModel: () => buildModel(),
    commitSet: (path, value) => void runWrite(() => setFloorVariable(currentScope(), currentWrapped(), path, value)),
    commitDelete: (path) => void runWrite(() => deleteFloorVariable(currentScope(), currentWrapped(), path)),
    requestRefresh: () => void load()
  });
  function currentScope() {
    return { type: "message", message_id: lastResult?.messageId ?? getLastMessageId() };
  }
  function currentWrapped() {
    return lastResult?.wrapped ?? true;
  }
  function sourceLabel(r) {
    if (r.meta.source === "mvu") return "MVU";
    if (r.meta.source === "tavern-helper") return "酒馆助手";
    return "—";
  }
  function buildModel() {
    const r = lastResult;
    if (!r) {
      return {
        data: {},
        isMvu: true,
        delta: /* @__PURE__ */ new Map(),
        status: "empty",
        statusText: "正在读取…",
        emptyText: "正在读取楼层变量…",
        canWrite: false,
        addHint: ""
      };
    }
    const canWrite = r.status !== "unavailable";
    let noticeText;
    if (r.status === "unavailable") {
      noticeText = "未检测到 MVU 框架或酒馆助手（Web 模拟器中仅可查看本说明）。在 SillyTavern 内、且安装了 MVU/酒馆助手时才能读写楼层变量。";
    } else if (r.status === "error") {
      noticeText = `读取变量出错：${r.error ?? "未知错误"}。可点「刷新」重试。`;
    }
    return {
      data: r.data,
      isMvu: r.isMvu,
      delta,
      status: r.status,
      statusText: `来源：${sourceLabel(r)} · ${r.messageId >= 0 ? `楼层 #${r.messageId}` : "无对话"}`,
      emptyText: r.status === "empty" && r.meta.waitedMvu ? "当前楼层暂无变量（已等待 MVU 初始化）。有变量的楼层刷新后会显示在这里。" : "当前楼层暂无变量。",
      noticeText,
      canWrite,
      addHint: canWrite ? "正常情况下变量由 MVU 框架按角色卡规则维护，无需手动新增；这里仅用于修补卡片缺失的变量或调试（卡的更新规则里没有的路径，AI 不会主动维护）。路径点号分层，值支持 数字/true/false/null/JSON/文本。" : "当前环境不可写入变量。"
    };
  }
  function isStale(token) {
    return disposed || token !== seq || !container.isConnected;
  }
  async function load() {
    const token = ++seq;
    view.resetEditing();
    if (!lastResult) view.render();
    const messageId = getLastMessageId();
    const result = await readVariables({ type: "message", message_id: messageId }, messageId);
    if (isStale(token)) return;
    let nextDelta = /* @__PURE__ */ new Map();
    if (result.status === "ready" && messageId > 0) {
      const prev = await findPrevStatRoot(messageId - 1);
      if (isStale(token)) return;
      nextDelta = computeDelta(result.data, prev, result.isMvu);
    }
    lastResult = result;
    delta = nextDelta;
    view.render();
  }
  function scheduleRefresh() {
    if (disposed || view.isEditing()) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      if (!disposed && !view.isEditing()) void load();
    }, 300);
  }
  async function runWrite(op) {
    try {
      await op();
    } catch (err) {
      console.error("[st-stage] 变量写入失败", err);
      window.alert(`写入失败：${err instanceof Error ? err.message : String(err)}`);
    }
    if (!disposed) await load();
  }
  return {
    start() {
      offEvents = subscribeVarEvents(() => scheduleRefresh());
      void load();
    },
    dispose() {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = null;
      offEvents?.();
      offEvents = null;
    }
  };
}
function mvuApp() {
  let inst = null;
  return {
    id: "mvu",
    name: "MVU",
    icon: "🔢",
    order: 4,
    mount(container, ctx) {
      inst?.dispose();
      inst = createInstance(container, ctx);
      inst.start();
    },
    unmount() {
      inst?.dispose();
      inst = null;
    }
  };
}

// st-extension/src/apps/newvar-app.ts
function newvarApp(deps) {
  let unsub = null;
  return {
    id: "newvar",
    name: "新变量",
    icon: "🧮",
    order: 5,
    mount(container, ctx) {
      unsub?.();
      const { runtime, openDesigner } = deps;
      const cfgBox = el2("div", "nv-box");
      const stateBox = el2("div", "nv-box");
      container.append(cfgBox, stateBox);
      function renderCfg() {
        cfgBox.textContent = "";
        const d = runtime.getData();
        const section = el2("div", "so-app-section");
        section.append(
          hintField(
            toggleRow("启用变量追踪", d.enabled, (v) => {
              ctx.setAppData({ ...runtime.getData(), enabled: v });
              runtime.onConfigChanged();
              renderCfg();
            }),
            "不依赖 MVU/酒馆助手：按你的变量定义自动向 AI 注入当前状态与更新规则，解析回复末尾的 <UpdateVariable> 并逐楼保存快照，任何角色卡都能用。变量定义、模板、注入预览都在「变量设计」里。"
          ),
          appButton("打开变量设计", openDesigner)
        );
        cfgBox.append(section);
      }
      const tree = createVariableTreeView(stateBox, {
        getModel: () => {
          const st = runtime.isSTAvailable();
          const d = runtime.getData();
          const state = runtime.getCurrentState();
          return {
            data: state,
            isMvu: false,
            delta: computeDelta(state, runtime.getPrevState(), false),
            status: st ? "ready" : "unavailable",
            statusText: st ? `内置追踪 · ${d.enabled ? "已启用" : "未启用"}` : "内置追踪 · 模拟器",
            emptyText: "暂无变量。点上方「打开变量设计」定义或导入模板，启用后 AI 回复会逐楼更新这里。",
            noticeText: st ? void 0 : "未检测到 SillyTavern：模拟器中可打开变量设计编辑定义与预览注入，状态快照在 ST 内才会产生。",
            canWrite: st,
            addHint: "手动新增只写入当前楼的状态快照（不会加进变量定义）。路径用点号分层。"
          };
        },
        commitSet: (path, value) => runtime.setVariable(path, value),
        commitDelete: (path) => runtime.deleteVariable(path),
        requestRefresh: () => tree.render()
      });
      renderCfg();
      tree.render();
      const offRuntime = runtime.subscribe(() => {
        if (!tree.isEditing()) tree.render();
      });
      unsub = () => offRuntime();
    },
    unmount() {
      unsub?.();
      unsub = null;
    }
  };
}

// st-extension/src/apps/api/core.ts
var API_APP_ID = "api";
function emptyDraft() {
  return { name: "", url: "", key: "", model: "", includeBody: "", excludeBody: "", includeHeaders: "" };
}
function normalizeUrl(u) {
  return String(u ?? "").trim().replace(/\/+$/, "");
}
function str(v) {
  return typeof v === "string" ? v : "";
}
function sanitizeAppData(raw) {
  const profiles = [];
  const list = raw?.profiles;
  if (Array.isArray(list)) {
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const p = item;
      const name = str(p.name).trim();
      const url = normalizeUrl(str(p.url));
      if (!name || !url) continue;
      profiles.push({
        id: str(p.id) || newProfileId(),
        name,
        url,
        key: str(p.key),
        model: str(p.model).trim(),
        includeBody: str(p.includeBody),
        excludeBody: str(p.excludeBody),
        includeHeaders: str(p.includeHeaders)
      });
    }
  }
  return { profiles };
}
function newProfileId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function validateDraft(draft) {
  if (!draft.name.trim()) return "给站点起个名称吧。";
  const url = normalizeUrl(draft.url);
  if (!url) return "接口地址 URL 还没填。";
  if (!/^https?:\/\//i.test(url)) return "接口地址要以 http:// 或 https:// 开头。";
  return null;
}
function upsertProfile(profiles, draft, editingId) {
  const invalid = validateDraft(draft);
  if (invalid) return { error: invalid };
  const name = draft.name.trim();
  const dup = profiles.find((p) => p.name === name && p.id !== editingId);
  if (dup) return { error: `站点名「${name}」已被占用，换一个吧。` };
  const clean = {
    name,
    url: normalizeUrl(draft.url),
    key: draft.key,
    model: draft.model.trim(),
    includeBody: draft.includeBody,
    excludeBody: draft.excludeBody,
    includeHeaders: draft.includeHeaders
  };
  if (editingId !== null) {
    const idx = profiles.findIndex((p) => p.id === editingId);
    if (idx < 0) return { error: "要编辑的站点已不存在。" };
    const next = [...profiles];
    next[idx] = { ...clean, id: editingId };
    return { profiles: next };
  }
  return { profiles: [...profiles, { ...clean, id: newProfileId() }] };
}
function findUrlDuplicate(profiles, url, excludeId) {
  const target = normalizeUrl(url);
  if (!target) return void 0;
  return profiles.find((p) => p.id !== excludeId && normalizeUrl(p.url) === target);
}
function moveProfile(profiles, id, delta) {
  const from = profiles.findIndex((p) => p.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= profiles.length) return profiles;
  const next = [...profiles];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
function findActiveProfile(profiles, currentUrl, currentModel = "") {
  const cur = normalizeUrl(currentUrl);
  if (!cur) return void 0;
  const sameUrl = profiles.filter((p) => normalizeUrl(p.url) === cur);
  if (sameUrl.length <= 1) return sameUrl[0];
  return sameUrl.find((p) => p.model !== "" && p.model === currentModel) ?? sameUrl[0];
}
function parseModelList(json) {
  if (json && typeof json === "object" && "error" in json && json.error) {
    const msg = json.message;
    throw new Error(typeof msg === "string" && msg ? msg : "站点接口返回了错误");
  }
  const box = json;
  const arr = Array.isArray(box) ? box : Array.isArray(box?.data) ? box.data : Array.isArray(box?.models) ? box.models : [];
  const names = arr.map((m) => {
    if (typeof m === "string") return m;
    if (m && typeof m === "object") {
      const o = m;
      return str(o.id) || str(o.model) || str(o.name);
    }
    return "";
  }).filter((s) => s !== "");
  if (names.length === 0) throw new Error("站点没有返回任何模型");
  return [...new Set(names)].sort();
}

// st-extension/src/apps/api/bridge.ts
function getST3() {
  try {
    return window.SillyTavern?.getContext();
  } catch {
    return void 0;
  }
}
function toast2(kind, message) {
  const t = window.toastr;
  t?.[kind]?.(message, "API 切换");
}
function readStr(obj, key) {
  const v = obj[key];
  return typeof v === "string" ? v : "";
}
function readConnection() {
  const st = getST3();
  const oai = st?.chatCompletionSettings;
  if (!st || !oai) return null;
  return {
    url: readStr(oai, "custom_url"),
    model: readStr(oai, "custom_model"),
    isCustomSource: st.mainApi === "openai" && readStr(oai, "chat_completion_source") === "custom",
    online: (st.onlineStatus ?? "no_connection") !== "no_connection",
    includeBody: readStr(oai, "custom_include_body"),
    excludeBody: readStr(oai, "custom_exclude_body"),
    includeHeaders: readStr(oai, "custom_include_headers")
  };
}
function onOnlineStatusChanged(handler) {
  const st = getST3();
  const eventName = st?.event_types?.ONLINE_STATUS_CHANGED ?? "online_status_changed";
  const source = st?.eventSource;
  if (!source) return () => {
  };
  source.on(eventName, handler);
  return () => source.removeListener(eventName, handler);
}
async function writeSecret(st, key) {
  const headers = st.getRequestHeaders?.() ?? { "Content-Type": "application/json" };
  const res = await fetch("/api/secrets/write", {
    method: "POST",
    headers,
    body: JSON.stringify({ key: "api_key_custom", value: key ?? "" })
  });
  if (!res.ok) throw new Error(`密钥写入 ST 失败（HTTP ${res.status}）`);
}
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function setInput(input, value) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
function setSelect(select, value) {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}
async function applyProfile(p) {
  const st = getST3();
  const oai = st?.chatCompletionSettings;
  if (!st || !oai) throw new Error("未检测到 SillyTavern 运行时");
  const mainApiSel = document.querySelector("#main_api");
  const sourceSel = document.querySelector("#chat_completion_source");
  const urlInput = document.querySelector("#custom_api_url_text");
  const connectBtn = document.querySelector("#api_button_openai");
  if (!mainApiSel || !sourceSel || !urlInput || !connectBtn) {
    throw new Error("找不到 ST 的连接设置面板，可能是酒馆版本太老（需 1.12+）");
  }
  await writeSecret(st, p.key);
  setSelect(mainApiSel, "openai");
  setSelect(sourceSel, "custom");
  await sleep(150);
  setInput(urlInput, p.url);
  const keyInput = document.querySelector("#api_key_custom");
  if (keyInput) setInput(keyInput, p.key);
  const modelInput = document.querySelector("#custom_model_id");
  if (modelInput && p.model) setInput(modelInput, p.model);
  oai["custom_include_body"] = p.includeBody;
  oai["custom_exclude_body"] = p.excludeBody;
  oai["custom_include_headers"] = p.includeHeaders;
  st.saveSettingsDebounced?.();
  await sleep(150);
  connectBtn.click();
}
async function fetchModels(url, key, restoreKey) {
  const st = getST3();
  if (!st) throw new Error("未检测到 SillyTavern 运行时");
  const visibleKey = document.querySelector("#api_key_custom")?.value ?? "";
  const prevKey = visibleKey || restoreKey;
  const wrote = !!key && key !== prevKey;
  if (wrote) await writeSecret(st, key);
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 2e4);
    let res;
    try {
      res = await fetch("/api/backends/chat-completions/status", {
        method: "POST",
        headers: st.getRequestHeaders?.() ?? { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_completion_source: "custom", custom_url: url }),
        signal: ac.signal
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`模型列表请求失败（HTTP ${res.status}）`);
    return parseModelList(await res.json());
  } finally {
    if (wrote && prevKey) {
      writeSecret(st, prevKey).catch((err) => console.warn("[st-stage] API：还原密钥失败", err));
    }
  }
}

// st-extension/src/apps/api-app.ts
function apiApp(deps) {
  let unsubscribe = null;
  return {
    id: API_APP_ID,
    name: "API",
    icon: "📡",
    order: 6,
    mount(container, ctx) {
      const state = { busy: false };
      render2(container, ctx, deps, state);
      unsubscribe = onOnlineStatusChanged(() => {
        if (!state.busy && container.isConnected) render2(container, ctx, deps, state);
      });
    },
    unmount() {
      unsubscribe?.();
      unsubscribe = null;
    }
  };
}
function render2(container, ctx, deps, state) {
  container.textContent = "";
  const data = sanitizeAppData(ctx.getAppData());
  const conn = readConnection();
  const active = conn ? findActiveProfile(data.profiles, conn.url, conn.model) : void 0;
  const rerender = () => {
    if (container.isConnected) render2(container, ctx, deps, state);
  };
  const status = el2("div", "so-app-section");
  const title = el2("div", "so-app-title");
  title.textContent = "当前连接";
  status.append(title);
  if (!conn) {
    const d = el2("div", "so-app-desc");
    d.textContent = "未检测到 SillyTavern 运行时（Web 模拟器中仅展示站点列表）。";
    status.append(d);
  } else {
    const line = el2("div", "so-app-desc");
    const dot = el2("span", `stapi-dot${conn.online ? " stapi-dot-on" : ""}`);
    const text = document.createElement("span");
    text.textContent = conn.online ? "已连接" : "未连接";
    line.append(dot, text);
    status.append(line);
    const site = el2("div", "so-app-desc");
    site.textContent = active ? `站点：${active.name}` : conn.url ? `接口：${conn.url}（还没存成站点，可在管理页「导入当前连接」一键录入）` : "尚未配置自定义接口。";
    status.append(site);
    if (conn.model) {
      const model = el2("div", "so-app-desc");
      model.textContent = `模型：${conn.model}`;
      status.append(model);
    }
    if (!conn.isCustomSource) {
      const warn = el2("div", "so-app-desc");
      warn.textContent = "当前没有走「自定义(OpenAI 兼容)」接口；点下方任一站点即可切换接管。";
      status.append(warn);
    }
  }
  container.append(status);
  const sites = el2("div", "so-app-section");
  const sitesTitle = el2("div", "so-app-title");
  sitesTitle.textContent = `站点（${data.profiles.length}）`;
  sites.append(sitesTitle);
  const feedback = el2("div", "so-app-desc");
  feedback.hidden = true;
  const say = (text) => {
    feedback.textContent = text;
    feedback.hidden = false;
  };
  if (data.profiles.length === 0) {
    const empty = el2("div", "so-app-desc");
    empty.textContent = "还没有站点，点下方「管理站点」添加。";
    sites.append(empty);
  }
  const doSwitch = (p) => {
    if (state.busy) return;
    if (!conn) {
      say("仅在 SillyTavern 内可切换。");
      return;
    }
    state.busy = true;
    say(`正在切换到「${p.name}」…`);
    sites.querySelectorAll(".stapi-row").forEach((r) => r.classList.add("stapi-row-busy"));
    applyProfile(p).then(() => {
      toast2("success", `「${p.name}」配置已应用，正在连接…`);
    }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast2("error", msg);
      say(`切换失败：${msg}`);
      console.error("[st-stage] API 切换失败", err);
    }).then(() => {
      state.busy = false;
      rerender();
    });
  };
  for (const p of data.profiles) {
    const isActive = active?.id === p.id;
    const row = el2("div", `stapi-row${isActive ? " stapi-row-on" : ""}`);
    row.setAttribute("role", "button");
    row.tabIndex = 0;
    const main = el2("div", "stapi-row-main");
    const name = el2("div", "stapi-row-name");
    name.textContent = p.name;
    main.append(name);
    const subParts = [p.model || "模型沿用当前"];
    if (p.includeBody.trim() || p.excludeBody.trim() || p.includeHeaders.trim()) subParts.push("附加参数");
    const sub = el2("div", "stapi-row-sub");
    sub.textContent = subParts.join(" · ");
    main.append(sub);
    const mark = el2("div", "stapi-row-mark");
    mark.textContent = isActive ? "✓" : "›";
    row.append(main, mark);
    row.addEventListener("click", () => doSwitch(p));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        doSwitch(p);
      }
    });
    sites.append(row);
  }
  sites.append(feedback);
  container.append(sites);
  const manage = el2("div", "so-app-section");
  const manageDesc = el2("div", "so-app-desc");
  manageDesc.textContent = "添加/编辑站点 · 从接口获取模型 · 附加参数（随站点切换）。";
  manage.append(manageDesc, appButton("管理站点", () => deps.openManager()));
  container.append(manage);
}

// st-extension/src/apps/index.ts
function createBuiltinApps(deps) {
  return [
    spriteApp(),
    galleryApp({ openManager: deps.openGalleryManager }),
    butlerApp(),
    mvuApp(),
    newvarApp({ runtime: deps.newvarRuntime, openDesigner: deps.openNewvarDesigner }),
    apiApp({ openManager: deps.openApiManager })
  ];
}

// st-extension/src/apps/newvar/engine.ts
function initStateFromSchema(schema) {
  const state = {};
  for (const def of schema.variables) {
    setNested(state, def.key, clone(def.default));
  }
  return state;
}
function clone(v) {
  if (v == null || typeof v !== "object") return v;
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return v;
  }
}
function fillDefaults(state, schema) {
  const next = clone(state);
  for (const def of schema.variables) {
    if (getNested(next, def.key) === void 0) setNested(next, def.key, clone(def.default));
  }
  return next;
}
function validateValue(def, raw) {
  switch (def.type) {
    case "number": {
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return { ok: false, error: `期望数字，得到 ${describe(raw)}` };
      }
      if (def.range) {
        const [min, max] = def.range;
        if (raw < min || raw > max) {
          const clipped = Math.max(min, Math.min(max, raw));
          return { ok: true, value: clipped, corrected: true };
        }
      }
      return { ok: true, value: raw };
    }
    case "string":
      if (typeof raw !== "string") return { ok: false, error: `期望文本，得到 ${describe(raw)}` };
      return { ok: true, value: raw };
    case "boolean":
      if (typeof raw !== "boolean") return { ok: false, error: `期望布尔，得到 ${describe(raw)}` };
      return { ok: true, value: raw };
    case "enum": {
      const options = def.enum ?? [];
      if (typeof raw !== "string" || !options.includes(raw)) {
        return { ok: false, error: `值 ${describe(raw)} 不在枚举 [${options.join(", ")}] 中` };
      }
      return { ok: true, value: raw };
    }
    default:
      return { ok: true, value: raw };
  }
}
function describe(v) {
  if (v === null) return "null";
  if (typeof v === "string") return `"${v}"`;
  if (typeof v === "object") return Array.isArray(v) ? "数组" : "对象";
  return String(v);
}
var BLOCK_RE = /<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/i;
var ANALYSIS_RE = /<Analysis>[\s\S]*?<\/Analysis>/gi;
var LODASH_RE = /_\.set\(\s*['"]([^'"]+)['"]\s*,\s*(?:[^,]*?,\s*)?([\s\S]*?)\)\s*;?/gi;
function parseUpdateBlock(text, format) {
  if (typeof text !== "string") return { found: false, ops: [] };
  const m = BLOCK_RE.exec(text);
  if (!m) return { found: false, ops: [] };
  const inner = m[1].replace(ANALYSIS_RE, "").trim();
  if (!inner) return { found: true, ops: [] };
  if (format === "lodash_set") {
    return parseLodash(inner);
  }
  return parseJsonPatch(inner);
}
function parseJsonPatch(inner) {
  const arrText = extractJsonArray(inner);
  if (arrText === null) return { found: true, ops: [], error: "未找到 JSON Patch 数组" };
  let parsed;
  try {
    parsed = JSON.parse(arrText);
  } catch (e) {
    return { found: true, ops: [], error: `JSON 解析失败：${e instanceof Error ? e.message : String(e)}` };
  }
  if (!Array.isArray(parsed)) return { found: true, ops: [], error: "JSON Patch 应为数组" };
  const ops = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw;
    const op = o.op;
    const pointer = o.path;
    if (op !== "replace" && op !== "add" && op !== "remove" || typeof pointer !== "string") continue;
    ops.push({ op, path: pointerToDotted(pointer), value: o.value });
  }
  return { found: true, ops };
}
function extractJsonArray(inner) {
  const start = inner.indexOf("[");
  const end = inner.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  return inner.slice(start, end + 1);
}
function pointerToDotted(pointer) {
  const p = pointer.startsWith("/") ? pointer.slice(1) : pointer;
  if (p === "") return "";
  return p.split("/").map((seg) => seg.replace(/~1/g, "/").replace(/~0/g, "~")).join(".");
}
function parseLodash(inner) {
  const ops = [];
  let m;
  LODASH_RE.lastIndex = 0;
  while ((m = LODASH_RE.exec(inner)) !== null) {
    const path = m[1];
    const valueText = stripTrailingComment(m[2]).trim();
    ops.push({ op: "replace", path, value: coerceScalar(valueText) });
  }
  return { found: true, ops };
}
function stripTrailingComment(s) {
  const idx = s.indexOf("//");
  return idx >= 0 ? s.slice(0, idx) : s;
}
function coerceScalar(t) {
  if (t === "") return "";
  try {
    return JSON.parse(t);
  } catch {
    return t.replace(/^['"]|['"]$/g, "");
  }
}
function applyOps(state, ops, schema) {
  const next = clone(state);
  const log = [];
  const defByKey = new Map(schema.variables.map((v) => [v.key, v]));
  const hasSchema = schema.variables.length > 0;
  for (const op of ops) {
    if (op.op === "remove") {
      deleteNested(next, op.path);
      log.push({ path: op.path, status: "removed" });
      continue;
    }
    const def = defByKey.get(op.path);
    if (!def) {
      if (hasSchema) {
        log.push({ path: op.path, status: "rejected", detail: "未定义的变量路径" });
        continue;
      }
      setNested(next, op.path, op.value);
      log.push({ path: op.path, status: "accepted" });
      continue;
    }
    const outcome = validateValue(def, op.value);
    if (!outcome.ok) {
      log.push({ path: op.path, status: "rejected", detail: outcome.error });
      continue;
    }
    setNested(next, op.path, outcome.value);
    log.push({
      path: op.path,
      status: outcome.corrected ? "corrected" : "accepted",
      detail: outcome.corrected ? `已修正为 ${JSON.stringify(outcome.value)}` : void 0
    });
  }
  return { state: next, log };
}
function buildInjection(state, schema, format) {
  const visible = schema.variables.filter((v) => !v.hidden);
  const stateLines = visible.map((v) => {
    const value = getNested(state, v.key);
    const desc = v.description ? `  // ${v.description}` : "";
    return `  ${v.key}: ${JSON.stringify(value)}${desc}`;
  });
  const ruleLines = [];
  for (const v of visible) {
    const checks = [];
    if (v.type === "number") {
      checks.push(v.range ? `数字，范围 ${v.range[0]}~${v.range[1]}（超出会被裁剪）` : "数字");
      checks.push('输出更新后的完整数值（禁止输出 "+3" 这类增量表达式，自己算好结果）');
    } else if (v.type === "enum") {
      checks.push(`只能取：${(v.enum ?? []).join(" / ")}`);
    } else if (v.type === "boolean") {
      checks.push("布尔值 true / false");
    } else {
      checks.push("文本");
    }
    if (v.updateRule) {
      for (const line of v.updateRule.split("\n")) {
        const t = line.trim();
        if (t) checks.push(t);
      }
    }
    ruleLines.push(`  ${v.key}:`);
    for (const c of checks) ruleLines.push(`    - ${c}`);
  }
  const example = visible[0]?.key ?? "变量路径";
  const examplePointer = `/${example.split(".").join("/")}`;
  const formatLines = format === "lodash_set" ? [
    "- 在回复正文全部结束后，若本轮有变量变化，追加一个 <UpdateVariable> 块；没有变化则不要输出该块",
    "- 块内每行一条命令：_.set('变量路径', 旧值, 新值);//变化原因",
    "格式示例：",
    "<UpdateVariable>",
    `_.set('${example}', 旧值, 新值);//原因`,
    "</UpdateVariable>"
  ] : [
    "- 在回复正文全部结束后，若本轮有变量变化，追加一个 <UpdateVariable> 块；没有变化则不要输出该块",
    "- 块内先写 <Analysis>（中文，不超过 60 字）：逐条对照上面的更新规则，说明哪些变量该更新、更新到多少",
    "- 然后输出严格符合 JSON Patch (RFC 6902) 的 JSON 数组，只允许 replace / add / remove 三种操作",
    "- path 用斜杠分隔层级（如 /状态/体力）；value 是更新后的完整值",
    "格式示例：",
    "<UpdateVariable>",
    "<Analysis>好感度因赠礼小幅上升 +2。</Analysis>",
    `[{"op":"replace","path":"${examplePointer}","value":新值}]`,
    "</UpdateVariable>"
  ];
  return [
    "<status_current_variable>",
    "当前变量状态：",
    stateLines.join("\n"),
    "</status_current_variable>",
    "",
    "<variable_update_rule>",
    "各变量的更新规则（check 条件不满足时，不要更新对应变量）：",
    ruleLines.join("\n"),
    "</variable_update_rule>",
    "",
    "<variable_update_format>",
    formatLines.join("\n"),
    "</variable_update_format>"
  ].join("\n");
}

// st-extension/src/apps/newvar/config.ts
var NEWVAR_APP_ID = "newvar";
var NEWVAR_CHANNEL = "newvar";
var NEWVAR_EXTRA_KEY = "st_stage_newvar";
function defaultNewvarData() {
  return {
    enabled: false,
    format: "json_patch",
    injectionDepth: 4,
    schema: { id: "default", name: "默认方案", version: 1, variables: [] },
    customTemplates: []
  };
}
var VAR_TYPES = ["number", "string", "boolean", "enum"];
function normalizeNewvarData(raw) {
  const d = defaultNewvarData();
  if (!raw || typeof raw !== "object") return d;
  const r = raw;
  if (typeof r.enabled === "boolean") d.enabled = r.enabled;
  if (r.format === "json_patch" || r.format === "lodash_set") d.format = r.format;
  if (typeof r.injectionDepth === "number" && Number.isInteger(r.injectionDepth)) {
    d.injectionDepth = Math.min(100, Math.max(0, r.injectionDepth));
  }
  const schema = r.schema;
  if (schema && typeof schema === "object") {
    const s = schema;
    if (typeof s.id === "string" && s.id) d.schema.id = s.id;
    if (typeof s.name === "string" && s.name) d.schema.name = s.name;
    if (typeof s.version === "number") d.schema.version = s.version;
    if (Array.isArray(s.variables)) {
      d.schema.variables = s.variables.map(normalizeDefinition).filter((v) => v !== null);
    }
  }
  if (Array.isArray(r.customTemplates)) {
    d.customTemplates = r.customTemplates.map(normalizeCustomTemplate).filter((t) => t !== null);
  }
  return d;
}
function normalizeCustomTemplate(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  if (typeof r.id !== "string" || r.id === "" || typeof r.name !== "string" || r.name === "") return null;
  const variables = Array.isArray(r.variables) ? r.variables.map(normalizeDefinition).filter((v) => v !== null) : [];
  if (variables.length === 0) return null;
  return {
    id: r.id,
    name: r.name,
    description: typeof r.description === "string" ? r.description : "",
    variables
  };
}
function normalizeDefinition(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  if (typeof r.key !== "string" || r.key.trim() === "") return null;
  const type = VAR_TYPES.includes(r.type) ? r.type : "string";
  const def = {
    key: r.key.trim(),
    type,
    default: r.default,
    description: typeof r.description === "string" ? r.description : ""
  };
  if (r.hidden === true) def.hidden = true;
  if (typeof r.updateRule === "string" && r.updateRule.trim() !== "") def.updateRule = r.updateRule;
  if (type === "number" && Array.isArray(r.range) && r.range.length === 2 && typeof r.range[0] === "number" && typeof r.range[1] === "number" && r.range[0] <= r.range[1]) {
    def.range = [r.range[0], r.range[1]];
  }
  if (type === "enum") {
    const options = Array.isArray(r.enum) ? r.enum.filter((x) => typeof x === "string" && x !== "") : [];
    if (options.length === 0) return null;
    def.enum = options;
  }
  def.default = coerceDefault(def, def.default);
  return def;
}
function coerceDefault(def, raw) {
  switch (def.type) {
    case "number": {
      const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
      if (def.range) return Math.min(def.range[1], Math.max(def.range[0], n));
      return n;
    }
    case "boolean":
      return typeof raw === "boolean" ? raw : false;
    case "enum": {
      const options = def.enum ?? [];
      return typeof raw === "string" && options.includes(raw) ? raw : options[0];
    }
    default:
      return typeof raw === "string" ? raw : raw == null ? "" : String(raw);
  }
}

// st-extension/src/apps/newvar/runtime.ts
function createNewvarRuntime(deps) {
  let lastParse = null;
  let warnedSave = false;
  const listeners = /* @__PURE__ */ new Set();
  const unsubs = [];
  function getST4() {
    try {
      return window.SillyTavern?.getContext();
    } catch {
      return void 0;
    }
  }
  function getData() {
    return normalizeNewvarData(deps.getSettings().apps[NEWVAR_APP_ID]);
  }
  function notify() {
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        console.error("[st-stage] 新变量订阅回调出错", err);
      }
    }
  }
  function floorSnapshot(msg) {
    const entry = msg?.extra?.[NEWVAR_EXTRA_KEY];
    if (!entry || typeof entry !== "object") return null;
    const stat = entry.stat_data;
    return stat && typeof stat === "object" && !Array.isArray(stat) ? stat : null;
  }
  function clone2(v) {
    try {
      return JSON.parse(JSON.stringify(v));
    } catch {
      return v;
    }
  }
  function findSnapshotBefore(chat, fromId) {
    for (let i = Math.min(fromId, chat.length - 1); i >= 0; i--) {
      const snap = floorSnapshot(chat[i]);
      if (snap) return clone2(snap);
    }
    return null;
  }
  function getCurrentState() {
    const schema = getData().schema;
    const chat = getST4()?.chat;
    if (Array.isArray(chat)) {
      const snap = findSnapshotBefore(chat, chat.length - 1);
      if (snap) return fillDefaults(snap, schema);
    }
    return initStateFromSchema(schema);
  }
  function getPrevState() {
    const chat = getST4()?.chat;
    if (!Array.isArray(chat)) return null;
    for (let i = chat.length - 1; i >= 0; i--) {
      if (floorSnapshot(chat[i])) return findSnapshotBefore(chat, i - 1);
    }
    return null;
  }
  function writeSnapshot(st, messageId, state) {
    const msg = st.chat?.[messageId];
    if (!msg) return;
    if (!msg.extra || typeof msg.extra !== "object") msg.extra = {};
    msg.extra[NEWVAR_EXTRA_KEY] = { stat_data: state };
    saveChat(st);
  }
  function saveChat(st) {
    try {
      if (typeof st.saveChatDebounced === "function") {
        st.saveChatDebounced();
      } else if (typeof st.saveChat === "function") {
        void st.saveChat();
      } else if (!warnedSave) {
        warnedSave = true;
        console.warn("[st-stage] 新变量：当前 ST 版本 context 无 saveChat，快照仅存内存（重载对话丢失）");
      }
    } catch (err) {
      console.warn("[st-stage] 新变量：保存对话失败", err);
    }
  }
  function buildPreview() {
    const data = getData();
    if (!data.enabled || data.schema.variables.length === 0) return "";
    return buildInjection(getCurrentState(), data.schema, data.format);
  }
  function reinject() {
    const data = getData();
    deps.inject(buildPreview(), data.injectionDepth);
  }
  function handleMessageReceived(...args) {
    const data = getData();
    if (!data.enabled) return;
    const st = getST4();
    const chat = st?.chat;
    if (!st || !Array.isArray(chat)) return;
    const rawId = args[0];
    const idNum = typeof rawId === "number" ? rawId : typeof rawId === "string" && rawId.trim() !== "" ? Number(rawId) : NaN;
    const messageId = Number.isInteger(idNum) && idNum >= 0 && idNum < chat.length ? idNum : chat.length - 1;
    const msg = chat[messageId];
    if (!msg || msg.is_user || typeof msg.mes !== "string") return;
    const parsed = parseUpdateBlock(msg.mes, data.format);
    if (!parsed.found) return;
    if (parsed.error) {
      lastParse = { messageId, found: true, error: parsed.error, log: [] };
      notify();
      return;
    }
    const snapBase = findSnapshotBefore(chat, messageId - 1);
    const base = snapBase ? fillDefaults(snapBase, data.schema) : initStateFromSchema(data.schema);
    const result = applyOps(base, parsed.ops, data.schema);
    writeSnapshot(st, messageId, result.state);
    lastParse = { messageId, found: true, log: result.log };
    reinject();
    notify();
  }
  function mutateCurrent(mutate) {
    const st = getST4();
    const chat = st?.chat;
    if (!st || !Array.isArray(chat) || chat.length === 0) return;
    const state = getCurrentState();
    mutate(state);
    writeSnapshot(st, chat.length - 1, state);
    reinject();
    notify();
  }
  function subscribeEvents() {
    const st = getST4();
    const es = st?.eventSource;
    if (!es) return;
    const et = st?.eventTypes ?? {};
    const bind = (name, fallback, handler) => {
      const event = name ?? fallback;
      es.on(event, handler);
      unsubs.push(() => {
        try {
          es.removeListener(event, handler);
        } catch {
        }
      });
    };
    bind(et.MESSAGE_RECEIVED, "message_received", handleMessageReceived);
    const onNav = () => {
      reinject();
      notify();
    };
    bind(et.CHAT_CHANGED, "chat_id_changed", onNav);
    bind(et.MESSAGE_SWIPED, "message_swiped", onNav);
    bind(et.MESSAGE_DELETED, "message_deleted", onNav);
  }
  return {
    start() {
      subscribeEvents();
      reinject();
    },
    dispose() {
      for (const off of unsubs) off();
      unsubs.length = 0;
      listeners.clear();
    },
    isSTAvailable() {
      return Array.isArray(getST4()?.chat);
    },
    getData,
    getCurrentState,
    getPrevState,
    setVariable(path, value) {
      mutateCurrent((state) => setNested(state, path, value));
    },
    deleteVariable(path) {
      mutateCurrent((state) => deleteNested(state, path));
    },
    onConfigChanged() {
      reinject();
      notify();
    },
    buildPreview,
    getLastParse: () => lastParse,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

// st-extension/src/apps/newvar/templates.ts
var TIME_SLOT = {
  key: "时间.当前时段",
  type: "enum",
  default: "下午",
  description: "当前时间段",
  enum: ["清晨", "上午", "中午", "下午", "傍晚", "夜晚", "深夜"],
  updateRule: "按剧情累计推进：对话约 5~15 分钟，场景移动 10~30 分钟，重大事件 30 分钟以上\n累计跨过时段边界时才切换，禁止无故跳时段"
};
var romanceSingle = {
  id: "romance-single",
  name: "恋爱 · 单角色",
  description: "好感度/关系阶段/心情/时间地点。好感度小步进、阶段须事件驱动，适合大多数单角色卡。",
  variables: [
    {
      key: "好感度",
      type: "number",
      default: 20,
      description: "角色对用户的好感（0~100）",
      range: [0, 100],
      updateRule: "正面互动 +1~3；重大事件（告白、共渡难关）±5~10；负面言行 -1~5\n无实质互动时保持不变，禁止无缘由跳变"
    },
    {
      key: "关系阶段",
      type: "enum",
      default: "陌生",
      description: "与用户的关系阶段",
      enum: ["陌生", "熟识", "朋友", "暧昧", "恋人"],
      updateRule: "只有好感度达到相应水平且发生标志性事件时才推进一级，不可跳级\n没有重大变故不要倒退"
    },
    {
      key: "心情",
      type: "enum",
      default: "平静",
      description: "角色当前心情",
      enum: ["开心", "平静", "害羞", "烦躁", "难过"]
    },
    {
      key: "当前状态",
      type: "string",
      default: "初次见面",
      description: "正在做什么、与用户的互动状态（一句话）"
    },
    TIME_SLOT,
    { key: "地点.当前地点", type: "string", default: "教室", description: "当前所在地点" }
  ]
};
function roleVars(role) {
  return [
    {
      key: `角色.${role}.是否在场`,
      type: "boolean",
      default: role === "角色A",
      description: "是否出现在当前场景",
      updateRule: "只有实际出现在当前场景才为 true\n不在场角色的其他变量（除所在位置外）不要更新"
    },
    {
      key: `角色.${role}.好感度`,
      type: "number",
      default: 20,
      description: `${role}对用户的好感（0~100）`,
      range: [0, 100],
      updateRule: "正面互动 +1~3；重大事件 ±5~10；输出更新后的完整数值"
    },
    { key: `角色.${role}.当前状态`, type: "string", default: "——", description: "在做什么/情绪（一句话）" },
    { key: `角色.${role}.所在位置`, type: "string", default: "未知", description: "当前所在位置" },
    { key: `角色.${role}.穿着`, type: "string", default: "日常便服", description: "当前穿着" }
  ];
}
var romanceMulti = {
  id: "romance-multi",
  name: "恋爱 · 多角色",
  description: "两个示例角色（角色A/角色B）各自维护在场/好感/状态/位置/穿着。导入后点击各条定义，把路径里的「角色A」改成你卡里的名字。",
  variables: [...roleVars("角色A"), ...roleVars("角色B"), TIME_SLOT, {
    key: "地点.当前地点",
    type: "string",
    default: "客厅",
    description: "用户当前所在地点"
  }]
};
var rpg = {
  id: "rpg",
  name: "RPG 冒险",
  description: "生命/法力/金币/等级/状态。数值全部要求输出计算后的完整值，等级须事件驱动。",
  variables: [
    {
      key: "生命值",
      type: "number",
      default: 100,
      description: "当前生命（0~100）",
      range: [0, 100],
      updateRule: "战斗受伤 -10~30；休息/治疗恢复；归零进入昏迷"
    },
    { key: "法力值", type: "number", default: 50, description: "当前法力（0~100）", range: [0, 100] },
    {
      key: "金币",
      type: "number",
      default: 0,
      description: "持有金币",
      range: [0, 999999],
      updateRule: "交易/战利品/悬赏时增减；输出计算后的总额，禁止输出增量"
    },
    {
      key: "等级",
      type: "number",
      default: 1,
      description: "冒险者等级（1~99）",
      range: [1, 99],
      updateRule: "只有明确的升级事件才 +1，严禁随剧情自动增长"
    },
    { key: "当前地点", type: "string", default: "新手村", description: "当前所在地" },
    {
      key: "状态",
      type: "enum",
      default: "正常",
      description: "身体状态",
      enum: ["正常", "受伤", "中毒", "昏迷"],
      updateRule: "由战斗/事件驱动；生命值归零时置为 昏迷"
    }
  ]
};
var daily = {
  id: "daily",
  name: "日常陪伴",
  description: "好感/心情/体力/当前活动/时间地点，适合慢节奏日常卡。",
  variables: [
    {
      key: "好感度",
      type: "number",
      default: 30,
      description: "角色对用户的好感（0~100）",
      range: [0, 100],
      updateRule: "日常互动 +1~2；特别的时刻 +3~5；冷落或伤害 -1~5"
    },
    {
      key: "心情",
      type: "enum",
      default: "平静",
      description: "当前心情",
      enum: ["开心", "平静", "疲惫", "低落", "兴奋"]
    },
    {
      key: "体力",
      type: "number",
      default: 100,
      description: "体力（0~100）",
      range: [0, 100],
      updateRule: "活动消耗 5~15；休息恢复；清晨重置为 100"
    },
    { key: "当前活动", type: "string", default: "闲聊", description: "正在做的事（一句话）" },
    TIME_SLOT,
    { key: "地点.当前地点", type: "string", default: "家里", description: "当前所在地点" }
  ]
};
var NEWVAR_TEMPLATES = [romanceSingle, romanceMulti, rpg, daily];

// st-extension/src/apps/newvar/designer.ts
var TYPE_LABELS = { number: "数字", string: "文本", boolean: "布尔", enum: "枚举" };
function draftFromDef(def) {
  return {
    key: def.key,
    type: def.type,
    defaultText: formatValue(def.default),
    description: def.description,
    rangeText: def.range ? `${def.range[0]}~${def.range[1]}` : "",
    enumText: (def.enum ?? []).join(", "),
    updateRule: def.updateRule ?? "",
    hidden: def.hidden === true
  };
}
function emptyDraft2() {
  return {
    key: "",
    type: "number",
    defaultText: "0",
    description: "",
    rangeText: "",
    enumText: "",
    updateRule: "",
    hidden: false
  };
}
function draftToDef(draft) {
  const key = draft.key.trim();
  if (!key) return { error: "请填写变量路径。" };
  const def = { key, type: draft.type, default: void 0, description: draft.description.trim() };
  if (draft.hidden) def.hidden = true;
  if (draft.updateRule.trim()) def.updateRule = draft.updateRule.trim();
  if (draft.type === "number") {
    const range = parseRange(draft.rangeText);
    if (range === false) return { error: "范围格式应为「最小~最大」，如 0~100。" };
    if (range) def.range = range;
    const n = Number(draft.defaultText.trim());
    let dflt = Number.isFinite(n) ? n : 0;
    if (def.range) dflt = Math.min(def.range[1], Math.max(def.range[0], dflt));
    def.default = dflt;
  } else if (draft.type === "boolean") {
    def.default = draft.defaultText.trim() === "true";
  } else if (draft.type === "enum") {
    const options = draft.enumText.split(/[,，]/).map((s) => s.trim()).filter((s) => s !== "");
    if (options.length === 0) return { error: "枚举类型至少需要一个选项（逗号分隔）。" };
    def.enum = options;
    def.default = options.includes(draft.defaultText.trim()) ? draft.defaultText.trim() : options[0];
  } else {
    def.default = draft.defaultText;
  }
  return { def };
}
function cloneDefs(defs) {
  return JSON.parse(JSON.stringify(defs));
}
function parseRange(text) {
  const t = text.trim();
  if (!t) return null;
  const m = /^(-?\d+(?:\.\d+)?)\s*~\s*(-?\d+(?:\.\d+)?)$/.exec(t);
  if (!m) return false;
  const min = Number(m[1]);
  const max = Number(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return false;
  return [min, max];
}
function createNewvarDesigner(deps) {
  let backdrop = null;
  let body = null;
  let formDraft = null;
  let editingIndex = null;
  let scrollToEditor = false;
  function applyBackdropSize() {
    if (!backdrop) return;
    backdrop.style.left = "0";
    backdrop.style.top = "0";
    backdrop.style.width = `${window.innerWidth}px`;
    backdrop.style.height = `${window.innerHeight}px`;
  }
  function onEscape(e) {
    if (e.key === "Escape") close();
  }
  function open() {
    if (backdrop) {
      render3();
      return;
    }
    formDraft = null;
    editingIndex = null;
    backdrop = el2("div", "so-manager-backdrop");
    document.addEventListener("keydown", onEscape);
    window.addEventListener("resize", applyBackdropSize);
    applyBackdropSize();
    const dialog = el2("div", "so-manager");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", "变量设计");
    const header = el2("div", "so-manager-header");
    const title = el2("div", "so-manager-title");
    title.textContent = "变量设计";
    const closeBtn = el2("div", "menu_button so-manager-close");
    closeBtn.textContent = "✕";
    closeBtn.title = "关闭";
    closeBtn.setAttribute("role", "button");
    closeBtn.tabIndex = 0;
    closeBtn.addEventListener("click", close);
    closeBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        close();
      }
    });
    header.append(title, closeBtn);
    body = el2("div", "so-manager-body");
    dialog.append(header, body);
    backdrop.append(dialog);
    document.body.append(backdrop);
    render3();
  }
  function close() {
    if (!backdrop) return;
    document.removeEventListener("keydown", onEscape);
    window.removeEventListener("resize", applyBackdropSize);
    backdrop.remove();
    backdrop = null;
    body = null;
    formDraft = null;
    editingIndex = null;
    deps.onClosed?.();
  }
  function save(next) {
    deps.setData(next);
    render3();
  }
  function render3() {
    if (!body) return;
    try {
      body.textContent = "";
      body.append(
        buildTemplateSection(),
        buildDefsSection(),
        buildSettingsSection(),
        buildPreviewSection(),
        buildLogSection()
      );
      if (scrollToEditor) {
        scrollToEditor = false;
        body.querySelector(".nv-defs-editor")?.scrollIntoView({ block: "nearest" });
      }
    } catch (err) {
      console.error("[st-stage] 变量设计弹窗渲染失败", err);
    }
  }
  function section(titleText) {
    const box = el2("div", "so-section");
    const title = el2("div", "so-section-title");
    title.textContent = titleText;
    box.append(title);
    return { box };
  }
  function descLine2(parent, text) {
    const d = el2("div", "so-app-desc");
    d.textContent = text;
    parent.append(d);
  }
  function buildTemplateSection() {
    const data = deps.getData();
    const { box } = section("模板库（一键起步）");
    descLine2(box, "「替换」清空现有定义后导入；「追加」跳过重名路径合并。导入的规则都已写好，可再逐条微调。");
    const grid = el2("div", "nv-tpl-grid");
    for (const tpl of NEWVAR_TEMPLATES) grid.append(buildTemplateCard(tpl, null));
    for (const tpl of data.customTemplates) grid.append(buildTemplateCard(tpl, tpl.id));
    box.append(grid);
    const saveRow = el2("div", "nv-tpl-save");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "text_pole so-app-input";
    nameInput.placeholder = "模板名（如 我的恋爱系统）";
    nameInput.autocomplete = "off";
    const saveBtn = el2("button", "menu_button vm-act");
    saveBtn.textContent = "把当前定义存为模板";
    saveBtn.addEventListener("click", () => {
      const cur = deps.getData();
      const name = nameInput.value.trim();
      if (!name) {
        window.alert("请先填写模板名。");
        return;
      }
      if (cur.schema.variables.length === 0) {
        window.alert("当前没有任何变量定义，无法保存为模板。");
        return;
      }
      const tpl = {
        id: `custom-${Date.now().toString(36)}`,
        name,
        description: `自定义 · ${cur.schema.variables.length} 项`,
        variables: cloneDefs(cur.schema.variables)
      };
      save({ ...cur, customTemplates: [...cur.customTemplates, tpl] });
    });
    saveRow.append(nameInput, saveBtn);
    box.append(saveRow);
    return box;
  }
  function buildTemplateCard(tpl, customId) {
    const card = el2("div", "nv-tpl-card");
    const name = el2("div", "vm-key");
    name.textContent = `${tpl.name}（${tpl.variables.length} 项）`;
    const desc = el2("div", "vm-desc nv-tpl-desc");
    desc.textContent = tpl.description;
    card.append(name, desc);
    const actions = el2("div", "nv-tpl-actions");
    const replaceBtn = el2("button", "menu_button vm-act");
    replaceBtn.textContent = "替换";
    replaceBtn.addEventListener("click", () => {
      const cur = deps.getData();
      if (cur.schema.variables.length > 0 && !window.confirm(`用「${tpl.name}」替换现有 ${cur.schema.variables.length} 条定义？（楼层快照不受影响）`)) {
        return;
      }
      formDraft = null;
      editingIndex = null;
      save({ ...cur, schema: { ...cur.schema, name: tpl.name, variables: cloneDefs(tpl.variables) } });
    });
    const appendBtn = el2("button", "menu_button vm-act vm-act-ghost");
    appendBtn.textContent = "追加";
    appendBtn.addEventListener("click", () => {
      const cur = deps.getData();
      const existing = new Set(cur.schema.variables.map((v) => v.key));
      const added = tpl.variables.filter((v) => !existing.has(v.key));
      if (added.length === 0) {
        window.alert("该模板的变量路径都已存在，没有可追加的项。");
        return;
      }
      save({ ...cur, schema: { ...cur.schema, variables: [...cur.schema.variables, ...cloneDefs(added)] } });
    });
    actions.append(replaceBtn, appendBtn);
    if (customId) {
      const delBtn = el2("button", "menu_button vm-act vm-act-ghost nv-tpl-del");
      delBtn.textContent = "删除";
      delBtn.addEventListener("click", () => {
        if (!window.confirm(`删除自定义模板「${tpl.name}」？`)) return;
        const cur = deps.getData();
        save({ ...cur, customTemplates: cur.customTemplates.filter((t) => t.id !== customId) });
      });
      actions.append(delBtn);
    }
    card.append(actions);
    return card;
  }
  function buildDefsSection() {
    const data = deps.getData();
    const { box } = section(`变量定义（${data.schema.variables.length}）`);
    const layout = el2("div", "nv-defs-layout");
    const list = el2("div", "nv-defs-list");
    const editor = el2("div", "nv-defs-editor");
    if (data.schema.variables.length === 0) {
      descLine2(list, "还没有变量。从上方模板一键导入，或点右侧「添加变量」逐条定义。");
    }
    for (let i = 0; i < data.schema.variables.length; i++) {
      list.append(buildDefRow(data.schema.variables[i], i));
    }
    if (formDraft) {
      editor.append(buildDefForm());
    } else {
      const hint = el2("div", "so-app-desc");
      hint.textContent = "点击左侧变量进行编辑，或新建：";
      editor.append(
        hint,
        appButton("＋ 添加变量", () => {
          formDraft = emptyDraft2();
          editingIndex = null;
          scrollToEditor = true;
          render3();
        })
      );
    }
    layout.append(list, editor);
    box.append(layout);
    return box;
  }
  function buildDefRow(def, index) {
    const selected = editingIndex === index;
    const card = el2("div", `vm-leaf${selected ? " nv-def-selected" : ""}`);
    const main = el2("div", "vm-leaf-main");
    const keyEl = el2("span", "vm-key");
    keyEl.textContent = def.key;
    const meta = el2("span", "vm-val");
    const parts = [TYPE_LABELS[def.type], `默认 ${formatValue(def.default)}`];
    if (def.range) parts.push(`范围 ${def.range[0]}~${def.range[1]}`);
    if (def.enum) parts.push(`枚举 ${def.enum.join("/")}`);
    if (def.hidden) parts.push("对 AI 隐藏");
    meta.textContent = parts.join(" · ");
    main.append(keyEl, meta);
    if (def.description) {
      const desc = el2("div", "vm-desc");
      desc.textContent = def.description;
      main.append(desc);
    }
    if (def.updateRule) {
      const rule = el2("div", "vm-desc");
      rule.textContent = `规则：${def.updateRule.split("\n").join("；")}`;
      main.append(rule);
    }
    main.setAttribute("role", "button");
    main.tabIndex = 0;
    const edit = () => {
      formDraft = draftFromDef(def);
      editingIndex = index;
      scrollToEditor = true;
      render3();
    };
    main.addEventListener("click", edit);
    main.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        edit();
      }
    });
    const del = el2("button", "vm-del");
    del.setAttribute("aria-label", "删除定义");
    del.title = "删除该变量定义";
    del.textContent = "✕";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!window.confirm(`删除变量定义「${def.key}」？（已保存的楼层快照不受影响）`)) return;
      const cur = deps.getData();
      if (editingIndex === index) {
        formDraft = null;
        editingIndex = null;
      }
      save({ ...cur, schema: { ...cur.schema, variables: cur.schema.variables.filter((_, i) => i !== index) } });
    });
    card.append(main, del);
    return card;
  }
  function buildDefForm() {
    const draft = formDraft;
    const wrap = el2("div", "vm-leaf vm-editing");
    const title = el2("div", "so-app-title vm-edit-title");
    title.textContent = editingIndex === null ? "新变量定义" : `编辑：${draft.key || "（未命名）"}`;
    wrap.append(title);
    const err = el2("div", "so-app-desc vm-add-err");
    err.hidden = true;
    wrap.append(
      textRow("路径（点号分层）", draft.key, "如 状态.体力 / 角色.小雪.好感度", (v) => draft.key = v),
      selectRow(
        "类型",
        draft.type,
        Object.keys(TYPE_LABELS).map((t) => ({ value: t, label: TYPE_LABELS[t] })),
        (v) => {
          draft.type = v;
          render3();
        }
      ),
      textRow("默认值", draft.defaultText, draft.type === "boolean" ? "true / false" : "", (v) => draft.defaultText = v),
      textRow("描述（给 AI 看）", draft.description, "如 角色对用户的好感", (v) => draft.description = v)
    );
    if (draft.type === "number") {
      wrap.append(textRow("范围（可空）", draft.rangeText, "如 0~100，越界自动修正", (v) => draft.rangeText = v));
    }
    if (draft.type === "enum") {
      wrap.append(textRow("枚举选项（逗号分隔）", draft.enumText, "如 开心, 平静, 烦躁", (v) => draft.enumText = v));
    }
    wrap.append(
      textareaRow(
        "更新规则（每行一条，注入给 AI）",
        draft.updateRule,
        "如：正面互动 +1~3\n重大事件 ±5~10\n禁止无缘由跳变",
        (v) => draft.updateRule = v
      ),
      toggleRow("对 AI 隐藏（内部计算用）", draft.hidden, (v) => draft.hidden = v),
      err
    );
    const actions = el2("div", "vm-actions");
    const saveBtn = el2("button", "menu_button vm-act");
    saveBtn.textContent = "保存定义";
    saveBtn.addEventListener("click", () => {
      const r = draftToDef(draft);
      if (!r.def) {
        err.textContent = r.error ?? "输入无效。";
        err.hidden = false;
        return;
      }
      const cur = deps.getData();
      const dup = cur.schema.variables.findIndex((v, i) => v.key === r.def.key && i !== editingIndex);
      if (dup >= 0) {
        err.textContent = `路径「${r.def.key}」已有定义。`;
        err.hidden = false;
        return;
      }
      const variables = [...cur.schema.variables];
      if (editingIndex !== null && editingIndex < variables.length) variables[editingIndex] = r.def;
      else variables.push(r.def);
      formDraft = null;
      editingIndex = null;
      save({ ...cur, schema: { ...cur.schema, variables } });
    });
    const cancel = el2("button", "menu_button vm-act vm-act-ghost");
    cancel.textContent = "取消";
    cancel.addEventListener("click", () => {
      formDraft = null;
      editingIndex = null;
      render3();
    });
    actions.append(saveBtn, cancel);
    wrap.append(actions);
    return wrap;
  }
  function buildSettingsSection() {
    const data = deps.getData();
    const { box } = section("生成设置");
    box.append(
      selectRow(
        "输出格式",
        data.format,
        [
          { value: "json_patch", label: "JSON Patch（推荐）" },
          { value: "lodash_set", label: "_.set（老版 MVU 兼容）" }
        ],
        (v) => save({ ...deps.getData(), format: v === "lodash_set" ? "lodash_set" : "json_patch" })
      ),
      numberRow(
        "注入深度（距末尾楼层数）",
        data.injectionDepth,
        0,
        20,
        (v) => save({ ...deps.getData(), injectionDepth: v })
      )
    );
    return box;
  }
  function buildPreviewSection() {
    const fold = foldSection("注入预览");
    const text = deps.buildPreview();
    if (text) {
      const pre = el2("div", "nv-pre");
      pre.textContent = text;
      fold.body.append(pre);
    } else {
      descLine2(fold.body, "（未启用或未定义任何变量时不注入。启用开关在手机「新变量」页。）");
    }
    const wrap = el2("div", "so-section");
    wrap.append(fold.box);
    return wrap;
  }
  function buildLogSection() {
    const fold = foldSection("解析日志");
    const report = deps.getLastParse();
    if (!report) {
      descLine2(fold.body, "尚无解析记录。AI 回复包含 <UpdateVariable> 块时，这里显示逐条接受/修正/拒绝结果。");
    } else {
      descLine2(fold.body, `楼层 #${report.messageId}${report.error ? ` · 解析出错：${report.error}` : ""}`);
      const icons = { accepted: "✅", corrected: "⚠️", rejected: "❌", removed: "🗑️" };
      for (const entry of report.log) {
        const line = el2("div", "so-app-desc nv-log-line");
        line.textContent = `${icons[entry.status] ?? "·"} ${entry.path}${entry.detail ? ` — ${entry.detail}` : ""}`;
        fold.body.append(line);
      }
    }
    const wrap = el2("div", "so-section");
    wrap.append(fold.box);
    return wrap;
  }
  return { open, close, isOpen: () => backdrop !== null };
}

// st-extension/src/apps/api/manager.ts
function createApiManager(deps) {
  let backdrop = null;
  let dialog = null;
  let body = null;
  let picker = null;
  let draft = null;
  let editingId = null;
  let formNotice = "";
  let scrollToEditor = false;
  function applyBackdropSize() {
    if (!backdrop) return;
    backdrop.style.left = "0";
    backdrop.style.top = "0";
    backdrop.style.width = `${window.innerWidth}px`;
    backdrop.style.height = `${window.innerHeight}px`;
  }
  function onEscape(e) {
    if (e.key !== "Escape") return;
    if (picker) closePicker();
    else close();
  }
  function open() {
    if (backdrop) {
      render3();
      return;
    }
    draft = null;
    editingId = null;
    formNotice = "";
    backdrop = el2("div", "so-manager-backdrop");
    document.addEventListener("keydown", onEscape);
    window.addEventListener("resize", applyBackdropSize);
    applyBackdropSize();
    dialog = el2("div", "so-manager");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", "API 站点管理");
    const header = el2("div", "so-manager-header");
    const title = el2("div", "so-manager-title");
    title.textContent = "API 站点管理";
    const closeBtn = el2("div", "menu_button so-manager-close");
    closeBtn.textContent = "✕";
    closeBtn.title = "关闭";
    closeBtn.setAttribute("role", "button");
    closeBtn.tabIndex = 0;
    closeBtn.addEventListener("click", close);
    closeBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        close();
      }
    });
    header.append(title, closeBtn);
    body = el2("div", "so-manager-body");
    dialog.append(header, body);
    backdrop.append(dialog);
    document.body.append(backdrop);
    render3();
  }
  function close() {
    if (!backdrop) return;
    document.removeEventListener("keydown", onEscape);
    window.removeEventListener("resize", applyBackdropSize);
    backdrop.remove();
    backdrop = null;
    dialog = null;
    body = null;
    picker = null;
    draft = null;
    editingId = null;
    deps.onClosed?.();
  }
  function save(next) {
    deps.setData(next);
    render3();
  }
  function render3() {
    if (!body) return;
    try {
      body.textContent = "";
      body.append(buildListSection(), buildEditorSection(), buildNoteSection());
      if (scrollToEditor) {
        scrollToEditor = false;
        body.querySelector(".stapi-editor")?.scrollIntoView({ block: "nearest" });
      }
    } catch (err) {
      console.error("[st-stage] API 站点管理弹窗渲染失败", err);
    }
  }
  function section(titleText) {
    const box = el2("div", "so-section");
    const title = el2("div", "so-section-title");
    title.textContent = titleText;
    box.append(title);
    return box;
  }
  function descLine2(parent, text) {
    const d = el2("div", "so-app-desc");
    d.textContent = text;
    parent.append(d);
  }
  function buildListSection() {
    const data = deps.getData();
    const box = section(`站点（${data.profiles.length}）`);
    const conn = readConnection();
    const activeId = findActiveProfile(data.profiles, conn?.url ?? "", conn?.model ?? "")?.id;
    if (data.profiles.length === 0) {
      descLine2(box, "列表还是空的。点下方「＋ 添加站点」，或先在 ST 里连好一个接口再用「导入当前连接」一键录入。");
    } else {
      descLine2(box, "列表顺序即手机页顺序，常用的用 ↑ 排前面。");
    }
    for (const p of data.profiles) {
      const row = el2("div", `vm-leaf${editingId === p.id ? " nv-def-selected" : ""}`);
      const main = el2("div", "vm-leaf-main");
      const name = el2("span", "vm-key");
      name.textContent = p.id === activeId ? `${p.name} · 使用中` : p.name;
      const meta = el2("span", "vm-val");
      const parts = [p.url];
      if (p.model) parts.push(p.model);
      parts.push(p.key ? "已配 Key" : "缺 Key");
      if (p.includeBody.trim() || p.excludeBody.trim() || p.includeHeaders.trim()) parts.push("附加参数 ✓");
      meta.textContent = parts.join(" · ");
      main.append(name, meta);
      main.setAttribute("role", "button");
      main.tabIndex = 0;
      const edit = () => {
        draft = {
          name: p.name,
          url: p.url,
          key: p.key,
          model: p.model,
          includeBody: p.includeBody,
          excludeBody: p.excludeBody,
          includeHeaders: p.includeHeaders
        };
        editingId = p.id;
        formNotice = "";
        scrollToEditor = true;
        render3();
      };
      main.addEventListener("click", edit);
      main.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          edit();
        }
      });
      const moveBtn = (label, delta) => {
        const btn = el2("button", "vm-del stapi-move");
        btn.setAttribute("aria-label", delta < 0 ? "上移" : "下移");
        btn.title = delta < 0 ? "上移（列表顺序即手机页顺序）" : "下移";
        btn.textContent = label;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          save({ profiles: moveProfile(deps.getData().profiles, p.id, delta) });
        });
        return btn;
      };
      const del = el2("button", "vm-del");
      del.setAttribute("aria-label", "删除站点");
      del.title = "删除该站点";
      del.textContent = "✕";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!window.confirm(`删除站点「${p.name}」？（不影响 ST 当前连接）`)) return;
        if (editingId === p.id) {
          draft = null;
          editingId = null;
        }
        save({ profiles: deps.getData().profiles.filter((x) => x.id !== p.id) });
      });
      row.append(main, moveBtn("↑", -1), moveBtn("↓", 1), del);
      box.append(row);
    }
    box.append(
      appButton("＋ 添加站点", () => {
        draft = emptyDraft();
        editingId = null;
        formNotice = "";
        scrollToEditor = true;
        render3();
      })
    );
    return box;
  }
  function buildEditorSection() {
    const box = section(!draft ? "站点编辑" : editingId === null ? "新增站点" : `编辑：${draft.name || "（未命名）"}`);
    box.classList.add("stapi-editor");
    if (!draft) {
      descLine2(box, "点击上方站点进行编辑，或「＋ 添加站点」新建。");
      return box;
    }
    const d = draft;
    const notice = el2("div", "so-app-desc vm-add-err");
    notice.textContent = formNotice;
    notice.hidden = formNotice === "";
    formNotice = "";
    box.append(notice);
    const showNotice = (text) => {
      notice.textContent = text;
      notice.hidden = false;
    };
    box.append(
      textRow("站点名称", d.name, "起个好认的名字，如：主力中转", (v) => d.name = v),
      textRow("接口地址 URL", d.url, "形如 https://example.com/v1", (v) => d.url = v),
      textRow("API Key", d.key, "只存在你本机的 ST 设置里（明文），公用设备慎用", (v) => d.key = v.trim(), "password"),
      textRow("模型 ID（可空）", d.model, "留空则切换时沿用 ST 当前模型", (v) => d.model = v),
      appButton("从站点拉取模型列表", () => {
        const url = normalizeUrl(d.url);
        if (!url) {
          showNotice("先把接口地址 URL 填上，才能拉模型。");
          return;
        }
        openPicker(url, d.key, (m) => {
          d.model = m;
          render3();
        });
      })
    );
    const extra = foldSection(
      "附加参数（可选，随站点一起切换）",
      Boolean(d.includeBody.trim() || d.excludeBody.trim() || d.includeHeaders.trim())
    );
    const extraDesc = el2("div", "so-app-desc");
    extraDesc.textContent = "对应 ST 连接面板的「附加参数」，YAML 格式原样透传；切换到本站点时自动写入，无需再去 ST 里手改。";
    extra.body.append(
      extraDesc,
      textareaRow("包括主体参数（YAML 对象）", d.includeBody, "写进每次请求主体的参数，一行一条：\ntop_k: 20\nrepetition_penalty: 1.1", (v) => d.includeBody = v),
      textareaRow("排除主体参数（每行一个）", d.excludeBody, "不想让 ST 发出去的参数名，一行一个：\ntop_p", (v) => d.excludeBody = v),
      textareaRow("包含请求标头（YAML 对象）", d.includeHeaders, "随请求附带的自定义 Header：\nX-My-Header: 某值", (v) => d.includeHeaders = v)
    );
    box.append(extra.box);
    const actions = el2("div", "vm-actions");
    const saveBtn = el2("button", "menu_button vm-act");
    saveBtn.textContent = editingId === null ? "保存站点" : "保存修改";
    saveBtn.addEventListener("click", () => {
      const cur = deps.getData().profiles;
      const urlDup = findUrlDuplicate(cur, d.url, editingId);
      if (urlDup && !window.confirm(
        `站点「${urlDup.name}」已经在用这个地址了。
同地址多配置是允许的（比如同一网关配不同模型），确定再存一份吗？`
      )) {
        return;
      }
      const r = upsertProfile(cur, d, editingId);
      if ("error" in r) {
        showNotice(r.error);
        return;
      }
      draft = null;
      editingId = null;
      save({ profiles: r.profiles });
    });
    const cancel = el2("button", "menu_button vm-act vm-act-ghost");
    cancel.textContent = "取消";
    cancel.addEventListener("click", () => {
      draft = null;
      editingId = null;
      render3();
    });
    const readCur = el2("button", "menu_button vm-act vm-act-ghost");
    readCur.textContent = "导入当前连接";
    readCur.title = "把 ST 正在使用的 URL/模型/附加参数填进表单（Key 读不回，需手填）";
    readCur.addEventListener("click", () => {
      const conn = readConnection();
      if (!conn) {
        showNotice("未检测到 SillyTavern 运行时，导入不了。");
        return;
      }
      d.url = conn.url;
      d.model = conn.model;
      d.includeBody = conn.includeBody;
      d.excludeBody = conn.excludeBody;
      d.includeHeaders = conn.includeHeaders;
      formNotice = "已导入当前 URL/模型/附加参数；Key 出于安全读不回来，请手动补上。";
      render3();
    });
    actions.append(saveBtn, cancel, readCur);
    box.append(actions);
    return box;
  }
  function buildNoteSection() {
    const box = section("说明");
    descLine2(box, "Key 随 ST 设置明文保存在你自己的设备上（扩展设置的通用机制），公用设备上请谨慎。");
    descLine2(box, "切换在手机「API」页进行：点站点行 → 写入 Key、切到自定义(OpenAI 兼容)接口、写附加参数 → 自动连接。");
    return box;
  }
  function closePicker() {
    picker?.remove();
    picker = null;
  }
  function openPicker(url, key, onPick) {
    if (!dialog) return;
    closePicker();
    picker = el2("div", "stapi-picker");
    const box = el2("div", "stapi-picker-box");
    const head = el2("div", "stapi-picker-head");
    const title = el2("div", "so-section-title");
    title.textContent = "选择模型";
    const closeBtn = el2("button", "menu_button vm-act vm-act-ghost");
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "关闭");
    closeBtn.addEventListener("click", closePicker);
    head.append(title, closeBtn);
    const filter = document.createElement("input");
    filter.type = "text";
    filter.className = "text_pole so-app-input";
    filter.placeholder = "输入关键字筛选";
    filter.autocomplete = "off";
    const list = el2("div", "stapi-picker-list");
    const loading = el2("div", "so-app-desc");
    loading.textContent = "正在向站点请求模型列表…";
    list.append(loading);
    box.append(head, filter, list);
    picker.append(box);
    picker.addEventListener("click", (e) => {
      if (e.target === picker) closePicker();
    });
    dialog.append(picker);
    const restoreKey = findActiveProfile(deps.getData().profiles, readConnection()?.url ?? "")?.key ?? "";
    fetchModels(url, key, restoreKey).then((models) => {
      if (!picker) return;
      const renderList = (kw) => {
        list.textContent = "";
        const f = kw.trim().toLowerCase();
        const subset = models.filter((m) => m.toLowerCase().includes(f));
        if (subset.length === 0) {
          const empty = el2("div", "so-app-desc");
          empty.textContent = "没有筛到匹配的模型";
          list.append(empty);
          return;
        }
        for (const m of subset) {
          const item = el2("div", "stapi-picker-item");
          item.textContent = m;
          item.setAttribute("role", "button");
          item.tabIndex = 0;
          const pick = () => {
            closePicker();
            onPick(m);
          };
          item.addEventListener("click", pick);
          item.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pick();
            }
          });
          list.append(item);
        }
      };
      renderList("");
      filter.addEventListener("input", () => renderList(filter.value));
      filter.focus();
    }).catch((err) => {
      if (!picker) return;
      list.textContent = "";
      const fail = el2("div", "so-app-desc");
      fail.textContent = `拉取失败：${err instanceof Error ? err.message : String(err)}`;
      list.append(fail);
    });
  }
  return { open, close, isOpen: () => backdrop !== null };
}

// st-extension/src/index.ts
async function init() {
  window.__stStageDispose?.();
  const adapter = new STAdapter();
  let settings;
  try {
    settings = await adapter.loadSettings();
  } catch (err) {
    console.error("[sprite-overlay] 初始化失败", err);
    return;
  }
  function updateSettings(next) {
    const displayChanged = next.hideTagInMessage !== settings.hideTagInMessage || next.renderInlineImages !== settings.renderInlineImages || next.spriteDisplayMode !== settings.spriteDisplayMode || next.imageHost !== settings.imageHost || next.enabled !== settings.enabled || next.recentFloors !== settings.recentFloors;
    const autoChanged = next.autoSwitch !== settings.autoSwitch || next.autoSwitchSeconds !== settings.autoSwitchSeconds;
    settings = next;
    adapter.saveSettings(settings);
    overlay.setLayout(settings.overlay);
    phone.setVisible(settings.showPhone);
    if (autoChanged) overlay.setAutoSwitch(settings.autoSwitch, settings.autoSwitchSeconds);
    refresh();
    if (displayChanged) reprocessAllMessages(settings);
  }
  function saveSettingsOnly(next) {
    settings = next;
    adapter.saveSettings(settings);
  }
  const manager = createSpriteManager({
    adapter,
    getSettings: () => settings,
    updateSettings,
    // 从手机打开的弹窗关闭后：重新展开手机并回到「图库」页；悬浮窗齿轮来源则正常关闭
    onClosed: (source) => {
      if (source === "phone") phone.openApp("gallery");
    }
  });
  const overlay = createOverlay(
    settings.overlay,
    (layout) => {
      settings = { ...settings, overlay: layout };
      adapter.saveSettings(settings);
    },
    () => manager.open(),
    // 悬浮窗 ✕：只隐藏窗体并记住状态，立绘功能（含楼层立绘）不受影响
    () => updateSettings({ ...settings, overlayHidden: true })
  );
  overlay.setAutoSwitch(settings.autoSwitch, settings.autoSwitchSeconds);
  const registry = new PhoneAppRegistry();
  function createAppContext(appId, goHome) {
    return createPhoneAppContext({
      appId,
      getSettings: () => settings,
      updateSettings,
      saveSettingsOnly,
      getCharacterName: () => adapter.getCurrentCharacterName(),
      goHome
    });
  }
  const phone = createPhoneShell(settings.phone, {
    registry,
    createAppContext,
    onStateChange: (state) => {
      saveSettingsOnly({ ...settings, phone: state });
    }
  });
  function collapsePhone() {
    settings = { ...settings, phone: { ...settings.phone, open: false } };
    adapter.saveSettings(settings);
    phone.setState(settings.phone);
  }
  const newvarRuntime = createNewvarRuntime({
    getSettings: () => settings,
    inject: (prompt, depth) => adapter.injectChannel(NEWVAR_CHANNEL, prompt, depth)
  });
  window.__stStageDispose = () => newvarRuntime.dispose();
  const newvarDesigner = createNewvarDesigner({
    getData: () => newvarRuntime.getData(),
    setData: (next) => {
      saveSettingsOnly({ ...settings, apps: { ...settings.apps, [NEWVAR_APP_ID]: next } });
      newvarRuntime.onConfigChanged();
    },
    buildPreview: () => newvarRuntime.buildPreview(),
    getLastParse: () => newvarRuntime.getLastParse(),
    onClosed: () => phone.openApp("newvar")
  });
  const apiManager = createApiManager({
    getData: () => sanitizeAppData(settings.apps[API_APP_ID]),
    setData: (next) => {
      saveSettingsOnly({ ...settings, apps: { ...settings.apps, [API_APP_ID]: next } });
    },
    onClosed: () => phone.openApp("api")
  });
  for (const app of createBuiltinApps({
    // 从手机开图库弹窗：先收起手机（避免挡在弹窗上），来源标记=手机（关闭后回图库页）
    openGalleryManager: () => {
      collapsePhone();
      manager.open("phone");
    },
    newvarRuntime,
    openNewvarDesigner: () => {
      collapsePhone();
      newvarDesigner.open();
    },
    openApiManager: () => {
      collapsePhone();
      apiManager.open();
    }
  })) {
    registry.register(app);
  }
  window.stStage = {
    registerApp: (app) => registry.register(app)
  };
  function overlayAllowed() {
    return settings.enabled && settings.spriteDisplayMode !== "inline" && !settings.overlayHidden;
  }
  let lastOverlayContentKey = "";
  function refresh() {
    if (!settings.enabled) {
      adapter.injectPrompt("");
      overlay.setVisible(false);
      lastOverlayContentKey = "";
      return;
    }
    const characterName = adapter.getCurrentCharacterName();
    const packs = getActivePacks(settings, characterName);
    const pack = packs[0] ?? null;
    const prompt = buildPrompt(
      getActiveAddresses(settings, characterName),
      settings.multiRolePromptMode,
      settings.spriteCount,
      settings.promptTemplate
    );
    adapter.injectPrompt(prompt, settings.injectionDepth);
    const contentKey = `${characterName}|${packs.map((p) => p.id).join(",")}|${pack ? pack.sprites.length > 0 : false}`;
    if (contentKey !== lastOverlayContentKey) {
      lastOverlayContentKey = contentKey;
      if (pack && pack.sprites.length > 0) {
        preloadOnActivate(packs);
        overlay.setImage(pack.sprites[0].url, pack.sprites[0].tag);
      } else if (characterName) {
        overlay.setPlaceholder("未绑定立绘包\n点击 ⚙ 进行绑定");
      } else {
        overlay.setPlaceholder("打开角色聊天后\n点击 ⚙ 绑定立绘包");
      }
    }
    overlay.setVisible(overlayAllowed());
  }
  adapter.onMessageReceived((text) => {
    if (!settings.enabled) return;
    const characterName = adapter.getCurrentCharacterName();
    const packs = getActivePacks(settings, characterName);
    if (packs.length === 0) return;
    const seq = resolveSprites(packs, extractTags(text));
    preloadMatchedSprites(seq);
    if (seq.length > 0 && overlayAllowed()) {
      overlay.setSprites(seq);
      overlay.setVisible(true);
    }
  });
  mountMessagePostprocess({ getSettings: () => settings });
  adapter.onCharacterChanged(() => {
    refresh();
    manager.refreshIfOpen();
    setTimeout(() => reprocessAllMessages(settings), 200);
  });
  mountSettingsPanel({
    getSettings: () => settings,
    updateSettings
  });
  refresh();
  newvarRuntime.start();
  phone.setState(settings.phone);
  phone.setVisible(settings.showPhone);
  const version = false ? "dev" : `v${"0.6.1"} · ${"2026-07-28 13:14"}`;
  console.log(`[sprite-overlay] 掌柜的（st-stage）已加载（含手机框架）${version}`);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void init());
} else {
  void init();
}
