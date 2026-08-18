// core/types.ts
var SETTINGS_VERSION = 7;
var RECENT_FLOORS_DEFAULT = 6;
var RECENT_FLOORS_MIN = 1;
var RECENT_FLOORS_MAX = 50;
var SPRITE_OPACITY_DEFAULT = 100;
var SPRITE_OPACITY_MIN = 20;
var SPRITE_OPACITY_MAX = 100;
var SPRITE_COUNT_DEFAULT = 1;
var SPRITE_COUNT_MIN = 1;
var SPRITE_COUNT_MAX = 10;
var INJECTION_DEPTH_DEFAULT = 4;
var INJECTION_DEPTH_MIN = 0;
var INJECTION_DEPTH_MAX = 100;
var PROMPT_BUDGET_DEFAULT = 0;
var PROMPT_BUDGET_MIN = 0;
var PROMPT_BUDGET_MAX = 2e4;
var DEFAULT_IMAGE_HOST = "https://files.catbox.moe/";
function getSpriteSource(sprite) {
  if (sprite.url.startsWith("data:")) return "embedded";
  if (/^https?:\/\//.test(sprite.url)) return "hosted";
  return "local";
}
var DEFAULT_PROMPT_NOTE_PLACEMENT = "after-list";
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
    spriteOpacity: SPRITE_OPACITY_DEFAULT,
    recentFloors: RECENT_FLOORS_DEFAULT,
    phone: { x: 24, y: 320, open: false },
    showPhone: true,
    autoSwitch: false,
    autoSwitchSeconds: 3,
    multiRole: false,
    multiRolePromptMode: "repeat",
    spriteCount: SPRITE_COUNT_DEFAULT,
    injectionDepth: INJECTION_DEPTH_DEFAULT,
    promptTemplate: "",
    promptBudget: PROMPT_BUDGET_DEFAULT,
    imgbbApiKey: "",
    autoUpload: false,
    galleryFoldByRole: true,
    packs: [],
    presetOverrides: {},
    bindings: [],
    apps: {}
  };
}

// core/sprite-metadata.ts
var MAX_LABELS = 24;
var MAX_LABEL_CODE_POINTS = 32;
var MAX_NOTE_CODE_POINTS = 500;
function parseNumberedTag(tag) {
  const match = /^(.+?)(\d+)$/u.exec(tag);
  if (!match) return null;
  if (/^\d+$/u.test(match[1])) return null;
  return { prefix: match[1], suffix: match[2], value: BigInt(match[2]) };
}
function hasCoherentSuffixFormatting(tags) {
  const canonical = tags.every((tag) => tag.suffix === tag.value.toString());
  const width = tags[0]?.suffix.length;
  const fixedWidth = width !== void 0 && tags.every((tag) => tag.suffix.length === width);
  return canonical || fixedWidth;
}
function compactNumberedTags(tags, reservedTags = tags) {
  const uniqueTags = [...new Set(tags)];
  const reserved = new Set(tags);
  for (const tag of reservedTags) reserved.add(tag);
  const entries = [];
  let index = 0;
  while (index < uniqueTags.length) {
    const first = parseNumberedTag(uniqueTags[index]);
    if (!first) {
      entries.push({ kind: "tag", label: uniqueTags[index], values: [uniqueTags[index]] });
      index++;
      continue;
    }
    let end = index + 1;
    let previous = first.value;
    while (end < uniqueTags.length) {
      const next = parseNumberedTag(uniqueTags[end]);
      if (!next || next.prefix !== first.prefix || next.value !== previous + 1n) break;
      previous = next.value;
      end++;
    }
    const values = uniqueTags.slice(index, end);
    const numbered = values.map((tag) => parseNumberedTag(tag));
    const last = numbered[numbered.length - 1];
    const label = `${first.prefix}${first.suffix}-${last.suffix}`;
    if (values.length >= 3 && hasCoherentSuffixFormatting(numbered) && !reserved.has(label)) {
      entries.push({
        kind: "range",
        label,
        values
      });
    } else {
      entries.push(...values.map((tag) => ({ kind: "tag", label: tag, values: [tag] })));
    }
    index = end;
  }
  return entries;
}
function clipCodePoints(value, limit) {
  return Array.from(value).slice(0, limit).join("").trim();
}
function normalizeLabels(raw) {
  if (!Array.isArray(raw)) return [];
  const labels = [];
  const seen = /* @__PURE__ */ new Set();
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const label = clipCodePoints(value.trim(), MAX_LABEL_CODE_POINTS);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
    if (labels.length === MAX_LABELS) break;
  }
  return labels;
}
function normalizePackKind(raw) {
  return raw === "sprite" || raw === "illustration" ? raw : void 0;
}
function packKind(pack) {
  return normalizePackKind(pack.kind) ?? "sprite";
}
function packLabels(pack) {
  return {
    role: (pack.roleName ?? "").trim() || "其他",
    type: packKind(pack) === "illustration" ? "插图" : "立绘",
    custom: normalizeLabels(pack.customTags)
  };
}
function normalizeNote(raw) {
  return typeof raw === "string" ? clipCodePoints(raw.trim(), MAX_NOTE_CODE_POINTS) : "";
}
function normalizeOutfitNotes(raw) {
  const notes = /* @__PURE__ */ Object.create(null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return notes;
  for (const [rawOutfit, rawNote] of Object.entries(raw)) {
    const outfit = rawOutfit.trim();
    const note = normalizeNote(rawNote);
    if (outfit && note) notes[outfit] = note;
  }
  return notes;
}
function filterSprites(pack, filter) {
  const query = (filter.query ?? "").trim().toLocaleLowerCase();
  const requiredLabels = [...new Set((filter.labels ?? []).map((label) => label.trim().toLocaleLowerCase()).filter(Boolean))];
  return pack.sprites.filter((sprite) => {
    const labels = (sprite.labels ?? []).map((label) => label.toLocaleLowerCase());
    if (!requiredLabels.every((label) => labels.includes(label))) return false;
    if (!query) return true;
    return [
      sprite.tag,
      ...labels,
      spriteRole(pack, sprite),
      spriteOutfit(pack, sprite),
      pack.name
    ].some((value) => value.toLocaleLowerCase().includes(query));
  });
}
function groupPacksByRole(packs) {
  const groups = [];
  const byRole = /* @__PURE__ */ new Map();
  for (const pack of packs) {
    const role = (pack.roleName ?? "").trim();
    if (!role) {
      groups.push(makePackGroup(`pack:${pack.id}`, "", [pack]));
      continue;
    }
    const existing = byRole.get(role);
    if (existing) {
      existing.packs.push(pack);
      existing.packCount += 1;
      existing.spriteCount += pack.sprites.length;
      continue;
    }
    const group = makePackGroup(`role:${role}`, role, [pack]);
    byRole.set(role, group);
    groups.push(group);
  }
  return groups;
}
function makePackGroup(key, role, packs) {
  return {
    key,
    role,
    packs,
    packCount: packs.length,
    spriteCount: packs.reduce((count, pack) => count + pack.sprites.length, 0)
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
function splitAtMost(text3, sep, n) {
  const out = [];
  let rest = text3;
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

// core/prompt-builder.ts
function buildPromptSceneNotes(packs, addresses) {
  const notes = [];
  const multiPack = packs.length > 1;
  const available2 = new Set(addresses.map(addressConflictKey));
  for (const pack of packs) {
    const scenes = [];
    const seen = /* @__PURE__ */ new Set();
    for (const sprite of pack.sprites) {
      const scene = effectiveSpriteAddress(pack, sprite, multiPack);
      if (!available2.has(addressConflictKey(scene))) continue;
      const key = JSON.stringify([scene.role, scene.outfit]);
      if (seen.has(key)) continue;
      seen.add(key);
      scenes.push(scene);
    }
    const placement = pack.promptNotePlacement ?? DEFAULT_PROMPT_NOTE_PLACEMENT;
    const packNote = pack.promptNote?.trim() ?? "";
    for (const [index, scene] of scenes.entries()) {
      if (packNote && placement === "before-list" && index === 0) {
        notes.push({ role: scene.role, outfit: scene.outfit, note: packNote, placement });
      }
      const outfitNote = pack.outfitNotes && Object.prototype.hasOwnProperty.call(pack.outfitNotes, scene.outfit) ? pack.outfitNotes?.[scene.outfit]?.trim() ?? "" : "";
      if (outfitNote) {
        notes.push({ role: scene.role, outfit: scene.outfit, note: outfitNote, placement });
      }
      if (packNote && placement === "after-list" && index === scenes.length - 1) {
        notes.push({ role: scene.role, outfit: scene.outfit, note: packNote, placement });
      }
    }
  }
  return notes;
}
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
        role: address.role,
        outfit: address.outfit,
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
function renderTags(tags, reservedTags) {
  const entries = compactNumberedTags(tags, reservedTags);
  return {
    text: entries.map((entry) => entry.kind === "range" ? `${entry.label}（输出时从${entry.values[0]}至${entry.values[entry.values.length - 1]}中随机选择一个完整图名）` : entry.label).join("、"),
    ranges: entries.filter((entry) => entry.kind === "range").map((entry) => entry.label)
  };
}
function rangeInstruction(ranges) {
  if (ranges.length === 0) return [];
  return [
    `编号范围仅用于压缩展示；必须输出范围内一个实际存在的完整图名，严禁直接输出范围标签（${ranges.join("、")}）。`
  ];
}
function indexSceneNotes(notes) {
  const index = /* @__PURE__ */ new Map();
  for (const note of notes) {
    if (!note.note.trim()) continue;
    const key = `${note.role}|${note.outfit}`;
    let placements = index.get(key);
    if (!placements) {
      placements = { "before-list": [], "after-list": [] };
      index.set(key, placements);
    }
    placements[note.placement].push(note);
  }
  return index;
}
function matchingNotes(noteIndex, scene, placement) {
  return noteIndex.get(scene.key)?.[placement] ?? [];
}
function noteLines(scene, note) {
  const parts = note.note.split("\n").map((line) => line.trim()).filter(Boolean);
  if (parts.length === 0) return [];
  const head = parts[0];
  const rest = parts.slice(1).map((line) => `  ${line}`);
  if (note.placement === "before-list") {
    return [`备注（${scene.label}）：${head}`, ...rest];
  }
  return [`  备注：${head}`, ...rest.map((line) => `  ${line}`)];
}
function renderGroupedSceneList(scenes, noteIndex, reservedTags) {
  const lines = [];
  const ranges = [];
  for (const scene of scenes) {
    for (const note of matchingNotes(noteIndex, scene, "before-list")) {
      lines.push(...noteLines(scene, note));
    }
    const rendered = renderTags(scene.tags, reservedTags);
    lines.push(`- ${scene.label}：${rendered.text}`);
    ranges.push(...rendered.ranges);
    for (const note of matchingNotes(noteIndex, scene, "after-list")) {
      lines.push(...noteLines(scene, note));
    }
  }
  return { lines, ranges };
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
function formatInstruction(scenes) {
  const hasDefault = scenes.some((scene) => !scene.role);
  const hasRoleOnly = scenes.some((scene) => scene.role && !scene.outfit);
  const hasOutfit = scenes.some((scene) => scene.role && scene.outfit);
  if (hasDefault && !hasRoleOnly && !hasOutfit) {
    return "输出格式：[立绘:图名]，图名须与上方清单完全一致。";
  }
  if (hasOutfit && !hasDefault && !hasRoleOnly) {
    return "输出格式：[立绘:角色/服装/图名]，角色、服装、图名均须与上方清单完全一致。";
  }
  return "输出格式：默认场景直接写 [立绘:图名]；其他场景写 [立绘:场景/图名]。两段地址表示无服装，三级地址表示指定服装。";
}
var CLOSING_INSTRUCTION = "只能使用上述场景中实际列出的图名，不要自行拼造不存在的角色/服装/图名组合。";
function buildGroupedFull(addresses, count, noteIndex, reservedTags) {
  const scenes = buildScenes(addresses);
  const rendered = renderGroupedSceneList(scenes, noteIndex, reservedTags);
  return [
    "[角色立绘系统]",
    "可用立绘（按场景）：",
    ...rendered.lines,
    ...rangeInstruction(rendered.ranges),
    formatInstruction(scenes),
    countInstruction(count),
    ...fewShotExample(scenes, count),
    CLOSING_INSTRUCTION
  ].join("\n");
}
var SHARED_LIST_LABEL = "共有图名";
function findSharedCluster(scenes) {
  const sets = scenes.map((scene) => new Set(scene.tags));
  const joinedLen = (tags) => tags.reduce((sum, tag) => sum + tag.length, 0) + Math.max(0, tags.length - 1);
  const seenCores = /* @__PURE__ */ new Set();
  let best = null;
  let bestSavings = 0;
  for (let i = 0; i < scenes.length; i++) {
    for (let j = i + 1; j < scenes.length; j++) {
      const core = scenes[i].tags.filter((tag) => sets[j].has(tag));
      if (core.length < 2) continue;
      const signature = core.join("\0");
      if (seenCores.has(signature)) continue;
      seenCores.add(signature);
      const members = sets.map((set) => core.every((tag) => set.has(tag)));
      const memberCount = members.filter(Boolean).length;
      const coreLen = joinedLen(core);
      const savings = memberCount * (coreLen - SHARED_LIST_LABEL.length - 5) - (coreLen + 60);
      if (savings > bestSavings) {
        bestSavings = savings;
        best = { core, members };
      }
    }
  }
  return best;
}
function buildShared(addresses, count, noteIndex, reservedTags) {
  const scenes = buildScenes(addresses);
  if (scenes.length <= 1 || reservedTags.has(SHARED_LIST_LABEL)) {
    return buildGroupedFull(addresses, count, noteIndex, reservedTags);
  }
  const cluster = findSharedCluster(scenes);
  if (!cluster) {
    return buildGroupedFull(addresses, count, noteIndex, reservedTags);
  }
  const coreSet = new Set(cluster.core);
  const renderedCore = renderTags(cluster.core, reservedTags);
  const ranges = [...renderedCore.ranges];
  const lines = [
    "[角色立绘系统]",
    `${SHARED_LIST_LABEL}：${renderedCore.text}`,
    "可用立绘（按场景）："
  ];
  for (const [index, scene] of scenes.entries()) {
    for (const note of matchingNotes(noteIndex, scene, "before-list")) {
      lines.push(...noteLines(scene, note));
    }
    if (cluster.members[index]) {
      const remainder = scene.tags.filter((tag) => !coreSet.has(tag));
      if (remainder.length === 0) {
        lines.push(`- ${scene.label}：${SHARED_LIST_LABEL}`);
      } else {
        const rendered = renderTags(remainder, reservedTags);
        lines.push(`- ${scene.label}：${SHARED_LIST_LABEL}，另有：${rendered.text}`);
        ranges.push(...rendered.ranges);
      }
    } else {
      const rendered = renderTags(scene.tags, reservedTags);
      lines.push(`- ${scene.label}：${rendered.text}`);
      ranges.push(...rendered.ranges);
    }
    for (const note of matchingNotes(noteIndex, scene, "after-list")) {
      lines.push(...noteLines(scene, note));
    }
  }
  lines.push(`场景行写「${SHARED_LIST_LABEL}」表示最上方共有清单里的图名整组可用；「另有」及直接列出的图名只属于所在场景。`);
  lines.push(...rangeInstruction(ranges));
  lines.push(formatInstruction(scenes));
  lines.push(countInstruction(count));
  lines.push(...fewShotExample(scenes, count));
  lines.push(CLOSING_INSTRUCTION);
  return lines.join("\n");
}
var ROLE_BASE_LIST_LABEL = "基础图名池";
var VARIANT_SUFFIX = "_变";
function findRoleBaseCluster(scenes) {
  const plainTags = scenes.map((scene) => scene.tags.filter((tag) => !tag.endsWith(VARIANT_SUFFIX)));
  const sets = plainTags.map((tags) => new Set(tags));
  const seen = /* @__PURE__ */ new Set();
  let best = null;
  for (let i = 0; i < scenes.length; i++) {
    for (let j = i + 1; j < scenes.length; j++) {
      const core = plainTags[i].filter((tag) => sets[j].has(tag));
      if (core.length < 2) continue;
      const signature = JSON.stringify(core);
      if (seen.has(signature)) continue;
      seen.add(signature);
      const members = sets.map((set) => core.every((tag) => set.has(tag)));
      if (!best || core.length > best.core.length || core.length === best.core.length && members.filter(Boolean).length > best.members.filter(Boolean).length) {
        best = { core, members };
      }
    }
  }
  return best;
}
function variantBases(tags) {
  const seen = /* @__PURE__ */ new Set();
  const bases = [];
  for (const tag of tags) {
    if (!tag.endsWith(VARIANT_SUFFIX)) continue;
    const base = tag.slice(0, -VARIANT_SUFFIX.length);
    if (!base || seen.has(base)) continue;
    seen.add(base);
    bases.push(base);
  }
  return bases;
}
function relativeFewShotExample(scenes, count) {
  if (count <= 1) return [];
  const scene = scenes[0];
  if (!scene || scene.tags.length === 0) return [];
  const first = scene.tags[0];
  const second = scene.tags[1] ?? first;
  return [
    "插入位置示例（省略号代表你的正文段落）：",
    "…剧情段落一…",
    `[立绘:${first}]`,
    "…剧情段落二…",
    `[立绘:${second}]`
  ];
}
function buildRoleCompact(addresses, count, noteIndex, reservedTags) {
  const scenes = buildScenes(addresses);
  const role = scenes[0]?.role;
  if (scenes.length < 2 || !role || reservedTags.has(ROLE_BASE_LIST_LABEL) || scenes.some((scene) => scene.role !== role || !scene.outfit)) return null;
  const cluster = findRoleBaseCluster(scenes);
  if (!cluster || !cluster.members[0]) return null;
  const baseSet = new Set(cluster.core);
  const renderedBase = renderTags(cluster.core, reservedTags);
  const ranges = [...renderedBase.ranges];
  const lines = [
    "[角色立绘系统]",
    `角色：${role}`,
    `${ROLE_BASE_LIST_LABEL}：${renderedBase.text}`,
    "可用服装："
  ];
  for (const [index, scene] of scenes.entries()) {
    for (const note of matchingNotes(noteIndex, scene, "before-list")) {
      lines.push(...noteLines(scene, note));
    }
    const label = `${scene.outfit}${index === 0 ? "（默认）" : cluster.members[index] ? "" : "（仅限）"}`;
    const plainTags = scene.tags.filter((tag) => !tag.endsWith(VARIANT_SUFFIX));
    if (cluster.members[index]) {
      const extras = plainTags.filter((tag) => !baseSet.has(tag));
      if (extras.length === 0) {
        lines.push(`- ${label}：${ROLE_BASE_LIST_LABEL}`);
      } else {
        const rendered = renderTags(extras, reservedTags);
        lines.push(`- ${label}：${ROLE_BASE_LIST_LABEL}，另有：${rendered.text}`);
        ranges.push(...rendered.ranges);
      }
    } else {
      const rendered = renderTags(plainTags, reservedTags);
      lines.push(`- ${label}：${rendered.text}`);
      ranges.push(...rendered.ranges);
    }
    const variants = variantBases(scene.tags);
    if (variants.length > 0) lines.push(`  可用“${VARIANT_SUFFIX}”后缀：${variants.join("、")}`);
    for (const note of matchingNotes(noteIndex, scene, "after-list")) {
      lines.push(...noteLines(scene, note));
    }
  }
  lines.push(`服装行写“${ROLE_BASE_LIST_LABEL}”表示该服装可用上方整组图名；“另有”和“仅限”只属于所在服装。`);
  lines.push(...rangeInstruction(ranges));
  lines.push("输出格式：[立绘:图名]（默认服装）或 [立绘:服装/图名]（其他服装）；完整 [立绘:角色/服装/图名] 仍兼容。");
  lines.push(countInstruction(count));
  lines.push(...relativeFewShotExample(scenes, count));
  lines.push(CLOSING_INSTRUCTION);
  return lines.join("\n");
}
function chooseShorterPrompt(grouped, shared) {
  return shared.length < grouped.length ? shared : grouped;
}
function capAddresses(addresses, cap) {
  const perScene = /* @__PURE__ */ new Map();
  const kept = [];
  for (const address of addresses) {
    const key = sceneKey(address);
    let tags = perScene.get(key);
    if (!tags) {
      tags = /* @__PURE__ */ new Set();
      perScene.set(key, tags);
    }
    if (tags.has(address.tag)) continue;
    if (tags.size >= cap) continue;
    tags.add(address.tag);
    kept.push(address);
  }
  return kept;
}
function fitToBudget(addresses, budget, build) {
  const full = build(addresses);
  if (budget <= 0 || full.length <= budget) return full;
  const maxTags = Math.max(...buildScenes(addresses).map((scene) => scene.tags.length));
  let best = build(capAddresses(addresses, 1));
  let lo = 2;
  let hi = maxTags;
  while (lo <= hi) {
    const mid = lo + hi >> 1;
    const candidate = build(capAddresses(addresses, mid));
    if (candidate.length <= budget) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}
var BUILTIN_TEMPLATE = [
  "[角色立绘系统]",
  "可用立绘（按场景）：",
  "{清单}",
  "输出格式：默认场景直接写 [立绘:图名]；其他场景写 [立绘:场景/图名]。两段地址表示无服装，三级地址表示指定服装。",
  "请根据回复内容，按情节顺序选择 {数量} 张立绘。每个 [立绘:...] 标签单独占一行，插在触发它的剧情段落之后——随剧情分散在正文中，不要集中堆在回复结尾。",
  "只能使用上述场景中实际列出的图名，不要自行拼造不存在的角色/服装/图名组合。"
].join("\n");
var LEGACY_BUILTIN_TEMPLATES = [
  [
    "[角色立绘系统]",
    "可用立绘（按场景）：",
    "{清单}",
    "输出格式：默认场景直接写 [立绘:表情]；其他场景写 [立绘:场景/表情]。两段地址表示无服装，三级地址表示指定服装。",
    "请根据回复内容，按情节顺序选择 {数量} 张立绘。每个 [立绘:...] 标签单独占一行，插在触发它的剧情段落之后——随剧情分散在正文中，不要集中堆在回复结尾。",
    "只能使用上述场景中实际列出的表情，不要自行拼造不存在的角色/服装/表情组合。"
  ].join("\n")
];
function normalizeTemplateLineEndings(template) {
  return template.replace(/\r\n?/g, "\n");
}
function isKnownBuiltinTemplate(template) {
  const normalized = normalizeTemplateLineEndings(template);
  return [BUILTIN_TEMPLATE, ...LEGACY_BUILTIN_TEMPLATES].some((known) => normalized === known);
}
function buildPrompt(addresses, mode, count, template = "", budget = 0, notes = []) {
  if (addresses.length === 0) return "";
  const n = Math.max(1, Math.round(count) || 1);
  const b = Math.max(0, Math.round(budget) || 0);
  const noteIndex = indexSceneNotes(notes);
  const reservedTags = new Set(addresses.map((address) => address.tag));
  const custom = template.trim();
  if (custom && !isKnownBuiltinTemplate(template)) {
    return fitToBudget(addresses, b, (addrs) => {
      const rendered = renderGroupedSceneList(buildScenes(addrs), noteIndex, reservedTags);
      const list = [...rendered.lines, ...rangeInstruction(rendered.ranges)].join("\n");
      return custom.replace(/\{清单\}/g, list).replace(/\{数量\}/g, String(n));
    });
  }
  return fitToBudget(addresses, b, (addrs) => {
    const grouped = buildGroupedFull(addrs, n, noteIndex, reservedTags);
    if (mode === "full") return grouped;
    const shared = chooseShorterPrompt(grouped, buildShared(addrs, n, noteIndex, reservedTags));
    const roleCompact = buildRoleCompact(addrs, n, noteIndex, reservedTags);
    return roleCompact && roleCompact.length < grouped.length ? roleCompact : shared;
  });
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
function strictTagMatch(pool, tag) {
  const exact = pool.filter((candidate) => candidate.sprite.tag === tag);
  if (exact.length > 0) return { matched: true, sprite: exact.length === 1 ? exact[0].sprite : null };
  const fuzzy = pool.filter((candidate) => nameMatches(candidate.sprite.tag, tag));
  return { matched: fuzzy.length > 0, sprite: fuzzy.length === 1 ? fuzzy[0].sprite : null };
}
function isRelativeOutfitSet(packs, candidates) {
  if (packs.length < 2) return false;
  const role = candidates[0]?.role;
  return Boolean(
    role && candidates.length > 0 && candidates.every((candidate) => candidate.role === role && Boolean(candidate.outfit))
  );
}
function resolveSprite(packs, address) {
  const raw = address.trim();
  if (!raw) return null;
  const partCount = raw.split("/").length;
  const { role, outfit, tag } = parseAddress(raw);
  if (!tag) return null;
  const all = flatten(packs);
  if (partCount === 1) {
    const firstPack = packs[0];
    if (firstPack && isRelativeOutfitSet(packs, all)) {
      const preferred = strictTagMatch(
        all.filter((candidate) => candidate.pack.id === firstPack.id),
        tag
      );
      if (preferred.matched) return preferred.sprite;
    }
    return matchUniqueTagInPool(all, tag);
  }
  if (partCount === 2) {
    const exactRole = all.filter((candidate) => candidate.role === role);
    if (exactRole.length > 0) {
      const rolePool = exactRole.filter((candidate) => candidate.outfit === "");
      return strictTagMatch(rolePool, tag).sprite;
    }
    const exactAliasPool = all.filter((candidate) => candidate.baseAlias === role).filter((candidate) => candidate.outfit === "");
    if (exactAliasPool.length > 0) {
      const legacy = strictTagMatch(exactAliasPool, tag);
      if (legacy.matched) return legacy.sprite;
    }
    const exactOutfit = all.filter((candidate) => candidate.outfit === role);
    if (exactOutfit.length > 0) return strictTagMatch(exactOutfit, tag).sprite;
    const fuzzyRole = all.filter((candidate) => nameMatches(candidate.role, role));
    if (fuzzyRole.length > 0) {
      const rolePool = fuzzyRole.filter((candidate) => candidate.outfit === "");
      return strictTagMatch(rolePool, tag).sprite;
    }
    const fuzzyAliasPool = all.filter((candidate) => nameMatches(candidate.baseAlias, role)).filter((candidate) => candidate.outfit === "");
    if (fuzzyAliasPool.length > 0) {
      const legacy = strictTagMatch(fuzzyAliasPool, tag);
      if (legacy.matched) return legacy.sprite;
    }
    const fuzzyOutfit = all.filter((candidate) => nameMatches(candidate.outfit, role));
    return strictTagMatch(fuzzyOutfit, tag).sprite;
  }
  let pool = all;
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
function removePacks(settings, packIds) {
  let next = settings;
  for (const id of packIds) next = removePack(next, id);
  return next;
}
function setPackKind(settings, packIds, kind) {
  const selected = new Set(packIds);
  return {
    ...settings,
    packs: settings.packs.map((pack) => selected.has(pack.id) ? { ...pack, kind } : pack)
  };
}
function addPackCustomTag(settings, packIds, rawTag) {
  const tag = normalizeLabels([rawTag])[0];
  if (!tag) return settings;
  const selected = new Set(packIds);
  return {
    ...settings,
    packs: settings.packs.map((pack) => {
      if (!selected.has(pack.id)) return pack;
      const customTags = normalizeLabels([...pack.customTags ?? [], tag]);
      return { ...pack, customTags };
    })
  };
}
function removePackCustomTag(settings, packIds, rawTag) {
  const tag = normalizeLabels([rawTag])[0];
  if (!tag) return settings;
  const selected = new Set(packIds);
  return {
    ...settings,
    packs: settings.packs.map((pack) => {
      if (!selected.has(pack.id)) return pack;
      const customTags = normalizeLabels(pack.customTags).filter((item) => item !== tag);
      const next = { ...pack };
      if (customTags.length > 0) next.customTags = customTags;
      else delete next.customTags;
      return next;
    })
  };
}
function isSafeLocalUserImagePath(path) {
  if (!path.startsWith("/user/images/") || /%(?:2e|2f|5c)/i.test(path) || path.includes("\0")) return false;
  return !path.split("/").some((segment) => segment === "." || segment === "..");
}
function localUserImagePath(url) {
  const rawPath = url.split(/[?#]/, 1)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  const normalized = decoded.replace(/\\/g, "/");
  if (!isSafeLocalUserImagePath(normalized)) return null;
  return normalized;
}
function deletableLocalSpritePaths(settings, packIds) {
  const selected = new Set(packIds);
  const keptReferences = /* @__PURE__ */ new Set();
  for (const pack of settings.packs) {
    if (selected.has(pack.id)) continue;
    for (const sprite of pack.sprites) {
      const path = localUserImagePath(sprite.url);
      if (path) keptReferences.add(path);
    }
  }
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  for (const pack of settings.packs) {
    if (!selected.has(pack.id)) continue;
    for (const sprite of pack.sprites) {
      const path = localUserImagePath(sprite.url);
      if (!path || seen.has(path) || keptReferences.has(path)) continue;
      seen.add(path);
      result.push(path);
    }
  }
  return result;
}
function movePack(settings, packId, offset) {
  const from = settings.packs.findIndex((p) => p.id === packId);
  if (from < 0) return settings;
  const to = from + offset;
  if (to < 0 || to >= settings.packs.length) return settings;
  const packs = [...settings.packs];
  const [moved] = packs.splice(from, 1);
  packs.splice(to, 0, moved);
  return { ...settings, packs };
}
function movePackBefore(settings, packId, targetId) {
  if (packId === targetId) return settings;
  const from = settings.packs.findIndex((p) => p.id === packId);
  if (from < 0) return settings;
  const packs = [...settings.packs];
  const [moved] = packs.splice(from, 1);
  const to = packs.findIndex((p) => p.id === targetId);
  if (to < 0) return settings;
  packs.splice(to, 0, moved);
  return { ...settings, packs };
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
  for (const current2 of pack.sprites) {
    if (sameIdentity(pack, current2, stored.tag, g, o)) {
      if (!replaced) {
        sprites.push(stored);
        replaced = true;
      }
      continue;
    }
    sprites.push(current2);
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

// core/active-prompt.ts
function buildActiveSpritePrompt(settings, characterName, budget = settings.promptBudget) {
  const packs = getActivePacks(settings, characterName);
  const addresses = getActiveAddresses(settings, characterName);
  return buildPrompt(
    addresses,
    settings.multiRolePromptMode,
    settings.spriteCount,
    settings.promptTemplate,
    budget,
    buildPromptSceneNotes(packs, addresses)
  );
}

// core/tag-parser.ts
var TAG_REGEX = /[[【]\s*立绘\s*[:：]\s*([^\]】]+?)\s*[\]】]/g;
function extractTags(text3) {
  const tags = [];
  let match;
  const regex = new RegExp(TAG_REGEX.source, "g");
  while ((match = regex.exec(text3)) !== null) {
    const tag = match[1].trim();
    if (tag) tags.push(tag);
  }
  return tags;
}
function stripTags(text3) {
  return text3.replace(new RegExp(TAG_REGEX.source, "g"), "").replace(/[ \t]+$/gm, "");
}
function replaceTags(text3, replacer) {
  return text3.replace(new RegExp(TAG_REGEX.source, "g"), (raw, address) => {
    const trimmed = address.trim();
    if (!trimmed) return raw;
    const out = replacer(trimmed, raw);
    return out === null ? raw : out;
  });
}
function hasTag(text3) {
  return new RegExp(TAG_REGEX.source).test(text3);
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

// core/capabilities.ts
function createCapabilityTracker() {
  const cleanups = /* @__PURE__ */ new Set();
  let disposed = false;
  const run = (fn) => {
    try {
      fn();
    } catch (err) {
      console.error("[sprite-overlay] 能力清理失败", err);
    }
  };
  return {
    get disposed() {
      return disposed;
    },
    track(cleanup) {
      if (disposed) {
        run(cleanup);
        return () => {
        };
      }
      cleanups.add(cleanup);
      return () => {
        if (cleanups.delete(cleanup)) run(cleanup);
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const fn of [...cleanups].reverse()) run(fn);
      cleanups.clear();
    }
  };
}
function createEventHub() {
  const handlers = /* @__PURE__ */ new Set();
  return {
    emit(value) {
      for (const handler of [...handlers]) {
        try {
          handler(value);
        } catch (err) {
          console.error("[sprite-overlay] App 事件处理器抛错", err);
        }
      }
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    }
  };
}

// core/phone-registry.ts
var CTX_API_VERSION = 2;
function capInjectionText(appId, text3) {
  if (text3.length <= PROMPT_BUDGET_MAX) return text3;
  console.warn(
    `[sprite-overlay] App「${appId}」注入 ${text3.length} 字符超上限，已截断到 ${PROMPT_BUDGET_MAX}`
  );
  return text3.slice(0, PROMPT_BUDGET_MAX);
}
function createAppHost(deps, tracker) {
  return {
    apiVersion: CTX_API_VERSION,
    getSettings: () => deps.getSettings(),
    getCharacterName: () => deps.getCharacterName(),
    getAppData: () => deps.getSettings().apps[deps.appId],
    setAppData: (data) => deps.saveSettingsOnly({
      ...deps.getSettings(),
      apps: { ...deps.getSettings().apps, [deps.appId]: data }
    }),
    onMessageReceived: (handler) => tracker.track(deps.onMessageReceived(handler)),
    onCharacterChanged: (handler) => tracker.track(deps.onCharacterChanged(handler)),
    injectPrompt: (text3, depth) => deps.injectPrompt(deps.appId, capInjectionText(deps.appId, text3), depth),
    toast: (kind, message) => deps.toast(kind, message)
  };
}
function createPhoneAppContext(deps) {
  const tracker = createCapabilityTracker();
  const ctx = {
    ...createAppHost(deps, tracker),
    updateSettings: (next) => deps.updateSettings(next),
    goHome: deps.goHome,
    openModal: (build) => deps.openModal(deps.appId, build),
    setTimeout: (fn, ms) => {
      let untrack = () => {
      };
      const id = globalThis.setTimeout(() => {
        untrack();
        fn();
      }, ms);
      untrack = tracker.track(() => globalThis.clearTimeout(id));
      return id;
    },
    setInterval: (fn, ms) => {
      const id = globalThis.setInterval(fn, ms);
      tracker.track(() => globalThis.clearInterval(id));
      return id;
    }
  };
  return { ctx, dispose: () => tracker.dispose() };
}
function runAppSetup(app, deps, tracker) {
  if (typeof app.setup !== "function") return;
  try {
    const cleanup = app.setup(createAppHost(deps, tracker));
    if (typeof cleanup === "function") tracker.track(cleanup);
  } catch (err) {
    console.error(`[sprite-overlay] App「${app.id}」setup 失败`, err);
  }
}
var APP_ID_REGEX = /^[a-z][a-z0-9-]{1,31}$/;
function assertAppShape(app) {
  const a = app;
  if (typeof a !== "object" || a === null) {
    throw new Error("registerApp 参数必须是 App 对象（{ id, name, icon, mount, ... }）");
  }
  const o = a;
  if (typeof o.id !== "string" || !APP_ID_REGEX.test(o.id)) {
    throw new Error(`App id「${String(o.id)}」非法：需匹配 ${APP_ID_REGEX}`);
  }
  if (typeof o.name !== "string" || o.name.trim() === "") {
    throw new Error(`App「${o.id}」的 name 需为非空字符串`);
  }
  if (typeof o.icon !== "string" || o.icon.trim() === "") {
    throw new Error(`App「${o.id}」的 icon 需为非空字符串`);
  }
  if (typeof o.mount !== "function") {
    throw new Error(`App「${o.id}」缺少 mount(container, ctx) 函数`);
  }
  if (o.setup !== void 0 && typeof o.setup !== "function") {
    throw new Error(`App「${o.id}」的 setup 需为函数`);
  }
  if (o.unmount !== void 0 && typeof o.unmount !== "function") {
    throw new Error(`App「${o.id}」的 unmount 需为函数`);
  }
  if (o.order !== void 0 && typeof o.order !== "number") {
    throw new Error(`App「${o.id}」的 order 需为数字`);
  }
}
var PhoneAppRegistry = class {
  constructor() {
    this.apps = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Set();
  }
  /** 注册 App；形状非法或 id 重复时抛错（独立 App 走注册队列 shim，由 shim 统一 catch） */
  register(app) {
    assertAppShape(app);
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
function installRegisterQueue(prev, register) {
  const seen = [];
  const shim = {
    seen,
    push(app) {
      seen.push(app);
      try {
        register(app);
      } catch (err) {
        console.error("[sprite-overlay] 独立 App 注册失败", err);
      }
    }
  };
  const backlog = Array.isArray(prev) ? prev : typeof prev === "object" && prev !== null && Array.isArray(prev.seen) ? prev.seen : [];
  for (const app of backlog) shim.push(app);
  return shim;
}

// core/app-modal.ts
function openAppModal(build, hooks) {
  hooks.onOpen();
  const backdrop = document.createElement("div");
  backdrop.className = "so-app-modal-backdrop";
  const box = document.createElement("div");
  box.className = "so-app-modal";
  const head = document.createElement("div");
  head.className = "so-app-modal-head";
  const closeBtn = document.createElement("div");
  closeBtn.className = "so-app-modal-close";
  closeBtn.textContent = "✕";
  closeBtn.title = "关闭";
  closeBtn.setAttribute("role", "button");
  closeBtn.setAttribute("aria-label", "关闭弹窗");
  closeBtn.tabIndex = 0;
  const body = document.createElement("div");
  body.className = "so-app-modal-body";
  head.append(closeBtn);
  box.append(head, body);
  backdrop.append(box);
  document.body.append(backdrop);
  let cleanup;
  let closed = false;
  const runCleanup = () => {
    const current2 = cleanup;
    cleanup = void 0;
    try {
      current2?.();
    } catch (err) {
      console.error("[sprite-overlay] App 弹窗清理失败", err);
    }
  };
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey, true);
    runCleanup();
    backdrop.remove();
    hooks.onClose();
  };
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);
  closeBtn.addEventListener("click", close);
  closeBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      close();
    }
  });
  try {
    cleanup = build(body, close);
    if (closed) runCleanup();
  } catch (err) {
    console.error("[sprite-overlay] App 弹窗渲染失败", err);
    body.textContent = "弹窗渲染失败，详见控制台";
  }
  return close;
}
function openTrackedAppModal(build, hooks, track) {
  const untrackRef = {};
  let closed = false;
  const close = openAppModal(build, {
    onOpen: hooks.onOpen,
    onClose: () => {
      closed = true;
      try {
        hooks.onClose();
      } finally {
        untrackRef.current?.();
      }
    }
  });
  untrackRef.current = track(close);
  if (closed) untrackRef.current();
  return close;
}

// core/phone-shell.ts
var DRAG_THRESHOLD = 6;
function createPhoneShell(initialState, deps) {
  let state = { ...initialState };
  let activeApp = null;
  let activeCtxDispose = null;
  let screenScrollAppId = null;
  let hidden = false;
  let destroyed = false;
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
      activeCtxDispose?.();
      activeCtxDispose = null;
      activeApp = null;
    }
  }
  function renderScreen() {
    const prevScrollAppId = screenScrollAppId;
    const prevScrollTop = screen.scrollTop;
    screen.innerHTML = "";
    backBtn.style.display = activeApp ? "flex" : "none";
    if (activeApp) {
      statusTitle.textContent = activeApp.name;
      const container = document.createElement("div");
      container.className = "so-phone-app-container";
      screen.append(container);
      try {
        const mounted = deps.createAppContext(activeApp.id, goHome);
        activeCtxDispose = mounted.dispose;
        activeApp.mount(container, mounted.ctx);
      } catch (err) {
        console.error(`[sprite-overlay] App「${activeApp.id}」mount 失败`, err);
        container.replaceChildren();
        const errBox = document.createElement("div");
        errBox.className = "so-phone-app-error";
        errBox.textContent = "App 打开失败，详见控制台";
        container.append(errBox);
      }
      if (prevScrollAppId === activeApp.id && prevScrollTop > 0) screen.scrollTop = prevScrollTop;
      screenScrollAppId = activeApp.id;
      return;
    }
    screenScrollAppId = null;
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
      if (destroyed) return;
      const wasOpen = state.open;
      state = { ...next };
      if (wasOpen && !state.open) leaveApp();
      applyLayout();
      if (state.open) renderScreen();
    },
    openApp(appId) {
      if (destroyed) return;
      const app = deps.registry.get(appId);
      if (!app) return;
      leaveApp();
      activeApp = app;
      if (!state.open) commitState({ ...state, open: true });
      renderScreen();
    },
    setVisible(visible) {
      if (destroyed) return;
      hidden = !visible;
      if (hidden) leaveApp();
      applyLayout();
      if (!hidden && state.open) renderScreen();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
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
  const text3 = raw.trim();
  if (text3.indexOf(SHARE_PREFIX_V2) !== -1) return decodeShareStringV2(text3);
  return decodeShareStringV1(text3);
}
function decodeShareStringV1(raw) {
  const text3 = raw.trim();
  const prefixIndex = text3.indexOf(SHARE_PREFIX);
  if (prefixIndex === -1) {
    throw new Error(`导入失败：没有找到 ${SHARE_PREFIX} 开头的分享串`);
  }
  const body = text3.slice(prefixIndex + SHARE_PREFIX.length).trim();
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
  const kind = normalizePackKind(pack.kind);
  if (kind) segments.push(`@kind=${kind}`);
  const customTags = normalizeLabels(pack.customTags);
  if (customTags.length > 0) {
    segments.push(`@tags=${encodeURIComponent(JSON.stringify(customTags))}`);
  }
  segments.push(...entries);
  return {
    text: SHARE_PREFIX_V2 + segments.join("|"),
    included: entries.length,
    total: pack.sprites.length,
    missing
  };
}
function decodeShareStringV2(raw) {
  const text3 = raw.trim();
  const prefixIndex = text3.indexOf(SHARE_PREFIX_V2);
  if (prefixIndex === -1) {
    throw new Error(`导入失败：没有找到 ${SHARE_PREFIX_V2} 开头的分享串`);
  }
  const body = text3.slice(prefixIndex + SHARE_PREFIX_V2.length).trim();
  const segments = body.split("|");
  const name = sanitizePackName(segments[0] ?? "") || "分享立绘包";
  let author;
  let kind;
  let customTags = [];
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
      if (key2 === "kind") kind = normalizePackKind(value);
      if (key2 === "tags") {
        try {
          customTags = normalizeLabels(JSON.parse(decodeURIComponent(value)));
        } catch {
          customTags = [];
        }
      }
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
    ...kind ? { kind } : {},
    ...customTags.length > 0 ? { customTags } : {},
    ...commonRole ? { roleName: commonRole } : {},
    ...commonOutfit ? { outfit: commonOutfit } : {},
    sprites,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// core/presets.ts
var CASUAL = [
  ["中性", "https://i.ibb.co/xq4cf5cL/3dd68e58257c.webp"],
  ["关怀", "https://i.ibb.co/zhxnSVDC/a649145f4804.webp"],
  ["感激", "https://i.ibb.co/BHCvK9FK/f2a89a044460.webp"],
  ["喜悦", "https://i.ibb.co/v6ZQ675V/da65a3d6f363.webp"],
  ["释然", "https://i.ibb.co/5h6nTHr9/2e8dedc8c995.webp"],
  ["爱慕", "https://i.ibb.co/0VBkYJS8/84cf5eacdcb6.webp"],
  ["悲伤", "https://i.ibb.co/67brywRx/f4026cce61a5.webp"],
  ["害怕", "https://i.ibb.co/svTgVcqT/24b9ec4fe0f8.webp"],
  ["困惑", "https://i.ibb.co/PsLKDkVz/74e88f58013c.webp"],
  ["惊讶", "https://i.ibb.co/8Djg9L3T/804de98cf50d.webp"],
  ["失望", "https://i.ibb.co/ps3dq2r/331d09bc4bb5.webp"],
  ["领悟", "https://i.ibb.co/fGqpR9wZ/90ae3698d869.webp"],
  ["逗乐", "https://i.ibb.co/xqwJSBH1/acd0e14a6003.webp"],
  ["愤怒", "https://i.ibb.co/Z4qKB6L/fd9668f6ceb7.webp"],
  ["好奇", "https://i.ibb.co/wTFM3zG/cb05a7f6daec.webp"],
  ["期许", "https://i.ibb.co/xKkHbDG1/247fdc8430fb.webp"],
  ["懊悔", "https://i.ibb.co/DHgcqX50/0439ea39b11e.webp"],
  ["翻白眼吐舌", "https://i.ibb.co/Dgs304F4/801e25cfe603.webp"]
];
var SHADOW = [
  ["爱慕", "https://i.ibb.co/60pF1rrf/adbb1bd58d94.webp"],
  ["懊悔", "https://i.ibb.co/TM4D64jN/8766ffda8f10.webp"],
  ["悲伤", "https://i.ibb.co/ksCBgD1S/d547c9ec2684.webp"],
  ["逗乐", "https://i.ibb.co/S4Fg4ZHP/b8dac8fb2dc4.webp"],
  ["愤怒", "https://i.ibb.co/kgQY0dmZ/1d8b20b34a9c.webp"],
  ["感激", "https://i.ibb.co/spj7cm0B/803c75db520f.webp"],
  ["关怀", "https://i.ibb.co/MyW7mC51/805c6e6f2fda.webp"],
  ["害怕", "https://i.ibb.co/NgH8zHKY/ad70f87dbe3a.webp"],
  ["好奇", "https://i.ibb.co/PZZcZGT2/01878109e17e.webp"],
  ["惊讶", "https://i.ibb.co/G47GR2Xn/0b6612046f08.webp"],
  ["困惑", "https://i.ibb.co/MkrpPrX2/6bcaa9e1864e.webp"],
  ["领悟", "https://i.ibb.co/B5rT02yj/92259638b108.webp"],
  ["期许", "https://i.ibb.co/Ts3Ndt0/5c84cae66be6.webp"],
  ["失望", "https://i.ibb.co/VcRDvnJZ/fa1338ba2d5b.webp"],
  ["释然", "https://i.ibb.co/8ntLvxkC/e2cbd128cf32.webp"],
  ["妩媚", "https://i.ibb.co/W42FK6ck/2da7682a5aca.webp"],
  ["喜悦", "https://i.ibb.co/RZpHBGw/d196fad4ebd9.webp"],
  ["月光透视", "https://i.ibb.co/Y4GNnH1g/c71429c95fb1.webp"],
  ["中性", "https://i.ibb.co/Vc0rcqS3/e9572425090f.webp"]
];
var HEALING = [
  ["爱慕", "https://i.ibb.co/Kz0qqXwy/943e80b09794.webp"],
  ["懊悔", "https://i.ibb.co/ynDm48B2/d0455c0f8d56.webp"],
  ["悲伤", "https://i.ibb.co/Cs1CJ9Jx/db1bc0f21b91.webp"],
  ["逗乐", "https://i.ibb.co/xqhBPr9f/e17c1185bfe6.webp"],
  ["愤怒", "https://i.ibb.co/d0Sv6wpv/585dae5c1cdc.webp"],
  ["感激", "https://i.ibb.co/xW92rH4/0010903b4cc1.webp"],
  ["关怀", "https://i.ibb.co/PsR6Q63Z/bb10d8ab6dd7.webp"],
  ["害怕", "https://i.ibb.co/xtzGDZNX/347987abde75.webp"],
  ["好奇", "https://i.ibb.co/bRrSvX2b/79f774151ac6.webp"],
  ["惊讶", "https://i.ibb.co/b5YJS5h8/1c4feec0e58d.webp"],
  ["困惑", "https://i.ibb.co/PvDLR31C/921b9266d04a.webp"],
  ["领悟", "https://i.ibb.co/KpgfW9GX/d35fcbb4fc71.webp"],
  ["期许", "https://i.ibb.co/chyS8pMV/85153d9f7564.webp"],
  ["失望", "https://i.ibb.co/gbgDpg9c/81d8a3d4502c.webp"],
  ["释然", "https://i.ibb.co/QvJ1gMXD/b00ab1b50e48.webp"],
  ["喜悦", "https://i.ibb.co/svwRkfnV/df602cb11428.webp"],
  ["治愈绽放", "https://i.ibb.co/PZhSQd5V/64b508544524.webp"],
  ["中性", "https://i.ibb.co/SDzshHs8/ae718842095e.webp"]
];
var PRIEST = [
  ["启仪_变", "https://i.ibb.co/wFsqCvGY/13b312237d50.webp"],
  ["施法_变", "https://i.ibb.co/chdysgxL/0b5ab955de6c.webp"],
  ["爱慕", "https://i.ibb.co/CKBg2km1/78ae74a2723f.webp"],
  ["爱慕_变", "https://i.ibb.co/kVkkscbn/00260a4feba1.webp"],
  ["懊悔", "https://i.ibb.co/YTKgtzjD/f7a718c449ff.webp"],
  ["悲伤", "https://i.ibb.co/Kz6940LS/c14da4f09dbd.webp"],
  ["逗乐", "https://i.ibb.co/0vbDwQL/520b7638c1b0.webp"],
  ["愤怒", "https://i.ibb.co/3y9JmhK1/b0822e479741.webp"],
  ["感激", "https://i.ibb.co/gMHYkGJ0/18f28786a9f4.webp"],
  ["感激_变", "https://i.ibb.co/chVBLdKP/c0119e0d2181.webp"],
  ["关怀", "https://i.ibb.co/R4M427Yv/be710e562c6f.webp"],
  ["关怀_变", "https://i.ibb.co/jP6TYrr8/e3847545ce6f.webp"],
  ["害怕", "https://i.ibb.co/xSrGj0Y4/a4e07cd690ab.webp"],
  ["好奇", "https://i.ibb.co/wNNXFkm1/e2632830682d.webp"],
  ["好奇_变", "https://i.ibb.co/rKCJjwN7/8e97d9255dfa.webp"],
  ["惊讶", "https://i.ibb.co/TBpb5L25/1656c2d618d3.webp"],
  ["困惑", "https://i.ibb.co/CpBn8429/07b8b190dcea.webp"],
  ["领悟", "https://i.ibb.co/7JBZ1bdz/e34f5355ff9e.webp"],
  ["领悟_变", "https://i.ibb.co/s9mbmZ4v/82b0711944b0.webp"],
  ["期许", "https://i.ibb.co/9HnJTNd3/f02a51d2d3f7.webp"],
  ["期许_变", "https://i.ibb.co/xp3Yrrm/87df334b9495.webp"],
  ["森林赐福觉醒", "https://i.ibb.co/PsMKZxcD/25f73b4d1353.webp"],
  ["失望", "https://i.ibb.co/wZYSGcb8/26282c1c0140.webp"],
  ["释然", "https://i.ibb.co/278Vgcfj/7e310449df6f.webp"],
  ["释然_变", "https://i.ibb.co/b5pKXttg/a2c01ff8d658.webp"],
  ["妩媚_变", "https://i.ibb.co/Fb97dRp9/090dc1ec60bc.webp"],
  ["喜悦", "https://i.ibb.co/BHTwvPpp/83fad5398fbb.webp"],
  ["喜悦_变", "https://i.ibb.co/sdKxRR6K/ff4e310ca857.webp"],
  ["中性", "https://i.ibb.co/4RkyVzmK/0cdecdd14d36.webp"],
  ["中性_变", "https://i.ibb.co/1GXq8zXG/b0b8fd3ac8a0.webp"]
];
var BATTLE = [
  ["懊悔", "https://i.ibb.co/9H2xWG2x/91152cce4459.webp"],
  ["悲伤", "https://i.ibb.co/5XJp8LHf/3c211c8b83cc.webp"],
  ["逗乐", "https://i.ibb.co/whg2hdCs/8cfebde27a4b.webp"],
  ["愤怒", "https://i.ibb.co/tTZ4J7FQ/c3f950d3633c.webp"],
  ["感激", "https://i.ibb.co/pvSmYKJ9/d94cbc8cfa25.webp"],
  ["关怀", "https://i.ibb.co/R47nycMX/224cc7f5eb41.webp"],
  ["害怕", "https://i.ibb.co/qLpXyBdK/d00f0cb7ac32.webp"],
  ["好奇", "https://i.ibb.co/Kcjwtx4W/e08d99a6afda.webp"],
  ["惊讶", "https://i.ibb.co/TBndwYZX/62cf3d53fcc0.webp"],
  ["困惑", "https://i.ibb.co/PsMrjMmP/85e7abd8c74d.webp"],
  ["领悟", "https://i.ibb.co/NnL183Sy/b06aaccd6bf5.webp"],
  ["期许", "https://i.ibb.co/B5CyGzn6/c7c6f8f64085.webp"],
  ["失望", "https://i.ibb.co/V0k3sS7f/6496d55b49bd.webp"],
  ["释然", "https://i.ibb.co/qYvP9y6g/b9e5a2f36684.webp"],
  ["喜悦", "https://i.ibb.co/5WRcBW8x/77e9f76adbe4.webp"],
  ["中性", "https://i.ibb.co/5fpPBcb/25edd6692c97.webp"],
  ["自然共鸣觉醒", "https://i.ibb.co/gbq20w38/75a67df38a8c.webp"]
];
var PRESET_DEFS = [
  {
    id: "preset_seraphina_casual",
    name: "塞拉菲娜·常服",
    description: "内置云端预设 · 日常常服",
    roleName: "塞拉菲娜",
    outfit: "常服",
    promptNote: "日常场景中穿的衣服。",
    sprites: CASUAL
  },
  {
    id: "preset_seraphina_shadow",
    name: "塞拉菲娜·暗影斗篷",
    description: "内置云端预设 · 夜间巡行服装",
    roleName: "塞拉菲娜",
    outfit: "暗影斗篷",
    promptNote: "夜晚外出巡夜时的服装。",
    sprites: SHADOW
  },
  {
    id: "preset_seraphina_healing",
    name: "塞拉菲娜·治愈白裙",
    description: "内置云端预设 · 白天外出服装",
    roleName: "塞拉菲娜",
    outfit: "治愈白裙",
    promptNote: "白天外出时的服装。",
    sprites: HEALING
  },
  {
    id: "preset_seraphina_priest",
    name: "塞拉菲娜·祭司仪式袍",
    description: "内置云端预设 · 森林仪式服装",
    roleName: "塞拉菲娜",
    outfit: "祭司仪式袍",
    promptNote: "粗麻多层长袍、露肩、藤蔓束带、翡翠胸针。适用：森林仪式、祈祷、神谕祝福。仪式中可切换至带“_变”后缀的成熟形态。",
    sprites: PRIEST
  },
  {
    id: "preset_seraphina_battle",
    name: "塞拉菲娜·战斗服",
    description: "内置云端预设 · 野外战斗服装",
    roleName: "塞拉菲娜",
    outfit: "战斗服",
    promptNote: "橄榄绿粗布抹胸、撕裂短裹裙、腹部交叉绑带，适用：野外战斗、训练、紧张对峙。",
    sprites: BATTLE
  }
];
var LEGACY_PRESET_IDS = /* @__PURE__ */ new Set(["preset_silver_loli", "preset_raven_onee"]);
function getPresetPacks() {
  return PRESET_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    author: "内置预设",
    description: def.description,
    roleName: def.roleName,
    outfit: def.outfit,
    promptNote: def.promptNote,
    promptNotePlacement: "after-list",
    sprites: def.sprites.map(([tag, url]) => ({
      tag,
      url,
      remoteUrl: url,
      code: url.slice(url.lastIndexOf("/") + 1)
    }))
  }));
}
function presetSpriteKey(sprite) {
  return JSON.stringify([sprite.group || "", sprite.outfit || "", sprite.tag]);
}
function sanitizedNullableText(value) {
  if (value === null) return null;
  return typeof value === "string" ? value.trim() : void 0;
}
function sanitizedNullableTag(value) {
  if (value === null) return null;
  if (typeof value !== "string") return void 0;
  return normalizeTag(value) || void 0;
}
function sanitizePresetOverrides(raw, presets = getPresetPacks()) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result = {};
  for (const preset of presets) {
    const value = raw[preset.id];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const input = value;
    const override = {};
    const metadataInput = input.metadata;
    if (metadataInput && typeof metadataInput === "object" && !Array.isArray(metadataInput)) {
      const source = metadataInput;
      const metadata = {};
      if (typeof source.name === "string") {
        const name = sanitizePackName(source.name);
        if (name) metadata.name = name;
      }
      for (const field of ["author", "description"]) {
        const sanitized = sanitizedNullableText(source[field]);
        if (sanitized !== void 0) metadata[field] = sanitized;
      }
      for (const field of ["roleName", "outfit"]) {
        const sanitized = sanitizedNullableTag(source[field]);
        if (sanitized !== void 0) metadata[field] = sanitized;
      }
      if (source.kind === null) metadata.kind = null;
      else {
        const kind = normalizePackKind(source.kind);
        if (kind) metadata.kind = kind;
      }
      if (source.customTags === null) metadata.customTags = null;
      else if (Array.isArray(source.customTags)) {
        const customTags = normalizeLabels(source.customTags);
        metadata.customTags = customTags.length > 0 ? customTags : null;
      }
      if (source.promptNote === null) metadata.promptNote = null;
      else if (typeof source.promptNote === "string") {
        const note = normalizeNote(source.promptNote);
        if (note) metadata.promptNote = note;
      }
      if (source.promptNotePlacement === null) metadata.promptNotePlacement = null;
      else if (source.promptNotePlacement === "before-list" || source.promptNotePlacement === "after-list") {
        metadata.promptNotePlacement = source.promptNotePlacement;
      }
      if (source.outfitNotes === null) metadata.outfitNotes = null;
      else if (source.outfitNotes && typeof source.outfitNotes === "object" && !Array.isArray(source.outfitNotes)) {
        metadata.outfitNotes = normalizeOutfitNotes(source.outfitNotes);
      }
      if (Object.keys(metadata).length > 0) override.metadata = metadata;
    }
    if (input.localSprites && typeof input.localSprites === "object" && !Array.isArray(input.localSprites)) {
      const validKeys = new Set(preset.sprites.map(presetSpriteKey));
      const localSprites = {};
      for (const [key, path] of Object.entries(input.localSprites)) {
        if (validKeys.has(key) && typeof path === "string" && isSafeLocalUserImagePath(path)) {
          localSprites[key] = path;
        }
      }
      if (Object.keys(localSprites).length > 0) override.localSprites = localSprites;
    }
    if (typeof input.updatedAt === "string" && input.updatedAt.trim()) {
      override.updatedAt = input.updatedAt.trim();
    }
    if (Object.keys(override).length > 0) result[preset.id] = override;
  }
  return result;
}
function mergePresetPacks(overrides, presets = getPresetPacks()) {
  const sanitized = sanitizePresetOverrides(overrides, presets);
  return presets.map((preset) => {
    const override = sanitized[preset.id];
    if (!override) return preset;
    const merged = { ...preset };
    const metadata = override.metadata;
    if (metadata) {
      if (metadata.name !== void 0) merged.name = metadata.name;
      for (const field of ["author", "description", "roleName", "outfit", "promptNote"]) {
        const value = metadata[field];
        if (value === null) delete merged[field];
        else if (value !== void 0) merged[field] = value;
      }
      if (metadata.kind === null) delete merged.kind;
      else if (metadata.kind !== void 0) merged.kind = metadata.kind;
      if (metadata.customTags === null) delete merged.customTags;
      else if (metadata.customTags !== void 0) merged.customTags = metadata.customTags;
      if (metadata.promptNotePlacement === null) delete merged.promptNotePlacement;
      else if (metadata.promptNotePlacement !== void 0) {
        merged.promptNotePlacement = metadata.promptNotePlacement;
      }
      if (metadata.outfitNotes === null) delete merged.outfitNotes;
      else if (metadata.outfitNotes !== void 0) merged.outfitNotes = metadata.outfitNotes;
    }
    merged.sprites = preset.sprites.map((sprite) => {
      const local = override.localSprites?.[presetSpriteKey(sprite)];
      return local ? { ...sprite, url: local, remoteUrl: sprite.url } : sprite;
    });
    return merged;
  });
}
function isPresetPack(packId) {
  return LEGACY_PRESET_IDS.has(packId) || PRESET_DEFS.some((def) => def.id === packId);
}

// core/migrate.ts
function migrateSettings(saved) {
  const defaults = createDefaultSettings();
  if (!saved || typeof saved !== "object") return defaults;
  const raw = saved;
  const savedVersion = typeof raw.settingsVersion === "number" && Number.isFinite(raw.settingsVersion) ? raw.settingsVersion : 0;
  const migrated = {
    settingsVersion: SETTINGS_VERSION,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : defaults.enabled,
    hideTagInMessage: typeof raw.hideTagInMessage === "boolean" ? raw.hideTagInMessage : defaults.hideTagInMessage,
    spriteDisplayMode: raw.spriteDisplayMode === "overlay" || raw.spriteDisplayMode === "inline" || raw.spriteDisplayMode === "both" ? raw.spriteDisplayMode : defaults.spriteDisplayMode,
    renderInlineImages: typeof raw.renderInlineImages === "boolean" ? raw.renderInlineImages : defaults.renderInlineImages,
    imageHost: typeof raw.imageHost === "string" && /^https?:\/\//.test(raw.imageHost) ? raw.imageHost : defaults.imageHost,
    overlay: migrateOverlay(raw.overlay, defaults.overlay),
    overlayHidden: typeof raw.overlayHidden === "boolean" ? raw.overlayHidden : defaults.overlayHidden,
    spriteOpacity: typeof raw.spriteOpacity === "number" && Number.isFinite(raw.spriteOpacity) ? Math.min(SPRITE_OPACITY_MAX, Math.max(SPRITE_OPACITY_MIN, Math.round(raw.spriteOpacity))) : defaults.spriteOpacity,
    recentFloors: typeof raw.recentFloors === "number" && Number.isFinite(raw.recentFloors) ? Math.min(RECENT_FLOORS_MAX, Math.max(RECENT_FLOORS_MIN, Math.round(raw.recentFloors))) : defaults.recentFloors,
    phone: migratePhone(raw.phone, defaults.phone),
    showPhone: typeof raw.showPhone === "boolean" ? raw.showPhone : defaults.showPhone,
    autoSwitch: typeof raw.autoSwitch === "boolean" ? raw.autoSwitch : defaults.autoSwitch,
    autoSwitchSeconds: typeof raw.autoSwitchSeconds === "number" && Number.isFinite(raw.autoSwitchSeconds) ? Math.min(60, Math.max(1, Math.round(raw.autoSwitchSeconds))) : defaults.autoSwitchSeconds,
    multiRole: typeof raw.multiRole === "boolean" ? raw.multiRole : defaults.multiRole,
    multiRolePromptMode: raw.multiRolePromptMode === "repeat" ? "repeat" : raw.multiRolePromptMode === "full" && savedVersion >= 5 ? "full" : defaults.multiRolePromptMode,
    spriteCount: typeof raw.spriteCount === "number" && Number.isFinite(raw.spriteCount) ? Math.min(SPRITE_COUNT_MAX, Math.max(SPRITE_COUNT_MIN, Math.round(raw.spriteCount))) : defaults.spriteCount,
    injectionDepth: typeof raw.injectionDepth === "number" && Number.isFinite(raw.injectionDepth) ? Math.min(INJECTION_DEPTH_MAX, Math.max(INJECTION_DEPTH_MIN, Math.round(raw.injectionDepth))) : defaults.injectionDepth,
    promptTemplate: typeof raw.promptTemplate === "string" && !isKnownBuiltinTemplate(raw.promptTemplate) ? raw.promptTemplate : defaults.promptTemplate,
    promptBudget: typeof raw.promptBudget === "number" && Number.isFinite(raw.promptBudget) ? Math.min(PROMPT_BUDGET_MAX, Math.max(PROMPT_BUDGET_MIN, Math.round(raw.promptBudget))) : defaults.promptBudget,
    imgbbApiKey: typeof raw.imgbbApiKey === "string" ? raw.imgbbApiKey : defaults.imgbbApiKey,
    autoUpload: typeof raw.autoUpload === "boolean" ? raw.autoUpload : defaults.autoUpload,
    galleryFoldByRole: savedVersion >= 6 && typeof raw.galleryFoldByRole === "boolean" ? raw.galleryFoldByRole : defaults.galleryFoldByRole,
    packs: Array.isArray(raw.packs) ? raw.packs.flatMap((p) => migratePack(p) ?? []) : [],
    presetOverrides: sanitizePresetOverrides(raw.presetOverrides),
    bindings: Array.isArray(raw.bindings) ? raw.bindings.flatMap((b) => migrateBinding(b) ?? []) : [],
    apps: raw.apps && typeof raw.apps === "object" && !Array.isArray(raw.apps) ? raw.apps : {}
  };
  if (savedVersion <= 5) {
    const localCopies = migrateLegacyLocalPresetCopies(
      migrated.packs,
      migrated.bindings,
      migrated.presetOverrides
    );
    return { ...migrated, ...localCopies };
  }
  return migrated;
}
function migrateLegacyLocalPresetCopies(packs, bindings, presetOverrides, presets = getPresetPacks()) {
  const candidatesByPreset = /* @__PURE__ */ new Map();
  for (const preset of presets) {
    const remoteByKey = new Map(preset.sprites.map((sprite) => [presetSpriteKey(sprite), sprite.url]));
    const candidates = packs.filter((pack) => {
      if (pack.name !== `${preset.name}（本地）` || (pack.roleName ?? "") !== (preset.roleName ?? "") || (pack.outfit ?? "") !== (preset.outfit ?? "") || pack.sprites.length !== preset.sprites.length) return false;
      const keys = /* @__PURE__ */ new Set();
      for (const sprite of pack.sprites) {
        const key = presetSpriteKey(sprite);
        if (keys.has(key) || remoteByKey.get(key) !== sprite.remoteUrl) return false;
        keys.add(key);
      }
      return keys.size === remoteByKey.size;
    });
    if (candidates.length === 1 && candidates[0].sprites.every((sprite) => isSafeLocalUserImagePath(sprite.url))) candidatesByPreset.set(preset.id, candidates);
  }
  const copyToPreset = /* @__PURE__ */ new Map();
  const nextOverrides = { ...presetOverrides };
  for (const [presetId, [copy]] of candidatesByPreset) {
    copyToPreset.set(copy.id, presetId);
    const existing = nextOverrides[presetId] ?? {};
    nextOverrides[presetId] = {
      ...existing,
      localSprites: {
        ...existing.localSprites,
        ...Object.fromEntries(copy.sprites.map((sprite) => [presetSpriteKey(sprite), sprite.url]))
      },
      ...copy.updatedAt ? { updatedAt: copy.updatedAt } : {}
    };
  }
  const migratedBindings = bindings.map((binding) => {
    const packIds = [];
    for (const id of binding.packIds) {
      const nextId = copyToPreset.get(id) ?? id;
      if (!packIds.includes(nextId)) packIds.push(nextId);
    }
    return { ...binding, packIds };
  });
  return {
    packs: packs.filter((pack) => !copyToPreset.has(pack.id)),
    bindings: migratedBindings,
    presetOverrides: nextOverrides
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
    const labels = normalizeLabels(s.labels);
    return [
      {
        tag,
        url: s.url,
        ...code ? { code } : {},
        ...group ? { group } : {},
        ...outfit2 ? { outfit: outfit2 } : {},
        ...remoteUrl ? { remoteUrl } : {},
        ...labels.length > 0 ? { labels } : {}
      }
    ];
  });
  const roleName = typeof p.roleName === "string" ? normalizeTag(p.roleName) : "";
  const outfit = typeof p.outfit === "string" ? normalizeTag(p.outfit) : "";
  const kind = normalizePackKind(p.kind);
  const customTags = normalizeLabels(p.customTags);
  const promptNote = normalizeNote(p.promptNote);
  const outfitNotes = normalizeOutfitNotes(p.outfitNotes);
  const sourceStoryKey = typeof p.sourceStoryKey === "string" ? p.sourceStoryKey.trim() : "";
  return {
    id: p.id,
    name,
    ...typeof p.author === "string" && p.author ? { author: p.author } : {},
    ...typeof p.description === "string" && p.description ? { description: p.description } : {},
    ...kind ? { kind } : {},
    ...customTags.length > 0 ? { customTags } : {},
    ...roleName ? { roleName } : {},
    ...outfit ? { outfit } : {},
    ...promptNote ? { promptNote } : {},
    ...p.promptNotePlacement === "before-list" || p.promptNotePlacement === "after-list" ? { promptNotePlacement: p.promptNotePlacement } : {},
    ...Object.keys(outfitNotes).length > 0 ? { outfitNotes } : {},
    ...sourceStoryKey ? { sourceStoryKey } : {},
    ...typeof p.coverTag === "string" && p.coverTag ? { coverTag: p.coverTag } : {},
    ...typeof p.updatedAt === "string" && p.updatedAt ? { updatedAt: p.updatedAt } : {},
    sprites
  };
}

// core/image-compress.ts
function analyzeImagePixels(data) {
  if (data.length < 4) return "opaque";
  const luminanceBins = /* @__PURE__ */ new Map();
  let grayscalePixels = 0;
  const totalPixels = Math.floor(data.length / 4);
  for (let offset = 0; offset + 3 < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha < 250) return "transparent";
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 5) continue;
    grayscalePixels += 1;
    const bin = Math.round((red + green + blue) / 3 / 8) * 8;
    luminanceBins.set(bin, (luminanceBins.get(bin) ?? 0) + 1);
  }
  const dominant = [...luminanceBins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  if (dominant.length === 2) {
    const [[firstValue, firstCount], [secondValue, secondCount]] = dominant;
    const difference = Math.abs(firstValue - secondValue);
    const dominantCount = firstCount + secondCount;
    if (grayscalePixels / totalPixels >= 0.5 && firstCount / totalPixels >= 0.1 && secondCount / totalPixels >= 0.1 && dominantCount / totalPixels >= 0.5 && Math.min(firstValue, secondValue) >= 160 && difference >= 8 && difference <= 64) return "opaque-checkerboard";
  }
  return "opaque";
}
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
    let transparency;
    try {
      transparency = analyzeImagePixels(ctx.getImageData(0, 0, width, height).data);
    } catch {
    }
    const compressedUri = canvas.toDataURL("image/webp", quality);
    if (!compressedUri.startsWith("data:image/webp") || compressedUri.length >= originalUri.length) {
      return { ...original, ...transparency ? { transparency } : {} };
    }
    return {
      dataUri: compressedUri,
      compressed: true,
      bytes: estimateDataUriBytes(compressedUri),
      ...transparency ? { transparency } : {}
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

// core/story-archive.ts
function storyArchiveKey(parts) {
  const groupId = clean(parts.groupId);
  const characterId = clean(parts.characterId);
  const characterName = clean(parts.characterName);
  const owner = groupId ? `group:${groupId}` : characterId || (characterName ? `name:${characterName}` : "unknown");
  const chatId = clean(parts.chatId);
  const title2 = clean(parts.title);
  const chat2 = chatId || (title2 ? `title:${title2}` : "current");
  return `${owner}::${chat2}`;
}
function upsertStorySprite(settings, story, source) {
  const existingIndex = settings.packs.findIndex((pack2) => pack2.sourceStoryKey === story.key);
  const existing = existingIndex >= 0 ? settings.packs[existingIndex] : null;
  const sourceUrls = new Set([source.url, source.remoteUrl].filter((url) => Boolean(url)));
  if (existing?.sprites.some(
    (sprite) => sourceUrls.has(sprite.url) || Boolean(sprite.remoteUrl && sourceUrls.has(sprite.remoteUrl))
  )) return settings;
  const pack = existing ?? createStoryPack(story);
  const tag = uniqueTag(pack, source.tag);
  const nextPack = {
    ...pack,
    roleName: pack.roleName || normalizeTag(story.characterName) || void 0,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    sprites: [...pack.sprites, { ...source, tag }]
  };
  const packs = [...settings.packs];
  if (existingIndex >= 0) packs[existingIndex] = nextPack;
  else packs.push(nextPack);
  return { ...settings, packs };
}
function createStoryPack(story) {
  const title2 = sanitizePackName(story.title) || sanitizePackName(story.characterName) || "Untitled";
  return {
    id: `story_${hash(story.key)}`,
    name: sanitizePackName(`Story - ${title2}`) || "Story",
    kind: "illustration",
    roleName: normalizeTag(story.characterName) || void 0,
    sourceStoryKey: story.key,
    sprites: []
  };
}
function uniqueTag(pack, raw) {
  const fallback = `Generated image ${pack.sprites.length + 1}`;
  const base = normalizeTag(raw) || normalizeTag(fallback);
  const used = new Set(pack.sprites.map((sprite) => sprite.tag));
  if (!used.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const suffixText = ` ${suffix}`;
    const stem = Array.from(base).slice(0, Math.max(1, 20 - suffixText.length)).join("");
    const candidate = normalizeTag(`${stem}${suffixText}`);
    if (!used.has(candidate)) return candidate;
  }
}
function clean(value) {
  return value === null || value === void 0 ? "" : String(value).trim();
}
function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

// st-extension/src/st-adapter.ts
var MODULE_NAME = "sprite_overlay";
function getContext() {
  const st = window.SillyTavern;
  if (!st) throw new Error("[sprite-overlay] SillyTavern 全局对象不存在，扩展只能在 ST 内运行");
  return st.getContext();
}
function findComposerTextarea(root = document) {
  const input = root.querySelector("#send_textarea");
  return input instanceof HTMLTextAreaElement ? input : null;
}
var STAdapter = class {
  /** 只读返回指定消息的原始文本，供可见 DOM 的保守后处理建立边界证据。 */
  getRawMessage(messageId) {
    const index = typeof messageId === "number" ? messageId : /^(?:0|[1-9]\d*)$/.test(messageId) ? Number(messageId) : NaN;
    if (!Number.isInteger(index) || index < 0) return null;
    const message = getContext().chat[index];
    return typeof message?.mes === "string" ? message.mes : null;
  }
  async loadSettings() {
    const ctx = getContext();
    const saved = ctx.extensionSettings[MODULE_NAME];
    if (saved && typeof saved === "object") {
      const merged = migrateSettings(saved);
      const customPacks = merged.packs.filter((p) => !isPresetPack(p.id));
      merged.packs = [...mergePresetPacks(merged.presetOverrides), ...customPacks];
      return merged;
    }
    const defaults = createDefaultSettings();
    defaults.packs = mergePresetPacks(defaults.presetOverrides);
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
  async saveImageFile(file, fileName, characterName) {
    return this.saveImage(fileName, await blobToDataUri(file), characterName);
  }
  async deleteImage(url) {
    const path = url.split(/[?#]/, 1)[0].replace(/\\/g, "/");
    if (!isSafeLocalUserImagePath(path)) {
      throw new Error("只能删除 SillyTavern 用户图片目录中的文件");
    }
    const ctx = getContext();
    const response = await fetch("/api/images/delete", {
      method: "POST",
      headers: ctx.getRequestHeaders?.() ?? { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path.slice(1) })
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`删除本地图片失败：HTTP ${response.status}`);
    }
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
  getStoryContext() {
    const ctx = getContext();
    const groupId = ctx.groupId;
    const group = groupId === void 0 || groupId === null ? void 0 : ctx.groups?.find((candidate) => `${candidate.id ?? ""}` === `${groupId}`);
    const characterName = group?.name || this.getCurrentCharacterName() || "Unknown";
    const chatId = ctx.chatId ?? ctx.chatMetadata?.file_name;
    const title2 = ctx.chatMetadata?.name || ctx.chatMetadata?.file_name || `${chatId ?? ""}` || characterName;
    return {
      key: storyArchiveKey({
        chatId,
        characterId: ctx.characterId,
        groupId,
        title: title2,
        characterName
      }),
      title: title2,
      characterName
    };
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
        const chat2 = getContext().chat;
        const idNum = typeof messageId === "number" ? messageId : typeof messageId === "string" && messageId.trim() !== "" ? Number(messageId) : NaN;
        const message = Number.isInteger(idNum) && idNum >= 0 && idNum < chat2.length ? chat2[idNum] : chat2[chat2.length - 1];
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
  /** 订阅新聊天创建；CHAT_CHANGED 在部分 ST 版本中会早于新聊天 DOM 稳定。 */
  onChatCreated(handler) {
    const ctx = getContext();
    const eventName = ctx.eventTypes?.CHAT_CREATED ?? "chat_created";
    ctx.eventSource.on(eventName, handler);
    return () => ctx.eventSource.removeListener(eventName, handler);
  }
  /** 订阅流式累计文本。ST 每次事件传入从回复开头到当前 token 的完整字符串。 */
  onStreamText(handler) {
    const ctx = getContext();
    const eventName = ctx.eventTypes?.STREAM_TOKEN_RECEIVED ?? "stream_token_received";
    const wrapped = (text3) => {
      if (typeof text3 === "string") handler(text3);
    };
    ctx.eventSource.on(eventName, wrapped);
    return () => ctx.eventSource.removeListener(eventName, wrapped);
  }
  /** 订阅生成结束，用于清空流式增量状态。 */
  onGenerationEnded(handler) {
    const ctx = getContext();
    const eventName = ctx.eventTypes?.GENERATION_ENDED ?? "generation_ended";
    ctx.eventSource.on(eventName, handler);
    return () => ctx.eventSource.removeListener(eventName, handler);
  }
};

// st-extension/src/overlay-dom.ts
var DRAG_THRESHOLD2 = 6;
function createOverlay(initialLayout, onLayoutChange, onManage, onClose, onOpenSprites) {
  let layout = { ...initialLayout };
  let sprites = [];
  let index = 0;
  let autoEnabled = false;
  let autoSeconds = 3;
  let autoTimer = null;
  let fadeTimer = null;
  let userOpacity = 1;
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
  const spritesBtn = document.createElement("div");
  spritesBtn.className = "sprite-overlay-sprites fa-solid fa-eye";
  spritesBtn.title = "打开立绘 App";
  spritesBtn.setAttribute("role", "button");
  spritesBtn.setAttribute("aria-label", "打开立绘 App");
  spritesBtn.tabIndex = 0;
  spritesBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  const openSprites = (e) => {
    e.stopPropagation();
    onOpenSprites?.();
  };
  spritesBtn.addEventListener("click", openSprites);
  spritesBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openSprites(e);
    }
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
  frame.append(img, placeholder, tagBadge, dots, spritesBtn, gearBtn, closeBtn, resizeHandle);
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
        img.style.opacity = String(userOpacity);
      };
      if (img.complete) img.style.opacity = String(userOpacity);
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
    setPlaceholder(text3) {
      stopAuto();
      sprites = [];
      index = 0;
      dots.replaceChildren();
      dots.style.display = "none";
      img.style.display = "none";
      tagBadge.style.display = "none";
      placeholder.textContent = text3;
      placeholder.style.display = "flex";
    },
    setVisible(visible) {
      root.style.display = visible ? "block" : "none";
    },
    setLayout(next) {
      layout = { ...next };
      applyLayout();
    },
    setOpacity(percent) {
      const clamped = Math.min(100, Math.max(20, Math.round(percent))) / 100;
      userOpacity = clamped;
      if (img.style.opacity !== "0") img.style.opacity = String(clamped);
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
  const customTags = normalizeLabels(packs.flatMap((pack) => pack.customTags ?? []));
  const coverTag = first?.coverTag && sprites.some((sprite) => sprite.tag === first.coverTag) ? first.coverTag : sprites[0]?.tag;
  return {
    id: result.id,
    name: result.name,
    ...first?.author ? { author: first.author } : {},
    ...first?.description ? { description: first.description } : {},
    ...first?.kind ? { kind: first.kind } : {},
    ...customTags.length > 0 ? { customTags } : {},
    ...commonRole ? { roleName: commonRole } : {},
    ...commonOutfit ? { outfit: commonOutfit } : {},
    ...coverTag ? { coverTag } : {},
    sprites,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// core/pack-io.ts
async function exportPack(pack, embedHosted = false) {
  const sprites = [];
  for (const sprite of pack.sprites) {
    const source = getSpriteSource(sprite);
    const labels = normalizeLabels(sprite.labels);
    const extra = {
      ...remoteField(sprite),
      ...sprite.group ? { group: sprite.group } : {},
      ...sprite.outfit ? { outfit: sprite.outfit } : {},
      ...labels.length > 0 ? { labels } : {}
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
  const promptNote = normalizeNote(pack.promptNote);
  const outfitNotes = normalizeOutfitNotes(pack.outfitNotes);
  const sourceStoryKey = typeof pack.sourceStoryKey === "string" ? pack.sourceStoryKey.trim() : "";
  const kind = normalizePackKind(pack.kind);
  const customTags = normalizeLabels(pack.customTags);
  return {
    format: "sprite-pack@3",
    name: pack.name,
    author: pack.author,
    description: pack.description,
    ...kind ? { kind } : {},
    ...customTags.length > 0 ? { customTags } : {},
    ...pack.roleName ? { roleName: pack.roleName } : {},
    ...pack.outfit ? { outfit: pack.outfit } : {},
    ...promptNote ? { promptNote } : {},
    ...pack.promptNotePlacement === "before-list" || pack.promptNotePlacement === "after-list" ? { promptNotePlacement: pack.promptNotePlacement } : {},
    ...Object.keys(outfitNotes).length > 0 ? { outfitNotes } : {},
    ...sourceStoryKey ? { sourceStoryKey } : {},
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
  if (file.format !== "sprite-pack@3" && file.format !== "sprite-pack@2" && file.format !== "sprite-pack@1") {
    throw new Error("导入失败：不是 sprite-pack@1 / @2 / @3 格式的立绘包");
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
    const labels = normalizeLabels(item.labels);
    sprites.push({
      tag,
      url,
      ...code ? { code } : {},
      ...remoteUrl ? { remoteUrl } : {},
      ...group ? { group } : {},
      ...outfit2 ? { outfit: outfit2 } : {},
      ...labels.length > 0 ? { labels } : {}
    });
  }
  if (sprites.length === 0) {
    throw new Error("导入失败：没有可用的立绘条目（表情名可能全部为空或重复）");
  }
  const normalizedCover = typeof file.coverTag === "string" ? normalizeTag(file.coverTag) : "";
  const coverTag = sprites.some((s) => s.tag === normalizedCover) ? normalizedCover : void 0;
  const roleName = typeof file.roleName === "string" ? normalizeTag(file.roleName) : "";
  const outfit = typeof file.outfit === "string" ? normalizeTag(file.outfit) : "";
  const kind = normalizePackKind(file.kind);
  const customTags = normalizeLabels(file.customTags);
  const promptNote = normalizeNote(file.promptNote);
  const outfitNotes = normalizeOutfitNotes(file.outfitNotes);
  const sourceStoryKey = typeof file.sourceStoryKey === "string" ? file.sourceStoryKey.trim() : "";
  return {
    id: genId(),
    name: sanitizePackName(file.name) || "导入立绘包",
    author: typeof file.author === "string" ? sanitizePackName(file.author) || void 0 : void 0,
    description: typeof file.description === "string" ? sanitizeDescription(file.description) || void 0 : void 0,
    ...roleName ? { roleName } : {},
    ...outfit ? { outfit } : {},
    ...kind ? { kind } : {},
    ...customTags.length > 0 ? { customTags } : {},
    ...promptNote ? { promptNote } : {},
    ...file.promptNotePlacement === "before-list" || file.promptNotePlacement === "after-list" ? { promptNotePlacement: file.promptNotePlacement } : {},
    ...Object.keys(outfitNotes).length > 0 ? { outfitNotes } : {},
    ...sourceStoryKey ? { sourceStoryKey } : {},
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
      ...pack.kind ? { kind: pack.kind } : {},
      ...pack.customTags?.length ? { customTags: [...pack.customTags] } : {},
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

// core/sprite-resources.ts
function isCloudUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}
function hasLocalResource(sprite) {
  return !isCloudUrl(sprite.url);
}
function hasCloudResource(sprite) {
  return isCloudUrl(sprite.url) || isCloudUrl(sprite.remoteUrl);
}
function summarizePackResources(pack) {
  let local = 0;
  let cloud = 0;
  for (const sprite of pack.sprites) {
    if (hasLocalResource(sprite)) local += 1;
    if (hasCloudResource(sprite)) cloud += 1;
  }
  return { total: pack.sprites.length, local, cloud };
}

// core/preset-overrides.ts
function getCurrentPreset(presetId) {
  if (!isPresetPack(presetId)) return void 0;
  return getPresetPacks().find((preset) => preset.id === presetId);
}
function withSanitizedOverride(settings, presetId, rawOverride) {
  const sanitized = sanitizePresetOverrides({ [presetId]: rawOverride })[presetId];
  const presetOverrides = { ...settings.presetOverrides };
  if (sanitized) presetOverrides[presetId] = sanitized;
  else delete presetOverrides[presetId];
  const materialized = mergePresetPacks(presetOverrides).find((preset) => preset.id === presetId);
  return {
    ...settings,
    presetOverrides,
    packs: materialized ? settings.packs.map((pack) => pack.id === presetId ? materialized : pack) : settings.packs
  };
}
function setPresetLocalSprite(settings, presetId, sourceSprite, localUrl) {
  const preset = getCurrentPreset(presetId);
  if (!preset || typeof localUrl !== "string" || !isSafeLocalUserImagePath(localUrl)) {
    return settings;
  }
  const sourceKey = presetSpriteKey(sourceSprite);
  if (!preset.sprites.some((sprite) => presetSpriteKey(sprite) === sourceKey)) return settings;
  const existing = settings.presetOverrides[presetId] ?? {};
  return withSanitizedOverride(settings, presetId, {
    ...existing,
    localSprites: {
      ...existing.localSprites,
      [sourceKey]: localUrl
    }
  });
}
function setPresetMetadata(settings, presetId, metadata) {
  if (!getCurrentPreset(presetId)) return settings;
  const existing = settings.presetOverrides[presetId] ?? {};
  return withSanitizedOverride(settings, presetId, {
    ...existing,
    metadata
  });
}
function clearPresetMetadata(settings, presetId) {
  if (!getCurrentPreset(presetId)) return settings;
  const existing = settings.presetOverrides[presetId];
  if (!existing?.metadata) return settings;
  const { metadata: _metadata, ...rest } = existing;
  const presetOverrides = { ...settings.presetOverrides };
  if (Object.keys(rest).length > 0) presetOverrides[presetId] = rest;
  else delete presetOverrides[presetId];
  const materialized = mergePresetPacks(presetOverrides).find((preset) => preset.id === presetId);
  return {
    ...settings,
    presetOverrides,
    packs: materialized ? settings.packs.map((pack) => pack.id === presetId ? materialized : pack) : settings.packs
  };
}

// st-extension/src/sprite-actions.ts
function current(context) {
  const pack = context.getPack();
  const sprite = context.getSprite();
  return pack && sprite ? { pack, sprite } : null;
}
function commitAndRefresh(context, pack) {
  try {
    context.commit(pack);
  } finally {
    context.refresh();
  }
}
function createSpriteActions(context) {
  const source = context.getSprite();
  return [
    {
      id: "rename",
      label: "重命名",
      icon: "✎",
      run() {
        const state = current(context);
        if (!state) return;
        const next = window.prompt(`「${state.sprite.tag}」改名为：`, state.sprite.tag);
        if (next === null) return;
        commitAndRefresh(
          context,
          renameSprite(
            state.pack,
            state.sprite.tag,
            next,
            spriteGroup(state.sprite),
            state.sprite.outfit ?? ""
          )
        );
      }
    },
    {
      id: "labels",
      label: "标签",
      icon: "#",
      run() {
        const state = current(context);
        if (!state) return;
        const raw = window.prompt(
          `「${state.sprite.tag}」的标签（逗号分隔，留空=清除）：`,
          state.sprite.labels?.join(", ") ?? ""
        );
        if (raw === null) return;
        const labels = normalizeLabels(raw.split(/[,，]/));
        const nextSprite = { ...state.sprite };
        if (labels.length > 0) nextSprite.labels = labels;
        else delete nextSprite.labels;
        commitAndRefresh(context, upsertSprite(state.pack, nextSprite));
      }
    },
    {
      id: "group",
      label: "设分组",
      icon: "🏷",
      run() {
        const state = current(context);
        if (!state) return;
        const group = spriteGroup(state.sprite);
        const next = window.prompt(`「${state.sprite.tag}」的分组（留空=移出分组）：`, group);
        if (next === null) return;
        commitAndRefresh(
          context,
          setSpriteGroup(state.pack, state.sprite.tag, group, next, state.sprite.outfit ?? "")
        );
      }
    },
    {
      id: "replace",
      label: "重新上传 / 替换图片",
      icon: "🖼",
      run() {
        if (!current(context)) return;
        context.pickReplacement();
      }
    },
    {
      id: "localize",
      label: "保存到本地",
      icon: "↓",
      disabled: !source || getSpriteSource(source) !== "hosted",
      async run() {
        const state = current(context);
        if (!state || getSpriteSource(state.sprite) !== "hosted") return;
        await context.localize(state.sprite);
      }
    },
    {
      id: "remote",
      label: "远程地址",
      icon: "🔗",
      run() {
        const state = current(context);
        if (!state) return;
        const remote = state.sprite.remoteUrl || (getSpriteSource(state.sprite) === "hosted" ? state.sprite.url : "");
        if (!remote) {
          throw new Error(`「${state.sprite.tag}」还没有远程地址（未上传图床，分享时对方看不到）`);
        }
        window.prompt(
          `「${state.sprite.tag}」编号：${state.sprite.code || "无"}
远程地址（Ctrl+C 复制）：`,
          remote
        );
      }
    },
    {
      id: "cover",
      label: "设为封面",
      icon: "★",
      run() {
        const state = current(context);
        if (!state) return;
        commitAndRefresh(context, { ...state.pack, coverTag: state.sprite.tag });
      }
    },
    {
      id: "delete",
      label: "删除",
      icon: "✕",
      destructive: true,
      run() {
        const state = current(context);
        if (!state || !window.confirm(`删除立绘「${state.sprite.tag}」？`)) return;
        const next = removeSprite(
          state.pack,
          state.sprite.tag,
          spriteGroup(state.sprite),
          state.sprite.outfit ?? ""
        );
        context.commit(next);
        if (next.sprites.length === 0) context.close();
        else context.refresh();
      }
    }
  ];
}

// st-extension/src/sprite-lightbox.ts
function openSpriteLightbox(options) {
  let currentPack = options.pack;
  let currentIndex = clampIndex(options.index, currentPack.sprites.length);
  let currentActions = options.actions;
  let closed = false;
  const layer = element("div", "so-lightbox");
  layer.setAttribute("role", "dialog");
  layer.setAttribute("aria-modal", "true");
  layer.setAttribute("aria-label", "立绘预览");
  layer.dataset.readonly = String(options.readonly);
  const stage = element("div", "so-lightbox-stage");
  const image = document.createElement("img");
  image.className = "so-lightbox-image";
  const caption = element("div", "so-lightbox-caption");
  const previous = control("◀", "上一张（← 方向键）", "so-lightbox-nav so-lightbox-prev");
  const next = control("▶", "下一张（→ 方向键）", "so-lightbox-nav so-lightbox-next");
  const closeButton = control("✕", "关闭（Esc）", "so-lightbox-close");
  const actionRail = element("div", "so-lightbox-actions");
  actionRail.setAttribute("role", "toolbar");
  actionRail.setAttribute("aria-label", "立绘操作");
  stage.append(image);
  layer.append(stage, caption, previous, next, closeButton, actionRail);
  const visualViewport = window.visualViewport;
  const applyViewport = () => {
    const left = visualViewport?.offsetLeft ?? 0;
    const top = visualViewport?.offsetTop ?? 0;
    const width = visualViewport?.width ?? window.innerWidth;
    const height = visualViewport?.height ?? window.innerHeight;
    layer.style.left = `${left}px`;
    layer.style.top = `${top}px`;
    layer.style.width = `${width}px`;
    layer.style.height = `${height}px`;
  };
  const renderActions = () => {
    actionRail.replaceChildren();
    const hidden = options.readonly || currentActions.length === 0;
    actionRail.hidden = hidden;
    layer.classList.toggle("so-lightbox-no-actions", hidden);
    if (options.readonly) return;
    for (const action of currentActions) {
      const button2 = document.createElement("button");
      button2.type = "button";
      button2.className = "so-lightbox-action";
      button2.dataset.actionId = action.id;
      button2.disabled = Boolean(action.disabled);
      if (action.destructive) button2.classList.add("so-lightbox-action-danger");
      if (action.icon) {
        const icon = element("span", "so-lightbox-action-icon");
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = action.icon;
        button2.append(icon);
      }
      const label = element("span", "so-lightbox-action-label");
      label.textContent = action.label;
      button2.append(label);
      button2.addEventListener("click", (event) => {
        event.stopPropagation();
        if (button2.disabled) return;
        try {
          void Promise.resolve(action.run()).catch((error) => {
            console.error("[sprite-overlay] 立绘操作失败", error);
          });
        } catch (error) {
          console.error("[sprite-overlay] 立绘操作失败", error);
        }
      });
      actionRail.append(button2);
    }
  };
  const render2 = () => {
    const sprite = currentPack.sprites[currentIndex];
    if (sprite) {
      image.src = sprite.url;
      image.alt = sprite.tag;
      caption.textContent = `${sprite.tag}（${currentIndex + 1}/${currentPack.sprites.length}）`;
    } else {
      image.removeAttribute("src");
      image.alt = "";
      caption.textContent = "";
    }
    const hasMultiple = currentPack.sprites.length > 1;
    previous.disabled = !hasMultiple;
    next.disabled = !hasMultiple;
    renderActions();
  };
  const navigate = (delta) => {
    const count = currentPack.sprites.length;
    if (closed || count === 0) return;
    currentIndex = (currentIndex + delta + count) % count;
    render2();
    options.onNavigate(currentIndex);
  };
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKeyDown, true);
    if (visualViewport) {
      visualViewport.removeEventListener("resize", applyViewport);
      visualViewport.removeEventListener("scroll", applyViewport);
    } else {
      window.removeEventListener("resize", applyViewport);
    }
    layer.remove();
    options.onClose();
  };
  const onKeyDown = (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      navigate(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      navigate(1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };
  previous.addEventListener("click", (event) => {
    event.stopPropagation();
    navigate(-1);
  });
  next.addEventListener("click", (event) => {
    event.stopPropagation();
    navigate(1);
  });
  closeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    close();
  });
  image.addEventListener("click", (event) => {
    event.stopPropagation();
    if (currentPack.sprites.length < 2) return;
    const rect = image.getBoundingClientRect();
    navigate(event.clientX < rect.left + rect.width / 2 ? -1 : 1);
  });
  layer.addEventListener("click", (event) => {
    if (event.target === layer || event.target === stage) close();
  });
  document.addEventListener("keydown", onKeyDown, true);
  if (visualViewport) {
    visualViewport.addEventListener("resize", applyViewport);
    visualViewport.addEventListener("scroll", applyViewport);
  } else {
    window.addEventListener("resize", applyViewport);
  }
  const controller = {
    update(pack, index, actions) {
      if (closed) return;
      currentPack = pack;
      currentIndex = clampIndex(index, pack.sprites.length);
      if (actions) currentActions = actions;
      render2();
    },
    close
  };
  applyViewport();
  render2();
  document.body.append(layer);
  return controller;
}
function clampIndex(index, count) {
  if (count === 0) return 0;
  return Math.max(0, Math.min(index, count - 1));
}
function element(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
function control(text3, label, className) {
  const button2 = document.createElement("button");
  button2.type = "button";
  button2.className = className;
  button2.textContent = text3;
  button2.title = label;
  button2.setAttribute("aria-label", label);
  return button2;
}

// st-extension/src/sprite-localize.ts
var LOCALIZE_MAX_BYTES = 20 * 1024 * 1024;
var LOCALIZE_TIMEOUT_MS = 3e4;
async function localizeSprite(sprite, fileName, deps) {
  if (getSpriteSource(sprite) !== "hosted") {
    throw new Error("这张立绘已经是本地图片");
  }
  let response;
  try {
    response = await deps.fetch(sprite.url, requestInit());
  } catch (error) {
    throw new Error(`下载远程图片失败：${downloadFailure(error)}`, { cause: error });
  }
  if (!response.ok) {
    throw new Error(`下载远程图片失败：HTTP ${response.status}`);
  }
  const declaredBytes = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > LOCALIZE_MAX_BYTES) {
    throw new Error(`远程图片过大，不能超过 ${formatLimit()}`);
  }
  let blob;
  try {
    blob = await response.blob();
  } catch (error) {
    throw new Error(`下载远程图片失败：${downloadFailure(error)}`, { cause: error });
  }
  if (blob.size > LOCALIZE_MAX_BYTES) {
    throw new Error(`远程图片过大，不能超过 ${formatLimit()}`);
  }
  if (!blob.type.startsWith("image/")) {
    throw new Error("远程地址没有返回图片");
  }
  let compressed;
  try {
    compressed = await (deps.compress ?? compressImage)(blob);
  } catch (error) {
    throw new Error(`压缩远程图片失败：${errorMessage(error)}`, { cause: error });
  }
  let localUrl;
  try {
    localUrl = await deps.saveImage(dataUriToFile(compressed.dataUri, fileName), fileName);
  } catch (error) {
    throw new Error(`保存本地图片失败：${errorMessage(error)}`, { cause: error });
  }
  if (!localUrl || getSpriteSource({ ...sprite, url: localUrl }) === "hosted") {
    throw new Error("保存本地图片失败：平台未返回本地地址");
  }
  return { ...sprite, url: localUrl, remoteUrl: sprite.url };
}
function dataUriToFile(dataUri, fileName) {
  const match = /^data:(image\/[^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUri);
  if (!match) throw new Error("压缩后的图片数据格式不正确");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], fileName, { type: match[1] });
}
function errorMessage(error) {
  return error instanceof Error && error.message ? error.message : "未知错误";
}
function downloadFailure(error) {
  const name = typeof error?.name === "string" ? error.name : "";
  return name === "TimeoutError" || name === "AbortError" ? `超过 ${LOCALIZE_TIMEOUT_MS / 1e3} 秒没有响应` : errorMessage(error);
}
function requestInit() {
  return typeof AbortSignal?.timeout === "function" ? { signal: AbortSignal.timeout(LOCALIZE_TIMEOUT_MS) } : void 0;
}
function formatLimit() {
  return `${LOCALIZE_MAX_BYTES / 1024 / 1024} MB`;
}

// st-extension/src/sprite-manager.ts
var SPRITE_PAGE_SIZE = 60;
function createSpriteManager(deps) {
  let backdrop = null;
  let destroyed = false;
  let view = { kind: "list" };
  let spriteVisibleCount = SPRITE_PAGE_SIZE;
  let spriteFilterQuery = "";
  let spriteFilterLabels = [];
  let expandedRoleGroupKey = "";
  const openSections = /* @__PURE__ */ new Map();
  let enableListOpen = false;
  let enableListDocHandler = null;
  let batchMode = false;
  const selectedPackIds = /* @__PURE__ */ new Set();
  let batchResourceBusy = false;
  let openedFrom = "overlay";
  let activeLightbox = null;
  function applyBackdropSize() {
    if (!backdrop) return;
    backdrop.style.left = "0";
    backdrop.style.top = "0";
    backdrop.style.width = `${window.innerWidth}px`;
    backdrop.style.height = `${window.innerHeight}px`;
  }
  function open(source = "overlay") {
    if (destroyed) return;
    openedFrom = source;
    if (backdrop) {
      render2();
      return;
    }
    view = { kind: "list" };
    spriteVisibleCount = SPRITE_PAGE_SIZE;
    spriteFilterQuery = "";
    spriteFilterLabels = [];
    expandedRoleGroupKey = "";
    openSections.clear();
    enableListOpen = false;
    batchMode = false;
    selectedPackIds.clear();
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
      render2();
    };
    backBtn.addEventListener("click", goBack);
    backBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        goBack();
      }
    });
    const title2 = el("b", "so-manager-title");
    const actions = el("div", "so-manager-actions");
    const closeBtn = el("div", "menu_button so-manager-close");
    closeBtn.title = "关闭";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => close());
    header.append(backBtn, title2, actions, closeBtn);
    const body = el("div", "so-manager-body");
    dialog.append(header, body);
    backdrop.append(dialog);
    document.body.append(backdrop);
    render2();
  }
  function onEscape(e) {
    if (e.key !== "Escape") return;
    if (e.defaultPrevented) return;
    if (backdrop?.querySelector(".so-lightbox")) return;
    if (backdrop?.querySelector(".so-popover")) {
      closeEnableList();
      closePopovers();
      return;
    }
    if (view.kind === "pack") {
      view = { kind: "list" };
      render2();
    } else {
      close();
    }
  }
  function close() {
    if (!backdrop) return;
    activeLightbox?.controller?.close();
    closeEnableList();
    document.removeEventListener("keydown", onEscape);
    window.removeEventListener("resize", applyBackdropSize);
    backdrop.remove();
    backdrop = null;
    deps.onClosed?.(openedFrom);
  }
  function refreshIfOpen() {
    if (backdrop) {
      render2();
      refreshLightbox();
    }
  }
  function commit(next) {
    deps.updateSettings(next);
    render2();
    refreshLightbox();
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
    render2();
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
  function closeEnableList() {
    enableListOpen = false;
    backdrop?.querySelectorAll('.so-popover[data-pop="启用包"]').forEach((n) => n.remove());
    if (enableListDocHandler) {
      document.removeEventListener("click", enableListDocHandler, true);
      enableListDocHandler = null;
    }
  }
  function renderEnableList() {
    const header = backdrop?.querySelector(".so-manager-header");
    if (!header) return;
    header.querySelectorAll('.so-popover[data-pop="启用包"]').forEach((n) => n.remove());
    if (!enableListOpen) return;
    const characterName = deps.adapter.getCurrentCharacterName();
    if (!characterName) {
      closeEnableList();
      return;
    }
    const body = backdrop?.querySelector(".so-manager-body");
    const settings = deps.getSettings();
    const boundIds = settings.bindings.find((b) => b.characterName === characterName)?.packIds ?? [];
    const panel = el("div", "so-popover so-enable-pop");
    panel.dataset.pop = "启用包";
    const heading = el("div", "so-popover-title");
    heading.textContent = `勾选启用（${characterName}，即时生效）`;
    panel.append(heading);
    if (settings.packs.length === 0) {
      const tip = el("div", "so-status");
      tip.textContent = "还没有立绘包，先用「新建」或「导入」。";
      panel.append(tip);
    }
    for (const p of settings.packs) {
      panel.append(
        checkboxRow(`${p.name}（${p.sprites.length} 张）`, boundIds.includes(p.id), (v) => {
          if (v) bindPackWithChoices(characterName, p.id, body);
          else commit(unbindPack(deps.getSettings(), characterName, p.id));
          renderEnableList();
        })
      );
    }
    header.append(panel);
    if (!enableListDocHandler) {
      enableListDocHandler = (e) => {
        const current2 = backdrop?.querySelector('.so-popover[data-pop="启用包"]');
        const btn = backdrop?.querySelector(".so-enable-btn");
        if (current2?.contains(e.target) || btn?.contains(e.target)) return;
        closeEnableList();
      };
      document.addEventListener("click", enableListDocHandler, true);
    }
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
  function render2() {
    if (!backdrop) return;
    const backBtn = backdrop.querySelector(".so-manager-back");
    const title2 = backdrop.querySelector(".so-manager-title");
    const actions = backdrop.querySelector(".so-manager-actions");
    const body = backdrop.querySelector(".so-manager-body");
    body.innerHTML = "";
    actions.innerHTML = "";
    backdrop.querySelector(".so-manager")?.classList.toggle("so-manager-batch-mode", batchMode);
    closePopovers();
    try {
      if (view.kind === "pack") {
        const packId = view.packId;
        const pack = deps.getSettings().packs.find((p) => p.id === packId);
        if (pack) {
          backBtn.style.display = "inline-flex";
          title2.textContent = pack.name;
          renderPackDetail(body, actions, pack);
          return;
        }
        view = { kind: "list" };
      }
      backBtn.style.display = "none";
      title2.textContent = "立绘包管理";
      renderList(body, actions);
    } catch (err) {
      console.error("[sprite-overlay] 管理弹窗渲染失败", err);
      const msg = el("div", "so-status");
      msg.textContent = `界面渲染出错：${err instanceof Error ? err.message : String(err)}`;
      body.append(msg);
    }
  }
  function collapsible(titleText, open2 = false, key = "") {
    const box = document.createElement("details");
    box.className = "so-section so-collapse";
    box.open = key ? openSections.get(key) ?? open2 : open2;
    if (key) box.addEventListener("toggle", () => openSections.set(key, box.open));
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
    if (batchMode) {
      const selectedCount = selectedPackIds.size;
      const deletablePacks = settings.packs.filter(
        (pack) => selectedPackIds.has(pack.id) && !isPresetPack(pack.id)
      );
      actions.append(
        button("全选", () => {
          const all = settings.packs;
          if (all.length > 0 && all.every((p) => selectedPackIds.has(p.id))) {
            selectedPackIds.clear();
          } else {
            selectedPackIds.clear();
            for (const p of all) selectedPackIds.add(p.id);
          }
          render2();
        }),
        button(`上传云端（${selectedCount}）`, () => {
          void uploadSelectedPacks();
        }),
        button(`保存本地（${selectedCount}）`, () => {
          void localizeSelectedPacks();
        }),
        button(`复制分享串（${selectedCount}）`, () => {
          void copySelectedPackShares();
        }),
        button(`删除所选（${deletablePacks.length}）`, () => {
          if (deletablePacks.length === 0) {
            toast(body, selectedPackIds.size > 0 ? "预设包不可删除；可保存本地、上传云端或复制分享串" : "先点卡片勾选要删除的包");
            return;
          }
          const names = deletablePacks.map((pack) => pack.name);
          const preview = names.slice(0, 8).join("、") + (names.length > 8 ? ` 等 ${names.length} 个` : "");
          const ids = deletablePacks.map((pack) => pack.id);
          void deletePacksWithChoice(ids, names, preview);
        }, "so-btn-danger"),
        button("完成", () => {
          batchMode = false;
          selectedPackIds.clear();
          render2();
        })
      );
    } else {
      if (characterName) {
        const enableBtn = button(
          boundIds.length > 0 ? `启用包（${boundIds.length}） ▾` : "启用包 ▾",
          () => {
            if (enableListOpen) {
              closeEnableList();
            } else {
              closePopovers();
              enableListOpen = true;
              renderEnableList();
            }
          }
        );
        enableBtn.classList.add("so-enable-btn");
        enableBtn.setAttribute("aria-label", `为「${characterName}」勾选启用立绘包`);
        actions.append(enableBtn);
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
            render2();
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
              render2();
            } catch (err) {
              toast(body, err instanceof Error ? err.message : "分享串解析失败");
            }
          });
          const jsonHeading = el("div", "so-popover-title");
          jsonHeading.textContent = "从 JSON 文件导入";
          const jsonBtn = button("选择 JSON 文件…", () => {
            pickFile(".json,application/json", false, async (files) => {
              try {
                const text3 = await files[0].text();
                if (text3.length > 2 * 1024 * 1024 && !window.confirm(
                  `这个 JSON 有 ${(text3.length / 1024 / 1024).toFixed(1)}MB（内嵌 base64 图）。云端部署的酒馆导入大包容易内存爆满，建议让对方先传图床再发分享串。仍要导入吗？`
                ))
                  return;
                const pack = importPack(text3);
                if (!installImportedPack(pack, body)) return;
                const installed = deps.getSettings().packs.find((item) => item.id === pack.id);
                if (installed) view = { kind: "pack", packId: installed.id };
                render2();
              } catch (err) {
                toast(body, err instanceof Error ? err.message : "导入失败");
              }
            });
          });
          panel.append(shareHeading, shareInput, shareBtn, jsonHeading, jsonBtn);
        })
      );
      if (settings.packs.length > 0) {
        actions.append(
          button("批量管理", () => {
            closeEnableList();
            batchMode = true;
            selectedPackIds.clear();
            render2();
          })
        );
      }
    }
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
    if (batchMode) {
      const tip = el("div", "so-status so-batch-tip");
      tip.textContent = "批量管理：先勾选图包，再统一设置类型或标签；资源操作和排序仍可在上方完成。预设包可保存本地或分享，但不可删除。";
      body.append(tip);
      body.append(renderBatchClassificationTools(body));
    }
    const useFold = settings.galleryFoldByRole && !batchMode;
    const grid = el("div", useFold ? "so-pack-list-folded" : "so-pack-grid");
    const boundState = (pack) => boundIds.includes(pack.id) ? binding?.enabled ? "active" : "off" : null;
    if (useFold) {
      for (const group of groupPacksByRole(settings.packs)) {
        if (group.packCount === 1) {
          grid.append(renderPackCard(group.packs[0], boundState(group.packs[0])));
          continue;
        }
        const section2 = el("div", "so-role-pack-group");
        section2.dataset.roleKey = group.key;
        const expanded = expandedRoleGroupKey === group.key;
        const toggle = () => {
          expandedRoleGroupKey = expanded ? "" : group.key;
          render2();
        };
        if (expanded) {
          const row = el("button", "so-role-pack-row");
          row.type = "button";
          row.setAttribute("aria-expanded", "true");
          const title2 = el("b");
          title2.textContent = group.role;
          const counts = el("span");
          counts.textContent = `${group.packCount} 个图包 · ${group.spriteCount} 张`;
          const arrow = el("span", "so-role-pack-arrow");
          arrow.textContent = "▾";
          row.append(title2, counts, arrow);
          row.addEventListener("click", toggle);
          const packs = el("div", "so-role-pack-strip");
          packs.setAttribute("aria-label", `${group.role}的图包`);
          for (const pack of group.packs) packs.append(renderPackCard(pack, boundState(pack)));
          section2.append(row, packs);
        } else {
          section2.append(renderRolePackStack(group.role, group.key, group.packs, group.spriteCount, boundState, toggle));
        }
        grid.append(section2);
      }
    } else {
      for (const pack of settings.packs) grid.append(renderPackCard(pack, boundState(pack)));
    }
    body.append(grid);
    body.append(statusBar());
    renderEnableList();
  }
  function selectedPacks() {
    return deps.getSettings().packs.filter((pack) => selectedPackIds.has(pack.id));
  }
  function persistSelectedPresetMetadata(settings, packIds) {
    let next = settings;
    for (const packId of packIds) {
      if (!isPresetPack(packId)) continue;
      const pack = next.packs.find((candidate) => candidate.id === packId);
      if (!pack) continue;
      const customTags = normalizeLabels(pack.customTags);
      next = setPresetMetadata(next, packId, {
        name: pack.name,
        author: pack.author ?? null,
        description: pack.description ?? null,
        roleName: pack.roleName ?? null,
        outfit: pack.outfit ?? null,
        promptNote: pack.promptNote ?? null,
        promptNotePlacement: pack.promptNotePlacement ?? null,
        outfitNotes: pack.outfitNotes ?? null,
        kind: pack.kind ?? null,
        customTags: customTags.length > 0 ? customTags : null
      });
    }
    return next;
  }
  function renderBatchClassificationTools(body) {
    const panel = el("div", "so-batch-classification");
    const ids = [...selectedPackIds];
    const kindSelect = document.createElement("select");
    kindSelect.className = "text_pole so-batch-kind-select";
    for (const [value, label] of [["sprite", "立绘"], ["illustration", "插图"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      kindSelect.append(option);
    }
    const kindRow = el("div", "so-row");
    kindRow.append(
      labeled("类型", kindSelect),
      button("设置类型", () => {
        if (selectedPackIds.size === 0) {
          toast(body, "请先勾选要设置的图包");
          return;
        }
        const selected = [...selectedPackIds];
        const changed = setPackKind(
          deps.getSettings(),
          selected,
          kindSelect.value === "illustration" ? "illustration" : "sprite"
        );
        commit(persistSelectedPresetMetadata(changed, selected));
        toast(body, `已设置 ${selected.length} 个图包的类型`);
      })
    );
    const tagInput = textInput("输入自定义标签");
    tagInput.classList.add("so-batch-tag-input");
    tagInput.maxLength = 32;
    const addRow = el("div", "so-row");
    addRow.append(
      labeled("自定义标签", tagInput),
      button("添加标签", () => {
        const tag = normalizeLabels([tagInput.value])[0];
        if (selectedPackIds.size === 0) {
          toast(body, "请先勾选要设置的图包");
          return;
        }
        if (!tag) {
          toast(body, "请输入标签");
          return;
        }
        const selected = [...selectedPackIds];
        const changed = addPackCustomTag(deps.getSettings(), selected, tag);
        commit(persistSelectedPresetMetadata(changed, selected));
        toast(body, `已为 ${selected.length} 个图包添加「${tag}」`);
      })
    );
    const removeSelect = document.createElement("select");
    removeSelect.className = "text_pole so-batch-tag-remove-select";
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = ids.length === 0 ? "先勾选图包" : "选择要移除的标签";
    removeSelect.append(emptyOption);
    const selectedTags = normalizeLabels(selectedPacks().flatMap((pack) => pack.customTags ?? []));
    for (const tag of selectedTags) {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      removeSelect.append(option);
    }
    const removeRow = el("div", "so-row");
    removeRow.append(
      labeled("移除标签", removeSelect),
      button("移除标签", () => {
        if (selectedPackIds.size === 0) {
          toast(body, "请先勾选要设置的图包");
          return;
        }
        if (!removeSelect.value) {
          toast(body, "请选择要移除的标签");
          return;
        }
        const selected = [...selectedPackIds];
        const changed = removePackCustomTag(deps.getSettings(), selected, removeSelect.value);
        commit(persistSelectedPresetMetadata(changed, selected));
        toast(body, `已从 ${selected.length} 个图包移除「${removeSelect.value}」`);
      })
    );
    panel.append(kindRow, addRow, removeRow);
    return panel;
  }
  function sameSprite(pack, source) {
    return pack.sprites.find(
      (candidate) => candidate.tag === source.tag && spriteGroup(candidate) === spriteGroup(source) && (candidate.outfit ?? "") === (source.outfit ?? "")
    ) ?? null;
  }
  async function uploadSelectedPacks() {
    if (batchResourceBusy) return;
    const packs = selectedPacks();
    if (packs.length === 0) {
      toast(currentManagerBody(), "先勾选要上传云端的图包");
      return;
    }
    const apiKey = deps.getSettings().imgbbApiKey.trim();
    if (!apiKey) {
      toast(currentManagerBody(), "请先在「图库」App 配置 imgbb API Key");
      return;
    }
    batchResourceBusy = true;
    let uploaded = 0;
    let failed = 0;
    try {
      for (const pack of packs) {
        const pending = pack.sprites.filter(
          (sprite) => getSpriteSource(sprite) !== "hosted" && !(sprite.remoteUrl && /^https?:\/\//.test(sprite.remoteUrl))
        );
        for (const sprite of pending) {
          try {
            const dataUri = sprite.url.startsWith("data:") ? sprite.url : await urlToDataUri(sprite.url);
            const result = await uploadToImgbb(apiKey, dataUri);
            if (!isValidImgbbResult(result)) throw new Error("图床响应无效");
            const latestPack = deps.getSettings().packs.find((candidate) => candidate.id === pack.id);
            const latestSprite = latestPack ? sameSprite(latestPack, sprite) : null;
            if (!latestPack || !latestSprite) throw new Error("立绘在上传期间已变化");
            if (!updateChecked(upsertPack(
              deps.getSettings(),
              upsertSprite(latestPack, { ...latestSprite, code: result.code, remoteUrl: result.url })
            ))) throw new Error("更新图包失败");
            uploaded++;
          } catch (error) {
            console.warn("[sprite-overlay] 批量上传云端失败", { packId: pack.id, tag: sprite.tag, error });
            failed++;
          }
        }
      }
    } finally {
      batchResourceBusy = false;
      render2();
      toast(currentManagerBody(), `上传云端完成：成功 ${uploaded} 张，失败 ${failed} 张${failed > 0 ? "（可再次点击重试）" : ""}`);
    }
  }
  async function localizeSelectedPacks() {
    if (batchResourceBusy) return;
    const packs = selectedPacks();
    if (packs.length === 0) {
      toast(currentManagerBody(), "先勾选要保存到本地的图包");
      return;
    }
    batchResourceBusy = true;
    let localizedCount = 0;
    let failed = 0;
    try {
      for (const pack of packs) {
        const remoteSprites = pack.sprites.filter((sprite) => getSpriteSource(sprite) === "hosted");
        const preset = isPresetPack(pack.id);
        for (const sprite of remoteSprites) {
          try {
            const parts = [pack.name, spriteGroup(sprite), sprite.outfit ?? "", sprite.tag].filter(Boolean);
            const fileName = `${parts.join("-")}.webp`;
            const localized = await localizeSprite(sprite, fileName, {
              fetch: window.fetch.bind(window),
              compress: compressImage,
              saveImage: (file, name) => deps.adapter.saveImageFile(
                file,
                name,
                deps.adapter.getCurrentCharacterName() || pack.name || "shared"
              )
            });
            const latestSettings = deps.getSettings();
            const latestPack = latestSettings.packs.find((candidate) => candidate.id === pack.id);
            const latestSprite = latestPack ? sameSprite(latestPack, sprite) : null;
            if (!latestPack || !latestSprite || latestSprite.url !== sprite.url) {
              throw new Error("立绘在保存期间已变化");
            }
            if (preset) {
              const next = setPresetLocalSprite(latestSettings, pack.id, latestSprite, localized.url);
              if (next === latestSettings) throw new Error("更新预设覆盖失败");
              deps.updateSettings(next);
            } else if (!updateChecked(upsertPack(
              latestSettings,
              upsertSprite(latestPack, { ...latestSprite, url: localized.url, remoteUrl: localized.remoteUrl })
            ))) {
              throw new Error("更新图包失败");
            }
            localizedCount++;
          } catch (error) {
            console.warn("[sprite-overlay] 批量保存本地失败", { packId: pack.id, tag: sprite.tag, error });
            failed++;
          }
        }
      }
    } finally {
      batchResourceBusy = false;
      render2();
      toast(currentManagerBody(), `保存本地完成：成功 ${localizedCount} 张，失败 ${failed} 张${failed > 0 ? "（可再次点击重试）" : ""}`);
    }
  }
  async function copySelectedPackShares() {
    if (batchResourceBusy) return;
    const packs = selectedPacks();
    if (packs.length === 0) {
      toast(currentManagerBody(), "先勾选要复制分享串的图包");
      return;
    }
    const encoded = packs.map((pack) => ({ pack, result: encodeShareStringV2(pack) })).filter((entry) => entry.result !== null);
    if (encoded.length === 0) {
      toast(currentManagerBody(), "所选图包都没有可分享的远程图片");
      return;
    }
    const missingCount = encoded.reduce((count, entry) => count + entry.result.missing.length, 0);
    if (missingCount > 0 && !window.confirm(
      `所选图包中还有 ${missingCount} 张图片没有远程地址，不会进入分享串。仍要复制吗？`
    )) return;
    const text3 = encoded.map((entry) => entry.result.text).join("\n\n");
    const ok = await copyText(text3);
    toast(
      currentManagerBody(),
      ok ? `已复制 ${encoded.length} 个图包的分享串${missingCount > 0 ? `，缺少 ${missingCount} 张` : ""}` : "复制失败，请手动复制弹出的文本"
    );
    if (!ok) window.prompt("手动复制分享串：", text3);
  }
  async function deletePacksWithChoice(packIds, names, preview) {
    if (!window.confirm(`确定删除 ${names.length} 个立绘包？
${preview}
绑定关系会一并清除。`)) return;
    const current2 = deps.getSettings();
    const localPaths = deletableLocalSpritePaths(current2, packIds);
    const deleteLocal = localPaths.length > 0 && window.confirm(
      `检测到 ${localPaths.length} 个仅由这些包使用的本地图片文件。
同时从 SillyTavern 服务器删除它们吗？

选择“取消”将只删除图包记录，文件继续保留。`
    );
    if (!deleteLocal) {
      selectedPackIds.clear();
      view = { kind: "list" };
      commit(removePacks(current2, packIds));
      toast(currentManagerBody(), `已删除 ${names.length} 个立绘包，本地文件未删除`);
      return;
    }
    let deleted = 0;
    let failed = 0;
    for (const path of localPaths) {
      try {
        await deps.adapter.deleteImage(path);
        deleted++;
      } catch (error) {
        console.warn("[sprite-overlay] 删除本地图片失败", { path, error });
        failed++;
      }
    }
    if (failed > 0) {
      toast(
        currentManagerBody(),
        `本地文件删除成功 ${deleted} 张，失败 ${failed} 张；图包尚未删除，可再次重试`
      );
      return;
    }
    selectedPackIds.clear();
    view = { kind: "list" };
    commit(removePacks(deps.getSettings(), packIds));
    toast(currentManagerBody(), `已删除 ${names.length} 个立绘包及 ${deleted} 张本地文件`);
  }
  function renderRolePackStack(role, roleKey, packs, spriteCount, boundState, expand) {
    const stack = el("button", "so-role-pack-stack");
    stack.type = "button";
    stack.dataset.roleKey = roleKey;
    stack.setAttribute("aria-expanded", "false");
    stack.setAttribute("aria-label", `展开「${role}」的 ${packs.length} 个图包`);
    for (let index = 2; index >= 1; index -= 1) {
      const layer = el("span", `so-role-stack-layer so-role-stack-layer-${index}`);
      layer.setAttribute("aria-hidden", "true");
      stack.append(layer);
    }
    const face = el("span", "so-role-stack-face");
    const coverBox = el("span", "so-role-stack-cover");
    const first = packs[0];
    const cover = first ? getPackCover(first) : null;
    if (cover) {
      const image = document.createElement("img");
      image.src = cover.url;
      image.alt = "";
      image.loading = "lazy";
      coverBox.append(image);
    } else {
      coverBox.textContent = "暂无立绘";
    }
    const activeCount = packs.filter((pack) => boundState(pack) === "active").length;
    if (activeCount > 0) {
      const badge = el("span", "so-card-badge");
      badge.textContent = activeCount === 1 ? "使用中" : `使用中 ${activeCount}`;
      coverBox.append(badge);
    }
    const info = el("span", "so-card-info");
    const title2 = el("b");
    title2.textContent = role;
    const detail = el("small");
    detail.textContent = `${packs.length} 个图包 · ${spriteCount} 张`;
    const count = el("span", "so-role-stack-count");
    count.textContent = `${packs.length} 个图包`;
    info.append(title2, detail);
    face.append(coverBox, count, info);
    stack.append(face);
    stack.addEventListener("click", expand);
    return stack;
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
      badge.dataset.corner = "bottom-left";
      coverBox.append(badge);
    }
    if (isPresetPack(pack.id)) {
      const chip = el("span", "so-card-chip");
      chip.textContent = "预设";
      coverBox.append(chip);
    }
    const resources = summarizePackResources(pack);
    if (resources.total > 0) {
      const status = el("span", "so-card-resource-status");
      status.dataset.corner = "bottom-right";
      const resourceLabel = (kind, label) => {
        const count = resources[kind];
        if (count === 0) return;
        const chip = el("span", `so-card-resource-chip so-card-resource-${kind}`);
        chip.textContent = count === resources.total ? label : `${label} ${count}/${resources.total}`;
        status.append(chip);
      };
      resourceLabel("local", "本地");
      resourceLabel("cloud", "云端");
      coverBox.append(status);
    }
    const info = el("div", "so-card-info");
    const nameEl = el("b");
    nameEl.textContent = pack.name;
    const metaEl = el("small");
    metaEl.textContent = `${pack.sprites.length} 张 · ${pack.author ?? "未知作者"}`;
    const labels = packLabels(pack);
    const labelRow = el("div", "so-pack-labels");
    for (const text3 of [`角色：${labels.role}`, `类型：${labels.type}`, ...labels.custom]) {
      const chip = el("span");
      chip.textContent = text3;
      labelRow.append(chip);
    }
    info.append(nameEl, metaEl, labelRow);
    card.append(coverBox, info);
    if (batchMode) {
      const preset = isPresetPack(pack.id);
      const selected = selectedPackIds.has(pack.id);
      card.classList.add("so-card-batch");
      if (selected) card.classList.add("so-card-selected");
      const check = el("span", `so-card-check${selected ? " so-card-check-on" : ""}`);
      check.textContent = selected ? "✓" : "";
      check.dataset.corner = "top-left";
      coverBox.append(check);
      const orderRow = el("div", "so-row so-card-order");
      orderRow.append(
        iconButton("◀", "前移", () => {
          commit(movePack(deps.getSettings(), pack.id, -1));
        }, "so-chip-btn"),
        iconButton("▶", "后移", () => {
          commit(movePack(deps.getSettings(), pack.id, 1));
        }, "so-chip-btn")
      );
      card.append(orderRow);
      card.title = preset ? "点击勾选资源操作；预设包不可删除，可拖拽排序" : "点击勾选；可拖拽排序";
      card.setAttribute("aria-label", `选择立绘包「${pack.name}」`);
      const toggleSelect = () => {
        if (selectedPackIds.has(pack.id)) selectedPackIds.delete(pack.id);
        else selectedPackIds.add(pack.id);
        render2();
      };
      card.addEventListener("click", toggleSelect);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleSelect();
        }
      });
      card.draggable = true;
      card.dataset.packId = pack.id;
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("text/plain", pack.id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        card.classList.add("so-card-dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("so-card-dragging"));
      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        card.classList.add("so-card-drop-target");
      });
      card.addEventListener("dragleave", () => card.classList.remove("so-card-drop-target"));
      card.addEventListener("drop", (e) => {
        e.preventDefault();
        card.classList.remove("so-card-drop-target");
        const fromId = e.dataTransfer?.getData("text/plain");
        if (!fromId || fromId === pack.id) return;
        commit(movePackBefore(deps.getSettings(), fromId, pack.id));
      });
      return card;
    }
    const enter = () => {
      view = { kind: "pack", packId: pack.id };
      spriteVisibleCount = SPRITE_PAGE_SIZE;
      spriteFilterQuery = "";
      spriteFilterLabels = [];
      render2();
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
          upHint.textContent = "默认整个文件名作图名、落入当前包；预览里勾选「自动拆分」可按 _ - – — 空格拆「人名/服装/图名」（如 鸣人-居家服-微笑.png）并按前缀拆分成包。";
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
            const current2 = deps.getSettings();
            const target = current2.packs.find((p) => p.id === pack.id);
            if (!target) return;
            const host = current2.imageHost.endsWith("/") ? current2.imageHost : `${current2.imageHost}/`;
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
          void deletePacksWithChoice([pack.id], [pack.name], pack.name);
        }, "so-btn-danger")
      );
    }
    body.append(topRow);
    {
      const metaPanel = collapsible("包信息", false, `pack-meta:${pack.id}`);
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
      const promptNoteInput = document.createElement("textarea");
      promptNoteInput.className = "text_pole so-pack-prompt-note";
      promptNoteInput.placeholder = "图包备注（可选）";
      promptNoteInput.rows = 3;
      promptNoteInput.maxLength = MAX_NOTE_CODE_POINTS;
      promptNoteInput.value = pack.promptNote ?? "";
      const placementSelect = document.createElement("select");
      placementSelect.className = "text_pole so-pack-prompt-placement";
      placementSelect.setAttribute("aria-label", "图包备注插入位置");
      for (const [value, label] of [
        ["before-list", "立绘清单前"],
        ["after-list", "立绘清单后"]
      ]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        placementSelect.append(option);
      }
      placementSelect.value = pack.promptNotePlacement ?? DEFAULT_PROMPT_NOTE_PLACEMENT;
      const outfitNoteDrafts = new Map(Object.entries(pack.outfitNotes ?? {}));
      const outfitNotesBox = el("div", "so-outfit-note-list");
      const syncOutfitNoteDrafts = () => {
        for (const input of outfitNotesBox.querySelectorAll(".so-outfit-note-input")) {
          outfitNoteDrafts.set(input.dataset.outfit ?? "", input.value);
        }
      };
      const renderOutfitNotes = () => {
        syncOutfitNoteDrafts();
        const outfits = [...new Set([
          normalizeTag(outfitInput.value),
          ...pack.sprites.map((sprite) => normalizeTag(sprite.outfit ?? "")),
          ...outfitNoteDrafts.keys()
        ].filter(Boolean))];
        outfitNotesBox.replaceChildren();
        if (outfits.length === 0) return;
        const title2 = el("div", "so-section-title");
        title2.textContent = "服装备注";
        outfitNotesBox.append(title2);
        for (const outfit of outfits) {
          const input = document.createElement("textarea");
          input.className = "text_pole so-outfit-note-input";
          input.dataset.outfit = outfit;
          input.placeholder = `${outfit}的使用场景（可选）`;
          input.rows = 2;
          input.maxLength = MAX_NOTE_CODE_POINTS;
          input.value = outfitNoteDrafts.get(outfit) ?? "";
          input.addEventListener("input", () => outfitNoteDrafts.set(outfit, input.value));
          const row = labeled(outfit, input);
          row.classList.add("so-outfit-note-row");
          outfitNotesBox.append(row);
        }
      };
      outfitInput.addEventListener("change", renderOutfitNotes);
      renderOutfitNotes();
      const promptRow = el("div", "so-row so-pack-note-row");
      promptRow.append(
        labeled("图包备注", promptNoteInput),
        labeled("插入位置", placementSelect)
      );
      metaRow.append(
        labeled("包名", nameInput),
        labeled("作者", authorInput),
        labeled("人名", roleInput),
        labeled("服装", outfitInput),
        labeled("描述", descInput)
      );
      const saveRow = el("div", "so-row so-meta-save-row");
      saveRow.append(
        button("保存包信息", () => {
          const name = sanitizePackName(nameInput.value);
          if (!name) {
            toast(body, "包名不能为空");
            return;
          }
          const roleName = normalizeTag(roleInput.value);
          const outfit = normalizeTag(outfitInput.value);
          const promptNote = normalizeNote(promptNoteInput.value);
          syncOutfitNoteDrafts();
          const outfitNotes = normalizeOutfitNotes(Object.fromEntries(outfitNoteDrafts));
          if (readonly) {
            const current2 = deps.getSettings();
            const next = setPresetMetadata(current2, pack.id, {
              name,
              author: sanitizePackName(authorInput.value) || null,
              description: sanitizeDescription(descInput.value) || null,
              roleName: roleName || null,
              outfit: outfit || null,
              promptNote: promptNote || null,
              promptNotePlacement: promptNote ? placementSelect.value === "after-list" ? "after-list" : "before-list" : null,
              outfitNotes: Object.keys(outfitNotes).length > 0 ? outfitNotes : null
            });
            const materialized = next.packs.find((candidate) => candidate.id === pack.id);
            if (!materialized || !checkedSettings(upsertPack(current2, materialized))) return;
            commit(next);
            toast(body, "已保存包信息");
            return;
          }
          const nextPack = {
            ...pack,
            name,
            author: sanitizePackName(authorInput.value) || void 0,
            description: sanitizeDescription(descInput.value) || void 0,
            roleName: roleName || void 0,
            outfit: outfit || void 0
          };
          if (promptNote) {
            nextPack.promptNote = promptNote;
            nextPack.promptNotePlacement = placementSelect.value === "after-list" ? "after-list" : "before-list";
          } else {
            delete nextPack.promptNote;
            delete nextPack.promptNotePlacement;
          }
          if (Object.keys(outfitNotes).length > 0) nextPack.outfitNotes = outfitNotes;
          else delete nextPack.outfitNotes;
          if (commitChecked(upsertPack(deps.getSettings(), nextPack))) {
            toast(body, "已保存包信息");
          }
        }, "so-btn-primary so-meta-save")
      );
      if (readonly) {
        saveRow.append(button("恢复内置信息", () => {
          if (!window.confirm("确定恢复扩展内置的包信息吗？已保存的本地图片会保留。")) return;
          const current2 = deps.getSettings();
          const next = clearPresetMetadata(current2, pack.id);
          const materialized = next.packs.find((candidate) => candidate.id === pack.id);
          if (!materialized || !checkedSettings(upsertPack(current2, materialized))) return;
          commit(next);
          toast(body, "已恢复内置信息，本地图片保持不变");
        }));
      }
      const metaHint = el("div", "so-status");
      metaHint.textContent = readonly ? "可覆盖预设包信息；立绘图片本身仍不可添加、改名或删除。" : "人名/服装用于三级寻址 [立绘:人名/服装/图名]：整包同一角色时填人名，包内立绘用纯图名即可。";
      metaPanel.body.append(metaRow, promptRow, outfitNotesBox, metaHint, saveRow);
      body.append(metaPanel.box);
    }
    if (pack.sprites.length === 0) {
      const empty = el("div", "so-status");
      empty.textContent = "还没有立绘：点右上角「添加立绘」上传图片或粘贴编码。";
      body.append(empty);
    } else {
      const filters = el("div", "so-gallery-filters");
      const search = document.createElement("input");
      search.type = "search";
      search.className = "text_pole so-gallery-search";
      search.placeholder = "搜索图名、角色、服装或标签";
      search.setAttribute("aria-label", "搜索立绘");
      search.value = spriteFilterQuery;
      const labelSelect = document.createElement("select");
      labelSelect.className = "text_pole so-gallery-label-select";
      labelSelect.setAttribute("aria-label", "添加标签筛选");
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "按标签筛选…";
      labelSelect.append(placeholder);
      const availableLabels = [...new Set(pack.sprites.flatMap((sprite) => sprite.labels ?? []))];
      for (const label of availableLabels) {
        const option = document.createElement("option");
        option.value = label;
        option.textContent = label;
        labelSelect.append(option);
      }
      const chips = el("div", "so-gallery-filter-chips");
      filters.append(search, labelSelect, chips);
      body.append(filters);
      const gallery = el("div", "so-sprite-gallery");
      const count = el("div", "so-status so-sprite-count");
      const paging = el("div", "so-gallery-paging");
      body.append(gallery, count, paging);
      let filteredEntries = [];
      let sections = [];
      let groups = [];
      const grids = /* @__PURE__ */ new Map();
      const ensureGrid = (group) => {
        const existing = grids.get(group);
        if (existing) return existing;
        const section2 = el("div", "so-sprite-section");
        if (groups.length > 0) {
          const head = el("div", "so-group-head");
          head.textContent = group === "" ? "未分组" : group;
          section2.append(head);
        }
        const grid = el("div", "so-sprite-grid");
        section2.append(grid);
        const nextGrid = sections.slice(sections.indexOf(group) + 1).map((nextGroup) => grids.get(nextGroup)).find((candidate) => candidate != null);
        gallery.insertBefore(section2, nextGrid?.parentElement ?? null);
        grids.set(group, grid);
        return grid;
      };
      const appendSprites = (start, end) => {
        const entries = filteredEntries.slice(start, end);
        for (const group of sections) {
          const matching = entries.filter(({ sprite }) => spriteGroup(sprite) === group);
          if (matching.length === 0) continue;
          const grid = ensureGrid(group);
          for (const { sprite, index } of matching) {
            grid.append(renderSpriteCell(body, pack, sprite, index, readonly));
          }
        }
      };
      const updatePaging = () => {
        const visibleCount = Math.min(spriteVisibleCount, filteredEntries.length);
        count.textContent = `已显示 ${visibleCount}/${filteredEntries.length}`;
        paging.replaceChildren();
        if (visibleCount < filteredEntries.length) {
          paging.append(button("加载更多", () => {
            const previousCount = spriteVisibleCount;
            spriteVisibleCount = Math.min(filteredEntries.length, previousCount + SPRITE_PAGE_SIZE);
            appendSprites(previousCount, spriteVisibleCount);
            updatePaging();
          }));
        }
      };
      const renderFilteredGallery = () => {
        const matches = new Set(filterSprites(pack, {
          query: spriteFilterQuery,
          labels: spriteFilterLabels
        }));
        filteredEntries = pack.sprites.map((sprite, index) => ({ sprite, index })).filter(({ sprite }) => matches.has(sprite));
        groups = [...new Set(filteredEntries.map(({ sprite }) => spriteGroup(sprite)).filter(Boolean))];
        sections = [...groups];
        if (filteredEntries.some(({ sprite }) => spriteGroup(sprite) === "")) sections.push("");
        if (sections.length === 0) sections.push("");
        gallery.replaceChildren();
        grids.clear();
        if (filteredEntries.length === 0) {
          const empty = el("div", "so-status so-gallery-empty");
          empty.textContent = "没有符合筛选条件的立绘。";
          gallery.append(empty);
        } else {
          appendSprites(0, Math.min(spriteVisibleCount, filteredEntries.length));
        }
        updatePaging();
      };
      const renderChips = () => {
        chips.replaceChildren();
        for (const label of spriteFilterLabels) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "so-gallery-filter-chip";
          chip.textContent = `${label} ×`;
          chip.title = `移除标签筛选「${label}」`;
          chip.addEventListener("click", () => {
            spriteFilterLabels = spriteFilterLabels.filter((current2) => current2 !== label);
            spriteVisibleCount = SPRITE_PAGE_SIZE;
            renderChips();
            renderFilteredGallery();
          });
          chips.append(chip);
        }
      };
      search.addEventListener("input", () => {
        spriteFilterQuery = search.value;
        spriteVisibleCount = SPRITE_PAGE_SIZE;
        renderFilteredGallery();
      });
      labelSelect.addEventListener("change", () => {
        const label = labelSelect.value;
        labelSelect.value = "";
        if (!label || spriteFilterLabels.includes(label)) return;
        spriteFilterLabels = [...spriteFilterLabels, label];
        spriteVisibleCount = SPRITE_PAGE_SIZE;
        renderChips();
        renderFilteredGallery();
      });
      spriteVisibleCount = Math.min(
        Math.max(SPRITE_PAGE_SIZE, spriteVisibleCount),
        pack.sprites.length
      );
      renderChips();
      renderFilteredGallery();
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
        const splitPanel = collapsible("按分组拆成立绘包", false, `pack-split:${pack.id}`);
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
    const pack = deps.getSettings().packs.find((candidate) => candidate.id === packId);
    if (!pack || pack.sprites.length === 0) return;
    activeLightbox?.controller?.close();
    const state = { controller: null, packId, index: startIndex };
    const controller = openSpriteLightbox({
      pack,
      index: startIndex,
      readonly: isPresetPack(pack.id),
      actions: isPresetPack(pack.id) ? [] : lightboxActions(state),
      onNavigate: (index) => {
        state.index = index;
        refreshLightbox();
      },
      onClose: () => {
        if (activeLightbox === state) activeLightbox = null;
      }
    });
    state.controller = controller;
    activeLightbox = state;
  }
  function refreshLightbox() {
    const state = activeLightbox;
    if (!state?.controller) return;
    const pack = deps.getSettings().packs.find((candidate) => candidate.id === state.packId);
    if (!pack || pack.sprites.length === 0) {
      state.controller.close();
      return;
    }
    state.index = Math.max(0, Math.min(state.index, pack.sprites.length - 1));
    const actions = isPresetPack(pack.id) ? [] : lightboxActions(state);
    state.controller.update(pack, state.index, actions);
  }
  function commitActionPack(pack) {
    const result = upsertPack(deps.getSettings(), pack);
    if (!result.ok) throw new Error(`操作未生效，存在地址冲突：${conflictText(result.conflicts)}`);
    deps.updateSettings(result.settings);
  }
  function currentManagerBody() {
    return backdrop?.querySelector(".so-manager-body");
  }
  function runSpriteAction(action) {
    const report = (error) => {
      toast(currentManagerBody(), error instanceof Error ? error.message : "立绘操作失败");
      refreshLightbox();
    };
    try {
      const result = action.run();
      if (result instanceof Promise) void result.catch(report);
    } catch (error) {
      report(error);
    }
  }
  function pickReplacement(packId, getCurrentSprite) {
    const selected = getCurrentSprite();
    if (!selected) return;
    const identity = {
      tag: selected.tag,
      group: spriteGroup(selected),
      outfit: selected.outfit ?? ""
    };
    const latestTarget = () => {
      const pack = deps.getSettings().packs.find((candidate) => candidate.id === packId);
      const sprite = pack?.sprites.find(
        (candidate) => candidate.tag === identity.tag && spriteGroup(candidate) === identity.group && (candidate.outfit ?? "") === identity.outfit
      );
      return pack && sprite ? { pack, sprite } : null;
    };
    pickFile("image/*", false, async (files) => {
      try {
        const result = await compressImage(files[0]);
        const beforeSave = latestTarget();
        if (!beforeSave) return;
        const url = await deps.adapter.saveImage(
          `${beforeSave.sprite.tag}.webp`,
          result.dataUri,
          deps.adapter.getCurrentCharacterName() || beforeSave.pack.name
        );
        const target = latestTarget();
        if (!target) return;
        const base = {
          tag: target.sprite.tag,
          url,
          ...identity.group ? { group: identity.group } : {},
          ...identity.outfit ? { outfit: identity.outfit } : {},
          ...target.sprite.labels?.length ? { labels: target.sprite.labels } : {}
        };
        commitPack(upsertSprite(target.pack, base));
        const { autoUpload, imgbbApiKey } = deps.getSettings();
        if (autoUpload && imgbbApiKey.trim()) {
          try {
            const uploaded = await uploadToImgbb(imgbbApiKey, result.dataUri);
            if (isValidImgbbResult(uploaded)) {
              const latest = latestTarget();
              if (latest) {
                commitPack(upsertSprite(latest.pack, {
                  ...base,
                  code: uploaded.code,
                  remoteUrl: uploaded.url
                }));
                toast(currentManagerBody(), `已替换「${identity.tag}」并重传图床（${formatBytes(result.bytes)}）`);
                return;
              }
            }
            toast(currentManagerBody(), `已替换「${identity.tag}」，但图床响应无效，标记为待上传`);
          } catch {
            toast(currentManagerBody(), `已替换「${identity.tag}」，图床上传失败，标记为待上传`);
          }
        } else {
          toast(currentManagerBody(), `已替换「${identity.tag}」（${formatBytes(result.bytes)}），远程地址待上传`);
        }
      } catch (error) {
        toast(currentManagerBody(), error instanceof Error ? error.message : "替换失败");
      } finally {
        refreshLightbox();
      }
    });
  }
  function actionContext(packId, getSprite, closeAction) {
    const getPack = () => deps.getSettings().packs.find((candidate) => candidate.id === packId) ?? null;
    const context = {
      getPack,
      getSprite: () => {
        const pack = getPack();
        return pack ? getSprite(pack) : null;
      },
      commit: commitActionPack,
      pickReplacement: () => pickReplacement(packId, () => context.getSprite()),
      localize: async (source) => {
        const identity = {
          tag: source.tag,
          group: spriteGroup(source),
          outfit: source.outfit ?? ""
        };
        const localized = await localizeSprite(source, `${source.tag}.webp`, {
          fetch: window.fetch.bind(window),
          compress: compressImage,
          saveImage: (file, fileName) => deps.adapter.saveImageFile(
            file,
            fileName,
            deps.adapter.getCurrentCharacterName() || getPack()?.name || "shared"
          )
        });
        const pack = getPack();
        const latest = pack?.sprites.find(
          (candidate) => candidate.tag === identity.tag && spriteGroup(candidate) === identity.group && (candidate.outfit ?? "") === identity.outfit
        );
        if (!pack || !latest || latest.url !== source.url) {
          throw new Error("立绘在保存期间已发生变化，请重试");
        }
        commitActionPack(upsertSprite(pack, {
          ...latest,
          url: localized.url,
          remoteUrl: localized.remoteUrl
        }));
        context.refresh();
        toast(currentManagerBody(), `已将「${source.tag}」保存到本地`);
      },
      refresh: () => {
        render2();
        refreshLightbox();
      },
      close: closeAction
    };
    return context;
  }
  function lightboxActions(state) {
    const context = actionContext(
      state.packId,
      (pack) => pack.sprites[state.index] ?? null,
      () => {
        render2();
        state.controller?.close();
      }
    );
    return createSpriteActions(context).map((action) => ({
      ...action,
      run: () => runSpriteAction(action)
    }));
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
    const bar = el("div", "so-sprite-actions");
    const identity = {
      tag: sprite.tag,
      group: spriteGroup(sprite),
      outfit: sprite.outfit ?? ""
    };
    const context = actionContext(
      pack.id,
      (latest) => latest.sprites.find(
        (candidate) => candidate.tag === identity.tag && spriteGroup(candidate) === identity.group && (candidate.outfit ?? "") === identity.outfit
      ) ?? null,
      () => {
        render2();
        refreshLightbox();
      }
    );
    const sharedActions = createSpriteActions(context);
    for (const action of sharedActions) {
      bar.append(iconButton(
        action.icon ?? action.label,
        action.label,
        () => runSpriteAction(action),
        "so-icon-btn",
        Boolean(action.disabled)
      ));
    }
    bar.append(
      iconButton("◀", "前移", () => {
        const target = context.getPack();
        if (!target) return;
        commitPack(moveSprite(target, index, index - 1));
      }),
      iconButton("▶", "后移", () => {
        const target = context.getPack();
        if (!target) return;
        commitPack(moveSprite(target, index, index + 1));
      })
    );
    cell.append(bar);
    return cell;
  }
  function openUploadPreview(currentPackId, files) {
    const fileArr = Array.from(files);
    const parsed = fileArr.map((f) => parseSpriteFileName(f.name));
    let autoSplit = false;
    let strategy = "skip";
    let uploading = false;
    const modal = el("div", "so-upload-modal");
    const panel = el("div", "so-upload-panel");
    const head = el("div", "so-upload-head");
    const title2 = el("b");
    title2.textContent = `批量上传预览（${fileArr.length} 张）`;
    head.append(title2);
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
      checkboxRow("按文件名前缀自动拆分人名/服装（勾选后在下方预览拆分结果，可拆出新包）", autoSplit, (v) => {
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
      if (uploading) return;
      uploading = true;
      confirmBtn.setAttribute("aria-disabled", "true");
      confirmBtn.classList.add("disabled");
      const entries = fileArr.map((file, i) => ({
        fileName: file.name,
        role: autoSplit ? inputs[i].role.value : "",
        outfit: autoSplit ? inputs[i].outfit.value : "",
        tag: inputs[i].tag.value
      }));
      void applyUploadPlan(currentPackId, fileArr, entries, strategy, status, () => modal.remove()).finally(
        () => {
          uploading = false;
          confirmBtn.removeAttribute("aria-disabled");
          confirmBtn.classList.remove("disabled");
        }
      );
    });
    const cancelBtn = button(
      "取消",
      () => {
        if (!uploading) modal.remove();
      },
      "so-btn-danger"
    );
    actions.append(
      confirmBtn,
      cancelBtn
    );
    panel.append(head, opts, actions, status, rows);
    modal.append(panel);
    (backdrop ?? document.body).append(modal);
  }
  async function applyUploadPlan(currentPackId, files, entries, strategy, status, done) {
    const { autoUpload, imgbbApiKey } = deps.getSettings();
    const useImgbb = autoUpload && imgbbApiKey.trim() !== "";
    let added = 0;
    let conflicts = 0;
    let skipped = 0;
    let failed = 0;
    let unprocessed = 0;
    let hosted = 0;
    let hostFailed = 0;
    let opaqueImages = 0;
    let checkerboardImages = 0;
    const newPackIds = /* @__PURE__ */ new Map();
    function persisted(targetId, sprite) {
      return Boolean(
        deps.getSettings().packs.find((pack) => pack.id === targetId)?.sprites.some(
          (item) => item.tag === sprite.tag && item.url === sprite.url && item.code === sprite.code && item.remoteUrl === sprite.remoteUrl
        )
      );
    }
    function applyUploadSettings(result, wasPersisted) {
      if (!result.ok) {
        try {
          showConflicts(result.conflicts);
        } catch (error) {
          console.error("[sprite-overlay] 展示上传冲突失败", error);
        }
        return false;
      }
      try {
        deps.updateSettings(result.settings);
      } catch (error) {
        if (!wasPersisted()) throw error;
        console.warn("[sprite-overlay] 图片已保存，但后续界面刷新失败", error);
      }
      return true;
    }
    try {
      const current2 = deps.getSettings().packs.find((p) => p.id === currentPackId) ?? null;
      const plans = planUploads(entries, deps.getSettings().packs, strategy, current2?.name ?? "新包", current2);
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
          if (result.transparency === "opaque-checkerboard") checkerboardImages += 1;
          else if (result.transparency === "opaque") opaqueImages += 1;
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
              if (!applyUploadSettings(
                upsertPack(deps.getSettings(), np),
                () => deps.getSettings().packs.some((pack) => pack.id === np.id)
              )) {
                conflicts++;
                unprocessed = plans.length - i - 1;
                break;
              }
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
          if (!applyUploadSettings(
            upsertPack(deps.getSettings(), upsertSprite(target, sprite)),
            () => persisted(targetId, sprite)
          )) {
            conflicts++;
            unprocessed = plans.length - i - 1;
            break;
          }
          added++;
          if (useImgbb) {
            try {
              const up = await uploadToImgbb(imgbbApiKey, result.dataUri);
              if (isValidImgbbResult(up)) {
                const latest = deps.getSettings().packs.find((p) => p.id === targetId);
                if (latest) {
                  const hostedSprite = { tag: plan.finalTag, url, code: up.code, remoteUrl: up.url };
                  if (applyUploadSettings(
                    upsertPack(deps.getSettings(), upsertSprite(latest, hostedSprite)),
                    () => persisted(targetId, hostedSprite)
                  )) hosted++;
                  else hostFailed++;
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
    } catch (error) {
      console.error("[sprite-overlay] 上传批次失败", error);
      failed++;
      unprocessed = Math.max(0, files.length - added - conflicts - skipped - failed);
    } finally {
      try {
        done();
      } catch (error) {
        console.error("[sprite-overlay] 关闭上传窗口失败", error);
      }
      try {
        render2();
      } catch (error) {
        console.error("[sprite-overlay] 上传后刷新失败", error);
      }
      const parts = [
        `成功 ${added} 张`,
        `冲突 ${conflicts} 张`,
        `失败 ${failed} 张`,
        `未处理 ${unprocessed} 张`
      ];
      if (skipped > 0) parts.push(`跳过 ${skipped} 张（重名/无效）`);
      if (useImgbb) parts.push(`imgbb 成功 ${hosted}${hostFailed > 0 ? `、失败 ${hostFailed}` : ""}`);
      if (checkerboardImages > 0) {
        parts.push(`警告：${checkerboardImages} 张疑似把棋盘格烤进图片，插件无法安全自动去除`);
      }
      if (opaqueImages > 0) {
        parts.push(`提示：${opaqueImages} 张没有透明像素，作为立绘时会显示完整背景`);
      }
      try {
        toast(backdrop?.querySelector(".so-manager-body"), parts.join("，"));
      } catch (error) {
        console.error("[sprite-overlay] 展示上传结果失败", error);
      }
    }
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
    render2();
    toast(
      backdrop?.querySelector(".so-manager-body"),
      `补传完成：成功 ${ok} 张${fail > 0 ? `，失败 ${fail} 张（可再次点击重试）` : ""}`
    );
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    close();
  }
  return { open, close, destroy, refreshIfOpen };
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
function iconButton(icon, title2, onClick, className = "so-icon-btn", disabled = false) {
  const btn = el("div", className);
  btn.textContent = icon;
  btn.title = title2;
  btn.setAttribute("role", "button");
  btn.setAttribute("aria-label", title2);
  btn.setAttribute("aria-disabled", String(disabled));
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!disabled) onClick();
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
async function copyText(text3) {
  try {
    await navigator.clipboard.writeText(text3);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text3;
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
    return () => {
    };
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
  const version = false ? "" : ` v${"0.9.0"}（构建 ${"2026-08-18 23:07"}）`;
  hint.textContent = `酒馆里的事，掌柜的都管。立绘显示/轮播/Prompt 设置在手机「立绘」App；图包管理与图床设置在手机「图库」App。${version}`;
  content.append(hint);
  return () => wrapper.remove();
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
function hasInlineImageMarkup(text3) {
  return new RegExp(COMBINED_SOURCE, "i").test(text3);
}
function replaceInlineImages(text3, replacer) {
  const regex = new RegExp(COMBINED_SOURCE, "gi");
  return text3.replace(regex, (raw, ...groups) => {
    const code = (groups[1] ?? groups[3] ?? "").trim();
    if (!isValidImageCode(code)) return raw;
    const out = replacer({ raw, code });
    return out === null ? raw : out;
  });
}

// st-extension/src/apps/path-utils.ts
var FORBIDDEN_PATH_SEGMENTS = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
function parsePath(path) {
  const segments = path.split(".");
  return segments.some((segment) => segment.length === 0 || FORBIDDEN_PATH_SEGMENTS.has(segment)) ? null : segments;
}
function isSafePath(path) {
  return parsePath(path) !== null;
}
function getNested(obj, path) {
  const segments = parsePath(path);
  if (!segments) return void 0;
  let cur = obj;
  for (const seg of segments) {
    if (cur == null || typeof cur !== "object") return void 0;
    cur = cur[seg];
  }
  return cur;
}
function setNested(obj, path, value) {
  const segs = parsePath(path);
  if (!segs || segs.length === 0) return;
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
  const segs = parsePath(path);
  if (!segs || segs.length === 0) return;
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    if (cur == null || typeof cur !== "object") return;
    cur = cur[segs[i]];
  }
  if (cur != null && typeof cur === "object") delete cur[segs[segs.length - 1]];
}

// st-extension/src/apps/newvar/config.ts
var NEWVAR_APP_ID = "newvar";
var NEWVAR_CHANNEL = "newvar";
var NEWVAR_EXTRA_KEY = "st_stage_newvar";
function defaultNewvarData() {
  return {
    enabled: false,
    hideUpdateBlocks: true,
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
  if (typeof r.hideUpdateBlocks === "boolean") d.hideUpdateBlocks = r.hideUpdateBlocks;
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
  if (typeof r.key !== "string" || r.key.trim() === "" || !isSafePath(r.key.trim())) return null;
  const type = VAR_TYPES.includes(r.type) ? r.type : "string";
  const def = {
    key: r.key.trim(),
    type,
    default: r.default,
    description: typeof r.description === "string" ? r.description : ""
  };
  if (r.hidden === true) def.hidden = true;
  if (typeof r.updateRule === "string" && r.updateRule.trim() !== "") def.updateRule = r.updateRule;
  if (type === "number" && Array.isArray(r.range) && r.range.length === 2 && typeof r.range[0] === "number" && typeof r.range[1] === "number" && Number.isFinite(r.range[0]) && Number.isFinite(r.range[1]) && r.range[0] <= r.range[1]) {
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

// st-extension/src/message-postprocess.ts
var FP_ATTR = "data-so-fp";
var MARKER_CLASS = "so-processed-marker";
var snapshots = /* @__PURE__ */ new WeakMap();
var postprocessControllers = /* @__PURE__ */ new Set();
function updateBlockRanges(text3) {
  const pattern = /<UpdateVariable(?:\s[^>]*)?>[\s\S]*?<\/UpdateVariable\s*>/gi;
  return Array.from(text3.matchAll(pattern), (match) => ({
    start: match.index,
    end: match.index + match[0].length
  }));
}
function hasUpdateBlock(text3) {
  return updateBlockRanges(text3).length > 0;
}
function stripMarkdownFence(text3) {
  const match = /^\s*```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```\s*$/i.exec(text3);
  return match ? match[1] : null;
}
function visibleUpdateVariants(inner) {
  const withAnalysis = inner.replace(/<Analysis(?:\s[^>]*)?>/gi, "").replace(/<\/Analysis\s*>/gi, "");
  const withoutAnalysis = inner.replace(/<Analysis(?:\s[^>]*)?>[\s\S]*?<\/Analysis\s*>/gi, "");
  const variants = [withAnalysis, withoutAnalysis];
  const normalized = /* @__PURE__ */ new Set();
  for (const variant of variants) {
    const fenced = stripMarkdownFence(variant);
    for (const candidate of fenced === null ? [variant] : [variant, fenced]) {
      const value = normalizeWhitespace(candidate);
      if (value) normalized.add(value);
    }
  }
  return [...normalized];
}
function compactVisibleProjection(text3) {
  return text3.replace(/<(?:thinking|reasoning)(?:\s[^>]*)?>[\s\S]*?<\/(?:thinking|reasoning)\s*>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, "").replace(/```(?:json)?/gi, "").replace(/\s+/g, "");
}
function edgeAnchors(text3, edge) {
  const lengths = [48, 24, 12, 8, 6, 4];
  const anchors = [];
  for (const length of lengths) {
    if (text3.length < length) continue;
    const anchor = edge === "start" ? text3.slice(0, length) : text3.slice(-length);
    if (!anchors.includes(anchor)) anchors.push(anchor);
  }
  if (anchors.length === 0 && text3) anchors.push(text3);
  return anchors;
}
function rawContextMatches(rawPrefix, rawSuffix, visibleText, start, end) {
  const prefix = compactVisibleProjection(rawPrefix);
  const suffix = compactVisibleProjection(rawSuffix);
  const before = visibleText.slice(0, start).replace(/\s+/g, "");
  const after = visibleText.slice(end).replace(/\s+/g, "");
  const prefixMatches = !prefix || edgeAnchors(prefix, "end").some((anchor) => before.endsWith(anchor));
  const suffixMatches = !suffix || edgeAnchors(suffix, "start").some((anchor) => after.startsWith(anchor));
  return prefixMatches && suffixMatches;
}
function sanitizedUpdateRange(rawMessage, visibleText) {
  if (rawMessage === null) return null;
  const openings = rawMessage.match(/<UpdateVariable(?:\s[^>]*)?>/gi) ?? [];
  const closings = rawMessage.match(/<\/UpdateVariable\s*>/gi) ?? [];
  if (openings.length !== 1 || closings.length !== 1) return null;
  const block = /<UpdateVariable(?:\s[^>]*)?>([\s\S]*?)<\/UpdateVariable\s*>/i.exec(rawMessage);
  if (!block) return null;
  const visible = normalizeWhitespaceWithOffsets(visibleText);
  const rawStart = block.index;
  const rawEnd = rawStart + block[0].length;
  for (const candidate of visibleUpdateVariants(block[1])) {
    const matches = [];
    let from = 0;
    while (from <= visible.text.length - candidate.length) {
      const index = visible.text.indexOf(candidate, from);
      if (index < 0) break;
      matches.push(index);
      if (matches.length > 1) break;
      from = index + 1;
    }
    if (matches.length !== 1) continue;
    const startIndex = matches[0];
    const start = visible.starts[startIndex];
    const end = visible.ends[startIndex + candidate.length - 1];
    if (!rawContextMatches(rawMessage.slice(0, rawStart), rawMessage.slice(rawEnd), visibleText, start, end)) {
      continue;
    }
    return { start, end };
  }
  return null;
}
function normalizeWhitespace(text3) {
  return text3.replace(/\s+/g, " ").trim();
}
function normalizeWhitespaceWithOffsets(text3) {
  let normalized = "";
  const starts = [];
  const ends = [];
  let index = 0;
  while (index < text3.length) {
    const start = index;
    if (/\s/.test(text3[index])) {
      while (index < text3.length && /\s/.test(text3[index])) index += 1;
      normalized += " ";
    } else {
      index += 1;
      normalized += text3[start];
    }
    starts.push(start);
    ends.push(index);
  }
  let first = 0;
  let last = normalized.length;
  while (first < last && normalized[first] === " ") first += 1;
  while (last > first && normalized[last - 1] === " ") last -= 1;
  return {
    text: normalized.slice(first, last),
    starts: starts.slice(first, last),
    ends: ends.slice(first, last)
  };
}
function removeTextRanges(root, ranges) {
  if (ranges.length === 0) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let current2;
  while (current2 = walker.nextNode()) {
    const node = current2;
    const value = node.nodeValue ?? "";
    const nodeStart = offset;
    const nodeEnd = nodeStart + value.length;
    offset = nodeEnd;
    const cuts = ranges.filter((range) => range.start < nodeEnd && range.end > nodeStart).map((range) => ({
      start: Math.max(0, range.start - nodeStart),
      end: Math.min(value.length, range.end - nodeStart)
    }));
    if (cuts.length === 0) continue;
    let kept = "";
    let cursor = 0;
    for (const cut of cuts) {
      kept += value.slice(cursor, cut.start);
      cursor = Math.max(cursor, cut.end);
    }
    node.nodeValue = kept + value.slice(cursor);
  }
}
function mountMessagePostprocess(deps) {
  const st = window.SillyTavern;
  if (!st) return () => {
  };
  const ctx = st.getContext();
  const renderedEvents = [...new Set([
    ctx.eventTypes?.CHARACTER_MESSAGE_RENDERED,
    ctx.eventTypes?.USER_MESSAGE_RENDERED,
    ctx.eventTypes?.MESSAGE_UPDATED
  ].filter((e) => typeof e === "string" && e.length > 0))];
  let active = true;
  const pendingTimers = /* @__PURE__ */ new Set();
  if (deps.getRawMessage || deps.decorateImages || deps.cleanupImages || deps.processMessage || deps.reprocessMessages || deps.cleanupMessages) {
    postprocessControllers.add(deps);
  }
  const cleanup = (unsubscribe) => {
    if (!active) return;
    active = false;
    unsubscribe();
    for (const timer of pendingTimers) clearTimeout(timer);
    pendingTimers.clear();
    deps.cleanupImages?.();
    deps.cleanupMessages?.();
    postprocessControllers.delete(deps);
  };
  const processRendered = (messageId) => {
    let rawMessage = null;
    if (typeof messageId === "string" || typeof messageId === "number") {
      try {
        rawMessage = deps.getRawMessage?.(messageId) ?? null;
      } catch (error) {
        console.warn("[sprite-overlay] 读取原始消息失败，变量块仅按可见标签处理", error);
      }
    }
    processMessages(deps.getSettings(), messageId, rawMessage);
    const bodies = [];
    if (messageId === null || messageId === void 0 || `${messageId}` === "") {
      bodies.push(...Array.from(document.querySelectorAll("#chat .mes .mes_text")));
      for (const body of bodies) deps.processMessage?.(body);
      deps.decorateImages?.(document);
      return;
    }
    const id = `${messageId}`;
    for (const message of Array.from(document.querySelectorAll("#chat .mes"))) {
      if (message.getAttribute("mesid") !== id) continue;
      const body = message.querySelector(".mes_text");
      if (body) {
        bodies.push(body);
        deps.processMessage?.(body);
      }
      deps.decorateImages?.(message);
    }
  };
  const handler = (...args) => {
    const messageId = typeof args[0] === "number" || typeof args[0] === "string" ? args[0] : null;
    queueMicrotask(() => {
      if (active) processRendered(messageId);
    });
  };
  if (renderedEvents.length > 0) {
    for (const event of renderedEvents) ctx.eventSource.on(event, handler);
    return () => cleanup(() => {
      for (const event of renderedEvents) ctx.eventSource.removeListener(event, handler);
    });
  }
  const fallbackEvent = ctx.eventTypes?.MESSAGE_RECEIVED ?? "message_received";
  const fallbackHandler = (...args) => {
    const messageId = typeof args[0] === "number" || typeof args[0] === "string" ? args[0] : null;
    const timer = setTimeout(() => {
      pendingTimers.delete(timer);
      if (active) processRendered(messageId);
    }, 150);
    pendingTimers.add(timer);
  };
  ctx.eventSource.on(fallbackEvent, fallbackHandler);
  return () => cleanup(() => ctx.eventSource.removeListener(fallbackEvent, fallbackHandler));
}
function anyFeatureOn(settings) {
  const spritesOn = settings.enabled && (settings.hideTagInMessage || settings.renderInlineImages || settings.spriteDisplayMode !== "overlay");
  const newvar = normalizeNewvarData(settings.apps[NEWVAR_APP_ID]);
  return spritesOn || newvar.enabled && newvar.hideUpdateBlocks;
}
function clampFloors(settings) {
  const n = Math.round(settings.recentFloors);
  if (!Number.isFinite(n)) return RECENT_FLOORS_MIN;
  return Math.min(RECENT_FLOORS_MAX, Math.max(RECENT_FLOORS_MIN, n));
}
function originalTextOf(el3) {
  return snapshots.get(el3)?.originalText ?? el3.textContent ?? "";
}
function collectCandidates(extraCandidates = /* @__PURE__ */ new Set()) {
  const out = [];
  for (const mes of Array.from(document.querySelectorAll("#chat .mes"))) {
    if (mes.getAttribute("is_user") === "true" || mes.getAttribute("is_system") === "true") continue;
    const textEl = mes.querySelector(".mes_text");
    if (!textEl) continue;
    const text3 = originalTextOf(textEl);
    if (hasTag(text3) || hasInlineImageMarkup(text3) || hasUpdateBlock(text3) || extraCandidates.has(textEl)) {
      out.push(textEl);
    }
  }
  return out;
}
function processMessages(settings, messageId = null, rawMessage = null) {
  if (!anyFeatureOn(settings)) return;
  if (messageId !== null && messageId !== void 0 && `${messageId}` !== "") {
    const idStr = `${messageId}`;
    const allMes = Array.from(document.querySelectorAll("#chat .mes"));
    const scope = allMes.filter((m) => m.getAttribute("mesid") === idStr).map((m) => m.querySelector(".mes_text")).filter((el3) => el3 !== null);
    const lastMes = allMes.length > 0 ? allMes[allMes.length - 1] : null;
    let windowSet = null;
    for (const el3 of scope) {
      if (lastMes !== null && el3.closest(".mes") === lastMes) {
        processMessageElement(el3, settings, rawMessage);
        continue;
      }
      const rawCandidate = rawMessage !== null && sanitizedUpdateRange(rawMessage, originalTextOf(el3)) !== null ? /* @__PURE__ */ new Set([el3]) : void 0;
      windowSet ?? (windowSet = new Set(collectCandidates(rawCandidate).slice(-clampFloors(settings))));
      if (windowSet.has(el3)) processMessageElement(el3, settings, rawMessage);
    }
    return;
  }
  for (const el3 of collectCandidates().slice(-clampFloors(settings))) {
    processMessageElement(el3, settings);
  }
}
function reprocessAllMessages(settings) {
  restoreAllMessages();
  if (anyFeatureOn(settings)) {
    const rawGetters = [...postprocessControllers].map((controller) => controller.getRawMessage).filter((getter) => getter !== void 0);
    if (rawGetters.length === 0) {
      processMessages(settings);
    } else {
      for (const message of Array.from(document.querySelectorAll("#chat .mes"))) {
        const messageId = message.getAttribute("mesid");
        if (messageId === null) continue;
        let rawMessage = null;
        for (const getter of rawGetters) {
          try {
            rawMessage = getter(messageId);
          } catch (error) {
            console.warn("[sprite-overlay] 读取原始消息失败，变量块仅按可见标签处理", error);
          }
          if (rawMessage !== null) break;
        }
        processMessages(settings, messageId, rawMessage);
      }
    }
  }
  for (const controller of postprocessControllers) {
    controller.reprocessMessages?.();
    controller.decorateImages?.(document);
  }
}
function restoreAllMessages() {
  for (const controller of postprocessControllers) controller.cleanupImages?.();
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
function hashText(text3) {
  let h = 5381;
  for (let i = 0; i < text3.length; i++) {
    h = (h << 5) + h + text3.charCodeAt(i) | 0;
  }
  return (h >>> 0).toString(36);
}
function processMessageElement(root, settings, rawMessage = null) {
  const inlineSprites = settings.spriteDisplayMode !== "overlay";
  const host = settings.imageHost.endsWith("/") ? settings.imageHost : `${settings.imageHost}/`;
  const newvar = normalizeNewvarData(settings.apps[NEWVAR_APP_ID]);
  const hideUpdateBlocks = newvar.enabled && newvar.hideUpdateBlocks;
  const snap = snapshots.get(root);
  const contentIsOurs = snap !== void 0 && root.querySelector(`.${MARKER_CLASS}`) !== null;
  const originalText = contentIsOurs ? snap.originalText : root.textContent ?? "";
  const fingerprint = `${settings.hideTagInMessage ? "T" : ""}${settings.renderInlineImages ? "I" : ""}${inlineSprites ? "S" : ""}${hideUpdateBlocks ? "V" : ""}|${hashText(host)}|${hashText(originalText)}|${rawMessage === null ? "" : hashText(rawMessage)}`;
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
  const literalUpdateRanges = hideUpdateBlocks ? updateBlockRanges(freshText) : [];
  const sanitizedRange = hideUpdateBlocks && literalUpdateRanges.length === 0 ? sanitizedUpdateRange(rawMessage, freshText) : null;
  const updateRanges = sanitizedRange ? [sanitizedRange] : literalUpdateRanges;
  const tagged = hasTag(freshText);
  const needsWork = settings.hideTagInMessage && tagged || inlineSprites && hasPacks && tagged || settings.renderInlineImages && hasInlineImageMarkup(freshText) || updateRanges.length > 0;
  if (!needsWork) return;
  snapshots.set(root, {
    nodes: Array.from(root.childNodes).map((n) => n.cloneNode(true)),
    originalText: freshText
  });
  if (hideUpdateBlocks) removeTextRanges(root, updateRanges);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let current2;
  while (current2 = walker.nextNode()) {
    textNodes.push(current2);
  }
  for (const textNode of textNodes) {
    const text3 = textNode.nodeValue ?? "";
    if (!text3) continue;
    const nodeTagged = hasTag(text3);
    const needsSprites = inlineSprites && hasPacks && nodeTagged;
    const needsStrip = settings.hideTagInMessage && nodeTagged && !needsSprites;
    const needsImages = settings.renderInlineImages && hasInlineImageMarkup(text3);
    if (!needsSprites && !needsStrip && !needsImages) continue;
    let processed = needsStrip ? stripTags(text3) : text3;
    const elements = [];
    const marker = (el3) => `\0${elements.push(el3) - 1}\0`;
    if (needsSprites && hasPacks) {
      processed = replaceTags(processed, (address, raw) => {
        const sprite = resolveSprite(packs, address);
        if (!sprite) return settings.hideTagInMessage ? "" : null;
        const image = createImage(sprite.url, sprite.tag, "so-inline-sprite");
        const imageMarker = marker(image);
        return settings.hideTagInMessage ? imageMarker : `${raw}${imageMarker}`;
      });
    }
    if (needsImages) {
      processed = replaceInlineImages(processed, (m) => marker(createImage(host + m.code, m.code)));
    }
    if (elements.length === 0) {
      if (processed !== text3) textNode.nodeValue = processed;
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

// st-extension/src/story-image-capture.ts
var ACTION_CLASS = "so-story-save-action";
function createStoryImageCapture(deps) {
  const decorations = /* @__PURE__ */ new Map();
  const release = (action, image, handler) => {
    action.removeEventListener("click", handler);
    action.remove();
    delete image.dataset.soStorySave;
    decorations.delete(action);
  };
  const pruneDetached = () => {
    for (const [action, { image, handler }] of decorations) {
      if (!action.isConnected || !image.isConnected) release(action, image, handler);
    }
  };
  const decorate = (root) => {
    pruneDetached();
    for (const image of Array.from(root.querySelectorAll("img"))) {
      if (!isEligible(image) || image.dataset.soStorySave === "true") continue;
      const action = document.createElement("button");
      action.type = "button";
      action.className = ACTION_CLASS;
      action.textContent = "保存到图库";
      const handler = () => {
        void archive(image, action, deps);
      };
      action.addEventListener("click", handler);
      image.dataset.soStorySave = "true";
      image.after(action);
      decorations.set(action, { image, handler });
    }
  };
  const cleanup = () => {
    for (const [action, { image, handler }] of decorations) {
      release(action, image, handler);
    }
  };
  return { decorate, cleanup };
}
async function archive(image, action, deps) {
  if (action.disabled) return;
  const url = image.currentSrc || image.src;
  const tag = normalizeTag(image.alt || image.title);
  const source = { tag, url };
  const story = deps.getStoryContext();
  action.disabled = true;
  action.textContent = "保存中…";
  try {
    let stored = source;
    let remoteOnly = false;
    if (getSpriteSource(source) === "hosted") {
      try {
        stored = await deps.localize(source, `${tag || "generated-image"}.webp`, story);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "未知错误";
        const keepRemote = window.confirm(
          `图片无法保存到本地：${detail}

是否仅保留远程引用？对方网站失效后图片也会失效。`
        );
        if (!keepRemote) {
          action.disabled = false;
          action.textContent = "保存到图库";
          return;
        }
        stored = { ...source, remoteUrl: source.url };
        remoteOnly = true;
      }
    }
    const next = upsertStorySprite(deps.getSettings(), story, stored);
    deps.updateSettings(next);
    action.textContent = remoteOnly ? "已保存远程引用" : "已保存";
  } catch (error) {
    action.disabled = false;
    action.textContent = error instanceof Error ? "保存失败，重试" : "保存失败";
  }
}
function isEligible(image) {
  const messageBody = image.closest(".mes_text");
  const message = messageBody?.closest(".mes");
  if (!message || message.getAttribute("is_user") === "true" || message.getAttribute("is_system") === "true") {
    return false;
  }
  if (image.closest('.avatar, .mesAvatar, .emoji, .so-inline-sprite, .st-stage-renderer, [class*="so-renderer-"]')) {
    return false;
  }
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  return !(width > 0 && height > 0 && (width < 64 || height < 64));
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
function rangeRow(label, value, min, max, onInput, onCommit, format = String) {
  const row = el2("label", "so-app-toggle so-app-range");
  const span = document.createElement("span");
  span.textContent = label;
  const controls = el2("span", "so-app-range-controls");
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = "1";
  input.value = String(Math.min(max, Math.max(min, Math.round(value))));
  const output = document.createElement("output");
  const read = () => {
    const parsed = Math.round(Number(input.value));
    const clamped = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min;
    input.value = String(clamped);
    output.value = format(clamped);
    output.textContent = output.value;
    return clamped;
  };
  read();
  input.addEventListener("input", () => onInput(read()));
  input.addEventListener("change", () => onCommit(read()));
  controls.append(input, output);
  row.append(span, controls);
  return row;
}
var foldOpenState = /* @__PURE__ */ new Map();
function foldSection(title2, open = false, key = "") {
  const box = document.createElement("details");
  box.className = "so-app-section so-app-fold";
  box.open = key ? foldOpenState.get(key) ?? open : open;
  if (key) box.addEventListener("toggle", () => foldOpenState.set(key, box.open));
  const summary = document.createElement("summary");
  summary.className = "so-app-title";
  summary.textContent = title2;
  const body = el2("div", "so-app-fold-body");
  box.append(summary, body);
  return { box, body };
}
function textareaRow(label, value, placeholder, onCommit) {
  const wrap = el2("div", "so-app-field");
  const title2 = el2("div", "so-app-title");
  title2.textContent = label;
  const input = document.createElement("textarea");
  input.className = "text_pole so-app-input";
  input.rows = 5;
  input.value = value;
  input.placeholder = placeholder;
  input.addEventListener("change", () => onCommit(input.value));
  wrap.append(title2, input);
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
  const title2 = el2("div", "so-app-title");
  title2.textContent = label;
  const input = document.createElement("input");
  input.type = type;
  input.className = "text_pole so-app-input";
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = "off";
  input.addEventListener("change", () => onCommit(input.value));
  wrap.append(title2, input);
  return wrap;
}

// st-extension/src/apps/sprite-app.ts
function spriteApp(deps = {}) {
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
      const title2 = el2("div", "so-app-title");
      title2.textContent = characterName ? `当前角色：${characterName}` : "尚未打开角色聊天";
      const detail = el2("div", "so-app-desc");
      detail.textContent = settings.enabled ? pack ? packs.length > 1 ? `立绘功能运行中 — 已启用 ${packs.length} 个包（${packs.reduce((n, p) => n + p.sprites.length, 0)} 张）` : `立绘功能运行中 — 已绑定「${pack.name}」（${pack.sprites.length} 张）` : "立绘功能已开启，但当前角色未绑定立绘包（到「图库」绑定）" : "立绘功能已关闭：不注入 Prompt、不解析标签，旧楼层已恢复原文";
      stateSection.append(
        title2,
        toggleRow(
          "启用立绘功能",
          settings.enabled,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), enabled: v })
        ),
        detail
      );
      const displaySection = foldSection("显示", false, "sprites:display");
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
        rangeRow(
          "悬浮窗立绘不透明度（%）",
          settings.spriteOpacity,
          SPRITE_OPACITY_MIN,
          SPRITE_OPACITY_MAX,
          (v) => deps.previewOpacity?.(v),
          (v) => ctx.updateSettings({ ...ctx.getSettings(), spriteOpacity: v }),
          (v) => `${v}%`
        ),
        toggleRow(
          "隐藏 [立绘:xxx] 标签",
          settings.hideTagInMessage,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), hideTagInMessage: v })
        ),
        hintField(
          toggleRow(
            "解析 <img>编码</img> 插图标签",
            settings.renderInlineImages,
            (v) => ctx.updateSettings({ ...ctx.getSettings(), renderInlineImages: v })
          ),
          "把 AI 正文中的 <img>文件编码</img> 按图床前缀渲染为剧情插图。它与 [立绘:图名] 的悬浮窗/楼层显示位置互相独立。"
        ),
        toggleRow(
          "同角色图包折叠",
          settings.galleryFoldByRole,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), galleryFoldByRole: v })
        )
      );
      const displayHint = el2("div", "so-app-desc");
      displayHint.textContent = "「仅楼层」把 [立绘:xxx] 原位替换为图片且不弹悬浮窗；楼层数限制加载聊天时补渲染的范围（新回复不受限）。不透明度只调悬浮窗，楼层立绘始终清晰显示。";
      displaySection.body.append(displayHint);
      const autoSection = foldSection("多立绘轮播", false, "sprites:auto");
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
      const promptSection = foldSection("Prompt", false, "sprites:prompt");
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
            { value: "repeat", label: "自动精简（默认：重合图名列一次）" },
            { value: "full", label: "全量（枚举全部地址）" }
          ],
          (v) => ctx.updateSettings({
            ...ctx.getSettings(),
            multiRolePromptMode: v === "full" ? "full" : "repeat"
          })
        ),
        numberRow(
          "Prompt 预算（字符，0=不限）",
          settings.promptBudget,
          PROMPT_BUDGET_MIN,
          PROMPT_BUDGET_MAX,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), promptBudget: v })
        )
      );
      const budgeted = buildActiveSpritePrompt(settings, characterName);
      const unlimited = settings.promptBudget > 0 ? buildActiveSpritePrompt(settings, characterName, 0) : budgeted;
      const budgetHint = el2("div", "so-app-desc");
      budgetHint.textContent = budgeted ? `预计注入 ${budgeted.length} 字符` + (budgeted.length < unlimited.length ? `（超预算，已从 ${unlimited.length} 字符每场景均衡截取，保留排前的图名）` : "") : "预计注入：无（当前角色没有可用立绘地址）";
      promptSection.body.append(budgetHint);
      const promptHint = el2("div", "so-app-desc");
      promptHint.textContent = "同角色多服装时，默认服装可写 [立绘:图名]，其他服装写 [立绘:服装/图名]；完整三级地址仍兼容。自动精简会抽取基础图名池和服装增量；适合相对地址时优先使用角色级格式（只要比全量短），否则在旧场景压缩和全量格式中取更短者。";
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
        appButton("填入内置底稿（未修改时仍自动精简）", () => {
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
      const section2 = el2("div", "so-app-section");
      const desc = el2("div", "so-app-desc");
      desc.textContent = "立绘包管理：新建/上传/导入导出/分享串/角色绑定。";
      section2.append(desc, appButton("打开立绘包管理", () => deps.openManager()));
      container.append(section2);
      const list = el2("div", "so-app-section");
      const title2 = el2("div", "so-app-title");
      title2.textContent = `共 ${settings.packs.length} 个立绘包`;
      list.append(title2);
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

// st-extension/src/apps/butler/actions.ts
function errorText(error) {
  return error instanceof Error && error.message ? error.message : "未知错误";
}
function equalJson(left, right) {
  if (left === right) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}
function cloneActions(actions) {
  return actions.map((action) => ({ ...action }));
}
async function applyTransaction(inputActions, bridge, baselineMeasurementId) {
  const actions = cloneActions(inputActions);
  const group = actions[0]?.group ?? "performanceSettings";
  if (actions.some((action) => action.group !== group)) throw new Error("事务内动作必须属于同一分组");
  const current2 = await bridge.readGroup(group);
  const before = {};
  const requested = {};
  for (const action of actions) {
    const actualBefore = current2[action.field];
    if (actualBefore !== void 0) action.before = actualBefore;
    before[action.field] = action.before;
    requested[action.field] = action.requested;
  }
  const transaction = {
    id: bridge.createId(),
    group,
    createdAt: bridge.now(),
    status: "applying",
    restoreStatus: "available",
    ...baselineMeasurementId ? { baselineMeasurementId } : {},
    before,
    requested,
    actual: { ...before },
    actions
  };
  await bridge.persistTransaction(transaction);
  for (const action of actions) {
    if (action.status === "unchanged" || equalJson(action.before, action.requested)) {
      action.status = "unchanged";
      action.actual = action.before;
      transaction.actual[action.field] = action.before;
      continue;
    }
    try {
      await bridge.writeGroup(group, { [action.field]: action.requested });
      const reread = await bridge.readGroup(group);
      action.actual = reread[action.field] ?? null;
      transaction.actual[action.field] = action.actual;
      if (equalJson(action.actual, action.requested)) {
        action.status = "applied";
      } else {
        action.status = "failed";
        action.error = "SillyTavern 实际值与请求值不一致";
      }
    } catch (error) {
      action.status = "failed";
      action.error = errorText(error);
      const reread = await bridge.readGroup(group);
      action.actual = reread[action.field] ?? null;
      transaction.actual[action.field] = action.actual;
    }
  }
  const changed = actions.filter((action) => action.status !== "unchanged");
  const applied = changed.filter((action) => action.status === "applied").length;
  const failed = changed.filter((action) => action.status === "failed").length;
  transaction.status = failed === 0 ? "applied" : applied > 0 ? "partial" : "failed";
  transaction.completedAt = bridge.now();
  transaction.actual = { ...await bridge.readGroup(group) };
  await bridge.persistTransaction(transaction);
  return transaction;
}
async function restoreTransaction(source, bridge, confirmedConflictFields = []) {
  const transaction = {
    ...source,
    before: { ...source.before },
    requested: { ...source.requested },
    actual: { ...source.actual },
    actions: cloneActions(source.actions),
    restoreStatus: "restoring"
  };
  await bridge.persistTransaction(transaction);
  const current2 = await bridge.readGroup(transaction.group);
  const confirmed = new Set(confirmedConflictFields);
  const conflicts = [];
  const fieldsToRestore = [];
  for (const [field, before] of Object.entries(transaction.before)) {
    const after = transaction.actual[field] ?? transaction.requested[field];
    const value = current2[field];
    if (equalJson(value, before)) continue;
    if (!equalJson(value, after) && !confirmed.has(field)) {
      conflicts.push({ field, before, after, current: value });
      continue;
    }
    fieldsToRestore.push([field, before]);
  }
  if (conflicts.length > 0) {
    transaction.restoreStatus = "conflict";
    await bridge.persistTransaction(transaction);
    return { transaction, conflicts };
  }
  try {
    for (const [field, before] of fieldsToRestore) {
      await bridge.writeGroup(transaction.group, { [field]: before });
    }
    const restored = await bridge.readGroup(transaction.group);
    const failedFields = Object.entries(transaction.before).filter(([field, before]) => !equalJson(restored[field], before));
    if (failedFields.length > 0) {
      transaction.restoreStatus = "conflict";
      transaction.error = `恢复后 ${failedFields.map(([field]) => field).join("、")} 未回到原值`;
    } else {
      transaction.status = "restored";
      transaction.restoreStatus = "restored";
      transaction.completedAt = bridge.now();
      delete transaction.error;
    }
  } catch (error) {
    transaction.restoreStatus = "conflict";
    transaction.error = `恢复失败：${errorText(error)}`;
  }
  await bridge.persistTransaction(transaction);
  return { transaction, conflicts: [] };
}
function capabilitySignature(snapshot) {
  return [...snapshot.capabilities].map((capability) => `${capability.id}:${capability.available ? "1" : "0"}`).sort().join("|");
}
function flattenNumbers(value, prefix = "", output = {}) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (prefix) output[prefix] = value;
    return output;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return output;
  for (const [key, child] of Object.entries(value)) {
    flattenNumbers(child, prefix ? `${prefix}.${key}` : key, output);
  }
  return output;
}
function compareMeasurements(before, after) {
  const reasons = [];
  if (before.invalidReason || after.invalidReason) reasons.push("检查无效");
  if (!before.chatKey || !after.chatKey || before.chatKey !== after.chatKey) reasons.push("聊天不同");
  if (before.probe !== after.probe) reasons.push("检查方式不同");
  if (!before.foreground || !after.foreground || before.foreground !== after.foreground) reasons.push("页面状态不同");
  if (before.durationMs !== after.durationMs || before.durationMs !== 6e3) reasons.push("检查时长不同");
  if (capabilitySignature(before) !== capabilitySignature(after)) reasons.push("可读取的数据不同");
  const deltas = {};
  if (reasons.length === 0) {
    const beforeNumbers = flattenNumbers(before.metrics);
    const afterNumbers = flattenNumbers(after.metrics);
    for (const [key, beforeValue] of Object.entries(beforeNumbers)) {
      const afterValue = afterNumbers[key];
      if (afterValue !== void 0) deltas[key] = afterValue - beforeValue;
    }
  }
  return {
    comparable: reasons.length === 0,
    reasons,
    before: before.metrics,
    after: after.metrics,
    deltas
  };
}

// st-extension/src/apps/butler/diagnosis.ts
function finding(input) {
  return {
    id: input.id,
    layer: input.layer,
    evidence: input.evidence,
    severity: input.severity,
    confidence: input.confidence,
    ...input.actionId ? { actionId: input.actionId } : {},
    explanation: {
      ...input.explanation,
      result: input.explanation.result ?? "尚未应用，等待再次检查。"
    }
  };
}
function planAction(id, label, field, before, requested, reloadRequired = false) {
  return {
    id,
    group: "performanceSettings",
    label,
    field,
    before,
    requested,
    status: before === requested ? "unchanged" : "planned",
    reloadRequired
  };
}
function buildSafePlan(current2, deviceClass) {
  const messageLimit = deviceClass === "mobile" ? 20 : 50;
  const nextMessages = current2.chat_truncation === 0 ? messageLimit : Math.min(current2.chat_truncation, messageLimit);
  const candidates = [
    planAction("perf-fast-ui", "关闭背景模糊", "fast_ui_mode", current2.fast_ui_mode, true),
    planAction("perf-reduced-motion", "开启减少动画", "reduced_motion", current2.reduced_motion, true, true),
    planAction("perf-no-shadows", "关闭阴影", "noShadows", current2.noShadows, true),
    planAction("perf-smooth-streaming", "关闭平滑文字更新", "smooth_streaming", current2.smooth_streaming, false),
    planAction("perf-stream-fade", "关闭文字淡入", "stream_fade_in", current2.stream_fade_in, false),
    planAction(
      "perf-streaming-fps",
      "降低流式更新频率",
      "streaming_fps",
      current2.streaming_fps,
      Math.min(current2.streaming_fps, 15)
    ),
    planAction(
      "perf-chat-truncation",
      "减少同时显示的消息",
      "chat_truncation",
      current2.chat_truncation,
      nextMessages,
      true
    )
  ];
  return {
    deviceClass,
    actions: candidates.filter((action) => action.status === "planned"),
    unchanged: candidates.filter((action) => action.status === "unchanged")
  };
}
function settingFinding(id, actionId, detected, change, reason, impact, reload) {
  return finding({
    id,
    layer: "pageRendering",
    evidence: { detected },
    severity: "suggestion",
    confidence: "setting",
    actionId,
    explanation: {
      detected,
      change,
      reason,
      impact,
      reload,
      restore: "可以点“恢复本次性能设置”回到修改前。"
    }
  });
}
function numberRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}
function resourceGroups(snapshot) {
  const resources = numberRecord(snapshot.metrics.resources);
  return Array.isArray(resources?.groups) ? resources.groups.filter((item) => typeof item === "object" && item !== null && !Array.isArray(item)) : [];
}
function unavailableCapabilities(capabilities) {
  return capabilities.filter(
    (capability) => !capability.available
  );
}
function capabilityAvailable(snapshot, id) {
  return snapshot.capabilities.some((capability) => capability.id === id && capability.available);
}
function diagnose(snapshot, current2) {
  const findings = [];
  if (current2) {
    if (!current2.fast_ui_mode) findings.push(settingFinding(
      "setting-no-blur",
      "perf-fast-ui",
      "背景模糊当前开启。",
      "关闭背景模糊。",
      "背景模糊会增加页面绘制工作。",
      "界面毛玻璃效果会减少，不改变模型回复内容。",
      "通常立即生效；部分界面在刷新后完全更新。"
    ));
    if (!current2.reduced_motion) findings.push(settingFinding(
      "setting-reduced-motion",
      "perf-reduced-motion",
      "动画效果当前较多。",
      "减少动画效果。",
      "减少持续过渡和动画更新可降低主线程与合成工作。",
      "界面过渡会更直接，不改变模型回复内容。",
      "刷新页面后完全生效。"
    ));
    if (!current2.noShadows) findings.push(settingFinding(
      "setting-no-shadows",
      "perf-no-shadows",
      "阴影效果当前开启。",
      "关闭阴影效果。",
      "减少阴影绘制可降低重绘成本。",
      "界面层次感会减弱，不改变模型回复内容。",
      "通常立即生效。"
    ));
    if (current2.smooth_streaming) findings.push(settingFinding(
      "setting-smooth-streaming",
      "perf-smooth-streaming",
      "平滑文字更新当前开启。",
      "关闭平滑文字更新。",
      "减少生成期间持续的文字动画与重绘。",
      "文字会更直接地更新，不改变模型输出内容。",
      "立即影响后续流式回复。"
    ));
    if (current2.stream_fade_in) findings.push(settingFinding(
      "setting-stream-fade",
      "perf-stream-fade",
      "文字淡入当前开启。",
      "关闭文字淡入。",
      "减少每批新文字的视觉动画。",
      "新文字不再淡入，不改变模型输出内容。",
      "立即影响后续流式回复。"
    ));
    if (current2.streaming_fps > 15) findings.push(settingFinding(
      "setting-streaming-fps",
      "perf-streaming-fps",
      `流式更新频率为 ${current2.streaming_fps}，高于安全建议上限 15。`,
      "降低到 15；已有更低值不会调高。",
      "减少生成期间 UI 更新频率。",
      "流式动画细腻度会降低，不改变回复内容。",
      "立即影响后续流式回复。"
    ));
    const limit = snapshot.environment.mobile.available ? snapshot.environment.mobile.value ? 20 : 50 : null;
    if (limit !== null && (current2.chat_truncation === 0 || current2.chat_truncation > limit)) findings.push(settingFinding(
      "setting-chat-truncation",
      "perf-chat-truncation",
      current2.chat_truncation === 0 ? "同时显示的消息数为 0，会把当前聊天全部放入页面。" : `同时显示的消息数为 ${current2.chat_truncation}，高于当前设备建议上限 ${limit}。`,
      `限制到 ${limit}；已有更低的非零值不会调高。`,
      "减少同时渲染的历史消息与页面节点。",
      "上翻时仍可继续加载历史消息，不会删除聊天数据。",
      "需要重载当前聊天。"
    ));
  }
  const dynamic = numberRecord(snapshot.metrics.dynamic);
  const longestTask = typeof dynamic?.longestTaskMs === "number" ? dynamic.longestTaskMs : 0;
  const longTaskCount = typeof dynamic?.longTaskCount === "number" ? dynamic.longTaskCount : 0;
  if (capabilityAvailable(snapshot, "longTasks") && longTaskCount > 0 && longestTask >= 50) findings.push(finding({
    id: "measured-long-tasks",
    layer: "pageRendering",
    evidence: { longTaskCount, longestTaskMs: longestTask },
    severity: longestTask >= 100 ? "risk" : "suggestion",
    confidence: "measurement",
    explanation: {
      detected: `6 秒检查中发现 ${longTaskCount} 次页面长时间占用，最长 ${longestTask}ms。`,
      change: "先应用安全显示建议，再次检查；若仍存在，再临时关闭扩展做对比。",
      reason: "页面连续忙碌超过 50ms，可能让点击和绘制变慢。",
      impact: "该指标属于整个页面，不能单独归因到某个扩展。",
      reload: "显示设置按各项说明生效；临时关闭扩展需要刷新。",
      restore: "显示设置和扩展排查都保留独立的恢复入口。"
    }
  }));
  const extensionResources = resourceGroups(snapshot).filter((group) => typeof group.key === "string" && group.key.startsWith("extension:"));
  if (capabilityAvailable(snapshot, "resourceTiming") && extensionResources.length > 0) findings.push(finding({
    id: "extension-resource-evidence",
    layer: "extensions",
    evidence: { groups: extensionResources },
    severity: "info",
    confidence: "correlation",
    explanation: {
      detected: `记录到 ${extensionResources.length} 个扩展的加载资源。`,
      change: "只把这些扩展列为“临时关闭扩展找卡顿”的对比对象，不会自动关闭。",
      reason: "下载或加载记录只能提供线索，不能据此判断某个扩展持续占用处理器或内存。",
      impact: "临时关闭扩展可能影响对应功能，必须由用户自己选择。",
      reload: "扩展启停需要刷新后才真正改变加载状态。",
      restore: "扩展排查会保留最初的禁用清单，可以全部恢复。"
    }
  }));
  const page = numberRecord(snapshot.metrics.page);
  if (page && capabilityAvailable(snapshot, "pageSummary")) findings.push(finding({
    id: "evidence-page-dom",
    layer: "pageRendering",
    evidence: page,
    severity: "info",
    confidence: "measurement",
    explanation: {
      detected: "已记录当前聊天消息数、已渲染楼层和 DOM 节点摘要。",
      change: "仅作为环境证据，不因数量本身自动修改设置。",
      reason: "相同数量在不同设备和内容结构上的开销差异很大。",
      impact: "无自动变更。",
      reload: "不需要。",
      restore: "没有修改，无需恢复。"
    }
  }));
  const media = numberRecord(snapshot.metrics.media);
  if (media && capabilityAvailable(snapshot, "mediaDom")) findings.push(finding({
    id: "evidence-media",
    layer: "mediaResourcesStorage",
    evidence: media,
    severity: "info",
    confidence: "measurement",
    explanation: {
      detected: "已记录页面媒体元素及可见/离屏摘要。",
      change: "仅作为环境证据，不自动暂停媒体或控制 GIF。",
      reason: "元素数量不能直接代表解码、显存或播放成本。",
      impact: "无自动变更。",
      reload: "不需要。",
      restore: "没有修改，无需恢复。"
    }
  }));
  const unavailable2 = unavailableCapabilities(snapshot.capabilities);
  if (unavailable2.length > 0) findings.push(finding({
    id: "capability-unavailable",
    layer: "mediaResourcesStorage",
    evidence: { capabilities: unavailable2.map((item) => ({ id: item.id, reason: item.reason })) },
    severity: "info",
    confidence: "correlation",
    explanation: {
      detected: `${unavailable2.length} 项浏览器或 ST 指标在当前环境不可用。`,
      change: "保留缺失原因，不生成估算值。",
      reason: "不同浏览器和 ST 版本公开的能力不同。",
      impact: "报告信息会减少，但不会影响其他可用指标。",
      reload: "通常不需要。",
      restore: "没有修改，无需恢复。"
    }
  }));
  return findings;
}

// st-extension/src/apps/butler/experiments.ts
var BACKUP_STORAGE_KEY = "st-stage:butler:extension-recovery:v1";
function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}
function isSelf(name) {
  return name === "st-stage" || name === "third-party/st-stage";
}
function isSystem(item) {
  return item.type.toLowerCase() === "system";
}
function trialForCandidates(kind, candidates) {
  if (kind === "selectedExtensions") return [...candidates];
  return candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 2)));
}
function defaultExperimentCandidates(inventory) {
  return inventory.extensions.filter((item) => item.configuredEnabled && !item.isSelf && !isSelf(item.name) && !isSystem(item)).map((item) => item.name);
}
function dependencyWarnings(inventory, selectedNames) {
  const selected = new Set(selectedNames);
  const warnings = [];
  for (const dependent of inventory.extensions) {
    if (!dependent.configuredEnabled || selected.has(dependent.name)) continue;
    if (dependent.manifest?.dependencies.status !== "valid") continue;
    for (const dependency of dependent.manifest.dependencies.names) {
      if (selected.has(dependency)) warnings.push({ dependency, dependent: dependent.name });
    }
  }
  return warnings;
}
function recoveryCommand(backup) {
  const disabled = JSON.stringify(uniqueSorted(backup.disabledExtensions));
  return `(async()=>{const m=await import('/scripts/extensions.js');const d=new Set(${disabled});for(const n of m.extensionNames){await (d.has(n)?m.disableExtension(n,false):m.enableExtension(n,false));}location.reload();})()`;
}
var buildEmergencyBackup = Object.assign(
  (disabledExtensions, createdAt) => ({
    version: 1,
    createdAt,
    disabledExtensions: uniqueSorted(disabledExtensions)
  }),
  { recoveryCommand }
);
function readEmergencyBackup(storage) {
  let raw;
  try {
    raw = storage.getItem(BACKUP_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value;
    if (record.version !== 1 || typeof record.createdAt !== "number" || !Number.isFinite(record.createdAt) || !Array.isArray(record.disabledExtensions) || !record.disabledExtensions.every((name) => typeof name === "string" && name.length > 0) || record.disabledExtensions.some((name) => typeof name === "string" && isSelf(name))) return null;
    return buildEmergencyBackup(record.disabledExtensions, record.createdAt);
  } catch {
    return null;
  }
}
function prepareExtensionExperiment(kind, candidateNames, inventory, baselineMeasurementId, deps) {
  const known = new Set(inventory.extensions.map((item) => item.name));
  const candidates = uniqueSorted(candidateNames);
  if (candidates.some(isSelf)) throw new Error("st-stage 自身不能进入扩展实验");
  const unknown = candidates.filter((name) => !known.has(name));
  if (unknown.length > 0) throw new Error(`未找到扩展：${unknown.join("、")}`);
  if (candidates.length === 0) throw new Error("至少选择一个扩展");
  return {
    id: deps.createId(),
    kind,
    status: "prepared",
    startedAt: deps.now(),
    originalDisabledExtensions: uniqueSorted(inventory.disabledExtensions),
    candidateExtensions: candidates,
    trialDisabledExtensions: trialForCandidates(kind, candidates),
    currentRound: 1,
    baselineMeasurementId
  };
}
async function applyDisabledSet(desiredDisabledExtensions, deps, reloadOnSuccess) {
  const inventory = await deps.readExtensions();
  if (inventory.status !== "ready") {
    return { ok: false, applied: [], failed: [{ name: "SillyTavern", error: inventory.reason }], reloadRequired: false };
  }
  if (!inventory.governance.writable) {
    return {
      ok: false,
      applied: [],
      failed: [{ name: "SillyTavern", error: inventory.governance.reason ?? "扩展治理只读" }],
      reloadRequired: false
    };
  }
  const desired = new Set(uniqueSorted(desiredDisabledExtensions));
  const failed = [];
  const applied = [];
  for (const name of desired) {
    if (isSelf(name)) failed.push({ name, error: "管家不能禁用 st-stage 自身" });
  }
  if (failed.length > 0) return { ok: false, applied, failed, reloadRequired: false };
  for (const extension of inventory.extensions) {
    if (extension.isSelf || isSelf(extension.name)) continue;
    const shouldEnable = !desired.has(extension.name);
    if (extension.configuredEnabled === shouldEnable) continue;
    const result = await deps.setExtensionEnabled(extension.name, shouldEnable);
    if (result.ok) applied.push(extension.name);
    else failed.push({ name: extension.name, error: result.error });
  }
  const ok = failed.length === 0;
  const reloadRequired = applied.length > 0;
  if (ok && reloadRequired && reloadOnSuccess) await deps.reloadPage();
  return { ok, applied, failed, reloadRequired };
}
async function restoreEmergencyExtensionBackup(backup, deps) {
  const batch = await applyDisabledSet(backup.disabledExtensions, deps, false);
  if (!batch.ok) return batch;
  deps.backupStorage.removeItem(BACKUP_STORAGE_KEY);
  if (batch.reloadRequired) await deps.reloadPage();
  return batch;
}
function desiredForTrial(experiment) {
  return uniqueSorted([
    ...experiment.originalDisabledExtensions,
    ...experiment.trialDisabledExtensions ?? experiment.candidateExtensions
  ]);
}
function storeEmergencyBackup(experiment, deps) {
  const backup = buildEmergencyBackup(experiment.originalDisabledExtensions, deps.now());
  deps.backupStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backup));
  deps.warnRecovery(buildEmergencyBackup.recoveryCommand(backup));
}
function partialFailureNote(prefix, batch) {
  const applied = batch.applied.length > 0 ? batch.applied.join("、") : "无";
  const failed = batch.failed.map((item) => `${item.name}（${item.error}）`).join("、");
  return `${prefix}；已修改：${applied}；失败：${failed}。页面未刷新，可保留当前状态或恢复原清单。`;
}
async function startExtensionExperiment(source, deps) {
  if (source.status !== "prepared") throw new Error("实验尚未处于准备状态");
  const experiment = structuredClone(source);
  await deps.persistExperiment(experiment);
  storeEmergencyBackup(experiment, deps);
  const batch = await applyDisabledSet(desiredForTrial(experiment), deps, false);
  if (!batch.ok) {
    experiment.status = "awaitingDecision";
    experiment.reloadRequiredAfterDecision = batch.reloadRequired;
    experiment.notes = partialFailureNote("扩展变更未全部成功", batch);
    await deps.persistExperiment(experiment);
    return { experiment, batch };
  }
  experiment.status = batch.reloadRequired ? "awaitingReload" : "sampling";
  await deps.persistExperiment(experiment);
  if (batch.reloadRequired) await deps.reloadPage();
  return { experiment, batch };
}
function resumeExtensionExperiment(source) {
  if (source.status !== "awaitingReload") return structuredClone(source);
  return { ...structuredClone(source), status: "sampling" };
}
function recordExperimentComparison(source, comparisonMeasurementId) {
  if (source.status !== "sampling") throw new Error("实验未处于复测阶段");
  return {
    ...structuredClone(source),
    status: "awaitingDecision",
    comparisonMeasurementId
  };
}
async function finishExtensionExperiment(source, decision, deps) {
  if (source.status !== "awaitingDecision") throw new Error("实验尚未等待用户决定");
  const completed = structuredClone(source);
  if (decision === "restore") {
    const restoring = { ...completed, status: "restoring" };
    await deps.persistExperiment(restoring);
    const batch = await applyDisabledSet(restoring.originalDisabledExtensions, deps, false);
    if (!batch.ok) {
      const retryable = {
        ...restoring,
        status: "awaitingDecision",
        reloadRequiredAfterDecision: Boolean(
          restoring.reloadRequiredAfterDecision || batch.reloadRequired
        ),
        notes: partialFailureNote("恢复未全部成功", batch)
      };
      await deps.persistExperiment(retryable);
      return retryable;
    }
    completed.status = "completed";
    completed.completedAt = deps.now();
    await deps.persistExperiment(null);
    deps.backupStorage.removeItem(BACKUP_STORAGE_KEY);
    if (batch.reloadRequired) await deps.reloadPage();
    return completed;
  }
  completed.status = "completed";
  completed.completedAt = deps.now();
  await deps.persistExperiment(null);
  deps.backupStorage.removeItem(BACKUP_STORAGE_KEY);
  if (completed.reloadRequiredAfterDecision) await deps.reloadPage();
  return completed;
}
async function advanceBinaryIsolation(source, symptomImproved, deps) {
  if (source.kind !== "binaryIsolation" || source.status !== "awaitingDecision") {
    throw new Error("二分实验尚未等待本轮判断");
  }
  const tested = new Set(source.trialDisabledExtensions ?? []);
  const candidates = symptomImproved ? source.candidateExtensions.filter((name) => tested.has(name)) : source.candidateExtensions.filter((name) => !tested.has(name));
  const next = {
    ...structuredClone(source),
    status: "prepared",
    candidateExtensions: candidates,
    trialDisabledExtensions: trialForCandidates("binaryIsolation", candidates),
    currentRound: source.currentRound + 1,
    comparisonMeasurementId: void 0,
    reloadRequiredAfterDecision: void 0
  };
  await deps.persistExperiment(next);
  const batch = await applyDisabledSet(desiredForTrial(next), deps, false);
  if (!batch.ok) {
    next.status = "awaitingDecision";
    next.reloadRequiredAfterDecision = batch.reloadRequired;
    next.notes = partialFailureNote("本轮扩展变更未全部成功", batch);
    await deps.persistExperiment(next);
    return next;
  }
  next.status = batch.reloadRequired ? "awaitingReload" : "sampling";
  await deps.persistExperiment(next);
  if (batch.reloadRequired) await deps.reloadPage();
  return next;
}

// st-extension/src/apps/butler/types.ts
var BUTLER_DATA_VERSION = 2;
var BUTLER_HISTORY_LIMIT = 10;
var BUTLER_DATA_BUDGET_BYTES = 64 * 1024;

// st-extension/src/apps/butler/history.ts
function utf8JsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
function protectedMeasurementIds(data) {
  return new Set([
    data.activeTransaction?.baselineMeasurementId,
    data.pendingExperiment?.baselineMeasurementId,
    data.pendingExperiment?.comparisonMeasurementId
  ].filter((id) => Boolean(id)));
}
function oldestRecordIndex(history, protectedIds) {
  let oldestIndex = -1;
  for (let index = 0; index < history.length; index += 1) {
    const record = history[index];
    if (record.kind === "measurement" && protectedIds.has(record.measurement.id)) continue;
    if (oldestIndex < 0) {
      oldestIndex = index;
      continue;
    }
    const candidate = history[index];
    const oldest = history[oldestIndex];
    if (candidate.createdAt < oldest.createdAt || candidate.createdAt === oldest.createdAt && candidate.completedAt < oldest.completedAt) {
      oldestIndex = index;
    }
  }
  return oldestIndex;
}
function withoutOldest(history, evictedIds, protectedIds) {
  const next = [...history];
  const index = oldestRecordIndex(next, protectedIds);
  if (index < 0) return null;
  const [removed] = next.splice(index, 1);
  evictedIds.push(removed.id);
  return next;
}
function fitButlerDataBudget(data, budgetBytes = BUTLER_DATA_BUDGET_BYTES, candidateHistoryId) {
  const evictedIds = [];
  const protectedIds = protectedMeasurementIds(data);
  let history = [...data.history];
  while (history.length > BUTLER_HISTORY_LIMIT) {
    const next = withoutOldest(history, evictedIds, protectedIds);
    if (!next) break;
    history = next;
  }
  let fitted = { ...data, history };
  let bytes = utf8JsonBytes(fitted);
  while (bytes > budgetBytes && history.length > 0) {
    const next = withoutOldest(history, evictedIds, protectedIds);
    if (!next) break;
    history = next;
    fitted = { ...data, history };
    bytes = utf8JsonBytes(fitted);
  }
  if (bytes <= budgetBytes) {
    return {
      data: fitted,
      bytes,
      budgetBytes,
      status: evictedIds.length > 0 ? "evicted" : "ok",
      historyAccepted: candidateHistoryId === void 0 ? true : fitted.history.some((record) => record.id === candidateHistoryId),
      evictedIds
    };
  }
  const protectedStatePresent = data.activeTransaction !== null || data.pendingExperiment !== null || protectedIds.size > 0;
  return {
    data: fitted,
    bytes,
    budgetBytes,
    status: protectedStatePresent ? "protected-over-budget" : "data-over-budget",
    historyAccepted: false,
    evictedIds
  };
}

// st-extension/src/apps/butler/migrations.ts
var INVALID = { ok: false };
var ACTION_GROUPS = ["performanceSettings", "disabledExtensions", "gameplaySettings"];
var ACTION_STATUSES = ["planned", "applied", "failed", "unchanged"];
var TRANSACTION_STATUSES = ["planned", "applying", "applied", "partial", "failed", "restored"];
var RESTORE_STATUSES = ["unavailable", "available", "restoring", "conflict", "restored"];
var EXPERIMENT_KINDS = ["selectedExtensions", "binaryIsolation"];
var EXPERIMENT_STATUSES = [
  "prepared",
  "awaitingReload",
  "sampling",
  "awaitingDecision",
  "restoring",
  "completed",
  "failed"
];
var ACTIVE_TRANSACTION_STATUSES = ["planned", "applying", "applied", "partial", "failed"];
var ACTIVE_RESTORE_STATUSES = ["available", "restoring", "conflict"];
var COMPLETED_TRANSACTION_STATUSES = ["applied", "partial", "failed", "restored"];
var PENDING_EXPERIMENT_STATUSES = [
  "prepared",
  "awaitingReload",
  "sampling",
  "awaitingDecision",
  "restoring"
];
var COMPLETED_EXPERIMENT_STATUSES = ["completed", "failed"];
var HISTORY_OUTCOMES = ["completed", "failed", "restored", "cancelled"];
var PROBES = ["static", "idle", "controlledScroll"];
var PERF_BOOLEAN_KEYS = [
  "fast_ui_mode",
  "reduced_motion",
  "noShadows",
  "smooth_streaming",
  "stream_fade_in"
];
function valid(value) {
  return { ok: true, value };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function isString(value) {
  return typeof value === "string";
}
function isOneOf(value, allowed) {
  return typeof value === "string" && allowed.includes(value);
}
function optionalString(value) {
  return value === void 0 || isString(value);
}
function optionalNumber(value) {
  return value === void 0 || isFiniteNumber(value);
}
function optionalBoolean(value) {
  return value === void 0 || typeof value === "boolean";
}
function normalizeJsonValue(value, ancestors = /* @__PURE__ */ new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return valid(value);
  if (isFiniteNumber(value)) return valid(value);
  if (typeof value !== "object" || value === null || ancestors.has(value)) return INVALID;
  ancestors.add(value);
  if (Array.isArray(value)) {
    const clone2 = [];
    for (const item of value) {
      const normalized = normalizeJsonValue(item, ancestors);
      if (!normalized.ok) {
        ancestors.delete(value);
        return INVALID;
      }
      clone2.push(normalized.value);
    }
    ancestors.delete(value);
    return valid(clone2);
  }
  const entries = [];
  for (const [key, item] of Object.entries(value)) {
    const normalized = normalizeJsonValue(item, ancestors);
    if (!normalized.ok) {
      ancestors.delete(value);
      return INVALID;
    }
    entries.push([key, normalized.value]);
  }
  ancestors.delete(value);
  return valid(Object.fromEntries(entries));
}
function normalizeJsonRecord(value) {
  if (!isRecord(value)) return INVALID;
  const normalized = normalizeJsonValue(value);
  return normalized.ok && isRecord(normalized.value) ? valid(normalized.value) : INVALID;
}
function normalizeStringArray(value) {
  return Array.isArray(value) && value.every(isString) ? valid([...value]) : INVALID;
}
function normalizePerformanceSnapshot(value) {
  if (!isRecord(value) || !PERF_BOOLEAN_KEYS.every((key) => typeof value[key] === "boolean") || !isFiniteNumber(value.streaming_fps) || !isFiniteNumber(value.chat_truncation)) return INVALID;
  return valid({
    fast_ui_mode: value.fast_ui_mode,
    reduced_motion: value.reduced_motion,
    noShadows: value.noShadows,
    smooth_streaming: value.smooth_streaming,
    stream_fade_in: value.stream_fade_in,
    streaming_fps: value.streaming_fps,
    chat_truncation: value.chat_truncation
  });
}
function normalizeObserved(value, normalizeValue) {
  if (!isRecord(value) || typeof value.available !== "boolean") return INVALID;
  if (!value.available) {
    return isString(value.reason) ? valid({ available: false, reason: value.reason }) : INVALID;
  }
  const normalized = normalizeValue(value.value);
  return normalized.ok ? valid({ available: true, value: normalized.value }) : INVALID;
}
function normalizeCapability(value) {
  if (!isRecord(value) || !isString(value.id) || typeof value.available !== "boolean") return INVALID;
  if (value.available) return valid({ id: value.id, available: true });
  return isString(value.reason) ? valid({ id: value.id, available: false, reason: value.reason }) : INVALID;
}
function normalizeEnvironment(value) {
  if (!isRecord(value)) return INVALID;
  const stVersion2 = normalizeObserved(value.stVersion, (input) => isString(input) ? valid(input) : INVALID);
  const stageBuild = normalizeObserved(value.stageBuild, (input) => isString(input) ? valid(input) : INVALID);
  const mobile = normalizeObserved(value.mobile, (input) => typeof input === "boolean" ? valid(input) : INVALID);
  const settingsSummary = normalizeObserved(value.settingsSummary, normalizeJsonRecord);
  const disabledExtensionsHash = normalizeObserved(
    value.disabledExtensionsHash,
    (input) => isString(input) ? valid(input) : INVALID
  );
  if (!stVersion2.ok || !stageBuild.ok || !mobile.ok || !settingsSummary.ok || !disabledExtensionsHash.ok) {
    return INVALID;
  }
  return valid({
    stVersion: stVersion2.value,
    stageBuild: stageBuild.value,
    mobile: mobile.value,
    settingsSummary: settingsSummary.value,
    disabledExtensionsHash: disabledExtensionsHash.value
  });
}
function normalizeMeasurementSnapshot(value) {
  if (!isRecord(value) || !isString(value.id) || !isFiniteNumber(value.createdAt) || !isFiniteNumber(value.durationMs) || !isOneOf(value.probe, PROBES) || typeof value.foreground !== "boolean" || !optionalString(value.chatKey) || !optionalString(value.invalidReason) || !Array.isArray(value.capabilities)) return null;
  const environment = normalizeEnvironment(value.environment);
  const metrics = normalizeJsonRecord(value.metrics);
  const capabilities = [];
  for (const candidate of value.capabilities) {
    const normalized = normalizeCapability(candidate);
    if (!normalized.ok) return null;
    capabilities.push(normalized.value);
  }
  if (!environment.ok || !metrics.ok) return null;
  return {
    id: value.id,
    createdAt: value.createdAt,
    durationMs: value.durationMs,
    probe: value.probe,
    foreground: value.foreground,
    ...value.chatKey === void 0 ? {} : { chatKey: value.chatKey },
    environment: environment.value,
    capabilities,
    metrics: metrics.value,
    ...value.invalidReason === void 0 ? {} : { invalidReason: value.invalidReason }
  };
}
function normalizeButlerAction(value) {
  if (!isRecord(value) || !isString(value.id) || !isOneOf(value.group, ACTION_GROUPS) || !isString(value.label) || !isString(value.field) || !isOneOf(value.status, ACTION_STATUSES) || typeof value.reloadRequired !== "boolean" || !optionalString(value.error)) return null;
  const before = normalizeJsonValue(value.before);
  const requested = normalizeJsonValue(value.requested);
  const actual = value.actual === void 0 ? null : normalizeJsonValue(value.actual);
  if (!before.ok || !requested.ok || actual !== null && !actual.ok) return null;
  return {
    id: value.id,
    group: value.group,
    label: value.label,
    field: value.field,
    before: before.value,
    requested: requested.value,
    ...actual === null ? {} : { actual: actual.value },
    status: value.status,
    reloadRequired: value.reloadRequired,
    ...value.error === void 0 ? {} : { error: value.error }
  };
}
function normalizeButlerTransaction(value) {
  if (!isRecord(value) || !isString(value.id) || !isOneOf(value.group, ACTION_GROUPS) || !isFiniteNumber(value.createdAt) || !optionalNumber(value.completedAt) || !isOneOf(value.status, TRANSACTION_STATUSES) || !isOneOf(value.restoreStatus, RESTORE_STATUSES) || !optionalString(value.baselineMeasurementId) || !Array.isArray(value.actions) || !optionalString(value.error)) return null;
  const before = normalizeJsonRecord(value.before);
  const requested = normalizeJsonRecord(value.requested);
  const actual = normalizeJsonRecord(value.actual);
  const actions = [];
  for (const candidate of value.actions) {
    const normalized = normalizeButlerAction(candidate);
    if (!normalized || normalized.group !== value.group) return null;
    actions.push(normalized);
  }
  if (!before.ok || !requested.ok || !actual.ok || actions.length === 0) return null;
  return {
    id: value.id,
    group: value.group,
    createdAt: value.createdAt,
    ...value.completedAt === void 0 ? {} : { completedAt: value.completedAt },
    status: value.status,
    restoreStatus: value.restoreStatus,
    ...value.baselineMeasurementId === void 0 ? {} : { baselineMeasurementId: value.baselineMeasurementId },
    before: before.value,
    requested: requested.value,
    actual: actual.value,
    actions,
    ...value.error === void 0 ? {} : { error: value.error }
  };
}
function normalizeButlerExperiment(value) {
  if (!isRecord(value) || !isString(value.id) || !isOneOf(value.kind, EXPERIMENT_KINDS) || !isOneOf(value.status, EXPERIMENT_STATUSES) || !isFiniteNumber(value.startedAt) || !optionalNumber(value.completedAt) || !isFiniteNumber(value.currentRound) || !Number.isInteger(value.currentRound) || value.currentRound < 0 || !optionalString(value.baselineMeasurementId) || !optionalString(value.comparisonMeasurementId) || !optionalBoolean(value.reloadRequiredAfterDecision) || !optionalString(value.notes)) return null;
  const originalDisabledExtensions = normalizeStringArray(value.originalDisabledExtensions);
  const candidateExtensions = normalizeStringArray(value.candidateExtensions);
  const trialDisabledExtensions = value.trialDisabledExtensions === void 0 ? null : normalizeStringArray(value.trialDisabledExtensions);
  if (!originalDisabledExtensions.ok || !candidateExtensions.ok || trialDisabledExtensions && !trialDisabledExtensions.ok) {
    return null;
  }
  return {
    id: value.id,
    kind: value.kind,
    status: value.status,
    startedAt: value.startedAt,
    ...value.completedAt === void 0 ? {} : { completedAt: value.completedAt },
    originalDisabledExtensions: originalDisabledExtensions.value,
    candidateExtensions: candidateExtensions.value,
    ...trialDisabledExtensions === null ? {} : { trialDisabledExtensions: trialDisabledExtensions.value },
    currentRound: value.currentRound,
    ...value.baselineMeasurementId === void 0 ? {} : { baselineMeasurementId: value.baselineMeasurementId },
    ...value.comparisonMeasurementId === void 0 ? {} : { comparisonMeasurementId: value.comparisonMeasurementId },
    ...value.reloadRequiredAfterDecision === void 0 ? {} : { reloadRequiredAfterDecision: value.reloadRequiredAfterDecision },
    ...value.notes === void 0 ? {} : { notes: value.notes }
  };
}
function normalizeHistoryBase(value) {
  if (!isString(value.id) || !isFiniteNumber(value.createdAt) || !isFiniteNumber(value.completedAt) || !isOneOf(value.outcome, HISTORY_OUTCOMES)) return INVALID;
  const summary = normalizeJsonRecord(value.summary);
  return summary.ok ? valid({
    id: value.id,
    createdAt: value.createdAt,
    completedAt: value.completedAt,
    outcome: value.outcome,
    summary: summary.value
  }) : INVALID;
}
function normalizeHistoryRecord(value) {
  if (!isRecord(value)) return null;
  const base = normalizeHistoryBase(value);
  if (!base.ok) return null;
  if (value.kind === "measurement") {
    if (value.transaction !== void 0 || value.experiment !== void 0) return null;
    const measurement = normalizeMeasurementSnapshot(value.measurement);
    return measurement ? { ...base.value, kind: "measurement", measurement } : null;
  }
  if (value.kind === "transaction") {
    if (value.measurement !== void 0 || value.experiment !== void 0) return null;
    const transaction = normalizeButlerTransaction(value.transaction);
    return transaction && transaction.completedAt !== void 0 && isOneOf(transaction.status, COMPLETED_TRANSACTION_STATUSES) ? { ...base.value, kind: "transaction", transaction } : null;
  }
  if (value.kind === "experiment") {
    if (value.measurement !== void 0 || value.transaction !== void 0) return null;
    const experiment = normalizeButlerExperiment(value.experiment);
    return experiment && experiment.completedAt !== void 0 && isOneOf(experiment.status, COMPLETED_EXPERIMENT_STATUSES) ? { ...base.value, kind: "experiment", experiment } : null;
  }
  return null;
}
function normalizeV2(value) {
  if (value.version !== BUTLER_DATA_VERSION || typeof value.performanceModeOn !== "boolean" || !Array.isArray(value.history)) return null;
  const activeTransaction = value.activeTransaction === null ? null : normalizeButlerTransaction(value.activeTransaction);
  const pendingExperiment = value.pendingExperiment === null ? null : normalizeButlerExperiment(value.pendingExperiment);
  const recoverableTransaction = activeTransaction && isOneOf(activeTransaction.status, ACTIVE_TRANSACTION_STATUSES) && isOneOf(activeTransaction.restoreStatus, ACTIVE_RESTORE_STATUSES) ? activeTransaction : null;
  const resumableExperiment = pendingExperiment && isOneOf(pendingExperiment.status, PENDING_EXPERIMENT_STATUSES) ? pendingExperiment : null;
  const history = [];
  for (const candidate of value.history) {
    const normalized = normalizeHistoryRecord(candidate);
    if (normalized) history.push(normalized);
  }
  return {
    version: BUTLER_DATA_VERSION,
    performanceModeOn: value.performanceModeOn,
    activeTransaction: recoverableTransaction,
    pendingExperiment: resumableExperiment,
    history
  };
}
function createEmptyButlerData() {
  return {
    version: BUTLER_DATA_VERSION,
    performanceModeOn: false,
    activeTransaction: null,
    pendingExperiment: null,
    history: []
  };
}
function migrateButlerData(value, _options = {}) {
  if (!isRecord(value)) return createEmptyButlerData();
  if (value.version === BUTLER_DATA_VERSION) return normalizeV2(value) ?? createEmptyButlerData();
  const snapshot = normalizePerformanceSnapshot(value.snapshot);
  if (!snapshot.ok || value.perfOn !== void 0 && typeof value.perfOn !== "boolean") {
    return createEmptyButlerData();
  }
  return {
    version: BUTLER_DATA_VERSION,
    performanceModeOn: false,
    // 旧版只保存整组快照，没有每个字段的实际回读结果，无法安全生成可恢复事务。
    // 清空保护槽，让用户重新体检并生成有逐项证据的新事务。
    activeTransaction: null,
    pendingExperiment: null,
    history: []
  };
}

// st-extension/src/apps/butler/modals.ts
var LAYER_LABELS = {
  pageRendering: "页面与渲染",
  mediaResourcesStorage: "媒体、资源与存储",
  extensions: "扩展",
  generationContext: "生成与上下文"
};
var EXPLANATION_LABELS = [
  ["detected", "检测到什么"],
  ["change", "建议修改"],
  ["reason", "为什么可能改善"],
  ["impact", "可能影响"],
  ["reload", "生效与刷新"],
  ["restore", "如何恢复"],
  ["result", "实测结果"]
];
var CAPABILITY_LABELS = {
  pageSummary: "聊天与页面结构",
  performanceSettings: "性能设置",
  mediaDom: "图片与媒体",
  resourceTiming: "资源加载记录",
  storageEstimate: "站点存储空间",
  jsHeap: "网页内存信息",
  cssAnimations: "动画数量统计",
  longTasks: "页面卡顿记录"
};
function text(parent, value, className = "so-butler-text") {
  const node = el2("div", className);
  node.textContent = value;
  parent.append(node);
  return node;
}
function title(parent, value) {
  text(parent, value, "so-butler-modal-title");
}
function valueText(value) {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
function renderFinding(parent, finding2) {
  const card = document.createElement("details");
  card.className = `so-butler-finding so-butler-severity-${finding2.severity}`;
  const summary = document.createElement("summary");
  const layer = el2("span", "so-butler-layer");
  layer.textContent = LAYER_LABELS[finding2.layer];
  const detected = document.createElement("span");
  detected.textContent = finding2.explanation.detected;
  summary.append(layer, detected);
  const body = el2("div", "so-butler-finding-body");
  for (const [key, label] of EXPLANATION_LABELS) {
    const row = el2("div", "so-butler-explanation-row");
    const strong = document.createElement("strong");
    strong.textContent = label;
    const content = document.createElement("span");
    content.textContent = finding2.explanation[key];
    row.append(strong, content);
    body.append(row);
  }
  card.append(summary, body);
  parent.append(card);
  return card;
}
function environmentRows(parent, measurement) {
  const entries = [
    ["SillyTavern", measurement.environment.stVersion],
    ["st-stage", measurement.environment.stageBuild],
    ["设备", measurement.environment.mobile],
    ["聊天标识", measurement.chatKey ? { available: true, value: measurement.chatKey } : { available: false, reason: "不可用" }]
  ];
  for (const [label, observed2] of entries) {
    const row = el2("div", "so-butler-kv");
    const key = document.createElement("span");
    key.textContent = label;
    const value = document.createElement("strong");
    value.textContent = observed2.available ? valueText(observed2.value) : observed2.reason;
    if (!observed2.available) value.className = "so-butler-muted";
    row.append(key, value);
    parent.append(row);
  }
}
function buildReportModal(controller) {
  return (body) => {
    title(body, "详细检查结果");
    text(body, "这里只展示可观测证据和能力缺失原因，不生成综合性能分数。", "so-butler-lead");
    const measurement = controller.getMeasurement();
    if (!measurement) {
      text(body, "尚无检查结果。关闭后运行一次基础检查或 6 秒检查。");
      return;
    }
    const environment = foldSection("检查环境", true);
    environmentRows(environment.body, measurement);
    const probeLabel = measurement.probe === "controlledScroll" ? "滚动长聊天检查" : measurement.probe === "idle" ? "不操作时检查" : "基础信息检查";
    text(environment.body, `检查方式：${probeLabel} · ${measurement.durationMs / 1e3} 秒 · ${measurement.foreground ? "页面在前台" : "页面在后台"}`);
    if (measurement.invalidReason) text(environment.body, measurement.invalidReason, "so-butler-alert");
    body.append(environment.box);
    const metrics = foldSection("原始数据", true);
    for (const [key, value] of Object.entries(measurement.metrics)) {
      const row = el2("div", "so-butler-metric-block");
      const strong = document.createElement("strong");
      strong.textContent = key;
      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(value, null, 2);
      row.append(strong, pre);
      metrics.body.append(row);
    }
    body.append(metrics.box);
    const capabilities = foldSection("哪些数据可以读取");
    for (const capability of measurement.capabilities) {
      text(
        capabilities.body,
        capability.available ? `${CAPABILITY_LABELS[capability.id] ?? capability.id}：可用` : `${CAPABILITY_LABELS[capability.id] ?? capability.id}：${capability.reason}`,
        capability.available ? "so-butler-text" : "so-butler-muted"
      );
    }
    body.append(capabilities.box);
    const findings = foldSection(`全部发现（${controller.getFindings().length}）`, true);
    for (const finding2 of controller.getFindings()) renderFinding(findings.body, finding2);
    body.append(findings.box);
    const comparison = controller.getComparison();
    if (comparison) {
      const compare = foldSection("最近一次前后对比", true);
      text(compare.body, comparison.comparable ? "两次检查条件一致，可以查看前后差值。" : `两次检查条件不同，暂不计算差值：${comparison.reasons.join("；")}。这里只并列原始数据。`);
      if (comparison.comparable) {
        for (const [key, value] of Object.entries(comparison.deltas)) {
          text(compare.body, `${key}：${value >= 0 ? "+" : ""}${value}`);
        }
      }
      body.append(compare.box);
    }
    const history = foldSection(`最近操作（${controller.getData().history.length}）`);
    for (const record of [...controller.getData().history].reverse()) {
      text(history.body, `${new Date(record.createdAt).toLocaleString()} · ${String(record.summary.label ?? record.kind)} · ${record.outcome}`);
    }
    if (controller.getData().history.length === 0) text(history.body, "暂无已保存操作。");
    body.append(history.box);
  };
}
function experimentStatus(experiment) {
  const labels = {
    prepared: "准备中",
    awaitingReload: "等待刷新",
    sampling: "等待关闭后检查",
    awaitingDecision: "等待结果决定",
    restoring: "正在恢复",
    completed: "已完成",
    failed: "失败"
  };
  return labels[experiment.status];
}
function buildExtensionModal(services, controller) {
  return (body) => {
    let disposed = false;
    let inventory = null;
    let selected = /* @__PURE__ */ new Set();
    let busy = false;
    let notice = "";
    let emergencyBackup = readEmergencyBackup(services.backupStorage);
    const run = async (task) => {
      if (busy) return;
      busy = true;
      notice = "";
      render2();
      try {
        await task();
      } catch (error) {
        notice = error instanceof Error ? error.message : "操作失败";
      } finally {
        busy = false;
        if (!disposed) render2();
      }
    };
    const renderPending = (experiment) => {
      title(body, "临时关闭扩展找卡顿");
      text(body, `当前排查方式：${experiment.kind === "binaryIsolation" ? "分批缩小范围" : "对比所选扩展"} · 第 ${experiment.currentRound} 轮`);
      text(body, `状态：${experimentStatus(experiment)}`, experiment.notes ? "so-butler-alert" : "so-butler-lead");
      if (experiment.notes) text(body, experiment.notes, "so-butler-alert");
      text(body, `本轮暂时禁用：${(experiment.trialDisabledExtensions ?? experiment.candidateExtensions).join("、")}`);
      text(body, "最初禁用清单已同时保存在管家数据、localStorage 和控制台恢复命令中。");
      if (experiment.status === "sampling") {
        body.append(appButton(busy ? "正在检查" : "检查关闭后的表现", () => run(controller.sampleExperiment)));
      }
      if (experiment.status === "awaitingDecision") {
        if (experiment.kind === "binaryIsolation" && experiment.candidateExtensions.length > 1 && experiment.reloadRequiredAfterDecision === void 0) {
          const actions = el2("div", "so-butler-actions");
          actions.append(
            appButton("变流畅了", () => run(() => controller.advanceBinary(true))),
            appButton("没有变流畅", () => run(() => controller.advanceBinary(false)))
          );
          body.append(actions);
        }
        const decisions = el2("div", "so-butler-actions");
        decisions.append(
          appButton("保持这些扩展关闭", () => run(() => controller.finishExperiment("keep"))),
          appButton("恢复原来的扩展状态", () => run(() => controller.finishExperiment("restore")))
        );
        body.append(decisions);
      }
      if (notice) text(body, notice, "so-butler-alert");
    };
    const renderInventory = (ready) => {
      title(body, "临时关闭扩展找卡顿");
      text(body, "用途：暂时关闭可疑的第三方扩展，刷新 SillyTavern 后重复刚才的操作。如果变流畅了，就恢复扩展并决定是否保留排查结果。", "so-butler-lead");
      text(body, "使用顺序：1. 勾选可疑扩展 → 2. 开始排查 → 3. 刷新页面并重复同一操作 → 4. 保留结果或恢复原清单。", "so-butler-text");
      text(body, "扩展脚本和样式只有刷新后才会真正停止加载；管家使用 SillyTavern 官方禁用接口，不修改内部数组。", "so-butler-muted");
      if (!ready.governance.writable) text(body, ready.governance.reason ?? "当前版本只支持查看。", "so-butler-alert");
      if (emergencyBackup) {
        const backup = foldSection("检测到紧急恢复备份", true, "butler-emergency-backup");
        text(backup.body, `保存时间：${new Date(emergencyBackup.createdAt).toLocaleString()} · 原禁用清单 ${emergencyBackup.disabledExtensions.length} 项。`);
        backup.body.append(appButton("恢复备份中的禁用清单", () => run(async () => {
          if (!emergencyBackup) return;
          await controller.restoreEmergencyBackup(emergencyBackup);
          emergencyBackup = null;
          notice = "紧急备份已恢复。";
        })));
        body.append(backup.box);
      }
      text(body, "第三方扩展", "so-butler-section-title");
      const list = el2("div", "so-butler-extension-list");
      for (const extension of ready.extensions) {
        const row = el2("label", "so-butler-extension-row");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = extension.name;
        checkbox.checked = selected.has(extension.name);
        checkbox.disabled = extension.isSelf || !extension.configuredEnabled || !ready.governance.writable;
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) selected.add(extension.name);
          else selected.delete(extension.name);
        });
        const label = el2("span", "so-butler-extension-name");
        label.textContent = extension.manifest?.displayName ? `${extension.manifest.displayName} (${extension.name})` : extension.name;
        const state = el2("small", "so-butler-muted");
        state.textContent = extension.isSelf ? "受保护" : extension.configuredEnabled ? `${extension.type} · 当前启用` : `${extension.type} · 当前禁用`;
        row.append(checkbox, label, state);
        list.append(row);
      }
      body.append(list);
      const start = async (kind) => {
        const names = [...selected];
        if (names.length === 0) throw new Error("至少选择一个启用的第三方扩展");
        const warnings = dependencyWarnings(ready, names);
        if (warnings.length > 0) {
          const detail = warnings.map((item) => `${item.dependent} 依赖 ${item.dependency}`).join("\n");
          if (!services.confirm(`所选扩展存在启用中的依赖方：
${detail}

仍要开始临时关闭排查吗？`)) return;
        }
        await controller.startExperiment(kind, names, ready);
      };
      const actions = el2("div", "so-butler-actions");
      actions.append(
        appButton("开始对比所选扩展", () => run(() => start("selectedExtensions"))),
        appButton("逐轮缩小可疑扩展", () => run(() => start("binaryIsolation")))
      );
      body.append(actions);
      text(body, "系统扩展默认不参与；st-stage 自身永远不可选。“逐轮缩小可疑扩展”只会在你勾选的范围里分批排查。");
      if (notice) text(body, notice, "so-butler-alert");
    };
    const render2 = () => {
      if (disposed) return;
      body.textContent = "";
      const pending = controller.getData().pendingExperiment;
      if (pending) {
        renderPending(pending);
        return;
      }
      if (!inventory) {
        title(body, "临时关闭扩展找卡顿");
        text(body, "正在读取 SillyTavern 扩展清单...");
        return;
      }
      if (inventory.status !== "ready") {
        title(body, "临时关闭扩展找卡顿");
        text(body, inventory.reason, "so-butler-alert");
        return;
      }
      renderInventory(inventory);
    };
    render2();
    void services.readExtensions().then((value) => {
      if (disposed) return;
      inventory = value;
      if (value.status === "ready") selected = new Set(defaultExperimentCandidates(value));
      render2();
    });
    return () => {
      disposed = true;
    };
  };
}
function advisorSection(body, heading, paragraphs) {
  const section2 = foldSection(heading, true);
  for (const paragraph of paragraphs) text(section2.body, paragraph);
  body.append(section2.box);
}
function buildAdvisorModal(services) {
  return (body) => {
    title(body, "记忆与服务器设置建议");
    text(body, "这里解释会影响记忆、检索、总结和服务器资源的设置。管家只读查看，不会自动修改，也不会加入一键性能优化。", "so-butler-lead");
    const health = services.readHealth();
    const extensionState = text(body, "常用扩展状态：正在读取 SillyTavern 扩展清单...", "so-butler-muted");
    advisorSection(body, "世界书（World Info）", [
      "世界书条目越多、扫描深度越高，生成前匹配工作通常越多；它同时承载设定一致性，不应按“越少越好”处理。",
      "优先清理重复条目、缩小不必要的扫描范围，再用相同对话比较调整前后的生成时间。"
    ]);
    advisorSection(body, "向量检索（Vector Storage）", [
      "向量检索会增加索引、查询和存储工作，但能从长历史或资料库召回相关内容。",
      "只在明确不需要语义召回的对话里临时关闭并比较；不要把 Token 减少直接等同于页面渲染变快。"
    ]);
    advisorSection(body, "自动总结（Summarize）", [
      "总结会额外调用模型或处理历史，但可以控制长期上下文大小。频率太高会增加请求，频率太低会让上下文膨胀。",
      "根据实际聊天长度和模型速度调整，保留角色记忆需求。"
    ]);
    advisorSection(body, "自动化规则（Regex / Quick Reply）", [
      "大量生成时 Regex 规则可能增加每次回复的处理工作，且角色卡和预设可能依赖它们，因此管家不会自动关闭。",
      health.quickReplySets.available ? `当前检测到 ${health.quickReplySets.value} 个 Quick Reply 集合。集合数量只作信息展示，不代表运行时成本。` : `Quick Reply 集合数不可用：${health.quickReplySets.reason}`
    ]);
    advisorSection(body, "服务器设置（config.yaml）", [
      "requestCompression：长聊天或弱网可减少传输体积；修改后需要重启 SillyTavern。",
      "lazyLoadCharacters：大量角色卡时应保持开启；旧配置可能沿用 false。",
      "memoryCacheCapacity：按角色卡规模设置缓存容量，容量越高通常占用更多服务端内存。",
      "useDiskCache：只有磁盘极慢时才考虑关闭。管家没有稳定公开接口读取或修改这些键，因此不会伪装成已检测。"
    ]);
    void services.readExtensions().then((inventory) => {
      if (inventory.status !== "ready") {
        extensionState.textContent = `常用扩展状态：不可用（${inventory.reason}）`;
        return;
      }
      const status = (label, names) => {
        const found = inventory.extensions.find((extension) => names.includes(extension.name));
        return found ? `${label}：当前${found.configuredEnabled ? "启用" : "禁用"}` : `${label}：未检测到`;
      };
      extensionState.textContent = [
        status("Vector Storage", ["vectors"]),
        status("Summarize", ["memory"]),
        status("Regex", ["regex"])
      ].join("；");
    }).catch(() => {
      extensionState.textContent = "常用扩展状态：读取失败";
    });
  };
}

// st-extension/src/apps/butler/st-contract.ts
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function isStringRecord(value) {
  return isRecord2(value) && Object.values(value).every((item) => typeof item === "string");
}
function declaration(value) {
  if (value === void 0) return { status: "absent", names: [] };
  if (!isStringArray(value)) return { status: "invalid", names: [] };
  return { status: "valid", names: [...value] };
}
function inspectExtensionModule(value) {
  if (!isRecord2(value)) {
    const reason = "extensions.js 模块形状无效";
    return { status: "unavailable", reason, governance: { writable: false, reason } };
  }
  const missing = [];
  if (!isStringArray(value.extensionNames)) missing.push("extensionNames");
  if (!isStringRecord(value.extensionTypes)) missing.push("extensionTypes");
  const settings = value.extension_settings;
  if (!isRecord2(settings) || !isStringArray(settings.disabledExtensions)) {
    missing.push("extension_settings.disabledExtensions");
  }
  if (typeof value.findExtension !== "function") missing.push("findExtension");
  if (typeof value.getExtensionManifest !== "function") missing.push("getExtensionManifest");
  if (missing.length > 0) {
    const reason = `extensions.js 缺少可读契约：${missing.join("、")}`;
    return { status: "unavailable", reason, governance: { writable: false, reason } };
  }
  const writeMissing = [];
  if (typeof value.enableExtension !== "function") writeMissing.push("enableExtension");
  if (typeof value.disableExtension !== "function") writeMissing.push("disableExtension");
  const governance = writeMissing.length === 0 ? { writable: true } : { writable: false, reason: `扩展治理只读：缺少 ${writeMissing.join("、")}` };
  return {
    status: "ready",
    api: {
      extensionNames: [...value.extensionNames],
      extensionTypes: { ...value.extensionTypes },
      // Keep the validated live object: ST replaces disabledExtensions after enableExtension().
      extensionSettings: settings,
      findExtension: value.findExtension,
      getExtensionManifest: value.getExtensionManifest,
      enableExtension: typeof value.enableExtension === "function" ? value.enableExtension : void 0,
      disableExtension: typeof value.disableExtension === "function" ? value.disableExtension : void 0
    },
    governance
  };
}
function inspectPowerUserModule(value) {
  if (!isRecord2(value) || typeof value.applyPowerUserSettings !== "function") {
    return { available: false, reason: "power-user.js 缺少 applyPowerUserSettings" };
  }
  return { available: true, applyPowerUserSettings: value.applyPowerUserSettings };
}
function summarizeExtensionManifest(value) {
  if (!isRecord2(value)) return null;
  const summary = {
    dependencies: declaration(value.dependencies),
    requiredModules: declaration(value.requires)
  };
  if (typeof value.display_name === "string") summary.displayName = value.display_name;
  if (typeof value.version === "string") summary.version = value.version;
  if (typeof value.loading_order === "string" || typeof value.loading_order === "number") {
    summary.loadingOrder = value.loading_order;
  }
  if (typeof value.js === "string") summary.js = value.js;
  if (typeof value.css === "string") summary.css = value.css;
  return summary;
}
function parseFoundExtension(value) {
  if (!isRecord2(value) || typeof value.name !== "string" || typeof value.enabled !== "boolean") return null;
  return { name: value.name, configuredEnabled: value.enabled };
}

// st-extension/src/apps/butler/bridge.ts
function getST() {
  try {
    return window.SillyTavern?.getContext();
  } catch {
    return void 0;
  }
}
var PERF_FIELDS = {
  fast_ui_mode: "boolean",
  reduced_motion: "boolean",
  noShadows: "boolean",
  smooth_streaming: "boolean",
  stream_fade_in: "boolean",
  streaming_fps: "number",
  chat_truncation: "number"
};
function unavailableCapabilities2(reason) {
  return Object.fromEntries(
    Object.keys(PERF_FIELDS).map((key) => [key, { available: false, reason }])
  );
}
function readPerfState() {
  const pu = getST()?.powerUserSettings;
  if (!pu) {
    const reason = "未检测到 SillyTavern power_user 设置";
    return { status: "unavailable", snapshot: {}, capabilities: unavailableCapabilities2(reason), reason };
  }
  const snapshot = {};
  const capabilities = {};
  for (const [rawKey, expected] of Object.entries(PERF_FIELDS)) {
    const key = rawKey;
    const value = pu[key];
    const valid2 = expected === "boolean" ? typeof value === "boolean" : typeof value === "number" && Number.isFinite(value);
    if (valid2) {
      Object.assign(snapshot, { [key]: value });
      capabilities[key] = { available: true };
    } else {
      capabilities[key] = { available: false, reason: "字段缺失或类型无效" };
    }
  }
  const complete = Object.values(capabilities).every((capability) => capability.available);
  return { status: complete ? "ready" : "partial", snapshot, capabilities };
}
function readPerf() {
  const result = readPerfState();
  return result.status === "ready" ? result.snapshot : null;
}
function readMobileState() {
  const st = getST();
  if (typeof st?.isMobile !== "function") {
    return { available: false, reason: "未检测到 SillyTavern 移动端判断接口" };
  }
  try {
    const value = st.isMobile();
    return typeof value === "boolean" ? { available: true, value } : { available: false, reason: "SillyTavern 移动端判断返回格式无效" };
  } catch {
    return { available: false, reason: "SillyTavern 移动端判断失败" };
  }
}
async function applyVisuals() {
  try {
    const modUrl = "/scripts/power-user.js";
    const contract = inspectPowerUserModule(await import(modUrl));
    if (!contract.available) throw new Error(contract.reason);
    contract.applyPowerUserSettings();
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
  const prevTrunc = typeof pu.chat_truncation === "number" && Number.isFinite(pu.chat_truncation) ? pu.chat_truncation : void 0;
  Object.assign(pu, fields);
  if (fields.reduced_motion !== void 0) applyReducedMotion(fields.reduced_motion);
  if (fields.fast_ui_mode !== void 0 || fields.noShadows !== void 0) await applyVisuals();
  st.saveSettingsDebounced?.();
  if (fields.chat_truncation !== void 0 && fields.chat_truncation !== prevTrunc) {
    await reloadChatSafe(st);
  }
}
function readHealthState() {
  const ext = getST()?.extensionSettings;
  if (!ext) {
    const reason = "未检测到 SillyTavern 扩展设置";
    return {
      disabledExtensions: { available: false, reason },
      quickReplySets: { available: false, reason }
    };
  }
  const disabled = ext["disabledExtensions"];
  const qr = ext["quickReply"];
  return {
    disabledExtensions: Array.isArray(disabled) ? { available: true, value: disabled.length } : { available: false, reason: "禁用扩展清单缺失或格式无效" },
    quickReplySets: Array.isArray(qr?.config?.setList) ? { available: true, value: qr.config.setList.length } : { available: false, reason: "Quick Reply 设置缺失或格式无效" }
  };
}
function scalarId(value) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "unknown";
}
function comparisonDigest(value) {
  let hash2 = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash2 ^= BigInt(value.charCodeAt(index));
    hash2 = BigInt.asUintN(64, hash2 * 0x100000001b3n);
  }
  return hash2.toString(16).padStart(16, "0");
}
function chatKey(st) {
  const conversation = scalarId(st.chatId);
  const identity = typeof st.groupId === "string" || typeof st.groupId === "number" ? `group:${st.groupId}:${conversation}` : `character:${scalarId(st.characterId)}:${conversation}`;
  return `chat:${comparisonDigest(identity)}`;
}
function readPageSummary() {
  const st = getST();
  const chat2 = st?.chat;
  const chatSummary = Array.isArray(chat2) ? {
    available: true,
    value: {
      chatKey: chatKey(st ?? {}),
      messageCount: chat2.length,
      userMessageCount: chat2.filter((message) => typeof message === "object" && message !== null && message.is_user === true).length,
      assistantMessageCount: chat2.filter((message) => typeof message === "object" && message !== null && message.is_user === false && message.is_system !== true).length
    }
  } : { available: false, reason: "聊天摘要不可用" };
  const root = typeof document === "undefined" ? null : document.querySelector("#chat");
  const dom = root ? {
    available: true,
    value: {
      renderedMessageCount: root.querySelectorAll(".mes").length,
      chatNodeCount: root.querySelectorAll("*").length + 1
    }
  } : { available: false, reason: "未找到 #chat DOM" };
  return { chat: chatSummary, dom };
}
function resourceGroupKey(url, initiatorType) {
  const marker = "/scripts/extensions/";
  const markerIndex = url.pathname.indexOf(marker);
  if (markerIndex >= 0) {
    const segments = url.pathname.slice(markerIndex + marker.length).split("/").filter(Boolean);
    if (segments.length < 2) return null;
    const extensionName = segments[0] === "third-party" && segments.length >= 3 ? `third-party/${segments[1]}` : segments[0];
    return `extension:${extensionName}`;
  }
  const kinds = {
    img: "image",
    image: "image",
    script: "script",
    link: "stylesheet",
    css: "stylesheet",
    font: "font",
    audio: "media",
    video: "media",
    iframe: "document",
    fetch: "fetch",
    xmlhttprequest: "fetch"
  };
  const kind = typeof initiatorType === "string" ? kinds[initiatorType.toLowerCase()] ?? "other" : "other";
  return `resource:${kind}`;
}
function evidenceNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
function groupResourceTimings(entries) {
  const groups = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    let url;
    try {
      url = new URL(entry.name);
    } catch {
      continue;
    }
    const key = resourceGroupKey(url, entry.initiatorType);
    if (!key) continue;
    const current2 = groups.get(key) ?? { key, count: 0, transferSize: 0, durationMs: 0 };
    current2.count += 1;
    current2.transferSize += evidenceNumber(entry.transferSize);
    current2.durationMs += evidenceNumber(entry.duration);
    groups.set(key, current2);
  }
  return [...groups.values()];
}
async function defaultModuleLoader(specifier) {
  return import(specifier);
}
function isSelfExtension(name) {
  return name === "st-stage" || name === "third-party/st-stage";
}
function createButlerBridge(deps = {}) {
  const loadModule = deps.loadModule ?? defaultModuleLoader;
  let extensionContractPromise;
  const loadExtensionContract = () => {
    extensionContractPromise ?? (extensionContractPromise = loadModule("/scripts/extensions.js").then(inspectExtensionModule).catch(() => {
      const reason = "无法加载 SillyTavern 扩展接口";
      return { status: "unavailable", reason, governance: { writable: false, reason } };
    }));
    return extensionContractPromise;
  };
  const findExtension = async (name) => {
    const contract = await loadExtensionContract();
    if (contract.status !== "ready") {
      return { ok: false, code: "api-unavailable", error: contract.reason };
    }
    try {
      const rawFound = contract.api.findExtension(name);
      if (rawFound === null) return { ok: false, code: "not-found", error: "未找到扩展" };
      const found = parseFoundExtension(rawFound);
      if (!found) {
        return { ok: false, code: "invalid-response", error: "SillyTavern findExtension 返回格式无效" };
      }
      return { ok: true, extension: found };
    } catch {
      return { ok: false, code: "api-error", error: "SillyTavern 扩展接口调用失败" };
    }
  };
  return {
    readPageSummary,
    readMobileState,
    readHealthState,
    async readExtensions() {
      const contract = await loadExtensionContract();
      if (contract.status !== "ready") {
        return {
          status: "unavailable",
          reason: contract.reason,
          governance: contract.governance,
          disabledExtensions: [],
          extensions: []
        };
      }
      const disabled = contract.api.extensionSettings.disabledExtensions;
      const extensions = contract.api.extensionNames.map((name) => {
        let rawManifest;
        try {
          rawManifest = contract.api.getExtensionManifest(name);
        } catch {
          rawManifest = null;
        }
        return {
          name,
          type: contract.api.extensionTypes[name] ?? "unknown",
          configuredEnabled: !disabled.includes(name),
          isSelf: isSelfExtension(name),
          manifest: summarizeExtensionManifest(rawManifest)
        };
      });
      return {
        status: "ready",
        governance: contract.governance,
        disabledExtensions: [...disabled],
        extensions
      };
    },
    findExtension,
    async setExtensionEnabled(name, enabled) {
      const contract = await loadExtensionContract();
      if (contract.status !== "ready") {
        return { ok: false, code: "api-unavailable", error: contract.reason };
      }
      if (!contract.governance.writable || !contract.api.enableExtension || !contract.api.disableExtension) {
        return {
          ok: false,
          code: "read-only",
          error: contract.governance.reason ?? "SillyTavern 扩展治理当前只读"
        };
      }
      const found = await findExtension(name);
      if (!found.ok) {
        return found.code === "not-found" ? { ok: false, code: "not-found", error: found.error } : { ok: false, code: "api-error", error: "SillyTavern 扩展接口调用失败" };
      }
      if (!enabled && isSelfExtension(found.extension.name)) {
        return { ok: false, code: "protected", error: "管家不能禁用 st-stage 自身" };
      }
      try {
        const toggle = enabled ? contract.api.enableExtension : contract.api.disableExtension;
        await Promise.resolve(toggle(found.extension.name, false));
        return {
          ok: true,
          name: found.extension.name,
          configuredEnabled: enabled,
          reloadRequired: true
        };
      } catch {
        return { ok: false, code: "api-error", error: "SillyTavern 扩展接口调用失败" };
      }
    }
  };
}

// st-extension/src/apps/butler/metrics.ts
var BUTLER_PROBE_DURATION_MS = 6e3;
var TIMER_INTERVAL_MS = 100;
function abortError() {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}
function runProbeTimeline(durationMs, signal, handlers, deps = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
  setTimer: (callback, ms) => window.setTimeout(callback, ms),
  clearTimer: (id) => window.clearTimeout(id)
}) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const startedAt = deps.now();
    let frameId = null;
    let timerId = null;
    let finishId = null;
    let settled = false;
    let nextTimerAt = TIMER_INTERVAL_MS;
    const cleanup = () => {
      if (frameId !== null) deps.cancelFrame(frameId);
      if (timerId !== null) deps.clearTimer(timerId);
      if (finishId !== null) deps.clearTimer(finishId);
      signal.removeEventListener("abort", onAbort);
      frameId = timerId = finishId = null;
    };
    const settle = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => settle(abortError());
    const frame = (time) => {
      if (settled || signal.aborted) return;
      handlers.onFrame(time - startedAt);
      frameId = deps.requestFrame(frame);
    };
    const timer = () => {
      if (settled || signal.aborted) return;
      const elapsed = deps.now() - startedAt;
      handlers.onTimer(nextTimerAt, elapsed);
      nextTimerAt += TIMER_INTERVAL_MS;
      timerId = deps.setTimer(timer, Math.max(0, nextTimerAt - elapsed));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    frameId = deps.requestFrame(frame);
    timerId = deps.setTimer(timer, TIMER_INTERVAL_MS);
    finishId = deps.setTimer(() => settle(), durationMs);
  });
}
function available(id) {
  return { id, available: true };
}
function unavailable(id, reason) {
  return { id, available: false, reason };
}
function finiteNonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
function percentile95(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}
function summarizeMedia(root, viewport) {
  const kinds = {
    images: "img",
    videos: "video",
    audio: "audio",
    canvas: "canvas",
    iframes: "iframe"
  };
  const result = {};
  let visible = 0;
  let offscreen = 0;
  for (const [key, selector] of Object.entries(kinds)) {
    const nodes = [...root.querySelectorAll(selector)];
    result[key] = nodes.length;
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      const intersects = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < viewport.height && rect.left < viewport.width;
      if (intersects) visible += 1;
      else offscreen += 1;
    }
  }
  return { ...result, visible, offscreen };
}
function sanitizeResourceGroups(groups) {
  const aggregated = /* @__PURE__ */ new Map();
  for (const group of groups) {
    const key = group.key.startsWith("extension:") ? group.key : `resource:${group.key.startsWith("resource:") ? group.key.slice("resource:".length) || "other" : "other"}`;
    const current2 = aggregated.get(key) ?? { key, count: 0, transferSize: 0, durationMs: 0 };
    current2.count += finiteNonNegative(group.count);
    current2.transferSize += finiteNonNegative(group.transferSize);
    current2.durationMs += finiteNonNegative(group.durationMs);
    aggregated.set(key, current2);
  }
  return [...aggregated.values()];
}
function combineSignals(external) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (external?.aborted) controller.abort();
  else external?.addEventListener("abort", onAbort, { once: true });
  return {
    controller,
    cleanup: () => external?.removeEventListener("abort", onAbort)
  };
}
function invalidReasonFromError(error, fallback) {
  return error instanceof Error && error.name === "AbortError" ? fallback : "采样失败，请重试";
}
function createMetricsSampler(deps) {
  const collectStatic = async (probe = "static") => {
    const page = deps.readPageSummary();
    const perf = deps.readPerfState();
    const capabilities = [];
    const metrics = {};
    if (page.chat.available && page.dom.available) {
      capabilities.push(available("pageSummary"));
      metrics.page = {
        messageCount: page.chat.value.messageCount,
        userMessageCount: page.chat.value.userMessageCount,
        assistantMessageCount: page.chat.value.assistantMessageCount,
        renderedMessageCount: page.dom.value.renderedMessageCount,
        chatNodeCount: page.dom.value.chatNodeCount
      };
    } else {
      capabilities.push(unavailable(
        "pageSummary",
        [page.chat, page.dom].filter((entry) => !entry.available).map((entry) => entry.reason).join("；")
      ));
    }
    if (perf.status !== "unavailable") {
      capabilities.push(available("performanceSettings"));
      metrics.performanceSettings = { ...perf.snapshot };
    } else {
      capabilities.push(unavailable("performanceSettings", perf.reason ?? "性能设置不可用"));
    }
    const root = deps.getChatScroller() ?? document;
    metrics.media = summarizeMedia(root, deps.getViewport());
    capabilities.push(available("mediaDom"));
    const resourceEvidence = deps.readResourceGroups();
    if (resourceEvidence === null) {
      capabilities.push(unavailable("resourceTiming", "当前浏览器不支持资源加载记录"));
    } else {
      metrics.resources = { groups: sanitizeResourceGroups(resourceEvidence) };
      capabilities.push(available("resourceTiming"));
    }
    const storage = await deps.estimateStorage();
    if (storage) {
      metrics.storage = {
        usageBytes: finiteNonNegative(storage.usage),
        quotaBytes: finiteNonNegative(storage.quota)
      };
      capabilities.push(available("storageEstimate"));
    } else {
      capabilities.push(unavailable("storageEstimate", "当前浏览器不支持站点存储检查"));
    }
    const heap = deps.readHeapBytes();
    if (heap === null) capabilities.push(unavailable("jsHeap", "当前浏览器不支持网页内存信息"));
    else {
      metrics.heap = { usedBytes: finiteNonNegative(heap) };
      capabilities.push(available("jsHeap"));
    }
    const animationCount2 = deps.countAnimations();
    if (animationCount2 === null) capabilities.push(unavailable("cssAnimations", "当前浏览器不支持动画数量统计"));
    else {
      metrics.animations = { running: finiteNonNegative(animationCount2) };
      capabilities.push(available("cssAnimations"));
    }
    return {
      id: deps.createId(),
      createdAt: deps.now(),
      durationMs: probe === "static" ? 0 : BUTLER_PROBE_DURATION_MS,
      probe,
      foreground: deps.isForeground(),
      ...page.chat.available ? { chatKey: page.chat.value.chatKey } : {},
      environment: await deps.readEnvironment(),
      capabilities,
      metrics
    };
  };
  const sampleDynamic = async (probe, signal, onFrameEffect) => {
    const snapshot = await collectStatic(probe);
    const combined = combineSignals(signal);
    const controller = combined.controller;
    const initialGenerating = deps.isGenerating();
    if (initialGenerating === null) {
      combined.cleanup();
      snapshot.invalidReason = "无法读取生成状态，采样未开始";
      return snapshot;
    }
    if (initialGenerating) {
      combined.cleanup();
      snapshot.invalidReason = "当前正在生成，采样未开始";
      return snapshot;
    }
    const initialPage = snapshot.metrics.page;
    const initialPageRecord = initialPage && typeof initialPage === "object" && !Array.isArray(initialPage) ? initialPage : null;
    const frameIntervals = [];
    const timerDelays = [];
    const longTasks = [];
    let previousFrame = null;
    let cancellationReason = "";
    let longTaskSubscription = null;
    let userInterfered = false;
    const userEvents = ["wheel", "pointerdown", "touchstart", "keydown", "input"];
    const onUserInterference = () => {
      userInterfered = true;
    };
    const cancel = (reason) => {
      if (!cancellationReason) cancellationReason = reason;
      controller.abort();
    };
    const onVisibility = () => {
      if (!deps.isForeground()) cancel("页面进入后台，采样已取消，请重试");
    };
    document.addEventListener("visibilitychange", onVisibility);
    for (const event of userEvents) document.addEventListener(event, onUserInterference, true);
    try {
      if (!deps.isForeground()) cancel("页面进入后台，采样已取消，请重试");
      longTaskSubscription = deps.observeLongTasks((duration) => {
        if (Number.isFinite(duration) && duration >= 0) longTasks.push(duration);
      });
      snapshot.capabilities.push(longTaskSubscription ? available("longTasks") : unavailable("longTasks", "当前浏览器不支持页面卡顿记录"));
      await deps.runTimeline(BUTLER_PROBE_DURATION_MS, controller.signal, {
        onFrame(time) {
          if (!deps.isForeground()) {
            cancel("页面进入后台，采样已取消，请重试");
            return;
          }
          if (userInterfered) cancel("检测到用户干预，采样已取消");
          const generating = deps.isGenerating();
          if (generating === null) cancel("无法读取生成状态，采样已取消");
          else if (generating !== initialGenerating) cancel("生成状态发生变化，采样已取消");
          const currentPage = deps.readPageSummary();
          if (snapshot.chatKey && currentPage.chat.available && currentPage.chat.value.chatKey !== snapshot.chatKey) {
            cancel("聊天已切换，采样已取消");
          }
          if (initialPageRecord && currentPage.dom.available) {
            const initialRendered = initialPageRecord.renderedMessageCount;
            const initialNodes = initialPageRecord.chatNodeCount;
            if (currentPage.dom.value.renderedMessageCount !== initialRendered || currentPage.dom.value.chatNodeCount !== initialNodes) {
              cancel("聊天布局变化，采样已取消");
            }
          }
          const reason = onFrameEffect?.(time);
          if (reason) cancel(reason);
          if (previousFrame !== null) frameIntervals.push(Math.max(0, time - previousFrame));
          previousFrame = time;
        },
        onTimer(scheduled, actual) {
          timerDelays.push(Math.max(0, actual - scheduled));
        }
      });
    } catch (error) {
      cancellationReason || (cancellationReason = invalidReasonFromError(error, signal?.aborted ? "用户取消了采样" : "采样已取消，请重试"));
    } finally {
      document.removeEventListener("visibilitychange", onVisibility);
      for (const event of userEvents) document.removeEventListener(event, onUserInterference, true);
      longTaskSubscription?.disconnect();
      combined.cleanup();
    }
    const animationCount2 = deps.countAnimations();
    snapshot.metrics.dynamic = {
      frameSamples: frameIntervals.length,
      frameIntervalP95Ms: percentile95(frameIntervals),
      frameIntervalsOver50Ms: frameIntervals.filter((value) => value > 50).length,
      timerDelayP95Ms: percentile95(timerDelays),
      longTaskCount: longTasks.length,
      longTaskTotalMs: longTasks.reduce((sum, value) => sum + value, 0),
      longestTaskMs: longTasks.length > 0 ? Math.max(...longTasks) : 0,
      ...animationCount2 === null ? {} : { cssAnimationCount: animationCount2 }
    };
    if (cancellationReason) snapshot.invalidReason = cancellationReason;
    return snapshot;
  };
  return {
    collectStatic: () => collectStatic("static"),
    sampleIdle: (signal) => sampleDynamic("idle", signal),
    async sampleControlledScroll(signal) {
      const chat2 = deps.getChatScroller();
      const originalTop = chat2?.scrollTop ?? 0;
      const initialHeight = chat2?.scrollHeight ?? 0;
      const initialClientHeight = chat2?.clientHeight ?? 0;
      const initialGenerating = deps.isGenerating();
      let userInterfered = false;
      let localReason = "";
      const userEvents = ["wheel", "pointerdown", "touchstart", "keydown", "input"];
      const onUserInterference = () => {
        userInterfered = true;
      };
      if (!chat2) {
        const snapshot = await collectStatic("controlledScroll");
        snapshot.invalidReason = "未找到聊天滚动区域";
        return snapshot;
      }
      if (initialHeight < initialClientHeight * 3) {
        const snapshot = await collectStatic("controlledScroll");
        snapshot.invalidReason = "聊天区域不足三个视口高度，无法安全运行受控滚动";
        return snapshot;
      }
      if (initialGenerating === null) {
        const snapshot = await collectStatic("controlledScroll");
        snapshot.invalidReason = "无法读取生成状态，采样未开始";
        return snapshot;
      }
      if (initialGenerating) {
        const snapshot = await collectStatic("controlledScroll");
        snapshot.invalidReason = "生成状态发生变化或当前正在生成，采样已取消";
        return snapshot;
      }
      const baseline = deps.readPageSummary();
      const baselineChatKey = baseline.chat.available ? baseline.chat.value.chatKey : null;
      const maxScroll = Math.max(0, initialHeight - initialClientHeight);
      const distance = Math.min(initialClientHeight * 1.5, Math.max(0, maxScroll - initialClientHeight));
      for (const event of userEvents) chat2.addEventListener(event, onUserInterference, { passive: true });
      chat2.scrollTop = maxScroll;
      try {
        const snapshot = await sampleDynamic("controlledScroll", signal, (time) => {
          if (userInterfered) localReason || (localReason = "检测到用户干预，采样已取消");
          if (chat2.scrollHeight !== initialHeight || chat2.clientHeight !== initialClientHeight) {
            localReason || (localReason = "聊天布局变化，采样已取消");
          }
          const generating2 = deps.isGenerating();
          if (generating2 === null) localReason || (localReason = "无法读取生成状态，采样已取消");
          else if (generating2 !== initialGenerating) localReason || (localReason = "生成状态发生变化，采样已取消");
          const progress = Math.min(1, Math.max(0, time / BUTLER_PROBE_DURATION_MS));
          chat2.scrollTop = progress <= 0.5 ? maxScroll - distance * progress * 2 : maxScroll - distance + distance * (progress - 0.5) * 2;
          return localReason || null;
        });
        const after = deps.readPageSummary();
        if (baselineChatKey && after.chat.available && after.chat.value.chatKey !== baselineChatKey) {
          localReason || (localReason = "聊天已切换，采样已取消");
        }
        if (chat2.scrollHeight !== initialHeight || chat2.clientHeight !== initialClientHeight) {
          localReason || (localReason = "聊天布局变化，采样已取消");
        }
        if (userInterfered) localReason || (localReason = "检测到用户干预，采样已取消");
        const generating = deps.isGenerating();
        if (generating === null) localReason || (localReason = "无法读取生成状态，采样已取消");
        else if (generating !== initialGenerating) localReason || (localReason = "生成状态发生变化，采样已取消");
        snapshot.metrics.controlledScroll = {
          valid: !snapshot.invalidReason && !localReason,
          originalTop,
          distance
        };
        if (localReason) snapshot.invalidReason = localReason;
        return snapshot;
      } finally {
        for (const event of userEvents) chat2.removeEventListener(event, onUserInterference);
        chat2.scrollTop = originalTop;
      }
    }
  };
}

// st-extension/src/apps/butler/runtime.ts
function observed(value, reason) {
  return value === null ? { available: false, reason } : { available: true, value };
}
function buildVersion() {
  if (false) return null;
  return `${"0.9.0"}+${"2026-08-18 23:07"}`;
}
function stVersion() {
  const text3 = document.querySelector("#version_display")?.textContent?.trim();
  return text3 || null;
}
function digest(values) {
  let hash2 = 0xcbf29ce484222325n;
  for (const value of values.sort().join("\0")) {
    hash2 ^= BigInt(value.charCodeAt(0));
    hash2 = BigInt.asUintN(64, hash2 * 0x100000001b3n);
  }
  return hash2.toString(16).padStart(16, "0");
}
function storageFallback() {
  return {
    getItem() {
      return null;
    },
    setItem() {
    },
    removeItem() {
    }
  };
}
function recoveryStorage() {
  let storage;
  try {
    storage = window.localStorage;
  } catch {
    return storageFallback();
  }
  return {
    getItem(key) {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        storage.setItem(key, value);
      } catch {
      }
    },
    removeItem(key) {
      try {
        storage.removeItem(key);
      } catch {
      }
    }
  };
}
function resourceGroups2() {
  if (typeof performance?.getEntriesByType !== "function") return null;
  try {
    const entries = performance.getEntriesByType("resource").map((entry) => {
      const resource = entry;
      return {
        name: resource.name,
        initiatorType: resource.initiatorType,
        transferSize: resource.transferSize,
        duration: resource.duration
      };
    });
    return groupResourceTimings(entries);
  } catch {
    return null;
  }
}
function observeLongTasks(record) {
  if (typeof PerformanceObserver === "undefined" || !PerformanceObserver.supportedEntryTypes?.includes("longtask")) return null;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) record(entry.duration);
    });
    observer.observe({ type: "longtask", buffered: false });
    return { disconnect: () => observer.disconnect() };
  } catch {
    return null;
  }
}
function animationCount() {
  const getAnimations = document.getAnimations;
  if (typeof getAnimations !== "function") return null;
  try {
    return getAnimations.call(document).filter((animation) => animation.playState === "running").length;
  } catch {
    return null;
  }
}
function createNativeServices(deps = {}) {
  const bridge = deps.bridge ?? createButlerBridge();
  const loadScriptModule = deps.loadScriptModule ?? ((specifier) => import(specifier));
  const now = deps.now ?? (() => Date.now());
  const createId = deps.createId ?? (() => crypto.randomUUID?.() ?? `butler-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const reloadNow = deps.reloadNow ?? (() => window.location.reload());
  const delay2 = deps.delay ?? ((ms) => new Promise((resolve) => window.setTimeout(resolve, ms)));
  let generationReader = null;
  let settingsWriter = null;
  let generationContractPromise = null;
  const loadGenerationContract = async () => {
    if (generationReader) return true;
    generationContractPromise ?? (generationContractPromise = (async () => {
      try {
        const specifier = "/script.js";
        const module = await loadScriptModule(specifier);
        if (typeof module.isGenerating === "function") {
          generationReader = module.isGenerating;
        }
        if (typeof module.saveSettings === "function") settingsWriter = module.saveSettings;
        return generationReader !== null;
      } catch {
        generationReader = null;
      }
      return false;
    })().finally(() => {
      generationContractPromise = null;
    }));
    return generationContractPromise;
  };
  const readEnvironment = async () => {
    const perf = readPerfState();
    const extensions = await bridge.readExtensions();
    const mobile = readMobileState();
    return {
      stVersion: observed(stVersion(), "当前页面未公开 SillyTavern 版本文本"),
      stageBuild: observed(buildVersion(), "开发源码未注入构建戳"),
      mobile: mobile.available ? { available: true, value: mobile.value } : { available: false, reason: mobile.reason },
      settingsSummary: perf.status === "unavailable" ? { available: false, reason: perf.reason ?? "性能设置不可用" } : { available: true, value: { ...perf.snapshot } },
      disabledExtensionsHash: extensions.status === "ready" ? { available: true, value: digest([...extensions.disabledExtensions]) } : { available: false, reason: extensions.reason }
    };
  };
  const sampler = createMetricsSampler({
    now,
    createId,
    readEnvironment,
    readPageSummary: bridge.readPageSummary,
    readPerfState,
    readResourceGroups: resourceGroups2,
    async estimateStorage() {
      try {
        if (typeof navigator.storage?.estimate !== "function") return null;
        const estimate = await navigator.storage.estimate();
        return typeof estimate.usage === "number" && typeof estimate.quota === "number" ? { usage: estimate.usage, quota: estimate.quota } : null;
      } catch {
        return null;
      }
    },
    readHeapBytes() {
      const used = performance.memory?.usedJSHeapSize;
      return typeof used === "number" && Number.isFinite(used) ? used : null;
    },
    getChatScroller: () => document.querySelector("#chat"),
    getViewport: () => ({
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight
    }),
    countAnimations: animationCount,
    isForeground: () => document.visibilityState === "visible",
    isGenerating: () => {
      if (!generationReader) return null;
      try {
        return generationReader();
      } catch {
        return null;
      }
    },
    observeLongTasks,
    runTimeline: deps.runTimeline ?? ((durationMs, signal, handlers) => runProbeTimeline(durationMs, signal, handlers))
  });
  const beforeDynamicProbe = async () => {
    await loadGenerationContract();
  };
  const reloadPage = async () => {
    await loadGenerationContract();
    if (settingsWriter) {
      try {
        await settingsWriter();
      } catch {
        await delay2(1100);
      }
    } else {
      await delay2(1100);
    }
    reloadNow();
  };
  return {
    collectStatic: () => sampler.collectStatic(),
    async sampleIdle(signal) {
      await beforeDynamicProbe();
      return sampler.sampleIdle(signal);
    },
    async sampleControlledScroll(signal) {
      await beforeDynamicProbe();
      return sampler.sampleControlledScroll(signal);
    },
    readPerformance: () => readPerf(),
    writePerformance: (fields) => writePerf(fields),
    readMobile: readMobileState,
    readHealth: readHealthState,
    readExtensions: bridge.readExtensions,
    setExtensionEnabled: bridge.setExtensionEnabled,
    reloadPage,
    backupStorage: recoveryStorage(),
    warnRecovery: (command) => console.warn("[st-stage] 管家扩展治理紧急恢复命令：", command),
    now,
    createId,
    confirm: (message) => window.confirm(message)
  };
}
function createButlerAppServices(deps = {}) {
  return createNativeServices(deps);
}

// st-extension/src/apps/butler-app.ts
var FIELD_LABELS = {
  fast_ui_mode: "关闭背景模糊",
  reduced_motion: "减少动画效果",
  noShadows: "关闭阴影",
  smooth_streaming: "平滑文字更新",
  stream_fade_in: "文字淡入",
  streaming_fps: "流式更新频率",
  chat_truncation: "同时显示的消息数"
};
function valueText2(value) {
  if (typeof value === "boolean") return value ? "开" : "关";
  if (value === void 0) return "不可用";
  return String(value);
}
function text2(parent, value, className = "so-butler-text") {
  const node = el2("div", className);
  node.textContent = value;
  parent.append(node);
  return node;
}
function latestMeasurement(data, id) {
  const records = data.history.filter((record) => record.kind === "measurement");
  const target = id ? records.find((record) => record.measurement.id === id) : records.reduce((latest, record) => !latest || record.createdAt > latest.createdAt ? record : latest, null);
  return target?.measurement ?? null;
}
function measurementHistory(measurement, label, outcome = "completed") {
  return {
    id: `history-${measurement.id}`,
    kind: "measurement",
    createdAt: measurement.createdAt,
    completedAt: measurement.createdAt + measurement.durationMs,
    outcome,
    summary: {
      label,
      probe: measurement.probe,
      valid: !measurement.invalidReason
    },
    measurement
  };
}
function transactionHistory(transaction) {
  return {
    id: `history-${transaction.id}`,
    kind: "transaction",
    createdAt: transaction.createdAt,
    completedAt: transaction.completedAt ?? transaction.createdAt,
    outcome: transaction.status === "restored" ? "restored" : transaction.status === "failed" ? "failed" : "completed",
    summary: {
      label: transaction.status === "restored" ? "恢复性能设置" : "安全性能优化",
      applied: transaction.actions.filter((action) => action.status === "applied").length,
      failed: transaction.actions.filter((action) => action.status === "failed").length
    },
    transaction
  };
}
function experimentHistory(experiment, label) {
  return {
    id: `history-${experiment.id}-${experiment.completedAt ?? experiment.currentRound}`,
    kind: "experiment",
    createdAt: experiment.startedAt,
    completedAt: experiment.completedAt ?? experiment.startedAt,
    outcome: experiment.status === "failed" ? "failed" : "completed",
    summary: { label, candidates: experiment.candidateExtensions.length },
    experiment
  };
}
function currentDevice(services) {
  const mobile = services.readMobile();
  return mobile.available && mobile.value ? "mobile" : "desktop";
}
function upsertHistory(data, record) {
  return {
    ...data,
    history: [...data.history.filter((item) => item.id !== record.id), record]
  };
}
function butlerApp(serviceOverrides) {
  const services = serviceOverrides ?? createButlerAppServices();
  let activeState = null;
  return {
    id: "butler",
    name: "管家",
    icon: "🧹",
    order: 3,
    mount(container, ctx) {
      activeState?.controller?.abort();
      activeState = createState();
      mountButler(container, ctx, services, activeState);
    },
    unmount() {
      if (activeState) {
        activeState.disposed = true;
        activeState.controller?.abort();
      }
      activeState = null;
    }
  };
}
function createState() {
  return {
    measurement: null,
    findings: [],
    comparison: null,
    selectedProbe: "idle",
    sampling: false,
    applying: false,
    notice: "",
    noticeKind: "info",
    controller: null,
    disposed: false
  };
}
function mountButler(container, ctx, services, state) {
  let data = migrateButlerData(ctx.getAppData(), {
    now: services.now(),
    idFactory: services.createId
  });
  const persistData = (next, candidateHistoryId) => {
    const result = fitButlerDataBudget(next, void 0, candidateHistoryId);
    data = result.data;
    ctx.setAppData(data);
    if (result.status === "protected-over-budget" || result.status === "data-over-budget") {
      state.notice = "管家恢复状态已达到 64 KiB 上限；新的历史记录未保存。";
      state.noticeKind = "error";
    } else if (candidateHistoryId && !result.historyAccepted) {
      state.notice = "本次结果可查看，但因 64 KiB 上限未写入历史。";
      state.noticeKind = "info";
    }
    return data;
  };
  const setNotice = (message, kind = "info") => {
    state.notice = message;
    state.noticeKind = kind;
  };
  const safely = async (task) => {
    try {
      await task();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "操作失败，请重试", "error");
    }
    if (!state.disposed) render2();
  };
  const readPerformanceGroup = async () => {
    const current2 = services.readPerformance();
    if (!current2) throw new Error("当前 SillyTavern 性能设置不完整，无法安全写入");
    return { ...current2 };
  };
  const actionBridge = {
    readGroup: async (group) => {
      if (group !== "performanceSettings") throw new Error("当前主屏只能修改性能设置");
      return readPerformanceGroup();
    },
    writeGroup: async (group, fields) => {
      if (group !== "performanceSettings") throw new Error("当前主屏只能修改性能设置");
      await services.writePerformance(fields);
    },
    persistTransaction: async (transaction) => {
      data = persistData({ ...data, activeTransaction: transaction, performanceModeOn: transaction.status !== "restored" });
    },
    now: services.now,
    createId: services.createId
  };
  const experimentDeps = {
    readExtensions: services.readExtensions,
    setExtensionEnabled: services.setExtensionEnabled,
    persistExperiment: async (experiment) => {
      data = persistData({ ...data, pendingExperiment: experiment });
    },
    reloadPage: services.reloadPage,
    now: services.now,
    createId: services.createId,
    backupStorage: services.backupStorage,
    warnRecovery: services.warnRecovery
  };
  const runProbe = async (probe, forExperiment = false) => {
    state.sampling = true;
    const controller = new AbortController();
    state.controller = controller;
    setNotice(forExperiment ? "正在检查扩展关闭后的表现，请保持页面前台。" : "正在检查，请保持页面前台且不要操作聊天。");
    render2();
    try {
      const result = probe === "controlledScroll" ? await services.sampleControlledScroll(controller.signal) : await services.sampleIdle(controller.signal);
      state.measurement = result;
      state.findings = diagnose(result, services.readPerformance());
      setNotice(result.invalidReason ?? "6 秒体检完成。", result.invalidReason ? "error" : "success");
      return result;
    } finally {
      if (state.controller === controller) state.controller = null;
      state.sampling = false;
    }
  };
  const baselineForTransaction = () => {
    const baselineId = data.activeTransaction?.baselineMeasurementId;
    if (baselineId) return latestMeasurement(data, baselineId);
    const current2 = state.measurement;
    if (current2 && current2.probe !== "static") return current2;
    return null;
  };
  const applySafePlan = async (plan) => {
    if (state.applying || plan.actions.length === 0) return;
    state.applying = true;
    setNotice("正在逐项应用并回读 SillyTavern 实际值。");
    render2();
    try {
      let baseline = baselineForTransaction();
      if (!baseline || baseline.probe === "static" || baseline.invalidReason) {
        baseline = await runProbe(state.selectedProbe);
        const record = measurementHistory(
          baseline,
          "优化前基线",
          baseline.invalidReason ? "cancelled" : "completed"
        );
        data = persistData(upsertHistory(data, record), record.id);
        if (baseline.invalidReason) throw new Error(`优化前检查未完成：${baseline.invalidReason}`);
      }
      const transaction = await applyTransaction(plan.actions, actionBridge, baseline?.id);
      data = persistData(upsertHistory(data, transactionHistory(transaction)), `history-${transaction.id}`);
      setNotice(
        transaction.status === "applied" ? `已应用 ${transaction.actions.filter((action) => action.status === "applied").length} 项；可以再测一次，也可以随时恢复。` : "部分设置未成功写入，已保留事务和每项实际结果。",
        transaction.status === "applied" ? "success" : "error"
      );
      if (baseline && !data.history.some((record) => record.kind === "measurement" && record.measurement.id === baseline.id)) {
        const record = measurementHistory(baseline, "优化前基线", baseline.invalidReason ? "cancelled" : "completed");
        data = persistData(upsertHistory(data, record), record.id);
      }
    } finally {
      state.applying = false;
    }
  };
  const remeasure = async () => {
    if (state.sampling) return;
    const baseline = baselineForTransaction();
    if (!baseline || baseline.probe === "static") throw new Error("请先完成一次检查，再点“再测一次，比较优化前后”。");
    const result = await runProbe(baseline.probe);
    const record = measurementHistory(result, "优化后再次检查", result.invalidReason ? "cancelled" : "completed");
    data = persistData(upsertHistory(data, record), record.id);
    state.comparison = compareMeasurements(baseline, result);
    setNotice(
      state.comparison.comparable ? "两次检查条件一致，已显示优化前后的变化。" : `两次检查条件不同，暂时不能直接比较：${state.comparison.reasons.join("；")}。`,
      state.comparison.comparable ? "success" : "info"
    );
  };
  const restorePerformance = async () => {
    const transaction = data.activeTransaction;
    if (!transaction) return;
    let result = await restoreTransaction(transaction, actionBridge);
    if (result.conflicts.length > 0) {
      const lines = result.conflicts.map((conflict) => `${FIELD_LABELS[conflict.field] ?? conflict.field}：当前 ${valueText2(conflict.current)}，优化后 ${valueText2(conflict.after)}，原值 ${valueText2(conflict.before)}`);
      if (!services.confirm(`这些设置在优化后又被修改：
${lines.join("\n")}

仍要覆盖并恢复原值吗？`)) {
        setNotice("检测到后续修改，未覆盖当前设置。", "info");
        return;
      }
      result = await restoreTransaction(transaction, actionBridge, result.conflicts.map((item) => item.field));
    }
    if (result.transaction.restoreStatus === "restored") {
      const record = transactionHistory(result.transaction);
      data = persistData({
        ...upsertHistory(data, record),
        activeTransaction: null,
        performanceModeOn: false
      }, record.id);
      setNotice("已恢复到优化前设置。", "success");
    } else {
      data = persistData({ ...data, activeTransaction: result.transaction });
      setNotice(result.transaction.error ?? "部分设置未恢复，请查看冲突。", "error");
    }
  };
  const modalController = {
    getData: () => data,
    getMeasurement: () => state.measurement,
    getFindings: () => state.findings,
    getComparison: () => state.comparison,
    async startExperiment(kind, selected, inventory) {
      let baseline = state.measurement;
      if (!baseline || baseline.probe === "static" || baseline.invalidReason) {
        baseline = await runProbe(state.selectedProbe);
        if (baseline.invalidReason) throw new Error("排查前检查未完成，暂时不能关闭扩展");
      }
      const record = measurementHistory(baseline, "扩展排查前检查");
      data = persistData(upsertHistory(data, record), record.id);
      const prepared = prepareExtensionExperiment(kind, selected, inventory, baseline.id, {
        now: services.now,
        createId: services.createId
      });
      const result = await startExtensionExperiment(prepared, experimentDeps);
      data = persistData({ ...data, pendingExperiment: result.experiment });
      if (!result.batch.ok) throw new Error(result.experiment.notes ?? "扩展变更失败");
    },
    async sampleExperiment() {
      const pending = data.pendingExperiment;
      if (!pending || pending.status !== "sampling") throw new Error("当前没有等待检查的扩展排查");
      const baseline = latestMeasurement(data, pending.baselineMeasurementId);
      const probe = baseline?.probe === "controlledScroll" ? "controlledScroll" : "idle";
      const comparison = await runProbe(probe, true);
      const record = measurementHistory(comparison, "关闭扩展后检查", comparison.invalidReason ? "cancelled" : "completed");
      data = persistData(upsertHistory(data, record), record.id);
      if (comparison.invalidReason) throw new Error("关闭扩展后的检查未完成，请重试");
      const next = recordExperimentComparison(pending, comparison.id);
      data = persistData({ ...data, pendingExperiment: next });
      if (baseline) state.comparison = compareMeasurements(baseline, comparison);
    },
    async finishExperiment(decision) {
      const pending = data.pendingExperiment;
      if (!pending) return;
      const completed = await finishExtensionExperiment(pending, decision, experimentDeps);
      if (completed.status !== "completed") {
        data = persistData({ ...data, pendingExperiment: completed });
        throw new Error(completed.notes ?? "扩展清单恢复失败");
      }
      const record = experimentHistory(completed, decision === "keep" ? "保留扩展排查结果" : "恢复扩展状态");
      data = persistData({ ...upsertHistory(data, record), pendingExperiment: null }, record.id);
      setNotice(decision === "keep" ? "已保留当前扩展禁用结果。" : "已恢复最初扩展禁用清单。", "success");
    },
    async advanceBinary(symptomImproved) {
      const pending = data.pendingExperiment;
      if (!pending) return;
      if (pending.candidateExtensions.length <= 1) {
        setNotice(`已缩小到：${pending.candidateExtensions[0] ?? "无候选"}。可保留或恢复原清单。`, "success");
        return;
      }
      const next = await advanceBinaryIsolation(pending, symptomImproved, experimentDeps);
      data = persistData({ ...data, pendingExperiment: next });
    },
    async restoreEmergencyBackup(backup) {
      const result = await restoreEmergencyExtensionBackup(backup, experimentDeps);
      if (!result.ok) {
        throw new Error(`紧急恢复失败：${result.failed.map((item) => `${item.name}（${item.error}）`).join("、")}`);
      }
      setNotice("紧急扩展禁用清单已恢复。", "success");
    }
  };
  const renderPlan = (parent, plan) => {
    const changed = foldSection(`建议调整（${plan.actions.length}）`, true, "butler-plan-changed");
    if (plan.actions.length === 0) text2(changed.body, "当前设置已经不高于安全建议，不需要继续调整。");
    for (const action of plan.actions) {
      text2(changed.body, `${FIELD_LABELS[action.field] ?? action.label}：${valueText2(action.before)} → ${valueText2(action.requested)}${action.reloadRequired ? "（需刷新或重载聊天）" : ""}`);
    }
    parent.append(changed.box);
    const unchanged = foldSection(`保持不变（${plan.unchanged.length}）`, false, "butler-plan-unchanged");
    for (const action of plan.unchanged) {
      text2(unchanged.body, `${FIELD_LABELS[action.field] ?? action.label}：${valueText2(action.before)} → ${valueText2(action.requested)}`);
    }
    parent.append(unchanged.box);
  };
  const renderTransaction = (parent, transaction) => {
    const result = foldSection("本次实际修改", true, "butler-transaction-results");
    const statusLabels = {
      planned: "等待修改",
      applied: "已修改",
      failed: "修改失败",
      unchanged: "无需修改"
    };
    for (const action of transaction.actions) {
      const suffix = action.error ? ` · ${action.error}` : "";
      text2(result.body, `${action.label}：原来 ${valueText2(action.before)}，现在 ${valueText2(action.actual)} · ${statusLabels[action.status]}${action.reloadRequired ? " · 需要刷新或重载聊天" : ""}${suffix}`);
    }
    parent.append(result.box);
  };
  const render2 = () => {
    if (state.disposed) return;
    container.textContent = "";
    container.classList.add("so-butler-app");
    const current2 = services.readPerformance();
    const mobile = services.readMobile();
    const health = services.readHealth();
    const header = el2("div", "so-app-section so-butler-hero");
    const heading = el2("div", "so-app-title");
    heading.textContent = "环境体检";
    const summary = el2("div", "so-butler-summary-grid");
    const summaryItems = [
      ["设备", mobile.available ? mobile.value ? "移动端" : "桌面端" : "未知"],
      ["性能设置", current2 ? "可读写" : "不可用"],
      ["禁用扩展", health.disabledExtensions.available ? String(health.disabledExtensions.value) : "未知"],
      ["最近记录", String(data.history.length)]
    ];
    for (const [label, value] of summaryItems) {
      const item = el2("div", "so-butler-summary-item");
      const small = document.createElement("small");
      small.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = value;
      item.append(small, strong);
      summary.append(item);
    }
    header.append(heading, summary);
    if (!state.measurement) text2(header, "正在读取当前环境...", "so-butler-muted");
    else {
      text2(
        header,
        state.measurement.invalidReason ? `最近体检无效：${state.measurement.invalidReason}` : `最近检查：${state.measurement.probe === "static" ? "基础检查" : "6 秒检查"} · ${state.findings.length} 条发现`,
        state.measurement.invalidReason ? "so-butler-alert" : "so-butler-text"
      );
    }
    container.append(header);
    const guide = el2("div", "so-app-section so-butler-guide");
    const guideTitle = el2("div", "so-app-title");
    guideTitle.textContent = "使用步骤";
    guide.append(guideTitle);
    text2(guide, "1. 开始检查 → 2. 查看发现 → 3. 应用建议 → 4. 再测一次或恢复。", "so-butler-guide-steps");
    text2(guide, "管家只会调整可读写的性能设置，不会修改模型、提示词或聊天内容。每次修改都保留恢复入口。", "so-butler-muted");
    container.append(guide);
    const sampling = el2("div", "so-app-section");
    const sampleTitle = el2("div", "so-app-title");
    sampleTitle.textContent = "开始检查";
    sampling.append(sampleTitle);
    text2(sampling, "“不操作时检查”观察页面自己是否持续占用资源；“滚动长聊天检查”会自动滚动一小段并恢复原位置。切后台、生成回复、切换聊天或手动操作时，本次检查会取消。");
    sampling.append(selectRow(
      "检查方式",
      state.selectedProbe,
      [
        { value: "idle", label: "不操作时检查（6 秒）" },
        { value: "controlledScroll", label: "滚动长聊天检查（6 秒）" }
      ],
      (value) => {
        state.selectedProbe = value;
        render2();
      }
    ));
    if (state.sampling) sampling.append(appButton("取消本次检查", () => state.controller?.abort()));
    else sampling.append(appButton("开始 6 秒体检", () => void safely(async () => {
      const result = await runProbe(state.selectedProbe);
      const record = measurementHistory(result, result.probe === "idle" ? "静置体检" : "受控滚动体检", result.invalidReason ? "cancelled" : "completed");
      data = persistData(upsertHistory(data, record), record.id);
    })));
    container.append(sampling);
    const findingSection = foldSection(`检查发现（${state.findings.length}）`, true, "butler-findings");
    if (state.findings.length === 0) text2(findingSection.body, state.measurement ? "当前证据没有触发建议。" : "静态体检完成后显示。");
    for (const finding2 of state.findings.slice(0, 5)) renderFinding(findingSection.body, finding2);
    container.append(findingSection.box);
    const planSection = el2("div", "so-app-section");
    const planTitle = el2("div", "so-app-title");
    planTitle.textContent = "可以立即应用的建议";
    planSection.append(planTitle);
    if (!current2) {
      text2(planSection, "当前 SillyTavern 没有公开完整性能设置，管家只做只读体检。", "so-butler-alert");
    } else {
      const plan = buildSafePlan(current2, currentDevice(services));
      renderPlan(planSection, plan);
      if (data.activeTransaction) {
        renderTransaction(planSection, data.activeTransaction);
        const actions = el2("div", "so-butler-actions");
        actions.append(
          appButton(state.sampling ? "正在再次检查" : "再测一次，比较优化前后", () => void safely(remeasure)),
          appButton("恢复本次性能设置", () => void safely(restorePerformance))
        );
        planSection.append(actions);
      } else if (plan.actions.length > 0) {
        const apply = appButton(
          state.applying ? "正在应用建议" : `立即应用 ${plan.actions.length} 项建议`,
          () => void safely(() => applySafePlan(plan))
        );
        apply.classList.add("so-butler-primary-action");
        planSection.append(apply);
      } else {
        text2(planSection, "这里没有需要应用的设置。如果仍然卡顿，可以打开“临时关闭扩展找卡顿”逐个排查。", "so-butler-muted");
      }
    }
    if (state.comparison) {
      const comparison = foldSection("优化前后对比", true, "butler-comparison");
      text2(comparison.body, state.comparison.comparable ? "两次检查条件一致。下面的负数通常表示对应耗时或数量减少。" : `两次检查条件不同，暂不计算差值：${state.comparison.reasons.join("；")}。可在详细结果中查看两次原始数据。`);
      if (state.comparison.comparable) {
        for (const [key, delta] of Object.entries(state.comparison.deltas)) {
          text2(comparison.body, `${key} 差值：${delta >= 0 ? "+" : ""}${delta}`);
        }
      }
      planSection.append(comparison.box);
    }
    container.append(planSection);
    const modalActions = el2("div", "so-app-section so-butler-modal-actions");
    modalActions.append(
      appButton("查看详细结果", () => ctx.openModal(buildReportModal(modalController))),
      appButton("临时关闭扩展找卡顿", () => ctx.openModal(buildExtensionModal(services, modalController))),
      appButton("记忆与服务器设置建议", () => ctx.openModal(buildAdvisorModal(services)))
    );
    container.append(modalActions);
    if (data.pendingExperiment) {
      const pending = el2("div", "so-app-section so-butler-pending");
      text2(pending, `扩展排查进行中：${data.pendingExperiment.kind === "binaryIsolation" ? "分批缩小范围" : "对比所选扩展"} · 第 ${data.pendingExperiment.currentRound} 轮`);
      pending.append(appButton("继续排查扩展", () => ctx.openModal(buildExtensionModal(services, modalController))));
      container.append(pending);
    }
    if (state.notice) text2(container, state.notice, `so-butler-notice so-butler-notice-${state.noticeKind}`);
  };
  if (data.pendingExperiment?.status === "awaitingReload") {
    data = persistData({ ...data, pendingExperiment: resumeExtensionExperiment(data.pendingExperiment) });
  }
  persistData(data);
  render2();
  void safely(async () => {
    const measurement = await services.collectStatic();
    if (!state.measurement || state.measurement.probe === "static") {
      state.measurement = measurement;
      state.findings = diagnose(measurement, services.readPerformance());
    }
    if (!state.notice) setNotice("基础检查完成。需要观察页面运行时表现时，再运行 6 秒检查。", "success");
  });
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
function editKind(v, definition) {
  if (definition?.type === "number") return "number";
  if (definition?.type === "enum") return "enum";
  if (definition?.type === "boolean") return "boolean";
  if (definition?.type === "string") return "text";
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
function computeDelta(current2, prev, isMvu) {
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
  walk(current2, "");
  return delta;
}
function createVariableTreeView(container, handlers) {
  let editingPath = null;
  const groupOpen = /* @__PURE__ */ new Map();
  let addOpen = false;
  function render2() {
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
    if (model.allowAdd !== false) container.append(buildAddSection(model));
  }
  function appendNotice(text3) {
    const note = el2("div", "so-app-section");
    const d = el2("div", "so-app-desc");
    d.textContent = text3;
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
        render2();
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
    const definition = model.definitions?.find((item) => item.key === path);
    const kind = editKind(inner, definition);
    const wrap = el2("div", "vm-leaf vm-editing");
    const title2 = el2("div", "so-app-title vm-edit-title");
    title2.textContent = `${key} · ${valueTypeLabel(value, tuple)}`;
    wrap.append(title2);
    if (tuple) {
      const desc = el2("div", "vm-desc");
      desc.textContent = `描述：${value[1]}（保留不变，仅编辑值）`;
      wrap.append(desc);
    }
    const err = el2("div", "so-app-desc vm-add-err");
    err.hidden = true;
    let readValue;
    if (kind === "boolean") {
      const row = el2("label", "so-app-toggle checkbox_label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = inner === true;
      const label = document.createElement("span");
      label.textContent = "启用（true）";
      row.append(input, label);
      wrap.append(row);
      readValue = () => ({ ok: true, value: input.checked });
    } else if (kind === "enum") {
      const select = document.createElement("select");
      select.className = "text_pole so-app-input vm-edit-input";
      for (const value2 of definition?.enum ?? []) {
        const option = document.createElement("option");
        option.value = value2;
        option.textContent = value2;
        option.selected = value2 === inner;
        select.append(option);
      }
      wrap.append(select);
      readValue = () => ({ ok: true, value: select.value });
    } else if (kind === "number") {
      const input = document.createElement("input");
      input.type = "number";
      input.step = "any";
      input.className = "text_pole so-app-input vm-edit-input";
      input.value = typeof inner === "number" && Number.isFinite(inner) ? String(inner) : "";
      if (definition?.range) {
        input.min = String(definition.range[0]);
        input.max = String(definition.range[1]);
      }
      wrap.append(input);
      readValue = () => {
        if (input.value.trim() === "") return { ok: false, msg: "请输入有效数字。" };
        const value2 = Number(input.value);
        return Number.isFinite(value2) ? { ok: true, value: value2 } : { ok: false, msg: "请输入有效数字。" };
      };
      setTimeout(() => input.focus(), 0);
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
      readValue = () => ({ ok: true, value: definition?.type === "string" ? input.value : parseInputValue(input.value) });
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
      const committed = handlers.commitSet(path, r.value);
      if (committed && !committed.ok) {
        editingPath = path;
        err.textContent = committed.error;
        err.hidden = false;
      }
    });
    const cancel = el2("button", "menu_button vm-act vm-act-ghost");
    cancel.textContent = "取消";
    cancel.addEventListener("click", () => {
      editingPath = null;
      render2();
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
        const committed = handlers.commitSet(path, parseInputValue(valInput.value));
        if (committed && !committed.ok) {
          err.textContent = committed.error;
          err.hidden = false;
        }
      })
    );
    box.append(summary, body);
    return box;
  }
  return {
    render: render2,
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
  const chat2 = getST2()?.chat;
  if (Array.isArray(chat2) && chat2.length > 0) return chat2.length - 1;
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
        const section2 = el2("div", "so-app-section");
        section2.append(
          hintField(
            toggleRow("启用变量追踪", d.enabled, (v) => {
              ctx.setAppData({ ...runtime.getData(), enabled: v });
              runtime.onConfigChanged();
              renderCfg();
            }),
            "不依赖 MVU/酒馆助手：按你的变量定义自动向 AI 注入当前状态与更新规则，解析回复末尾的 <UpdateVariable> 并逐楼保存快照，任何角色卡都能用。变量定义、模板、注入预览都在「变量设计」里。"
          ),
          hintField(
            toggleRow("隐藏正文中的变量更新记录", d.hideUpdateBlocks, (v) => {
              ctx.setAppData({ ...runtime.getData(), hideUpdateBlocks: v });
              renderCfg();
            }),
            "只隐藏消息气泡里完整的 <UpdateVariable>...</UpdateVariable> 区块，不修改 SillyTavern 保存的原始回复，也不影响变量解析和楼层快照。"
          ),
          appButton("打开变量设计", openDesigner)
        );
        cfgBox.append(section2);
      }
      const tree = createVariableTreeView(stateBox, {
        getModel: () => {
          const st = runtime.isSTAvailable();
          const d = runtime.getData();
          const state = runtime.getCurrentState();
          return {
            data: state,
            definitions: d.schema.variables,
            isMvu: false,
            delta: computeDelta(state, runtime.getPrevState(), false),
            status: st ? "ready" : "unavailable",
            statusText: st ? `内置追踪 · ${d.enabled ? "已启用" : "未启用"}` : "内置追踪 · 模拟器",
            emptyText: "暂无变量。点上方「打开变量设计」定义或导入模板，启用后 AI 回复会逐楼更新这里。",
            noticeText: st ? void 0 : "未检测到 SillyTavern：模拟器中可打开变量设计编辑定义与预览注入，状态快照在 ST 内才会产生。",
            canWrite: st,
            allowAdd: false,
            addHint: "这里只能修改变量设计中已有的路径；新增变量请先在「变量设计」中添加定义。"
          };
        },
        commitSet: (path, value) => runtime.setManualValue(path, value),
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
var API_PROFILE_VERSION = 2;
var chat = (id, label, options = {}) => ({
  id,
  label,
  mainApi: "openai",
  sourceField: "chat_completion_source",
  connectSelector: "#api_button_openai",
  ...options
});
var API_SOURCES = [
  chat("openai", "OpenAI", { modelField: "openai_model", secretKey: "api_key_openai", modelSelector: "#model_openai_select", keySelector: "#api_key_openai" }),
  chat("claude", "Claude", { modelField: "claude_model", secretKey: "api_key_claude", modelSelector: "#model_claude_select", keySelector: "#api_key_claude" }),
  chat("openrouter", "OpenRouter", { modelField: "openrouter_model", secretKey: "api_key_openrouter", modelSelector: "#model_openrouter_select", keySelector: "#api_key_openrouter" }),
  chat("makersuite", "Google AI Studio", { modelField: "google_model", secretKey: "api_key_makersuite", modelSelector: "#model_google_select", keySelector: "#api_key_makersuite" }),
  chat("mistralai", "Mistral AI", { modelField: "mistralai_model", secretKey: "api_key_mistralai", modelSelector: "#mistralai_model", keySelector: "#api_key_mistralai" }),
  chat("cohere", "Cohere", { modelField: "cohere_model", secretKey: "api_key_cohere", modelSelector: "#cohere_model", keySelector: "#api_key_cohere" }),
  chat("groq", "Groq", { modelField: "groq_model", secretKey: "api_key_groq", modelSelector: "#groq_model", keySelector: "#api_key_groq" }),
  chat("deepseek", "DeepSeek", { modelField: "deepseek_model", secretKey: "api_key_deepseek", modelSelector: "#deepseek_model", keySelector: "#api_key_deepseek" }),
  chat("xai", "xAI", { modelField: "xai_model", secretKey: "api_key_xai", modelSelector: "#xai_model", keySelector: "#api_key_xai" }),
  chat("custom", "自定义（OpenAI 兼容）", { urlField: "custom_url", modelField: "custom_model", secretKey: "api_key_custom", urlSelector: "#custom_api_url_text", modelSelector: "#custom_model_id", keySelector: "#api_key_custom", supportsModels: true }),
  { id: "textgenerationwebui", mainApi: "textgenerationwebui", label: "Text Completion", urlField: "api_server_textgenerationwebui", connectSelector: "#api_button_textgenerationwebui", urlSelector: "#api_url_text" },
  { id: "novel", mainApi: "novel", label: "NovelAI", secretKey: "api_key_novel", connectSelector: "#api_button_novel", keySelector: "#api_key_novel" },
  { id: "kobold", mainApi: "kobold", label: "KoboldAI", urlField: "api_server", connectSelector: "#api_button", urlSelector: "#api_url_text" },
  { id: "koboldhorde", mainApi: "koboldhorde", label: "KoboldAI Horde", secretKey: "api_key_horde", connectSelector: "#api_button", keySelector: "#horde_api_key" }
];
var COMMON_CHAT_SOURCE_IDS = /* @__PURE__ */ new Set(["openai", "claude", "openrouter", "makersuite", "custom"]);
var COMMON_CHAT_SOURCES = API_SOURCES.filter(
  (item) => item.mainApi === "openai" && COMMON_CHAT_SOURCE_IDS.has(item.id)
);
function getSource(mainApi, source = "") {
  return API_SOURCES.find((item) => item.mainApi === mainApi && (item.mainApi !== "openai" || item.id === source)) ?? API_SOURCES.find((item) => item.mainApi === mainApi) ?? API_SOURCES.find((item) => item.id === "custom");
}
function emptyDraft() {
  return { name: "", mainApi: "openai", source: "custom", url: "", key: "", secretId: "", secretMode: "stored", model: "", settings: {} };
}
function normalizeUrl(value) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}
function str(value) {
  return typeof value === "string" ? value : "";
}
function newProfileId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function sanitizeAppData(raw) {
  const profiles = [];
  const list = raw?.profiles;
  if (!Array.isArray(list)) return { profiles };
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const p = item;
    const name = str(p.name).trim();
    if (!name) continue;
    const legacy = p.version !== API_PROFILE_VERSION;
    const mainApi = legacy ? "openai" : str(p.mainApi);
    const source = legacy ? "custom" : str(p.source);
    const url = normalizeUrl(str(p.url));
    const descriptor = getSource(mainApi, source);
    if (descriptor.urlField && !url) continue;
    const settings = !legacy && p.settings && typeof p.settings === "object" ? p.settings : {};
    if (legacy) {
      settings.custom_include_body = str(p.includeBody);
      settings.custom_exclude_body = str(p.excludeBody);
      settings.custom_include_headers = str(p.includeHeaders);
    }
    profiles.push({
      version: 2,
      id: str(p.id) || newProfileId(),
      name,
      mainApi,
      source: descriptor.id,
      url,
      key: str(p.key),
      secretId: str(p.secretId),
      secretMode: str(p.secretMode) || (str(p.key) ? "legacy" : "unavailable"),
      model: str(p.model).trim(),
      settings
    });
  }
  return { profiles };
}
function validateDraft(draft) {
  if (!draft.name.trim()) return "给连接档案起个名称吧。";
  const descriptor = getSource(draft.mainApi, draft.source);
  if (descriptor.urlField) {
    const url = normalizeUrl(draft.url);
    if (!url) return "这个来源需要填写接口地址 URL。";
    if (!/^https?:\/\//i.test(url)) return "接口地址要以 http:// 或 https:// 开头。";
  }
  return null;
}
function upsertProfile(profiles, draft, editingId) {
  const invalid = validateDraft(draft);
  if (invalid) return { error: invalid };
  const name = draft.name.trim();
  if (profiles.some((p) => p.name === name && p.id !== editingId)) return { error: `连接档案「${name}」已存在。` };
  const clean2 = { ...draft, version: 2, name, url: normalizeUrl(draft.url), model: draft.model.trim(), settings: { ...draft.settings } };
  if (editingId) {
    const index = profiles.findIndex((p) => p.id === editingId);
    if (index < 0) return { error: "要编辑的连接档案已不存在。" };
    const next = [...profiles];
    next[index] = { ...clean2, id: editingId };
    return { profiles: next };
  }
  return { profiles: [...profiles, { ...clean2, id: newProfileId() }] };
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
function findActiveProfile(profiles, current2, currentModel = "") {
  const identity = typeof current2 === "string" ? { mainApi: "openai", source: "custom", url: current2, model: currentModel } : current2;
  const candidates = profiles.filter((p) => p.mainApi === identity.mainApi && (p.mainApi !== "openai" || p.source === identity.source) && (!p.url || normalizeUrl(p.url) === normalizeUrl(identity.url)));
  return candidates.find((p) => p.model && p.model === identity.model) ?? candidates[0];
}
function profileSummary(profile) {
  const source = getSource(profile.mainApi, profile.source);
  return [source.label, profile.url || "", profile.model || "", profile.key || profile.secretId ? "已配 Key" : "缺 Key"].filter(Boolean);
}
function parseModelList(json) {
  if (json && typeof json === "object" && "error" in json && json.error) {
    const message = json.message;
    throw new Error(typeof message === "string" && message ? message : "站点接口返回了错误");
  }
  const box = json;
  const arr = Array.isArray(box) ? box : Array.isArray(box?.data) ? box.data : Array.isArray(box?.models) ? box.models : [];
  const names = arr.map((m) => typeof m === "string" ? m : m && typeof m === "object" ? str(m.id) || str(m.model) || str(m.name) : "").filter(Boolean);
  if (!names.length) throw new Error("站点没有返回任何模型");
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
function readString(object, key) {
  const value = key ? object?.[key] : void 0;
  return typeof value === "string" ? value : "";
}
function settingsFor(st, mainApi) {
  return mainApi === "openai" ? st.chatCompletionSettings ?? {} : st.textCompletionSettings ?? st.powerUserSettings ?? {};
}
var SOURCE_SETTING_KEYS = ["custom_include_body", "custom_exclude_body", "custom_include_headers"];
async function secretRequest(path, body, st) {
  return fetch(`/api/secrets/${path}`, { method: "POST", headers: st.getRequestHeaders?.() ?? { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
async function readSecret(st, secretKey, secretId = "") {
  if (!secretKey) return { key: "", mode: "unavailable" };
  try {
    const response = await secretRequest("find", { key: secretKey, id: secretId }, st);
    if (!response.ok) return { key: "", mode: "unavailable" };
    const json = await response.json();
    return { key: typeof json.value === "string" ? json.value : "", mode: "read" };
  } catch {
    return { key: "", mode: "unavailable" };
  }
}
async function readConnection() {
  const st = getST3();
  if (!st) return null;
  const mainApi = st.mainApi ?? (document.querySelector("#main_api")?.value || "openai");
  const settings = settingsFor(st, mainApi);
  const source = mainApi === "openai" ? readString(settings, "chat_completion_source") || document.querySelector("#chat_completion_source")?.value || "openai" : mainApi;
  const descriptor = getSource(mainApi, source);
  const secretId = readString(settings, `${descriptor.secretKey}_id`) || readString(settings, "secret_id");
  const secret = await readSecret(st, descriptor.secretKey, secretId);
  const snapshot = {};
  for (const key of SOURCE_SETTING_KEYS) {
    const value = settings[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") snapshot[key] = value;
  }
  return {
    mainApi,
    source: descriptor.id,
    url: readString(settings, descriptor.urlField) || (descriptor.urlSelector ? document.querySelector(descriptor.urlSelector)?.value ?? "" : ""),
    model: readString(settings, descriptor.modelField) || (descriptor.modelSelector ? document.querySelector(descriptor.modelSelector)?.value ?? "" : ""),
    online: (st.onlineStatus ?? "no_connection") !== "no_connection",
    settings: snapshot,
    key: secret.key,
    secretId,
    secretMode: secret.mode
  };
}
function onOnlineStatusChanged(handler) {
  const st = getST3();
  const source = st?.eventSource;
  if (!source) return () => {
  };
  const eventName = st.event_types?.ONLINE_STATUS_CHANGED ?? "online_status_changed";
  source.on(eventName, handler);
  return () => source.removeListener(eventName, handler);
}
function dispatchValue(element2, value) {
  element2.value = value;
  element2.dispatchEvent(new Event("input", { bubbles: true }));
  element2.dispatchEvent(new Event("change", { bubbles: true }));
}
var sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function waitFor(selector, timeout = 2500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const element2 = document.querySelector(selector);
    if (element2) return element2;
    await sleep(50);
  }
  return null;
}
async function waitForValue(element2, value, timeout = 5e3) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (element2 instanceof HTMLSelectElement) {
      if ([...element2.options].some((option) => option.value === value)) return true;
    } else if (element2.value === value) return true;
    await sleep(80);
  }
  return false;
}
async function waitForConnection(profile, timeout = 8e3) {
  const start = Date.now();
  let latest = null;
  while (Date.now() - start < timeout) {
    latest = await readConnection();
    const sourceMatches = latest?.mainApi === profile.mainApi && (profile.mainApi !== "openai" || latest.source === profile.source);
    const modelMatches = !profile.model || latest?.model === profile.model;
    if (latest?.online && sourceMatches && modelMatches) return latest;
    await sleep(120);
  }
  if (profile.model && (!latest?.model || latest.model.toLowerCase() === "none")) throw new Error(`模型「${profile.model}」尚未加载，未将 NONE 视为切换成功`);
  throw new Error(`连接回验超时${latest?.model ? `（当前模型：${latest.model}）` : ""}`);
}
async function writeSecret(st, profile) {
  const descriptor = getSource(profile.mainApi, profile.source);
  if (!descriptor.secretKey || !profile.key) return;
  let response = await secretRequest("write", { key: descriptor.secretKey, value: profile.key, id: profile.secretId }, st);
  if (!response.ok && profile.secretId) response = await secretRequest("write", { key: descriptor.secretKey, value: profile.key }, st);
  if (!response.ok) throw new Error(`密钥写入 ST 失败（HTTP ${response.status}）`);
  if (descriptor.keySelector) {
    const input = await waitFor(descriptor.keySelector, 800);
    if (input) dispatchValue(input, profile.key);
  }
}
async function applyProfile(profile, onProgress = () => {
}) {
  const st = getST3();
  if (!st) throw new Error("未检测到 SillyTavern 运行时");
  const descriptor = getSource(profile.mainApi, profile.source);
  onProgress("正在切换补全方式与渠道…");
  const mainApiSelect = await waitFor("#main_api");
  if (!mainApiSelect) throw new Error("找不到 SillyTavern API 类型选择器");
  dispatchValue(mainApiSelect, profile.mainApi);
  if (profile.mainApi === "openai") {
    const sourceSelect = await waitFor("#chat_completion_source");
    if (!sourceSelect) throw new Error("找不到聊天补全来源选择器");
    dispatchValue(sourceSelect, profile.source);
  }
  await sleep(120);
  await writeSecret(st, profile);
  const settings = settingsFor(st, profile.mainApi);
  if (descriptor.sourceField) settings[descriptor.sourceField] = profile.source;
  if (descriptor.urlField) settings[descriptor.urlField] = profile.url;
  for (const [key, value] of Object.entries(profile.settings)) settings[key] = value;
  if (descriptor.urlSelector) {
    const input = await waitFor(descriptor.urlSelector);
    if (!input) throw new Error(`找不到 ${descriptor.label} 的 URL 输入框`);
    dispatchValue(input, profile.url);
  }
  st.saveSettingsDebounced?.();
  if (descriptor.urlField && readString(settings, descriptor.urlField) !== profile.url) throw new Error("URL 写入后回验失败，已停止连接");
  const button2 = await waitFor(descriptor.connectSelector);
  if (!button2) throw new Error(`找不到 ${descriptor.label} 的连接按钮`);
  let modelControl = null;
  if (descriptor.modelSelector && profile.model) {
    modelControl = await waitFor(descriptor.modelSelector, 2500);
    if (!modelControl) throw new Error(`找不到 ${descriptor.label} 的模型字段`);
    if (modelControl instanceof HTMLSelectElement && ![...modelControl.options].some((option) => option.value === profile.model)) {
      onProgress("正在连接渠道并加载可用模型…");
      button2.click();
      if (!await waitForValue(modelControl, profile.model)) throw new Error(`可用模型中没有「${profile.model}」，请检查模型 ID 或渠道权限`);
    }
    dispatchValue(modelControl, profile.model);
    if (descriptor.modelField) settings[descriptor.modelField] = profile.model;
  }
  onProgress(profile.model ? `正在确认模型「${profile.model}」…` : "正在确认连接…");
  button2.click();
  const connected = await waitForConnection(profile);
  if (modelControl && profile.model && modelControl.value !== profile.model) throw new Error(`模型写入被 SillyTavern 覆盖（当前：${modelControl.value || "NONE"}）`);
  return connected;
}
var modelQueue = Promise.resolve();
function fetchModels(profile) {
  const result = modelQueue.then(() => fetchModelsTransaction(profile));
  modelQueue = result.then(() => void 0, () => void 0);
  return result;
}
async function fetchModelsTransaction(profile) {
  const st = getST3();
  if (!st) throw new Error("未检测到 SillyTavern 运行时");
  const descriptor = getSource(profile.mainApi, profile.source);
  if (!descriptor.supportsModels) throw new Error("该来源不支持自动获取模型，请手动填写");
  const current2 = await readConnection();
  const temporary = { version: 2, id: "temporary", name: "temporary", model: "", settings: {}, secretMode: "stored", ...profile };
  await writeSecret(st, temporary);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2e4);
    try {
      const response = await fetch("/api/backends/chat-completions/status", { method: "POST", headers: st.getRequestHeaders?.() ?? { "Content-Type": "application/json" }, body: JSON.stringify({ chat_completion_source: profile.source, custom_url: profile.url }), signal: controller.signal });
      if (!response.ok) throw new Error(`模型列表请求失败（HTTP ${response.status}）`);
      return parseModelList(await response.json());
    } finally {
      clearTimeout(timer);
    }
  } finally {
    if (current2?.key) await writeSecret(st, { ...temporary, mainApi: current2.mainApi, source: current2.source, url: current2.url, key: current2.key, secretId: current2.secretId });
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
      const state = { busy: false, message: "" };
      void render(container, ctx, deps, state);
      unsubscribe = onOnlineStatusChanged(() => {
        if (!state.busy && container.isConnected) void render(container, ctx, deps, state);
      });
    },
    unmount() {
      unsubscribe?.();
      unsubscribe = null;
    }
  };
}
async function render(container, ctx, deps, state) {
  const data = sanitizeAppData(ctx.getAppData());
  const connection = await readConnection();
  if (!container.isConnected) return;
  const active = connection ? findActiveProfile(data.profiles, connection) : void 0;
  container.textContent = "";
  const status = el2("div", "so-app-section");
  const title2 = el2("div", "so-app-title");
  title2.textContent = "当前连接";
  status.append(title2);
  const line = el2("div", "so-app-desc");
  if (!connection) line.textContent = "未检测到 SillyTavern 运行时（这里只展示已保存档案）。";
  else {
    const source = getSource(connection.mainApi, connection.source);
    line.textContent = `${connection.online ? "已连接" : "未连接"} · ${source.label}${active ? ` · ${active.name}` : ""}`;
    const detail = el2("div", "so-app-desc");
    detail.textContent = [connection.url, connection.model].filter(Boolean).join(" · ") || "该来源没有地址或模型字段";
    status.append(detail);
  }
  status.append(line);
  container.append(status);
  const profiles = el2("div", "so-app-section");
  const profilesTitle = el2("div", "so-app-title");
  profilesTitle.textContent = `连接档案（${data.profiles.length}）`;
  profiles.append(profilesTitle);
  if (!data.profiles.length) {
    const empty = el2("div", "so-app-desc");
    empty.textContent = "还没有连接档案，请进入管理页添加或导入。";
    profiles.append(empty);
  }
  for (const profile of data.profiles) profiles.append(buildRow(profile, active?.id === profile.id, state.busy, () => void switchProfile(profile)));
  if (state.message) {
    const feedback = el2("div", "so-app-desc");
    feedback.textContent = state.message;
    profiles.append(feedback);
  }
  container.append(profiles);
  const manage = el2("div", "so-app-section");
  const description = el2("div", "so-app-desc");
  description.textContent = "管理全部 Chat Completion、Text Completion 与其他 SillyTavern API 档案。";
  manage.append(description, appButton("管理连接档案", deps.openManager));
  container.append(manage, buildApiGuide());
  async function switchProfile(profile) {
    if (state.busy || !connection) return;
    state.busy = true;
    state.message = `正在应用「${profile.name}」的类型、来源、密钥、URL 与模型…`;
    await render(container, ctx, deps, state);
    try {
      const connected = await applyProfile(profile, (message) => {
        state.message = message;
        if (container.isConnected) void render(container, ctx, deps, state);
      });
      state.message = `「${profile.name}」已连接${connected.model ? `，实际模型：${connected.model}` : ""}`;
      toast2("success", state.message);
    } catch (error) {
      state.message = `切换失败：${error instanceof Error ? error.message : String(error)}`;
      toast2("error", state.message);
      console.error("[st-stage] API 切换失败", error);
    } finally {
      state.busy = false;
      await render(container, ctx, deps, state);
    }
  }
}
function guideLine(title2, text3) {
  const line = el2("div", "so-app-desc");
  const strong = document.createElement("strong");
  strong.textContent = `${title2}：`;
  line.append(strong, document.createTextNode(text3));
  return line;
}
function buildApiGuide() {
  const guide = el2("div", "so-app-section");
  const title2 = el2("div", "so-app-title");
  title2.textContent = "API 使用说明";
  guide.append(title2);
  const quick = foldSection("快速开始", false);
  quick.body.append(
    guideLine("1. 建档", "在“管理连接档案”中添加档案，或先打开 SillyTavern 原生 API 面板配置好连接，再用“导入当前连接”。"),
    guideLine("2. 填写", "Key 是访问凭证，URL 是服务入口，模型 ID 必须与渠道实际提供的名称完全一致。Key 会明文保存在本扩展档案中。"),
    guideLine("3. 切换", "点击档案后会依次切换渠道、写入凭证、加载模型并做最终连接回验。看到“已连接，实际模型…”才算完成。")
  );
  const completion = foldSection("补全方式有什么不同", false);
  completion.body.append(
    guideLine("Chat Completion", "以 system、user、assistant 消息列表发送上下文。现代云模型主要使用这种方式，角色与指令边界清晰，通常是首选。"),
    guideLine("Text Completion", "把整个提示词拼成一段文本续写。适合本地推理后端、旧模型和需要精细控制提示模板的玩法。"),
    guideLine("NovelAI", "面向创作续写的专用服务，偏小说语料与采样控制，不等同于通用聊天 API。"),
    guideLine("KoboldAI", "常用于本地或自托管文本生成后端，玩法自由，但 URL、模型加载和性能取决于自己的服务。"),
    guideLine("KoboldAI Horde", "由社区算力池处理请求，不必自备推理服务；可用模型、排队时间和速度会随在线工作节点变化。"),
    guideLine("注意", "“补全方式”描述请求协议，不代表模型聪明程度。同一个模型可能被不同后端包装成不同协议。")
  );
  const channels = foldSection("Chat Completion 渠道说明", false);
  channels.body.append(
    guideLine("OpenAI", "官方直连渠道，模型名称和能力以 OpenAI 当前控制台为准。"),
    guideLine("Claude", "Anthropic 官方渠道，擅长长上下文与文本任务；使用 Anthropic Key。"),
    guideLine("OpenRouter", "聚合多家模型的统一入口，切模型方便；模型 ID 通常带厂商前缀，计费与路由由 OpenRouter 管理。"),
    guideLine("Google AI Studio", "Google Gemini 开发者渠道；区域可用性、限额与模型名以 AI Studio 为准。"),
    guideLine("自定义 OpenAI 兼容", "用于第三方中转、本地网关或其他兼容服务。通常需填写基础 URL（很多服务要求以 /v1 结尾）和服务方给出的精确模型 ID。"),
    guideLine("其他厂商", "DeepSeek、xAI、Mistral、Groq 等兼容 OpenAI 请求格式的服务统一使用“自定义 OpenAI 兼容”，不再重复提供厂商入口。")
  );
  const fields = foldSection("字段、安全与排障", false);
  fields.body.append(
    guideLine("Key 与 secret-id", "输入框会遮罩显示，但 Key 在本扩展档案中明文保存，并同步写入 SillyTavern 密钥库；新版可用 secret-id 区分同渠道多把 Key。请勿分享含档案数据的配置。"),
    guideLine("URL", "404 常见于路径不对，请核对是否需要 /v1；不要把具体的 /chat/completions 路径重复填进基础 URL。"),
    guideLine("NONE", "通常表示模型列表仍在加载、模型 ID 不存在或账号无权限。现在切换会等待并回验，不会把明显的 NONE 当成功。"),
    guideLine("401 / 403", "通常是 Key 错误、额度/权限不足或服务区域限制。"),
    guideLine("旧版兼容", "旧版 SillyTavern 可能不允许回读 Key；导入时会保留表单中已有 Key，并回退到单密钥槽位。")
  );
  guide.append(quick.box, completion.box, channels.box, fields.box);
  return guide;
}
function buildRow(profile, active, busy, onActivate) {
  const row = el2("div", `stapi-row${active ? " stapi-row-on" : ""}${busy ? " stapi-row-busy" : ""}`);
  row.setAttribute("role", "button");
  row.tabIndex = busy ? -1 : 0;
  row.setAttribute("aria-disabled", String(busy));
  const main = el2("div", "stapi-row-main");
  const name = el2("div", "stapi-row-name");
  name.textContent = profile.name;
  const summary = el2("div", "stapi-row-sub");
  summary.textContent = profileSummary(profile).join(" · ");
  main.append(name, summary);
  const mark = el2("div", "stapi-row-mark");
  mark.textContent = active ? "使用中" : "切换";
  row.append(main, mark);
  row.addEventListener("click", () => {
    if (!busy) onActivate();
  });
  row.addEventListener("keydown", (event) => {
    if (!busy && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onActivate();
    }
  });
  return row;
}

// st-extension/src/apps/renderer/prompt.ts
var GAL_PROMPT = `【Galgame 模式】
适合连续对话或分镜。字段：version=1，mode="gal"，scene 为场景说明，beats 为 1-50 个节拍；每个节拍必须有 speaker 和 text，title、background、节拍的 portrait/background 可省略。portrait 还可写成 sprite:地址，由当前角色图库解析。
示例：
<STStageRender>{"version":1,"mode":"gal","title":"雨夜重逢","scene":"车站月台","beats":[{"speaker":"小雪","text":"你终于来了。","portrait":"/user/images/xiaoxue.png"},{"speaker":"我","text":"抱歉，让你久等了。"}]}</STStageRender>`;
var CARDS_PROMPT = `【SLG 卡片选择模式】
适合给出 2-8 个明确选择。每张卡必须有唯一 id、title、description、action，consequence 可省略；action 是填入输入框但不自动发送的文字。
示例：
<STStageRender>{"version":1,"mode":"cards","title":"下一步行动","cards":[{"id":"advance","title":"继续前进","description":"沿山路调查灯光","consequence":"可能遭遇守卫","action":"我选择沿山路继续前进。"},{"id":"rest","title":"原地休整","description":"恢复体力并整理物资","action":"我选择原地休整。"}]}</STStageRender>`;
var BATTLE_PROMPT = `【战斗模式】
适合可由本地确定性规则处理的简单战斗。player/enemy 必须有不同的唯一 id，并包含 name、hp/maxHp、mp/maxMp、attack、defense、speed、crit、dodge。所有基础数值为 0-9999，hp 不得大于 maxHp，mp 不得大于 maxMp，crit/dodge 为 0-100。
skills、items、statuses 各最多 12 项且各自 id 不重复。skill 字段为 id/name/type/mpCost/power，type 只能是 damage 或 heal；item 字段为 id/name/effect/quantity/power，effect 只能是 heal_hp 或 heal_mp；status 字段为 id/name/duration，可选 attackDelta、defenseDelta、damagePerTurn。description 可用于技能和物品；background、enemyIntent、allowFlee 可省略。
示例：
<STStageRender>{"version":1,"mode":"battle","title":"遗迹守卫战","player":{"id":"hero","name":"旅行者","hp":80,"maxHp":100,"mp":30,"maxMp":50,"attack":18,"defense":8,"speed":12,"crit":10,"dodge":5,"skills":[{"id":"slash","name":"斩击","type":"damage","mpCost":5,"power":20}]},"enemy":{"id":"guard","name":"遗迹守卫","hp":90,"maxHp":90,"mp":0,"maxMp":0,"attack":16,"defense":10,"speed":8,"crit":5,"dodge":3},"enemyIntent":"蓄力攻击","allowFlee":true}</STStageRender>`;
function buildRendererPrompt(settings) {
  if (!settings.enabled) return "";
  const modes = [];
  if (settings.galEnabled) modes.push(GAL_PROMPT);
  if (settings.cardsEnabled) modes.push(CARDS_PROMPT);
  if (settings.battleEnabled) modes.push(BATTLE_PROMPT);
  if (modes.length === 0) return "";
  return `# ST Stage 结构化渲染协议

普通回复不需要输出渲染块；仅在当前场景明显适合以下已启用模式时使用。
用户明确要求使用某个已启用模式、演示该模式或测试该模式时，必须输出对应的结构化渲染块，不得只用普通文本说明。
每条回复最多输出一个 STStageRender 标签块，标签内部必须是严格 JSON。
使用时必须输出完整 <STStageRender>JSON</STStageRender> 标签，不得只输出裸 JSON。
禁止输出 HTML、脚本或其他可执行代码，也不要增加协议未声明的字段。
叙事正文放在块外，并保证块外内容脱离渲染器后仍然独立可读。
所有数值使用整数，图片只使用可信的 http(s)、base64 栅格 data:image、/user/ 或扩展相对路径。

${modes.join("\n\n")}`;
}

// st-extension/src/apps/renderer/config.ts
var RENDERER_APP_ID = "renderer";
function defaultRendererSettings() {
  return {
    enabled: false,
    galEnabled: true,
    cardsEnabled: true,
    battleEnabled: true,
    injectionDepth: 4,
    typewriter: true,
    reducedMotion: false
  };
}
function normalizeRendererSettings(raw) {
  const settings = defaultRendererSettings();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return settings;
  const value = raw;
  for (const key of ["enabled", "galEnabled", "cardsEnabled", "battleEnabled", "typewriter", "reducedMotion"]) {
    if (typeof value[key] === "boolean") settings[key] = value[key];
  }
  if (typeof value.injectionDepth === "number" && Number.isInteger(value.injectionDepth)) {
    settings.injectionDepth = Math.min(20, Math.max(0, value.injectionDepth));
  }
  return settings;
}

// st-extension/src/apps/renderer-app.ts
function refreshPrompt(host, settings) {
  host.injectPrompt(buildRendererPrompt(settings), settings.injectionDepth);
}
function section(title2, ...rows) {
  const box = el2("section", "so-app-section renderer-settings-section");
  const heading = el2("div", "so-app-title");
  heading.textContent = title2;
  box.append(heading, ...rows);
  return box;
}
function enabledModes(settings) {
  return [
    settings.galEnabled ? "Galgame" : "",
    settings.cardsEnabled ? "卡片选择" : "",
    settings.battleEnabled ? "战斗" : ""
  ].filter(Boolean);
}
function rendererStatus(settings) {
  const status = el2("div", "renderer-status so-app-desc");
  if (!settings.enabled) {
    status.textContent = "未启用（当前不注入任何协议提示词）。启用后，下一条合适的 AI 回复才会尝试显示结构化渲染。";
    return status;
  }
  const modes = enabledModes(settings);
  const injected = buildRendererPrompt(settings);
  status.textContent = modes.length > 0 ? `已启用 · 可用模式：${modes.join("、")} · 正在注入协议说明 ${injected.length} 字符（深度 ${settings.injectionDepth}）` : "已启用，但没有启用模式——此时不注入提示词；请至少打开一个模式。";
  return status;
}
function quickStep(number, title2, description) {
  const row = el2("div", "renderer-quick-step");
  const marker = el2("span", "renderer-quick-step-number");
  marker.textContent = number;
  const content = el2("div", "renderer-quick-step-content");
  const heading = el2("strong", "renderer-quick-step-title");
  heading.textContent = title2;
  const detail = el2("span", "so-app-desc");
  detail.textContent = description;
  content.append(heading, detail);
  row.append(marker, content);
  return row;
}
function quickStart(settings, onEnable) {
  const box = el2("section", "so-app-section renderer-quick-start");
  const heading = el2("div", "so-app-title");
  heading.textContent = "快速开始";
  box.append(heading, rendererStatus(settings));
  if (!settings.enabled) {
    const activation = appButton("启用渲染", onEnable);
    activation.classList.add("renderer-recommend");
    box.append(
      quickStep("1", "打开渲染", "启用下面的总开关，保留至少一个模式。"),
      quickStep("2", "发送普通消息", "不需要手动粘贴 JSON；插件会把协议说明注入给 AI。"),
      quickStep("3", "使用回复中的交互", "卡片会填入输入框，战斗按钮在渲染面板内执行。"),
      activation
    );
  }
  return box;
}
function modeGuide() {
  const { box, body } = foldSection("模式说明", false, "renderer:mode-guide");
  box.classList.add("renderer-mode-guide");
  const modes = [
    ["Galgame", "连续对话和分镜节拍；适合让 AI 控制角色、场景和立绘切换。"],
    ["卡片选择", "2-8 个明确选项；点击后只填入草稿，不会替你自动发送。"],
    ["战斗", "本地确定性战斗；选择攻击、技能、物品或逃跑后立即更新面板。"]
  ];
  for (const [title2, description] of modes) {
    const row = el2("div", "renderer-mode-row");
    const name = el2("strong", "renderer-mode-name");
    name.textContent = title2;
    const detail = el2("span", "so-app-desc");
    detail.textContent = description;
    row.append(name, detail);
    body.append(row);
  }
  const troubleshooting = el2("p", "so-app-desc renderer-troubleshooting");
  troubleshooting.textContent = "没有渲染时，普通回复会原样显示。自查顺序：先看上方状态行——显示「正在注入协议说明 N 字符」才说明协议在发给 AI；显示未启用或没有模式则先打开开关；之后发送新消息，只有 AI 返回合法的 STStageRender 块时才会出现面板。";
  body.append(troubleshooting);
  return box;
}
function rendererApp(deps) {
  return {
    id: RENDERER_APP_ID,
    name: "渲染",
    icon: "🎬",
    order: 7,
    setup(host) {
      const inject = () => refreshPrompt(host, normalizeRendererSettings(host.getAppData()));
      inject();
      const offCharacterChanged = host.onCharacterChanged(inject);
      return () => {
        offCharacterChanged();
        host.injectPrompt("");
      };
    },
    mount(container, ctx) {
      let current2 = normalizeRendererSettings(ctx.getAppData());
      function save(next) {
        current2 = normalizeRendererSettings(next);
        ctx.setAppData(current2);
        refreshPrompt(ctx, current2);
        deps.runtime.reprocessAll();
        render2();
      }
      function render2() {
        container.textContent = "";
        const page = el2("div", "renderer-settings");
        page.append(
          quickStart(current2, () => save({ ...current2, enabled: true })),
          modeGuide(),
          section(
            "状态",
            toggleRow("启用渲染", current2.enabled, (enabled) => save({ ...current2, enabled }))
          ),
          section(
            "模式",
            toggleRow("Galgame", current2.galEnabled, (galEnabled) => save({ ...current2, galEnabled })),
            toggleRow("卡片选择", current2.cardsEnabled, (cardsEnabled) => save({ ...current2, cardsEnabled })),
            toggleRow("战斗", current2.battleEnabled, (battleEnabled) => save({ ...current2, battleEnabled }))
          ),
          section(
            "行为",
            numberRow("注入深度", current2.injectionDepth, 0, 20, (injectionDepth) => save({ ...current2, injectionDepth })),
            hintField(
              toggleRow("打字机", current2.typewriter, (typewriter) => save({ ...current2, typewriter })),
              "仅控制 Galgame 渲染面板里对话文字的逐字显示动画，与模型的流式输出无关；关闭后整段文字直接显示。"
            ),
            toggleRow("减少动态", current2.reducedMotion, (reducedMotion) => save({ ...current2, reducedMotion }))
          )
        );
        container.append(page);
      }
      render2();
    }
  };
}

// st-extension/src/apps/index.ts
function createBuiltinApps(deps) {
  return [
    spriteApp({ previewOpacity: deps.previewSpriteOpacity }),
    galleryApp({ openManager: deps.openGalleryManager }),
    butlerApp(),
    mvuApp(),
    newvarApp({ runtime: deps.newvarRuntime, openDesigner: deps.openNewvarDesigner }),
    apiApp({ openManager: deps.openApiManager }),
    rendererApp({ runtime: deps.rendererRuntime })
  ];
}

// st-extension/src/apps/newvar/legacy-set-parser.ts
function parseLegacySetCalls(source) {
  const calls = [];
  const errors = [];
  let index = 0;
  while (index < source.length) {
    index = skipTrivia(source, index);
    if (index >= source.length) break;
    const start = index;
    try {
      const parsed = parseCall(source, start);
      let next = skipHorizontalSpace(source, parsed.next);
      const hasSemicolon = source[next] === ";";
      if (hasSemicolon) next = skipHorizontalSpace(source, next + 1);
      if (next >= source.length || isLineBreak(source[next])) {
        calls.push(parsed.call);
        index = next;
        continue;
      }
      if (source.startsWith("//", next)) {
        calls.push(parsed.call);
        index = skipLineComment(source, next);
        continue;
      }
      if (hasSemicolon && source.startsWith("_.set", next)) {
        calls.push(parsed.call);
        index = next;
        continue;
      }
      throw syntaxError(source, next, "调用后存在不允许的尾随内容");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      index = recoverAtNextLine(source, start);
    }
  }
  return { calls, errors };
}
function parseCall(source, start) {
  if (!source.startsWith("_.set", start)) throw syntaxError(source, start, "只允许 _.set(...) 调用");
  let index = skipWhitespace(source, start + "_.set".length);
  if (source[index] !== "(") throw syntaxError(source, index, "_.set 后缺少左括号");
  index = skipWhitespace(source, index + 1);
  const pathArg = parseValue(source, index);
  if (typeof pathArg.value !== "string") throw syntaxError(source, index, "第一个参数必须是字符串路径");
  const path = pathArg.value.trim();
  if (!path) throw syntaxError(source, index, "变量路径不能为空");
  if (!isSafePath(path)) throw syntaxError(source, index, "变量路径包含危险字段");
  index = expectComma(source, pathArg.next, "路径后缺少旧值参数");
  const oldArg = parseValue(source, index);
  index = expectComma(source, oldArg.next, "旧值后缺少新值参数");
  const newArg = parseValue(source, index);
  index = skipWhitespace(source, newArg.next);
  if (source[index] !== ")") throw syntaxError(source, index, "新值后必须立即结束调用");
  return {
    call: { path, oldValue: oldArg.value, newValue: newArg.value },
    next: index + 1
  };
}
function parseValue(source, start) {
  const index = skipWhitespace(source, start);
  const quote = source[index];
  if (quote === "'" || quote === '"') return parseString(source, index, quote);
  for (const [token, value] of [
    ["true", true],
    ["false", false],
    ["null", null]
  ]) {
    if (source.startsWith(token, index) && isValueBoundary(source[index + token.length])) {
      return { value, next: index + token.length };
    }
  }
  const number = source.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
  if (number && isValueBoundary(source[index + number[0].length])) {
    return { value: Number(number[0]), next: index + number[0].length };
  }
  throw syntaxError(source, index, "参数只能是字符串、数字、布尔值或 null");
}
function parseString(source, start, quote) {
  let value = "";
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === quote) return { value, next: index + 1 };
    if (isLineBreak(char)) throw syntaxError(source, index, "字符串引号未闭合");
    if (char !== "\\") {
      value += char;
      index += 1;
      continue;
    }
    const escaped = source[index + 1];
    if (escaped === void 0 || isLineBreak(escaped)) throw syntaxError(source, index, "字符串转义未完成");
    const simpleEscapes = {
      "'": "'",
      '"': '"',
      "\\": "\\",
      "/": "/",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "	"
    };
    if (escaped === "u") {
      const hex = source.slice(index + 2, index + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw syntaxError(source, index, "Unicode 转义必须包含四位十六进制数");
      value += String.fromCharCode(Number.parseInt(hex, 16));
      index += 6;
      continue;
    }
    if (!(escaped in simpleEscapes)) throw syntaxError(source, index, `不支持的字符串转义 \\${escaped}`);
    value += simpleEscapes[escaped];
    index += 2;
  }
  throw syntaxError(source, start, "字符串引号未闭合");
}
function expectComma(source, start, message) {
  const index = skipWhitespace(source, start);
  if (source[index] !== ",") throw syntaxError(source, index, message);
  return skipWhitespace(source, index + 1);
}
function skipWhitespace(source, start) {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}
function skipHorizontalSpace(source, start) {
  let index = start;
  while (source[index] === " " || source[index] === "	") index += 1;
  return index;
}
function skipTrivia(source, start) {
  let index = start;
  while (index < source.length) {
    if (/\s/.test(source[index]) || source[index] === ";") {
      index += 1;
      continue;
    }
    if (source.startsWith("//", index)) {
      index = skipLineComment(source, index);
      continue;
    }
    break;
  }
  return index;
}
function skipLineComment(source, start) {
  const newline = source.indexOf("\n", start + 2);
  return newline < 0 ? source.length : newline + 1;
}
function recoverAtNextLine(source, start) {
  const newline = source.indexOf("\n", start);
  return newline < 0 ? source.length : newline + 1;
}
function isLineBreak(char) {
  return char === "\n" || char === "\r";
}
function isValueBoundary(char) {
  return char === void 0 || char === "," || char === ")" || /\s/.test(char);
}
function syntaxError(source, index, message) {
  const before = source.slice(0, Math.max(0, index));
  const line = before.split("\n").length;
  const lastNewline = before.lastIndexOf("\n");
  const column = index - lastNewline;
  return new Error(`第 ${line} 行第 ${column} 列：${message}`);
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
function exampleValue(def) {
  if (def.type === "number") return def.range?.[0] ?? 0;
  if (def.type === "boolean") return true;
  if (def.type === "enum") return def.enum?.[0] ?? "";
  return "新值";
}
function dottedToPointer(path) {
  const segments = path.split(".").map((segment) => segment.replace(/~/g, "~0").replace(/\//g, "~1"));
  return `/${segments.join("/")}`;
}
function serializeExampleValue(value) {
  return JSON.stringify(value) ?? "null";
}
var BLOCK_RE = /<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/i;
var ANALYSIS_RE = /<Analysis>[\s\S]*?<\/Analysis>/gi;
function parseUpdateBlock(text3, format) {
  if (typeof text3 !== "string") return { found: false, ops: [] };
  const m = BLOCK_RE.exec(text3);
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
  const rejected = [];
  for (const [index, raw] of parsed.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      rejected.push({ index, reason: "补丁条目必须是对象" });
      continue;
    }
    const o = raw;
    const op = o.op;
    const pointer = o.path;
    if (op !== "replace" && op !== "add" && op !== "remove") {
      rejected.push({ index, reason: "op 只允许 add、replace 或 remove" });
      continue;
    }
    if (typeof pointer !== "string") {
      rejected.push({ index, reason: "path 必须是非空字符串" });
      continue;
    }
    const path = pointerToDotted(pointer).trim();
    if (!path) {
      rejected.push({ index, reason: "path 不能为空" });
      continue;
    }
    if (!isSafePath(path)) {
      rejected.push({ index, reason: "path 包含危险字段" });
      continue;
    }
    if (op !== "remove" && !Object.prototype.hasOwnProperty.call(o, "value")) {
      rejected.push({ index, reason: `${op} 操作缺少 value` });
      continue;
    }
    ops.push({ op, path, value: o.value });
  }
  return { found: true, ops, ...rejected.length > 0 ? { rejected } : {} };
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
  const parsed = parseLegacySetCalls(inner);
  const ops = parsed.calls.map((call) => ({ op: "replace", path: call.path, value: call.newValue }));
  return {
    found: true,
    ops,
    ...parsed.errors.length > 0 ? { error: parsed.errors.join("；") } : {}
  };
}
function applyOps(state, ops, schema) {
  const next = clone(state);
  const log = [];
  const defByKey = new Map(schema.variables.map((v) => [v.key, v]));
  const hasSchema = schema.variables.length > 0;
  for (const op of ops) {
    if (!op.path.trim() || !isSafePath(op.path)) {
      log.push({ path: op.path, status: "rejected", detail: "变量路径为空或包含危险字段" });
      continue;
    }
    const def = defByKey.get(op.path);
    if (op.op === "remove") {
      if (hasSchema && !def) {
        log.push({ path: op.path, status: "rejected", detail: "remove 只能删除 schema 中定义的叶子变量" });
        continue;
      }
      deleteNested(next, op.path);
      log.push({ path: op.path, status: "removed" });
      continue;
    }
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
  const exampleDef = visible[0];
  const example = exampleDef?.key ?? "变量路径";
  const examplePatchValue = exampleDef ? exampleValue(exampleDef) : "新值";
  const currentExampleValue = exampleDef ? getNested(state, example) : "旧值";
  const examplePatch = JSON.stringify([
    { op: "replace", path: dottedToPointer(example), value: examplePatchValue }
  ]);
  const formatLines = format === "lodash_set" ? [
    "- 在回复正文全部结束后，若本轮有变量变化，追加一个 <UpdateVariable> 块；没有变化则不要输出该块",
    "- 块内每行一条命令：_.set('变量路径', 旧值, 新值);//变化原因",
    "格式示例：",
    "<UpdateVariable>",
    `_.set(${JSON.stringify(example)}, ${serializeExampleValue(currentExampleValue)}, ${serializeExampleValue(examplePatchValue)});//原因`,
    "</UpdateVariable>"
  ] : [
    "- 在回复正文全部结束后，若本轮有变量变化，追加一个 <UpdateVariable> 块；没有变化则不要输出该块",
    "- 块内先写 <Analysis>（中文，不超过 60 字）：逐条对照上面的更新规则，说明哪些变量该更新、更新到多少",
    "- 然后输出严格符合 JSON Patch (RFC 6902) 的 JSON 数组，只允许 replace / add / remove 三种操作",
    "- path 用斜杠分隔层级（如 /状态/体力）；value 是更新后的完整值",
    "格式示例：",
    "<UpdateVariable>",
    `<Analysis>${example} 按规则更新为 ${JSON.stringify(examplePatchValue)}。</Analysis>`,
    examplePatch,
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
  function findSnapshotBefore(chat2, fromId) {
    for (let i = Math.min(fromId, chat2.length - 1); i >= 0; i--) {
      const snap = floorSnapshot(chat2[i]);
      if (snap) return clone2(snap);
    }
    return null;
  }
  function getCurrentState() {
    const schema = getData().schema;
    const chat2 = getST4()?.chat;
    if (Array.isArray(chat2)) {
      const snap = findSnapshotBefore(chat2, chat2.length - 1);
      if (snap) return fillDefaults(snap, schema);
    }
    return initStateFromSchema(schema);
  }
  function getPrevState() {
    const chat2 = getST4()?.chat;
    if (!Array.isArray(chat2)) return null;
    for (let i = chat2.length - 1; i >= 0; i--) {
      if (floorSnapshot(chat2[i])) return findSnapshotBefore(chat2, i - 1);
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
    const chat2 = st?.chat;
    if (!st || !Array.isArray(chat2)) return;
    const rawId = args[0];
    const idNum = typeof rawId === "number" ? rawId : typeof rawId === "string" && rawId.trim() !== "" ? Number(rawId) : NaN;
    const messageId = Number.isInteger(idNum) && idNum >= 0 && idNum < chat2.length ? idNum : chat2.length - 1;
    const msg = chat2[messageId];
    if (!msg || msg.is_user || typeof msg.mes !== "string") return;
    const parsed = parseUpdateBlock(msg.mes, data.format);
    if (!parsed.found) return;
    if (parsed.error) {
      lastParse = { messageId, found: true, error: parsed.error, log: [] };
      notify();
      return;
    }
    const snapBase = findSnapshotBefore(chat2, messageId - 1);
    const base = snapBase ? fillDefaults(snapBase, data.schema) : initStateFromSchema(data.schema);
    const result = applyOps(base, parsed.ops, data.schema);
    const parseLog = (parsed.rejected ?? []).map(({ index, reason }) => ({
      path: `JSON Patch[${index}]`,
      status: "rejected",
      detail: reason
    }));
    writeSnapshot(st, messageId, result.state);
    lastParse = { messageId, found: true, log: [...parseLog, ...result.log] };
    reinject();
    notify();
  }
  function mutateCurrent(mutate) {
    const st = getST4();
    const chat2 = st?.chat;
    if (!st || !Array.isArray(chat2) || chat2.length === 0) return false;
    const state = getCurrentState();
    mutate(state);
    writeSnapshot(st, chat2.length - 1, state);
    reinject();
    notify();
    return true;
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
    setManualValue(path, value) {
      const def = getData().schema.variables.find((item) => item.key === path);
      if (!def) return { ok: false, error: `未定义的变量路径：${path}` };
      const validated = validateValue(def, value);
      if (!validated.ok) return { ok: false, error: validated.error ?? "输入值不符合变量定义。" };
      if (!mutateCurrent((state) => setNested(state, path, validated.value))) {
        return { ok: false, error: "当前环境没有可写入的聊天楼层。" };
      }
      return { ok: true, value: validated.value };
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
var RELATIONSHIP_STAGES = ["陌生", "熟悉", "信任", "亲密", "挚爱"];
var RELATIONSHIP_RULE = "按好感度区间判断：陌生 0-19；熟悉 20-39；信任 40-59；亲密 60-79；挚爱 80-100\n只有数值跨入新区间且剧情关系确有变化时才调整，不可跳级";
function timeVariables() {
  return [
    {
      key: "时间.日期",
      type: "string",
      default: "故事开始日",
      description: "当前故事日期（优先使用 YYYY-MM-DD，原作未给年份时用明确的月日或第几天）",
      updateRule: "剧情明确跨过午夜或日期推进时更新；同一天内保持不变，禁止凭空补造年份"
    },
    {
      key: "时间.当前时间",
      type: "string",
      default: "15:00",
      description: "当前 24 小时时间（HH:mm）",
      updateRule: "按剧情累计推进：对话约 5~15 分钟，移动 10~30 分钟，重大事件 30 分钟以上；保持 HH:mm 格式"
    },
    {
      key: "时间.当前时段",
      type: "enum",
      default: "下午",
      description: "由当前时间对应的时段",
      enum: ["清晨", "上午", "中午", "下午", "傍晚", "夜晚", "深夜"],
      updateRule: "跟随 时间.当前时间 跨过时段边界时更新，未跨界时保持不变"
    }
  ];
}
var romanceSingle = {
  id: "romance-single",
  name: "恋爱 · 单角色",
  description: "好感、关系阶段、心情、行动和完整日期时间；关系按明确阈值小步推进。",
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
      default: "熟悉",
      description: "角色与用户当前的关系阶段",
      enum: RELATIONSHIP_STAGES,
      updateRule: RELATIONSHIP_RULE
    },
    {
      key: "心情",
      type: "enum",
      default: "平静",
      description: "角色当前主导心情",
      enum: ["开心", "平静", "害羞", "烦躁", "难过"],
      updateRule: "仅在当前场景出现明确情绪变化时更新；短暂措辞不代表主导心情改变"
    },
    {
      key: "当前状态",
      type: "string",
      default: "初次见面",
      description: "角色正在做什么以及与用户的互动状态（一句话）",
      updateRule: "角色行动或互动目标改变时用一句话概括；没有变化时保持原值"
    },
    {
      key: "地点.当前地点",
      type: "string",
      default: "教室",
      description: "角色与用户当前所在地点",
      updateRule: "明确发生场景移动后更新；只改变视角或提及其他地点时不要更新"
    },
    ...timeVariables()
  ]
};
function roleVariables(role, initiallyPresent) {
  const presencePath = `角色.${role}.是否在场`;
  const gate = `仅当 ${presencePath}为 true 时更新；不在场时保持原值`;
  return [
    {
      key: presencePath,
      type: "boolean",
      default: initiallyPresent,
      description: `${role}是否实际出现在当前场景`,
      updateRule: "角色进入当前场景时设为 true，明确离开时设为 false；仅被提及不算在场"
    },
    {
      key: `角色.${role}.好感度`,
      type: "number",
      default: 20,
      description: `${role}对用户的好感（0~100）`,
      range: [0, 100],
      updateRule: `${gate}
正面互动 +1~3；重大事件 ±5~10；输出更新后的完整数值`
    },
    {
      key: `角色.${role}.关系阶段`,
      type: "enum",
      default: "熟悉",
      description: `${role}与用户的关系阶段`,
      enum: RELATIONSHIP_STAGES,
      updateRule: `${gate}
${RELATIONSHIP_RULE}`
    },
    {
      key: `角色.${role}.当前状态`,
      type: "string",
      default: "等待互动",
      description: `${role}正在做什么以及当前情绪（一句话）`,
      updateRule: `${gate}
行动或主导情绪明确改变时更新为一句话概括`
    },
    {
      key: `角色.${role}.所在位置`,
      type: "string",
      default: "未知",
      description: `${role}当前所在位置`,
      updateRule: "角色移动或剧情明确交代其位置时更新；即使不在用户当前场景也可更新已知位置"
    },
    {
      key: `角色.${role}.穿着`,
      type: "string",
      default: "日常便服",
      description: `${role}当前主要穿着`,
      updateRule: `${gate}
明确换装或衣物状态显著变化时更新；未提及时保持原值`
    }
  ];
}
function instantiateRomanceMulti(parameters) {
  const roleA = normalizeRoleName(parameters.roleA, "角色A");
  const roleB = normalizeRoleName(parameters.roleB, "角色B");
  if (roleA === roleB) throw new Error("模板角色名不能重复");
  return [
    ...roleVariables(roleA, true),
    ...roleVariables(roleB, false),
    {
      key: "地点.当前地点",
      type: "string",
      default: "客厅",
      description: "用户当前所在地点",
      updateRule: "用户明确移动到新场景后更新；仅提及地点时保持原值"
    },
    ...timeVariables()
  ];
}
function normalizeRoleName(raw, fallback) {
  const name = raw?.trim() || fallback;
  if (name.includes(".")) throw new Error("模板角色名不能包含点号");
  if (!isSafePath(`角色.${name}.变量`)) throw new Error("模板角色名包含危险路径字段");
  return name;
}
var romanceMultiParameters = [
  { key: "roleA", label: "角色 1 名称", default: "角色A" },
  { key: "roleB", label: "角色 2 名称", default: "角色B" }
];
var romanceMulti = {
  id: "romance-multi",
  name: "恋爱 · 多角色",
  description: "为两个角色分别维护在场、好感、关系、状态、位置和穿着；导入前可直接填写角色名。",
  parameters: romanceMultiParameters,
  instantiate: instantiateRomanceMulti,
  variables: instantiateRomanceMulti(Object.fromEntries(romanceMultiParameters.map((item) => [item.key, item.default])))
};
var rpg = {
  id: "rpg",
  name: "RPG 冒险",
  description: "生命、法力、金币、等级、身体状态、位置与完整日期时间。",
  variables: [
    {
      key: "生命值",
      type: "number",
      default: 100,
      description: "当前生命（0~100）",
      range: [0, 100],
      updateRule: "战斗受伤通常 -10~30；休息或治疗按剧情恢复；归零后状态必须改为昏迷"
    },
    {
      key: "法力值",
      type: "number",
      default: 50,
      description: "当前法力（0~100）",
      range: [0, 100],
      updateRule: "施法按强度消耗 5~30；休息、药剂或法力源按剧情恢复；输出计算后的完整数值"
    },
    {
      key: "金币",
      type: "number",
      default: 0,
      description: "当前持有金币",
      range: [0, 999999],
      updateRule: "交易、战利品或悬赏结算时增减；输出计算后的总额，禁止输出增量"
    },
    {
      key: "等级",
      type: "number",
      default: 1,
      description: "冒险者等级（1~99）",
      range: [1, 99],
      updateRule: "只有剧情明确确认升级时增加 1；不得因普通战斗自动增长或跳级"
    },
    {
      key: "当前地点",
      type: "string",
      default: "新手村",
      description: "冒险者当前所在地",
      updateRule: "队伍明确移动并抵达新地点后更新；途中提及目的地时保持原值"
    },
    {
      key: "状态",
      type: "enum",
      default: "正常",
      description: "冒险者当前身体状态",
      enum: ["正常", "受伤", "中毒", "昏迷"],
      updateRule: "由战斗、治疗和事件驱动；生命值归零时必须为昏迷，恢复意识后再按剧情调整"
    },
    ...timeVariables()
  ]
};
var daily = {
  id: "daily",
  name: "日常陪伴",
  description: "好感、心情、体力、活动、地点与完整日期时间，适合慢节奏日常卡。",
  variables: [
    {
      key: "好感度",
      type: "number",
      default: 30,
      description: "角色对用户的好感（0~100）",
      range: [0, 100],
      updateRule: "日常正面互动 +1~2；特别时刻 +3~5；冷落或伤害 -1~5；无实质互动时保持不变"
    },
    {
      key: "心情",
      type: "enum",
      default: "平静",
      description: "角色当前主导心情",
      enum: ["开心", "平静", "疲惫", "低落", "兴奋"],
      updateRule: "场景出现明确情绪变化时更新；短暂语气变化不代表主导心情改变"
    },
    {
      key: "体力",
      type: "number",
      default: 100,
      description: "角色当前体力（0~100）",
      range: [0, 100],
      updateRule: "活动通常消耗 5~15；休息或进食按剧情恢复；跨日充分睡眠后可恢复到 100"
    },
    {
      key: "当前活动",
      type: "string",
      default: "闲聊",
      description: "角色当前正在做的事（一句话）",
      updateRule: "主要活动改变时更新为一句话；动作细节变化但活动未变时保持原值"
    },
    {
      key: "地点.当前地点",
      type: "string",
      default: "家里",
      description: "角色与用户当前所在地点",
      updateRule: "明确移动并抵达新地点后更新；只计划外出时保持原值"
    },
    ...timeVariables()
  ]
};
var survivalExploration = {
  id: "survival-exploration",
  name: "生存探索",
  description: "生命、饥饿、口渴、疲劳、体感温度、危险、地点与时间，适合荒野和末日探索。",
  variables: [
    {
      key: "生存.生命值",
      type: "number",
      default: 100,
      description: "当前生命值（0~100，0 表示失去行动能力）",
      range: [0, 100],
      updateRule: "受伤、疾病或恶劣环境时按剧情降低；治疗和安全休息时恢复；输出完整数值"
    },
    {
      key: "生存.饥饿度",
      type: "number",
      default: 10,
      description: "当前饥饿程度（0~100，越高越饥饿）",
      range: [0, 100],
      updateRule: "随活动和时间缓慢增加，进食后按食物份量降低；未经过明显时间时不要变化"
    },
    {
      key: "生存.口渴度",
      type: "number",
      default: 10,
      description: "当前口渴程度（0~100，越高越缺水）",
      range: [0, 100],
      updateRule: "随时间、炎热和剧烈活动增加，饮水后降低；变化通常快于饥饿度"
    },
    {
      key: "生存.疲劳度",
      type: "number",
      default: 5,
      description: "当前疲劳程度（0~100，越高越疲劳）",
      range: [0, 100],
      updateRule: "移动、战斗和缺眠时增加，休息或睡眠后降低；短暂对话不应显著变化"
    },
    {
      key: "环境.体感温度",
      type: "enum",
      default: "舒适",
      description: "角色当前的体感温度状态",
      enum: ["舒适", "寒冷", "炎热", "失温", "中暑"],
      updateRule: "由天气、衣物、庇护和持续暴露决定；只有环境或防护条件变化时更新"
    },
    {
      key: "环境.危险等级",
      type: "enum",
      default: "安全",
      description: "当前区域对角色的即时危险等级",
      enum: ["安全", "警戒", "危险", "致命"],
      updateRule: "根据已发现的敌人、灾害和退路判断；潜在风险未被发现前不要使用全知信息"
    },
    {
      key: "地点.当前地点",
      type: "string",
      default: "临时营地",
      description: "角色当前所在地点或区域",
      updateRule: "明确移动并抵达新区域后更新；仍在途中时保留当前区域并在正文描述移动"
    },
    ...timeVariables()
  ]
};
var mysteryInvestigation = {
  id: "mystery-investigation",
  name: "悬疑调查",
  description: "调查目标、线索摘要、嫌疑、紧迫度、阶段、地点与时间，适合推理和侦探剧情。",
  variables: [
    {
      key: "调查.当前目标",
      type: "string",
      default: "确认事件经过",
      description: "调查者当前最直接的调查目标（一句话）",
      updateRule: "目标完成、失效或出现更优先线索时更新；同时只保留一个最直接目标"
    },
    {
      key: "调查.线索摘要",
      type: "string",
      default: "尚无可靠线索",
      description: "已确认关键线索的简短摘要，不记录未经证实的猜测",
      updateRule: "获得、排除或重新解释关键线索时重写摘要；只写角色已知信息，避免全知泄露"
    },
    {
      key: "调查.嫌疑度",
      type: "number",
      default: 10,
      description: "当前主要怀疑方向的可信程度（0~100）",
      range: [0, 100],
      updateRule: "可靠证据支持时 +5~20，反证出现时 -5~30；普通直觉只允许小幅变化"
    },
    {
      key: "调查.紧迫度",
      type: "number",
      default: 20,
      description: "案件时间压力或即时威胁（0~100）",
      range: [0, 100],
      updateRule: "截止临近、威胁升级或证据将消失时增加；解除威胁或争取到时间后降低"
    },
    {
      key: "调查.阶段",
      type: "enum",
      default: "案发",
      description: "当前调查流程阶段",
      enum: ["案发", "勘查", "推理", "对质", "结案"],
      updateRule: "完成当前阶段的关键行动后推进一级；证据不足时不得从勘查直接跳到结案"
    },
    {
      key: "地点.当前地点",
      type: "string",
      default: "案发现场",
      description: "调查者当前所在地点",
      updateRule: "明确抵达新的调查地点后更新；提及其他地点或远程联络时保持原值"
    },
    ...timeVariables()
  ]
};
var questProgression = {
  id: "quest-progression",
  name: "任务推进",
  description: "目标、进度、阶段、阻碍、截止压力和完成状态，适合长期主线与委托。",
  variables: [
    {
      key: "任务.目标",
      type: "string",
      default: "确认任务目标",
      description: "当前任务的可验证最终目标（一句话）",
      updateRule: "任务被正式替换或目标条件改变时更新；执行步骤变化不等于最终目标变化"
    },
    {
      key: "任务.进度",
      type: "number",
      default: 0,
      description: "任务总体完成进度（0~100）",
      range: [0, 100],
      updateRule: "完成可验证里程碑时增加 5~30；普通对话不增加；任务失败可按实际损失回退"
    },
    {
      key: "任务.阶段",
      type: "enum",
      default: "未开始",
      description: "当前任务执行阶段",
      enum: ["未开始", "进行中", "受阻", "收尾", "已完成"],
      updateRule: "按实际执行状态更新；主要阻碍未解除时保持受阻，完成验收后才进入已完成"
    },
    {
      key: "任务.阻碍",
      type: "string",
      default: "无",
      description: "当前阻止任务推进的首要问题",
      updateRule: "出现新的首要阻碍时更新，解除后改为下一个阻碍或“无”；不要罗列次要困难"
    },
    {
      key: "任务.截止压力",
      type: "enum",
      default: "无",
      description: "任务截止期限造成的当前压力",
      enum: ["无", "低", "中", "高", "迫近"],
      updateRule: "根据剩余时间和所需工作量调整；时间推进但余量充足时不必升级"
    },
    {
      key: "任务.已完成",
      type: "boolean",
      default: false,
      description: "任务是否已满足最终目标并完成验收",
      updateRule: "只有最终目标已满足且剧情确认完成时设为 true；任务重开或验收失败时才恢复 false"
    },
    ...timeVariables()
  ]
};
var NEWVAR_TEMPLATES = [
  romanceSingle,
  romanceMulti,
  rpg,
  daily,
  survivalExploration,
  mysteryInvestigation,
  questProgression
];

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
  if (!isSafePath(key)) return { error: "变量路径不能包含 __proto__、prototype 或 constructor。" };
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
function parseRange(text3) {
  const t = text3.trim();
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
      render2();
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
    const title2 = el2("div", "so-manager-title");
    title2.textContent = "变量设计";
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
    header.append(title2, closeBtn);
    body = el2("div", "so-manager-body");
    dialog.append(header, body);
    backdrop.append(dialog);
    document.body.append(backdrop);
    render2();
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
    render2();
  }
  function render2() {
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
  function section2(titleText) {
    const box = el2("div", "so-section");
    const title2 = el2("div", "so-section-title");
    title2.textContent = titleText;
    box.append(title2);
    return { box };
  }
  function descLine(parent, text3) {
    const d = el2("div", "so-app-desc");
    d.textContent = text3;
    parent.append(d);
  }
  function buildTemplateSection() {
    const data = deps.getData();
    const { box } = section2("模板库（一键起步）");
    descLine(box, "「替换」清空现有定义后导入；「追加」跳过重名路径合并。导入的规则都已写好，可再逐条微调。");
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
    const builtIn = customId === null ? tpl : null;
    const parameterInputs = /* @__PURE__ */ new Map();
    for (const parameter of builtIn?.parameters ?? []) {
      const row = el2("label", "so-app-toggle");
      const label = document.createElement("span");
      label.textContent = parameter.label;
      const input = document.createElement("input");
      input.type = "text";
      input.className = "text_pole so-app-input";
      input.value = parameter.default;
      input.autocomplete = "off";
      row.append(label, input);
      card.append(row);
      parameterInputs.set(parameter.key, input);
    }
    const resolveVariables = () => {
      if (!builtIn?.instantiate) return tpl.variables;
      const parameters = Object.fromEntries([...parameterInputs].map(([key, input]) => [key, input.value.trim()]));
      const names = Object.values(parameters);
      if (names.some((value) => value === "")) {
        window.alert("请填写所有模板角色名。");
        return null;
      }
      if (new Set(names).size !== names.length) {
        window.alert("模板角色名不能重复。");
        return null;
      }
      if (names.some((value) => value.includes(".") || !isSafePath(`角色.${value}.变量`))) {
        window.alert("角色名不能包含点号或危险路径字段。");
        return null;
      }
      return builtIn.instantiate(parameters);
    };
    const actions = el2("div", "nv-tpl-actions");
    const replaceBtn = el2("button", "menu_button vm-act");
    replaceBtn.textContent = "替换";
    replaceBtn.addEventListener("click", () => {
      const variables = resolveVariables();
      if (!variables) return;
      const cur = deps.getData();
      if (cur.schema.variables.length > 0 && !window.confirm(`用「${tpl.name}」替换现有 ${cur.schema.variables.length} 条定义？（楼层快照不受影响）`)) {
        return;
      }
      formDraft = null;
      editingIndex = null;
      save({ ...cur, schema: { ...cur.schema, name: tpl.name, variables: cloneDefs(variables) } });
    });
    const appendBtn = el2("button", "menu_button vm-act vm-act-ghost");
    appendBtn.textContent = "追加";
    appendBtn.addEventListener("click", () => {
      const variables = resolveVariables();
      if (!variables) return;
      const cur = deps.getData();
      const existing = new Set(cur.schema.variables.map((v) => v.key));
      const added = variables.filter((v) => !existing.has(v.key));
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
    const { box } = section2(`变量定义（${data.schema.variables.length}）`);
    const layout = el2("div", "nv-defs-layout");
    const list = el2("div", "nv-defs-list");
    const editor = el2("div", "nv-defs-editor");
    if (data.schema.variables.length === 0) {
      descLine(list, "还没有变量。从上方模板一键导入，或点右侧「添加变量」逐条定义。");
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
          render2();
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
      render2();
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
    const title2 = el2("div", "so-app-title vm-edit-title");
    title2.textContent = editingIndex === null ? "新变量定义" : `编辑：${draft.key || "（未命名）"}`;
    wrap.append(title2);
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
          render2();
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
      render2();
    });
    actions.append(saveBtn, cancel);
    wrap.append(actions);
    return wrap;
  }
  function buildSettingsSection() {
    const data = deps.getData();
    const { box } = section2("生成设置");
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
    const text3 = deps.buildPreview();
    if (text3) {
      const pre = el2("div", "nv-pre");
      pre.textContent = text3;
      fold.body.append(pre);
    } else {
      descLine(fold.body, "（未启用或未定义任何变量时不注入。启用开关在手机「新变量」页。）");
    }
    const wrap = el2("div", "so-section");
    wrap.append(fold.box);
    return wrap;
  }
  function buildLogSection() {
    const fold = foldSection("解析日志");
    const report = deps.getLastParse();
    if (!report) {
      descLine(fold.body, "尚无解析记录。AI 回复包含 <UpdateVariable> 块时，这里显示逐条接受/修正/拒绝结果。");
    } else {
      descLine(fold.body, `楼层 #${report.messageId}${report.error ? ` · 解析出错：${report.error}` : ""}`);
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

// st-extension/src/apps/renderer/parser.ts
var OPEN_TAG = "<STStageRender>";
var CLOSE_TAG = "</STStageRender>";
var TAG_PREFIX = "<STStageRender";
var CLOSE_TAG_PREFIX = "</STStageRender";
var MAX_JSON_BYTES = 64 * 1024;
var MAX_BARE_SCAN_CHARS = 1024 * 1024;
var MAX_ARRAY_ITEMS = 12;
var MAX_BEATS = 50;
var MAX_CARDS = 8;
var MAX_RENDERER_BLOCKS = 3;
function firstError(...errors) {
  return errors.find((error) => error !== null) ?? null;
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function checkKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) return `${label}包含未知字段: ${key}`;
  }
  return null;
}
function getRequiredString(value, key, label, maxLength) {
  const field = value[key];
  if (typeof field !== "string" || field.trim().length === 0) return `${label}.${key} 必须是非空字符串`;
  if (field.length > maxLength) return `${label}.${key} 超过最大长度 ${maxLength}`;
  if (/<\/?[a-z][^>]*>/i.test(field)) return `${label}.${key} 不接受 HTML`;
  return null;
}
function getOptionalString(value, key, label, maxLength) {
  if (!(key in value)) return null;
  const field = value[key];
  if (typeof field !== "string") return `${label}.${key} 必须是字符串`;
  if (field.length > maxLength) return `${label}.${key} 超过最大长度 ${maxLength}`;
  if (/<\/?[a-z][^>]*>/i.test(field)) return `${label}.${key} 不接受 HTML`;
  return null;
}
function getNumber(value, key, label, min, max) {
  const field = value[key];
  if (typeof field !== "number" || !Number.isFinite(field) || !Number.isInteger(field)) {
    return `${label}.${key} 必须是有限整数`;
  }
  if (field < min || field > max) return `${label}.${key} 必须在 ${min}-${max} 范围内`;
  return null;
}
function getBoolean(value, key, label) {
  if (typeof value[key] !== "boolean") return `${label}.${key} 必须是布尔值`;
  return null;
}
function isSafeImageUrl(value) {
  if (/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=]+$/i.test(value)) return true;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.length > 0;
    } catch {
      return false;
    }
  }
  if (value.startsWith("//") || value.includes("\\") || /[\s<>]/.test(value)) return false;
  const localPrefix = /^(?:\/user\/|\.\/|assets\/|\/scripts\/extensions\/third-party\/)/i;
  if (!localPrefix.test(value)) return false;
  const path = value.split(/[?#]/, 1)[0].replace(/^\.\//, "");
  try {
    return !path.split("/").some((segment) => {
      let decoded = segment;
      for (let depth = 0; depth < 2; depth += 1) {
        decoded = decodeURIComponent(decoded);
        if (decoded === "." || decoded === ".." || /[\\/]/.test(decoded)) return true;
      }
      return false;
    });
  } catch {
    return false;
  }
}
function getOptionalImageUrl(value, key, label) {
  const error = getOptionalString(value, key, label, 2048);
  if (error !== null) return error;
  if (!(key in value)) return null;
  if (!isSafeImageUrl(value[key])) return `${label}.${key} 不是安全图片 URL`;
  return null;
}
function getOptionalPortrait(value, key, label) {
  const error = getOptionalString(value, key, label, 500);
  if (error !== null) return error;
  if (!(key in value)) return null;
  const portrait = value[key];
  if (/^sprite:[^\s<>]{1,493}$/u.test(portrait) || isSafeImageUrl(portrait)) return null;
  return `${label}.${key} 不是安全图片 URL 或 sprite 地址`;
}
function findDuplicateId(items) {
  const ids = /* @__PURE__ */ new Set();
  for (const item of items) {
    if (ids.has(item.id)) return item.id;
    ids.add(item.id);
  }
  return null;
}
function validateGal(value) {
  const keys = ["version", "mode", "title", "scene", "background", "beats"];
  const keyError = checkKeys(value, keys, "gal");
  if (keyError) return keyError;
  if (value.version !== 1) return "version 只支持 1";
  if (value.mode !== "gal") return "mode 只支持 gal、cards 或 battle";
  for (const [key, max] of [["title", 200], ["scene", 500]]) {
    const error = key === "title" ? getOptionalString(value, key, "gal", max) : getRequiredString(value, key, "gal", max);
    if (error) return error;
  }
  const backgroundError = getOptionalImageUrl(value, "background", "gal");
  if (backgroundError) return backgroundError;
  if (!Array.isArray(value.beats) || value.beats.length < 1) return "gal.beats 至少需要 1 项";
  if (value.beats.length > MAX_BEATS) return "gal.beats 必须在 1-50 范围内";
  const beats = [];
  for (const [index, item] of value.beats.entries()) {
    if (!isRecord3(item)) return `gal.beats[${index}] 必须是对象`;
    const itemError = checkKeys(item, ["speaker", "text", "portrait", "background"], `gal.beats[${index}]`);
    if (itemError) return itemError;
    const contentError = firstError(
      getRequiredString(item, "speaker", `gal.beats[${index}]`, 100),
      getRequiredString(item, "text", `gal.beats[${index}]`, 2e3),
      getOptionalPortrait(item, "portrait", `gal.beats[${index}]`),
      getOptionalImageUrl(item, "background", `gal.beats[${index}]`)
    );
    if (contentError) return contentError;
    beats.push({
      speaker: item.speaker,
      text: item.text,
      ...item.portrait === void 0 ? {} : { portrait: item.portrait },
      ...item.background === void 0 ? {} : { background: item.background }
    });
  }
  return {
    version: 1,
    mode: "gal",
    ...value.title === void 0 ? {} : { title: value.title },
    scene: value.scene,
    ...value.background === void 0 ? {} : { background: value.background },
    beats
  };
}
function validateCard(value, index) {
  if (!isRecord3(value)) return `cards.cards[${index}] 必须是对象`;
  const label = `cards.cards[${index}]`;
  const keyError = checkKeys(value, ["id", "title", "description", "consequence", "action"], label);
  if (keyError) return keyError;
  const errors = [
    getRequiredString(value, "id", label, 100),
    getRequiredString(value, "title", label, 200),
    getRequiredString(value, "description", label, 1e3),
    getOptionalString(value, "consequence", label, 1e3),
    getRequiredString(value, "action", label, 2e3)
  ];
  const error = firstError(...errors);
  if (error) return error;
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    ...value.consequence === void 0 ? {} : { consequence: value.consequence },
    action: value.action
  };
}
function validateCards(value) {
  const keyError = checkKeys(value, ["version", "mode", "title", "cards"], "cards");
  if (keyError) return keyError;
  if (value.version !== 1) return "version 只支持 1";
  if (value.mode !== "cards") return "mode 只支持 gal、cards 或 battle";
  const titleError = getRequiredString(value, "title", "cards", 200);
  if (titleError) return titleError;
  if (!Array.isArray(value.cards) || value.cards.length < 2) return "cards.cards 至少需要 2 项";
  if (value.cards.length > MAX_CARDS) return "cards.cards 必须在 2-8 范围内";
  const cards = [];
  for (const [index, item] of value.cards.entries()) {
    const card = validateCard(item, index);
    if (typeof card === "string") return card;
    cards.push(card);
  }
  const duplicateId = findDuplicateId(cards);
  if (duplicateId) return `cards.cards 包含重复 ID: ${duplicateId}`;
  return { version: 1, mode: "cards", title: value.title, cards };
}
function validateSkill(value, index) {
  if (!isRecord3(value)) return `battle.skills[${index}] 必须是对象`;
  const label = `battle.skills[${index}]`;
  const keyError = checkKeys(value, ["id", "name", "description", "type", "mpCost", "power"], label);
  if (keyError) return keyError;
  const stringError = firstError(getRequiredString(value, "id", label, 100), getRequiredString(value, "name", label, 100), getOptionalString(value, "description", label, 500));
  if (stringError) return stringError;
  if (value.type !== "damage" && value.type !== "heal") return `${label}.type 只支持 damage 或 heal`;
  const numericError = firstError(getNumber(value, "mpCost", label, 0, 9999), getNumber(value, "power", label, 0, 9999));
  if (numericError) return numericError;
  return {
    id: value.id,
    name: value.name,
    ...value.description === void 0 ? {} : { description: value.description },
    type: value.type,
    mpCost: value.mpCost,
    power: value.power
  };
}
function validateItem(value, index) {
  if (!isRecord3(value)) return `battle.items[${index}] 必须是对象`;
  const label = `battle.items[${index}]`;
  const keyError = checkKeys(value, ["id", "name", "description", "effect", "quantity", "power"], label);
  if (keyError) return keyError;
  const stringError = firstError(getRequiredString(value, "id", label, 100), getRequiredString(value, "name", label, 100), getOptionalString(value, "description", label, 500));
  if (stringError) return stringError;
  if (value.effect !== "heal_hp" && value.effect !== "heal_mp") return `${label}.effect 只支持 heal_hp 或 heal_mp`;
  const numericError = firstError(getNumber(value, "quantity", label, 0, 9999), getNumber(value, "power", label, 0, 9999));
  if (numericError) return numericError;
  return {
    id: value.id,
    name: value.name,
    ...value.description === void 0 ? {} : { description: value.description },
    effect: value.effect,
    quantity: value.quantity,
    power: value.power
  };
}
function validateStatus(value, index) {
  if (!isRecord3(value)) return `battle.statuses[${index}] 必须是对象`;
  const label = `battle.statuses[${index}]`;
  const keyError = checkKeys(value, ["id", "name", "duration", "attackDelta", "defenseDelta", "damagePerTurn"], label);
  if (keyError) return keyError;
  const stringError = firstError(getRequiredString(value, "id", label, 100), getRequiredString(value, "name", label, 100));
  if (stringError) return stringError;
  const durationError = getNumber(value, "duration", label, 1, 9999);
  if (durationError) return durationError;
  for (const key of ["attackDelta", "defenseDelta", "damagePerTurn"]) {
    const min = key === "damagePerTurn" ? 0 : -9999;
    const error = key in value ? getNumber(value, key, label, min, 9999) : null;
    if (error) return error;
  }
  return {
    id: value.id,
    name: value.name,
    duration: value.duration,
    ...value.attackDelta === void 0 ? {} : { attackDelta: value.attackDelta },
    ...value.defenseDelta === void 0 ? {} : { defenseDelta: value.defenseDelta },
    ...value.damagePerTurn === void 0 ? {} : { damagePerTurn: value.damagePerTurn }
  };
}
function validateFighter(value, label) {
  if (!isRecord3(value)) return `${label} 必须是对象`;
  const keyError = checkKeys(value, ["id", "name", "hp", "maxHp", "mp", "maxMp", "attack", "defense", "speed", "crit", "dodge", "portrait", "skills", "items", "statuses"], label);
  if (keyError) return keyError;
  const identityError = firstError(getRequiredString(value, "id", label, 100), getRequiredString(value, "name", label, 100));
  if (identityError) return identityError;
  const numericErrors = [
    getNumber(value, "hp", label, 0, 9999),
    getNumber(value, "maxHp", label, 1, 9999),
    getNumber(value, "mp", label, 0, 9999),
    getNumber(value, "maxMp", label, 0, 9999),
    getNumber(value, "attack", label, 0, 9999),
    getNumber(value, "defense", label, 0, 9999),
    getNumber(value, "speed", label, 0, 9999),
    getNumber(value, "crit", label, 0, 100),
    getNumber(value, "dodge", label, 0, 100)
  ];
  const numericError = numericErrors.find((item) => item !== null);
  if (numericError) return numericError;
  if (value.hp > value.maxHp) return `${label}.hp 必须小于等于 maxHp`;
  if (value.mp > value.maxMp) return `${label}.mp 必须小于等于 maxMp`;
  const portraitError = getOptionalPortrait(value, "portrait", label);
  if (portraitError) return portraitError;
  const parsed = {
    id: value.id,
    name: value.name,
    hp: value.hp,
    maxHp: value.maxHp,
    mp: value.mp,
    maxMp: value.maxMp,
    attack: value.attack,
    defense: value.defense,
    speed: value.speed,
    crit: value.crit,
    dodge: value.dodge,
    ...value.portrait === void 0 ? {} : { portrait: value.portrait }
  };
  const validators = [
    { key: "skills", validate: validateSkill },
    { key: "items", validate: validateItem },
    { key: "statuses", validate: validateStatus }
  ];
  for (const { key, validate } of validators) {
    if (!(key in value)) continue;
    const items = value[key];
    if (!Array.isArray(items)) return `${label}.${key} 必须是数组`;
    if (items.length > MAX_ARRAY_ITEMS) return `${label}.${key} 最多 12 项`;
    const parsedItems = [];
    for (const [index, item] of items.entries()) {
      const parsedItem = validate(item, index);
      if (typeof parsedItem === "string") return parsedItem;
      parsedItems.push(parsedItem);
    }
    const duplicateId = findDuplicateId(parsedItems);
    if (duplicateId) return `${label}.${key} 包含重复 ID: ${duplicateId}`;
    if (key === "skills") parsed.skills = parsedItems;
    if (key === "items") parsed.items = parsedItems;
    if (key === "statuses") parsed.statuses = parsedItems;
  }
  return parsed;
}
function validateBattle(value) {
  const keyError = checkKeys(value, ["version", "mode", "title", "background", "player", "enemy", "enemyIntent", "allowFlee"], "battle");
  if (keyError) return keyError;
  if (value.version !== 1) return "version 只支持 1";
  if (value.mode !== "battle") return "mode 只支持 gal、cards 或 battle";
  const titleError = getRequiredString(value, "title", "battle", 200);
  if (titleError) return titleError;
  const backgroundError = getOptionalImageUrl(value, "background", "battle");
  if (backgroundError) return backgroundError;
  const player = validateFighter(value.player, "battle.player");
  if (typeof player === "string") return player;
  const enemy = validateFighter(value.enemy, "battle.enemy");
  if (typeof enemy === "string") return enemy;
  if (player.id === enemy.id) return `battle.player 与 battle.enemy 包含重复 ID: ${player.id}`;
  const intentError = getOptionalString(value, "enemyIntent", "battle", 500);
  if (intentError) return intentError;
  const fleeError = "allowFlee" in value ? getBoolean(value, "allowFlee", "battle") : null;
  if (fleeError) return fleeError;
  return {
    version: 1,
    mode: "battle",
    title: value.title,
    ...value.background === void 0 ? {} : { background: value.background },
    player,
    enemy,
    ...value.enemyIntent === void 0 ? {} : { enemyIntent: value.enemyIntent },
    ...value.allowFlee === void 0 ? {} : { allowFlee: value.allowFlee }
  };
}
function validateBlock(value) {
  if (!isRecord3(value)) return "渲染块必须是 JSON 对象";
  if (value.version !== 1) return "version 只支持 1";
  if (value.mode === "gal") return validateGal(value);
  if (value.mode === "cards") return validateCards(value);
  if (value.mode === "battle") return validateBattle(value);
  return "mode 只支持 gal、cards 或 battle";
}
function parseBareRendererBlocks(source) {
  if (source.length > MAX_BARE_SCAN_CHARS) return [];
  const accepted = [];
  let objectStart = -1;
  let objectDepth = 0;
  let arrayDepth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (objectDepth > 0) {
      if (char === "{") objectDepth += 1;
      else if (char === "}") objectDepth -= 1;
      if (objectDepth !== 0) continue;
      const start = objectStart;
      const raw = source.slice(start, index + 1);
      objectStart = -1;
      if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BYTES) continue;
      let value;
      try {
        value = JSON.parse(raw);
      } catch {
        continue;
      }
      const block = validateBlock(value);
      if (typeof block === "string") continue;
      accepted.push({ block, raw, start, end: index + 1 });
      if (accepted.length >= MAX_RENDERER_BLOCKS) return accepted;
      continue;
    }
    if (char === "[") arrayDepth += 1;
    else if (char === "]") arrayDepth = Math.max(0, arrayDepth - 1);
    else if (char === "{" && arrayDepth === 0) {
      objectStart = index;
      objectDepth = 1;
    }
  }
  return accepted;
}
function parseWrappedRendererBlocks(source) {
  const accepted = [];
  let cursor = 0;
  while (true) {
    const start = source.indexOf(OPEN_TAG, cursor);
    if (start < 0) break;
    const close = source.indexOf(CLOSE_TAG, start + OPEN_TAG.length);
    if (close < 0) break;
    const end = close + CLOSE_TAG.length;
    const json = source.slice(start + OPEN_TAG.length, close);
    cursor = end;
    if (new TextEncoder().encode(json).byteLength > MAX_JSON_BYTES) continue;
    let value;
    try {
      value = JSON.parse(json);
    } catch {
      continue;
    }
    const block = validateBlock(value);
    if (typeof block === "string") continue;
    accepted.push({ block, raw: source.slice(start, end), start, end });
    if (accepted.length >= MAX_RENDERER_BLOCKS) break;
  }
  return accepted;
}
function parseRendererBlocks(source) {
  if (typeof source !== "string") return [];
  if (source.includes(OPEN_TAG)) return parseWrappedRendererBlocks(source);
  if (source.includes(TAG_PREFIX) || source.includes(CLOSE_TAG_PREFIX)) return [];
  return parseBareRendererBlocks(source);
}

// st-extension/src/apps/renderer/runtime.ts
var RENDERER_CLASS = "st-stage-renderer";
var SOURCE_CLASS = "st-stage-render-source";
var MARKER_CLASS2 = "st-stage-render-marker";
function isModeEnabled(settings, mode) {
  if (mode === "gal") return settings.galEnabled;
  if (mode === "cards") return settings.cardsEnabled;
  return settings.battleEnabled;
}
function findTextBoundary(root, target) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let last = null;
  let current2;
  while (current2 = walker.nextNode()) {
    const node = current2;
    const length = node.data.length;
    if (target <= consumed + length) return { node, offset: target - consumed };
    consumed += length;
    last = node;
  }
  return target === consumed && last ? { node: last, offset: last.data.length } : null;
}
function hideSourceBlock(root, parsed) {
  const text3 = root.textContent ?? "";
  if (text3.slice(parsed.start, parsed.end) !== parsed.raw) return null;
  const start = findTextBoundary(root, parsed.start);
  const end = findTextBoundary(root, parsed.end);
  if (!start || !end) return null;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  const source = document.createElement("span");
  source.className = SOURCE_CLASS;
  source.hidden = true;
  source.append(range.extractContents());
  range.insertNode(source);
  return source;
}
function outsideSignature(root, mounts) {
  const holder = document.createElement("div");
  const owned = new Set(mounts.flatMap((state) => [state.marker, state.container]));
  for (const node of Array.from(root.childNodes)) {
    if (!owned.has(node)) holder.append(node.cloneNode(true));
  }
  return holder.innerHTML;
}
function stillOwnsDom(root, state) {
  return state.mounts.every((mount) => mount.marker.parentNode === root && mount.container.parentNode === root) && outsideSignature(root, state.mounts) === state.outsideSignature;
}
function destroyMount(state) {
  if (state.destroyed) return;
  state.destroyed = true;
  try {
    state.mount.destroy();
  } catch {
  }
}
function createRendererRuntime(deps) {
  const states = /* @__PURE__ */ new WeakMap();
  const mountedRoots = /* @__PURE__ */ new Set();
  const modeDeps = deps.modeDeps ?? { getSettings: deps.getSettings };
  let disposed = false;
  function cleanupRoot(root) {
    const state = states.get(root);
    if (!state) return;
    for (const mount of state.mounts) destroyMount(mount);
    if (stillOwnsDom(root, state)) {
      root.replaceChildren(...state.snapshot);
    } else {
      for (const mount of state.mounts) {
        mount.marker.remove();
        mount.container.remove();
        if (root.contains(mount.source)) mount.source.replaceWith(...Array.from(mount.source.childNodes));
      }
    }
    states.delete(root);
    mountedRoots.delete(root);
  }
  function pruneDetachedRoots() {
    for (const root of Array.from(mountedRoots)) {
      if (!root.isConnected) cleanupRoot(root);
    }
  }
  function processMessage(root) {
    if (disposed) return;
    pruneDetachedRoots();
    if (!root.isConnected) return;
    const settings = deps.getSettings();
    const current2 = states.get(root);
    if (current2 && stillOwnsDom(root, current2) && settings.enabled && current2.mounts.every((mount) => isModeEnabled(settings, mount.mode))) return;
    if (current2) cleanupRoot(root);
    const message = root.closest(".mes");
    if (message?.getAttribute("is_user") === "true" || message?.getAttribute("is_system") === "true") return;
    if (!settings.enabled) return;
    const snapshot = Array.from(root.childNodes).map((node) => node.cloneNode(true));
    const prepared = [];
    for (const parsed of parseRendererBlocks(root.textContent ?? "")) {
      if (!isModeEnabled(settings, parsed.block.mode)) continue;
      const factory = deps.factories[parsed.block.mode];
      if (!factory) continue;
      const container = document.createElement("section");
      container.className = RENDERER_CLASS;
      try {
        const mount = factory(container, parsed.block, modeDeps);
        if (!mount || typeof mount.destroy !== "function") continue;
        prepared.push({ parsed, container, mount });
      } catch {
        continue;
      }
    }
    if (prepared.length === 0) return;
    const mounts = [];
    for (const item of [...prepared].reverse()) {
      const source = (() => {
        try {
          return hideSourceBlock(root, item.parsed);
        } catch {
          return null;
        }
      })();
      if (!source) {
        try {
          item.mount.destroy();
        } catch {
        }
        continue;
      }
      const marker = document.createElement("span");
      marker.className = MARKER_CLASS2;
      marker.hidden = true;
      mounts.unshift({
        mount: item.mount,
        marker,
        source,
        container: item.container,
        mode: item.parsed.block.mode,
        destroyed: false
      });
    }
    if (mounts.length === 0) return;
    for (const mount of mounts) root.append(mount.marker, mount.container);
    states.set(root, { mounts, snapshot, outsideSignature: outsideSignature(root, mounts) });
    mountedRoots.add(root);
  }
  function reprocessAll(scope = document) {
    if (disposed) return;
    for (const root of Array.from(mountedRoots)) cleanupRoot(root);
    const roots = [];
    if (scope instanceof HTMLElement && scope.matches(".mes_text")) roots.push(scope);
    for (const root of Array.from(scope.querySelectorAll(".mes_text"))) roots.push(root);
    for (const root of roots) processMessage(root);
  }
  function dispose() {
    if (disposed) return;
    for (const root of Array.from(mountedRoots)) cleanupRoot(root);
    disposed = true;
  }
  return { processMessage, reprocessAll, dispose };
}

// st-extension/src/apps/renderer/modes/gal.ts
var TYPEWRITER_INTERVAL_MS = 24;
function textElement(tag, className, text3) {
  const element2 = document.createElement(tag);
  element2.className = className;
  element2.textContent = text3;
  return element2;
}
function stageImage(className, src, alt) {
  const image = document.createElement("img");
  image.className = className;
  image.src = src;
  image.alt = alt;
  image.draggable = false;
  image.addEventListener("error", () => {
    image.hidden = true;
  });
  return image;
}
function resolvePortrait(value, deps) {
  if (!value) return null;
  if (!value.startsWith("sprite:")) return value;
  try {
    return deps.resolvePortrait?.(value.slice("sprite:".length)) ?? null;
  } catch {
    return null;
  }
}
function resolveBeatPortrait(portrait, speaker, deps) {
  if (portrait !== void 0) return resolvePortrait(portrait, deps);
  try {
    return deps.resolveSpeakerPortrait?.(speaker) ?? null;
  } catch {
    return null;
  }
}
function mountGalMode(root, block, deps) {
  const stage = document.createElement("div");
  stage.className = "st-render-gal";
  stage.setAttribute("role", "group");
  stage.setAttribute("aria-label", block.title ?? block.scene);
  const backgroundLayer = document.createElement("div");
  backgroundLayer.className = "st-render-gal-background-layer";
  const header = document.createElement("header");
  header.className = "st-render-gal-header";
  if (block.title) header.append(textElement("div", "st-render-gal-title", block.title));
  header.append(textElement("div", "st-render-gal-scene", block.scene));
  const portraitLayer = document.createElement("div");
  portraitLayer.className = "st-render-gal-portrait-layer";
  const dialogueBox = document.createElement("div");
  dialogueBox.className = "st-render-gal-dialogue-box";
  const speaker = textElement("div", "st-render-gal-speaker", "");
  const dialogue = textElement("div", "st-render-gal-dialogue", "");
  dialogue.setAttribute("aria-live", "polite");
  const controls = document.createElement("div");
  controls.className = "st-render-gal-controls";
  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "st-render-gal-control";
  previous.setAttribute("aria-label", "上一句");
  previous.title = "上一句";
  previous.textContent = "←";
  const progress = textElement("span", "st-render-gal-progress", "");
  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "st-render-gal-control st-render-gal-skip";
  skip.setAttribute("aria-label", "跳过");
  skip.textContent = "跳过";
  const next = document.createElement("button");
  next.type = "button";
  next.className = "st-render-gal-control";
  next.setAttribute("aria-label", "下一句");
  next.title = "下一句";
  next.textContent = "→";
  controls.append(previous, progress, skip, next);
  dialogueBox.append(speaker, dialogue, controls);
  stage.append(backgroundLayer, header, portraitLayer, dialogueBox);
  root.replaceChildren(stage);
  root.tabIndex = 0;
  let index = 0;
  let timer = null;
  let fullDialogue = "";
  let dialogueUnits = [];
  let cursor = 0;
  let destroyed = false;
  function stopTyping(complete) {
    if (timer === null) return false;
    clearInterval(timer);
    timer = null;
    if (complete) dialogue.textContent = fullDialogue;
    return true;
  }
  function renderDialogue(text3, forceInstant = false) {
    stopTyping(false);
    fullDialogue = text3;
    dialogueUnits = Array.from(text3);
    cursor = 0;
    const settings = deps.getSettings();
    if (forceInstant || settings.reducedMotion || !settings.typewriter) {
      dialogue.textContent = text3;
      return;
    }
    dialogue.textContent = "";
    timer = setInterval(() => {
      if (destroyed) return;
      cursor += 1;
      dialogue.textContent = dialogueUnits.slice(0, cursor).join("");
      if (cursor >= dialogueUnits.length) stopTyping(false);
    }, TYPEWRITER_INTERVAL_MS);
  }
  function renderBeat(forceInstant = false) {
    const beat = block.beats[index];
    speaker.textContent = beat.speaker;
    renderDialogue(beat.text, forceInstant);
    backgroundLayer.replaceChildren();
    const background = beat.background ?? block.background;
    if (background) backgroundLayer.append(stageImage("st-render-gal-background", background, ""));
    portraitLayer.replaceChildren();
    const portrait = resolveBeatPortrait(beat.portrait, beat.speaker, deps);
    if (portrait) portraitLayer.append(stageImage("st-render-gal-portrait", portrait, beat.speaker));
    previous.disabled = index === 0;
    next.disabled = index === block.beats.length - 1;
    skip.disabled = false;
    progress.textContent = `${index + 1} / ${block.beats.length}`;
  }
  function goPrevious() {
    if (index === 0) return;
    stopTyping(false);
    index -= 1;
    renderBeat();
  }
  function goNext() {
    if (stopTyping(true)) return;
    if (index >= block.beats.length - 1) return;
    index += 1;
    renderBeat();
  }
  function goLast() {
    stopTyping(false);
    index = block.beats.length - 1;
    renderBeat(true);
  }
  function onKeyDown(event) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    } else if (event.key === "End") {
      event.preventDefault();
      goLast();
    }
  }
  previous.addEventListener("click", goPrevious);
  next.addEventListener("click", goNext);
  skip.addEventListener("click", goLast);
  root.addEventListener("keydown", onKeyDown);
  renderBeat();
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopTyping(false);
      root.removeEventListener("keydown", onKeyDown);
      previous.removeEventListener("click", goPrevious);
      next.removeEventListener("click", goNext);
      skip.removeEventListener("click", goLast);
    }
  };
}

// st-extension/src/apps/renderer/modes/cards.ts
function textElement2(tag, className, text3) {
  const element2 = document.createElement(tag);
  element2.className = className;
  element2.textContent = text3;
  return element2;
}
function createCard(card) {
  const article = document.createElement("article");
  article.className = "st-render-card";
  article.dataset.cardId = card.id;
  article.append(
    textElement2("h3", "st-render-card-title", card.title),
    textElement2("p", "st-render-card-description", card.description)
  );
  if (card.consequence) article.append(textElement2("p", "st-render-card-consequence", card.consequence));
  const button2 = document.createElement("button");
  button2.type = "button";
  button2.className = "st-render-card-select";
  button2.dataset.cardId = card.id;
  button2.setAttribute("aria-pressed", "false");
  button2.textContent = "✓ 填入输入框";
  article.append(button2);
  return article;
}
function mountCardsMode(root, block, deps) {
  const section2 = document.createElement("section");
  section2.className = "st-render-cards";
  const title2 = textElement2("h2", "st-render-cards-title", block.title);
  const grid = document.createElement("div");
  grid.className = "st-render-cards-grid";
  for (const card of block.cards) grid.append(createCard(card));
  const status = textElement2("div", "st-render-cards-status", "");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  section2.append(title2, grid, status);
  root.replaceChildren(section2);
  const cards = new Map(block.cards.map((card) => [card.id, card]));
  let destroyed = false;
  function setSelected(selectedId) {
    for (const element2 of Array.from(grid.querySelectorAll(".st-render-card"))) {
      const selected = selectedId !== null && element2.dataset.cardId === selectedId;
      element2.classList.toggle("st-render-card-selected", selected);
      element2.querySelector(".st-render-card-select")?.setAttribute("aria-pressed", String(selected));
    }
  }
  function onClick(event) {
    if (destroyed || !(event.target instanceof Element)) return;
    const button2 = event.target.closest(".st-render-card-select");
    if (!button2 || !root.contains(button2)) return;
    const card = cards.get(button2.dataset.cardId ?? "");
    if (!card) return;
    const result = deps.insertDraft?.(card.action) ?? { ok: false, error: "未找到 SillyTavern 输入框。" };
    if (!result.ok) {
      setSelected(null);
      status.textContent = result.error;
      status.className = "st-render-cards-status st-render-cards-status-error";
      return;
    }
    setSelected(card.id);
    status.className = "st-render-cards-status st-render-cards-status-success";
    status.textContent = `已填入，请检查后发送：${card.title}`;
  }
  root.addEventListener("click", onClick);
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      root.removeEventListener("click", onClick);
    }
  };
}

// st-extension/src/apps/renderer/battle-engine.ts
var DEFENDING_STATUS_ID = "__defending";
function bounded(value, min = 0, max = 9999) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
function cloneFighter(fighter) {
  return {
    ...fighter,
    skills: fighter.skills.map((skill) => ({ ...skill })),
    items: fighter.items.map((item) => ({ ...item })),
    statuses: fighter.statuses.map((status) => ({ ...status }))
  };
}
function cloneState(state) {
  return {
    ...state,
    player: cloneFighter(state.player),
    enemy: cloneFighter(state.enemy),
    log: state.log.map((entry) => ({ ...entry }))
  };
}
function createFighter(config) {
  return {
    ...config,
    hp: bounded(config.hp, 0, config.maxHp),
    mp: bounded(config.mp, 0, config.maxMp),
    skills: (config.skills ?? []).map((skill) => ({ ...skill })),
    items: (config.items ?? []).map((item) => ({ ...item })),
    statuses: (config.statuses ?? []).map((status) => ({ ...status }))
  };
}
function effectiveStat(fighter, stat) {
  const field = stat === "attack" ? "attackDelta" : "defenseDelta";
  const delta = fighter.statuses.reduce((sum, status) => sum + (status[field] ?? 0), 0);
  return bounded(fighter[stat] + delta);
}
function upsertStatus(fighter, status) {
  const index = fighter.statuses.findIndex((item) => item.id === status.id);
  if (index >= 0) fighter.statuses[index] = { ...status };
  else fighter.statuses.push({ ...status });
}
function createRandom(source) {
  return () => {
    try {
      const value = source();
      return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
    } catch {
      return 0.5;
    }
  };
}
function createBattleEngine(config, deps = {}) {
  const random = createRandom(deps.random ?? Math.random);
  const player = createFighter(config.player);
  const enemy = createFighter(config.enemy);
  const state = {
    title: config.title,
    player,
    enemy,
    turn: 1,
    outcome: enemy.hp <= 0 ? "won" : player.hp <= 0 ? "lost" : "ongoing",
    log: [],
    allowFlee: config.allowFlee === true
  };
  function record(events, kind, text3) {
    const entry = { kind, text: text3 };
    events.push(entry);
    state.log.push({ ...entry });
  }
  function dealDamage(attacker, target, power, events, allowCritical = true) {
    if (random() * 100 < target.dodge) {
      record(events, "dodge", `${target.name} 闪避了 ${attacker.name} 的攻击。`);
      return;
    }
    const critical = allowCritical && random() * 100 < attacker.crit;
    const raw = critical ? Math.floor(power * 1.5) : power;
    const damage = Math.max(1, bounded(raw - effectiveStat(target, "defense")));
    target.hp = bounded(target.hp - damage, 0, target.maxHp);
    record(events, "damage", `${attacker.name}${critical ? "暴击" : ""}对 ${target.name} 造成 ${damage} 点伤害。`);
  }
  function updateOutcome() {
    if (state.enemy.hp <= 0) state.outcome = "won";
    else if (state.player.hp <= 0) state.outcome = "lost";
  }
  function tickStatuses(fighter, events) {
    const next = [];
    for (const status of fighter.statuses) {
      if ((status.damagePerTurn ?? 0) > 0 && fighter.hp > 0) {
        const damage = bounded(status.damagePerTurn ?? 0);
        fighter.hp = bounded(fighter.hp - damage, 0, fighter.maxHp);
        record(events, "status-damage", `${fighter.name} 受到 ${status.name} 的 ${damage} 点伤害。`);
      }
      const duration = status.duration - 1;
      if (duration > 0) next.push({ ...status, duration });
    }
    fighter.statuses = next;
  }
  function runEnemyTurn(events) {
    if (state.outcome !== "ongoing") return;
    dealDamage(state.enemy, state.player, effectiveStat(state.enemy, "attack"), events);
    updateOutcome();
  }
  function finishRound(events) {
    tickStatuses(state.player, events);
    tickStatuses(state.enemy, events);
    updateOutcome();
    state.turn += 1;
  }
  function reject(error) {
    return { ok: false, error, state: cloneState(state), events: [] };
  }
  function dispatch(action) {
    if (state.outcome !== "ongoing") return reject("战斗已经结束。");
    const actionType = action?.type;
    if (!["attack", "defend", "skill", "item", "flee"].includes(String(actionType))) {
      return reject("不支持的战斗动作。");
    }
    let validationError = null;
    let skill;
    let item;
    if (action.type === "skill") {
      skill = state.player.skills.find((candidate) => candidate.id === action.skillId);
      if (!skill) validationError = "找不到该技能。";
      else if (state.player.mp < skill.mpCost) validationError = "MP 不足。";
    } else if (action.type === "item") {
      item = state.player.items.find((candidate) => candidate.id === action.itemId);
      if (!item) validationError = "找不到该物品。";
      else if (item.quantity <= 0) validationError = "该物品已经用完。";
    } else if (action.type === "flee" && !state.allowFlee) {
      validationError = "本场战斗不能逃跑。";
    }
    if (validationError) return reject(validationError);
    const events = [];
    if (action.type === "attack") {
      dealDamage(state.player, state.enemy, effectiveStat(state.player, "attack"), events);
    } else if (action.type === "defend") {
      upsertStatus(state.player, {
        id: DEFENDING_STATUS_ID,
        name: "防御",
        duration: 1,
        defenseDelta: Math.max(10, effectiveStat(state.player, "defense"))
      });
      record(events, "defend", `${state.player.name} 进入防御姿态。`);
    } else if (action.type === "skill" && skill) {
      state.player.mp = bounded(state.player.mp - skill.mpCost, 0, state.player.maxMp);
      if (skill.type === "damage") dealDamage(state.player, state.enemy, skill.power, events);
      else {
        const before = state.player.hp;
        state.player.hp = bounded(state.player.hp + skill.power, 0, state.player.maxHp);
        record(events, "heal", `${state.player.name} 恢复 ${state.player.hp - before} 点生命。`);
      }
    } else if (action.type === "item" && item) {
      item.quantity -= 1;
      const field = item.effect === "heal_hp" ? "hp" : "mp";
      const maxField = item.effect === "heal_hp" ? "maxHp" : "maxMp";
      const before = state.player[field];
      state.player[field] = bounded(before + item.power, 0, state.player[maxField]);
      record(events, "heal", `${state.player.name} 使用 ${item.name}，恢复 ${state.player[field] - before} 点资源。`);
    } else if (action.type === "flee") {
      if (random() < 0.5) {
        state.outcome = "fled";
        record(events, "flee", `${state.player.name} 成功脱离战斗。`);
        return { ok: true, state: cloneState(state), events: events.map((event) => ({ ...event })) };
      }
      record(events, "flee", `${state.player.name} 逃跑失败。`);
    }
    updateOutcome();
    if (state.outcome === "ongoing") runEnemyTurn(events);
    if (state.outcome === "ongoing") finishRound(events);
    return { ok: true, state: cloneState(state), events: events.map((event) => ({ ...event })) };
  }
  return {
    getState: () => cloneState(state),
    dispatch
  };
}

// st-extension/src/apps/renderer/modes/battle.ts
var ACTION_DELAY_MS = 180;
function textElement3(tag, className, text3) {
  const element2 = document.createElement(tag);
  element2.className = className;
  element2.textContent = text3;
  return element2;
}
function imageElement(className, src, alt, onError) {
  const image = document.createElement("img");
  image.className = className;
  image.src = src;
  image.alt = alt;
  image.draggable = false;
  image.addEventListener("error", () => {
    image.hidden = true;
    onError?.();
  });
  return image;
}
function resolvePortrait2(value, deps) {
  if (!value) return null;
  if (!value.startsWith("sprite:")) return value;
  try {
    return deps.resolvePortrait?.(value.slice("sprite:".length)) ?? null;
  } catch {
    return null;
  }
}
function resourceRow(label, value, max, className) {
  const row = document.createElement("div");
  row.className = `st-render-resource ${className}`;
  const heading = textElement3("span", "st-render-resource-label", label);
  const progress = document.createElement("progress");
  progress.max = Math.max(1, max);
  progress.value = value;
  progress.setAttribute("aria-label", `${label} ${value} / ${max}`);
  const amount = textElement3("span", "st-render-resource-value", `${value} / ${max}`);
  row.append(heading, progress, amount);
  return row;
}
function combatantView(fighter, side, deps) {
  const card = document.createElement("section");
  card.className = `st-render-combatant st-render-combatant-${side}`;
  const heading = textElement3("h3", "st-render-combatant-name", fighter.name);
  const portrait = resolvePortrait2(fighter.portrait, deps);
  if (portrait) {
    card.append(imageElement("st-render-combatant-portrait", portrait, fighter.name, () => {
      card.classList.add("st-render-combatant-no-portrait");
    }));
  } else {
    card.classList.add("st-render-combatant-no-portrait");
  }
  card.append(
    heading,
    resourceRow("HP", fighter.hp, fighter.maxHp, "st-render-resource-hp"),
    resourceRow("MP", fighter.mp, fighter.maxMp, "st-render-resource-mp")
  );
  const statuses = document.createElement("div");
  statuses.className = "st-render-combatant-statuses";
  statuses.setAttribute("aria-label", "状态");
  for (const status of fighter.statuses) {
    statuses.append(textElement3("span", "st-render-status-chip", `${status.name} · ${status.duration}`));
  }
  card.append(statuses);
  return card;
}
function actionButton(action, label, disabled) {
  const button2 = document.createElement("button");
  button2.type = "button";
  button2.className = "st-render-battle-action";
  button2.dataset.action = action;
  button2.textContent = label;
  button2.disabled = disabled;
  return button2;
}
function mountBattleMode(root, block, deps) {
  const engine = createBattleEngine(block, { random: deps.random });
  const section2 = document.createElement("section");
  section2.className = "st-render-battle";
  if (block.background) section2.append(imageElement("st-render-battle-background", block.background, ""));
  const content = document.createElement("div");
  content.className = "st-render-battle-content";
  const header = document.createElement("header");
  header.className = "st-render-battle-header";
  const title2 = textElement3("h2", "st-render-battle-title", block.title);
  const turn = textElement3("span", "st-render-battle-turn", "");
  header.append(title2, turn);
  const intent = textElement3("div", "st-render-battle-intent", block.enemyIntent ? `敌方意图：${block.enemyIntent}` : "");
  const combatants = document.createElement("div");
  combatants.className = "st-render-battle-combatants";
  const outcome = textElement3("div", "st-render-battle-outcome", "");
  outcome.setAttribute("role", "status");
  const log = document.createElement("ol");
  log.className = "st-render-battle-log";
  log.setAttribute("aria-label", "战斗日志");
  const actions = document.createElement("div");
  actions.className = "st-render-battle-actions";
  const notice = textElement3("div", "st-render-battle-notice", "");
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  content.append(header, intent, combatants, outcome, log, actions, notice);
  section2.append(content);
  root.replaceChildren(section2);
  let pending = false;
  let destroyed = false;
  let freeOpen = false;
  let timer = null;
  function outcomeText(state) {
    if (state.outcome === "won") return "战斗胜利";
    if (state.outcome === "lost") return "战斗失败";
    if (state.outcome === "fled") return "已脱离战斗";
    return "";
  }
  function continuationText(state) {
    const summary = state.log.slice(-6).map((entry) => entry.text).join(" ");
    return `战斗结果：${outcomeText(state)}。战斗摘要：${summary || "战斗已结束。"}`;
  }
  function createSelect(className, options, disabled) {
    const select = document.createElement("select");
    select.className = className;
    select.disabled = disabled;
    for (const option of options) {
      const element2 = document.createElement("option");
      element2.value = option.id;
      element2.textContent = option.label;
      element2.disabled = option.disabled;
      select.append(element2);
    }
    const firstAvailable = options.find((option) => !option.disabled);
    if (firstAvailable) select.value = firstAvailable.id;
    return select;
  }
  function render2() {
    const state = engine.getState();
    const ended = state.outcome !== "ongoing";
    turn.textContent = `回合 ${state.turn}`;
    combatants.replaceChildren(
      combatantView(state.player, "player", deps),
      combatantView(state.enemy, "enemy", deps)
    );
    outcome.replaceChildren();
    if (ended) {
      outcome.append(
        textElement3("span", "st-render-battle-outcome-text", outcomeText(state)),
        actionButton("continue", "继续剧情", false)
      );
    }
    outcome.hidden = !ended;
    log.replaceChildren();
    if (state.log.length === 0) log.append(textElement3("li", "st-render-battle-log-entry", "等待行动"));
    else {
      for (const entry of state.log.slice(-12)) log.append(textElement3("li", `st-render-battle-log-entry st-render-battle-log-${entry.kind}`, entry.text));
    }
    actions.replaceChildren();
    const locked = ended || pending;
    const attack = actionButton("attack", "⚔ 攻击", locked);
    const defend = actionButton("defend", "◆ 防御", locked);
    const skillOptions = state.player.skills.map((skill2) => ({
      id: skill2.id,
      label: `${skill2.name} · ${skill2.mpCost} MP`,
      disabled: state.player.mp < skill2.mpCost
    }));
    const skillSelect = createSelect("st-render-battle-skill-select", skillOptions, locked || skillOptions.length === 0);
    const skill = actionButton("skill", "✦ 施放技能", locked || !skillOptions.some((option) => !option.disabled));
    const itemOptions = state.player.items.map((item2) => ({
      id: item2.id,
      label: `${item2.name} · ${item2.quantity}`,
      disabled: item2.quantity <= 0
    }));
    const itemSelect = createSelect("st-render-battle-item-select", itemOptions, locked || itemOptions.length === 0);
    const item = actionButton("item", "＋ 使用物品", locked || !itemOptions.some((option) => !option.disabled));
    const flee = actionButton("flee", "↗ 逃跑", locked || !state.allowFlee);
    const free = actionButton("free", "… 自由行动", locked);
    actions.append(attack, defend, skillSelect, skill, itemSelect, item, flee, free);
    if (freeOpen && !locked) {
      const freePanel = document.createElement("div");
      freePanel.className = "st-render-battle-free";
      const input = document.createElement("input");
      input.type = "text";
      input.className = "st-render-battle-free-input";
      input.maxLength = 500;
      input.placeholder = "输入行动";
      const submit = actionButton("free-submit", "填入草稿", false);
      freePanel.append(input, submit);
      actions.append(freePanel);
      input.focus();
    }
  }
  function execute(action) {
    if (destroyed) return;
    timer = null;
    const result = engine.dispatch(action);
    pending = false;
    notice.textContent = result.ok ? "" : result.error ?? "行动失败";
    render2();
  }
  function schedule(action) {
    if (pending || engine.getState().outcome !== "ongoing") return;
    freeOpen = false;
    if (deps.getSettings().reducedMotion) {
      execute(action);
      return;
    }
    pending = true;
    render2();
    timer = setTimeout(() => execute(action), ACTION_DELAY_MS);
  }
  function onClick(event) {
    if (destroyed || !(event.target instanceof Element)) return;
    const button2 = event.target.closest("button[data-action]");
    if (!button2 || !root.contains(button2) || button2.disabled) return;
    const action = button2.dataset.action;
    if (action === "attack" || action === "defend" || action === "flee") {
      schedule({ type: action });
    } else if (action === "skill") {
      const select = root.querySelector(".st-render-battle-skill-select");
      if (select?.value) schedule({ type: "skill", skillId: select.value });
    } else if (action === "item") {
      const select = root.querySelector(".st-render-battle-item-select");
      if (select?.value) schedule({ type: "item", itemId: select.value });
    } else if (action === "free") {
      freeOpen = !freeOpen;
      render2();
    } else if (action === "free-submit") {
      const input = root.querySelector(".st-render-battle-free-input");
      const value = input?.value.trim() ?? "";
      if (!value) {
        notice.textContent = "请输入自由行动。";
        return;
      }
      const result = deps.insertDraft?.(`战斗行动：${value}`) ?? { ok: false, error: "未找到 SillyTavern 输入框。" };
      notice.textContent = result.ok ? "已填入自由行动" : result.error;
    } else if (action === "continue") {
      const state = engine.getState();
      if (state.outcome === "ongoing") return;
      const result = deps.insertDraft?.(continuationText(state)) ?? { ok: false, error: "未找到 SillyTavern 输入框。" };
      notice.textContent = result.ok ? "已填入战斗结果" : result.error;
    }
  }
  root.addEventListener("click", onClick);
  render2();
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      root.removeEventListener("click", onClick);
    }
  };
}

// st-extension/src/apps/renderer/composer.ts
function createComposerBridge(deps = {}) {
  const findInput = deps.findInput ?? (() => findComposerTextarea());
  let owned = null;
  function insertDraft(text3) {
    const input = findInput();
    if (!input) return { ok: false, error: "未找到 SillyTavern 输入框。" };
    if (owned?.input === input) {
      if (input.value === "") owned = null;
      else if (input.value !== owned.value) return { ok: false, error: "输入草稿已修改，未覆盖你的内容。" };
    } else {
      owned = null;
      if (input.value !== "") return { ok: false, error: "输入框已有草稿，未覆盖你的内容。" };
    }
    input.value = text3;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    owned = { input, value: text3 };
    return { ok: true };
  }
  function dispose() {
    owned = null;
  }
  return { insertDraft, dispose };
}

// st-extension/src/apps/api/manager.ts
var MAIN_API_OPTIONS = [
  { value: "openai", label: "聊天补全（Chat Completion）" },
  { value: "textgenerationwebui", label: "文本补全（Text Completion）" },
  { value: "novel", label: "NovelAI" },
  { value: "kobold", label: "KoboldAI" },
  { value: "koboldhorde", label: "KoboldAI Horde" }
];
function createApiManager(deps) {
  let backdrop = null;
  let body = null;
  let draft = null;
  let editingId = null;
  let notice = "";
  const section2 = (title2) => {
    const box = el2("div", "so-section");
    const heading = el2("div", "so-section-title");
    heading.textContent = title2;
    box.append(heading);
    return box;
  };
  const desc = (box, text3) => {
    const line = el2("div", "so-app-desc");
    line.textContent = text3;
    box.append(line);
  };
  const save = (data) => {
    deps.setData(data);
    render2();
  };
  function open() {
    if (backdrop) return render2();
    backdrop = el2("div", "so-manager-backdrop");
    backdrop.style.inset = "0";
    const dialog = el2("div", "so-manager");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", "API 连接档案管理");
    const header = el2("div", "so-manager-header");
    const title2 = el2("div", "so-manager-title");
    title2.textContent = "API 连接档案管理";
    const closeButton = el2("button", "menu_button so-manager-close");
    closeButton.textContent = "关闭";
    closeButton.addEventListener("click", close);
    header.append(title2, closeButton);
    body = el2("div", "so-manager-body");
    dialog.append(header, body);
    backdrop.append(dialog);
    document.body.append(backdrop);
    render2();
  }
  function close() {
    backdrop?.remove();
    backdrop = null;
    body = null;
    draft = null;
    editingId = null;
    deps.onClosed?.();
  }
  function edit(profile) {
    const { id: _id, version: _version, ...value } = profile;
    draft = { ...value, settings: { ...value.settings } };
    editingId = profile.id;
    notice = "";
    render2();
  }
  function render2() {
    if (!body) return;
    body.textContent = "";
    body.append(buildList(), buildEditor(), buildHelp());
  }
  function buildList() {
    const data = deps.getData();
    const box = section2(`连接档案（${data.profiles.length}）`);
    if (!data.profiles.length) desc(box, "还没有档案。可新建，或导入 SillyTavern 当前连接。");
    void readConnection().then((connection) => {
      if (!connection || !body) return;
      const active = findActiveProfile(data.profiles, connection);
      body.querySelector(`[data-profile-id="${active?.id ?? ""}"]`)?.classList.add("stapi-row-on");
    });
    for (const profile of data.profiles) {
      const row = el2("div", "vm-leaf");
      row.dataset.profileId = profile.id;
      const main = el2("div", "vm-leaf-main");
      main.tabIndex = 0;
      main.setAttribute("role", "button");
      const name = el2("span", "vm-key");
      name.textContent = profile.name;
      const meta = el2("span", "vm-val");
      meta.textContent = profileSummary(profile).join(" · ");
      main.append(name, meta);
      main.addEventListener("click", () => edit(profile));
      const move = (label, delta) => {
        const button2 = el2("button", "vm-del stapi-move");
        button2.textContent = label;
        button2.addEventListener("click", () => save({ profiles: moveProfile(deps.getData().profiles, profile.id, delta) }));
        return button2;
      };
      const remove = el2("button", "vm-del");
      remove.textContent = "删除";
      remove.addEventListener("click", () => {
        if (window.confirm(`删除连接档案「${profile.name}」？`)) save({ profiles: deps.getData().profiles.filter((item) => item.id !== profile.id) });
      });
      row.append(main, move("↑", -1), move("↓", 1), remove);
      box.append(row);
    }
    box.append(appButton("＋ 添加连接档案", () => {
      draft = emptyDraft();
      editingId = null;
      notice = "";
      render2();
    }));
    return box;
  }
  function buildEditor() {
    const box = section2(draft ? editingId ? `编辑：${draft.name || "未命名"}` : "新增连接档案" : "档案编辑");
    if (!draft) {
      desc(box, "选择上方档案进行编辑，或添加一个新档案。");
      return box;
    }
    const d = draft;
    if (notice) {
      desc(box, notice);
      notice = "";
    }
    box.append(textRow("档案名称", d.name, "例如：主力 Claude", (value) => {
      d.name = value;
    }));
    box.append(selectRow("API 大类", d.mainApi, MAIN_API_OPTIONS, (value) => {
      d.mainApi = value;
      d.source = getSource(value, "").id;
      d.url = "";
      d.model = "";
      d.secretId = "";
      render2();
    }));
    if (d.mainApi === "openai") {
      const sources = [...COMMON_CHAT_SOURCES];
      const currentSource = getSource(d.mainApi, d.source);
      if (!sources.some((item) => item.id === currentSource.id)) sources.push(currentSource);
      box.append(selectRow("来源", d.source, sources.map((item) => ({ value: item.id, label: item.label })), (value) => {
        d.source = value;
        d.url = "";
        d.model = "";
        d.secretId = "";
        render2();
      }));
    }
    const descriptor = getSource(d.mainApi, d.source);
    if (descriptor.urlField) box.append(textRow("接口地址 URL", d.url, "https://example.com/v1", (value) => {
      d.url = value;
    }));
    if (descriptor.secretKey) box.append(textRow("API Key", d.key, d.secretMode === "unavailable" ? "当前 ST 不允许读取；留空可保留原值" : "明文保存在本扩展档案，并同步写入 ST 密钥库", (value) => {
      d.key = value.trim();
      d.secretMode = value ? "stored" : d.secretMode;
    }, "password"));
    if (descriptor.modelField || descriptor.supportsModels) box.append(textRow("模型 ID（可空）", d.model, "留空则沿用当前模型", (value) => {
      d.model = value;
    }));
    if (descriptor.supportsModels) box.append(appButton("从接口获取模型", () => void loadModels(d)));
    const extra = foldSection("附加参数（自定义接口）", Object.values(d.settings).some(Boolean));
    extra.body.append(
      textareaRow("包括主体参数", String(d.settings.custom_include_body ?? ""), "YAML 对象", (value) => {
        d.settings.custom_include_body = value;
      }),
      textareaRow("排除主体参数", String(d.settings.custom_exclude_body ?? ""), "每行一个参数名", (value) => {
        d.settings.custom_exclude_body = value;
      }),
      textareaRow("包含请求标头", String(d.settings.custom_include_headers ?? ""), "YAML 对象", (value) => {
        d.settings.custom_include_headers = value;
      })
    );
    if (d.source === "custom") box.append(extra.box);
    const actions = el2("div", "vm-actions");
    const saveButton = el2("button", "menu_button vm-act");
    saveButton.textContent = editingId ? "保存修改" : "保存档案";
    saveButton.addEventListener("click", () => {
      const duplicate = findUrlDuplicate(deps.getData().profiles, d.url, editingId);
      if (duplicate && !window.confirm(`「${duplicate.name}」使用相同 URL，仍要保存吗？`)) return;
      const result = upsertProfile(deps.getData().profiles, d, editingId);
      if ("error" in result) {
        notice = result.error;
        return render2();
      }
      draft = null;
      editingId = null;
      save({ profiles: result.profiles });
    });
    const importButton = el2("button", "menu_button vm-act vm-act-ghost");
    importButton.textContent = "导入当前连接";
    importButton.addEventListener("click", () => void importCurrent());
    const cancel = el2("button", "menu_button vm-act vm-act-ghost");
    cancel.textContent = "取消";
    cancel.addEventListener("click", () => {
      draft = null;
      editingId = null;
      render2();
    });
    actions.append(saveButton, importButton, cancel);
    box.append(actions);
    return box;
  }
  async function importCurrent() {
    const current2 = await readConnection();
    if (!current2 || !draft) {
      notice = "未检测到 SillyTavern 运行时。";
      return render2();
    }
    draft.mainApi = current2.mainApi;
    draft.source = current2.source;
    draft.url = current2.url;
    draft.model = current2.model;
    draft.settings = { ...current2.settings };
    draft.secretId = current2.secretId;
    if (current2.key) draft.key = current2.key;
    draft.secretMode = current2.secretMode;
    notice = current2.secretMode === "read" ? "已完整导入当前连接和密钥。" : "已导入连接设置；当前版本无法回读密钥，已保留表单中的 Key。";
    render2();
  }
  async function loadModels(value) {
    if (!normalizeUrl(value.url)) {
      notice = "请先填写接口地址。";
      return render2();
    }
    try {
      const models = await fetchModels({ ...value });
      const selected = window.prompt(`可用模型：
${models.join("\n")}

请输入要使用的模型 ID：`, value.model || models[0]);
      if (selected && draft) draft.model = selected;
    } catch (error) {
      notice = `获取模型失败：${error instanceof Error ? error.message : String(error)}`;
    }
    render2();
  }
  function buildHelp() {
    const box = section2("兼容说明");
    desc(box, "Key 在本扩展档案中明文保存；连接时优先写入 SillyTavern 新版多密钥 secret-id，旧版会回退到对应单密钥槽位。");
    desc(box, "新档案只列常用渠道；其他兼容 OpenAI 的厂商使用“自定义”入口。历史档案中的旧渠道仍可查看和编辑。");
    return box;
  }
  return { open, close, isOpen: () => backdrop !== null };
}

// st-extension/src/lifecycle.ts
function beginExtensionLifecycle(target, doc) {
  target.__stStageDispose?.();
  const lifecycle = createCapabilityTracker();
  const dispose = () => lifecycle.dispose();
  target.__stStageDispose = dispose;
  lifecycle.track(() => {
    if (target.__stStageDispose === dispose) delete target.__stStageDispose;
  });
  const stylesheet = doc?.querySelector("link[data-st-stage-style]");
  if (stylesheet) lifecycle.track(() => stylesheet.remove());
  return lifecycle;
}
function runWhenDomReady(doc, lifecycle, start) {
  let started = false;
  let untrack = () => {
  };
  const run = () => {
    if (started || lifecycle.disposed) return;
    started = true;
    untrack();
    void Promise.resolve(start()).catch((err) => {
      console.error("[sprite-overlay] 初始化失败", err);
    });
  };
  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", run);
    untrack = lifecycle.track(() => doc.removeEventListener("DOMContentLoaded", run));
  } else {
    run();
  }
}

// st-extension/src/index.ts
async function init(lifecycle) {
  const adapter = new STAdapter();
  let settings;
  try {
    settings = await adapter.loadSettings();
  } catch (err) {
    console.error("[sprite-overlay] 初始化失败", err);
    return;
  }
  if (lifecycle.disposed) return;
  function updateSettings(next) {
    const displayChanged = next.hideTagInMessage !== settings.hideTagInMessage || next.renderInlineImages !== settings.renderInlineImages || next.spriteDisplayMode !== settings.spriteDisplayMode || next.imageHost !== settings.imageHost || next.enabled !== settings.enabled || next.recentFloors !== settings.recentFloors || next.spriteOpacity !== settings.spriteOpacity;
    const autoChanged = next.autoSwitch !== settings.autoSwitch || next.autoSwitchSeconds !== settings.autoSwitchSeconds;
    settings = next;
    adapter.saveSettings(settings);
    overlay.setLayout(settings.overlay);
    overlay.setOpacity(settings.spriteOpacity);
    phone.setVisible(settings.showPhone);
    if (autoChanged) overlay.setAutoSwitch(settings.autoSwitch, settings.autoSwitchSeconds);
    refresh();
    if (displayChanged) reprocessAllMessages(settings);
  }
  function saveSettingsOnly(next) {
    const previousNewvar = normalizeNewvarData(settings.apps[NEWVAR_APP_ID]);
    const nextNewvar = normalizeNewvarData(next.apps[NEWVAR_APP_ID]);
    const previousHidesUpdates = previousNewvar.enabled && previousNewvar.hideUpdateBlocks;
    const nextHidesUpdates = nextNewvar.enabled && nextNewvar.hideUpdateBlocks;
    settings = next;
    adapter.saveSettings(settings);
    if (previousHidesUpdates !== nextHidesUpdates) {
      reprocessAllMessages(settings);
    }
  }
  const appMessageHub = createEventHub();
  const appCharacterHub = createEventHub();
  const hostTracker = createCapabilityTracker();
  lifecycle.track(() => hostTracker.dispose());
  lifecycle.track(() => adapter.injectPrompt(""));
  const usedAppChannels = /* @__PURE__ */ new Set();
  const platformCaps = {
    onMessageReceived: (handler) => appMessageHub.subscribe(handler),
    onCharacterChanged: (handler) => appCharacterHub.subscribe(() => handler()),
    injectPrompt: (appId, text3, depth) => {
      const channel = `app:${appId}`;
      if (!usedAppChannels.has(channel)) {
        usedAppChannels.add(channel);
        hostTracker.track(() => adapter.injectChannel(channel, ""));
      }
      adapter.injectChannel(channel, text3, depth);
    },
    toast: (kind, message) => {
      const t = window.toastr;
      if (t?.[kind]) t[kind](message);
      else console.info(`[sprite-overlay][${kind}] ${message}`);
    }
  };
  function createHostDeps(appId) {
    return {
      appId,
      getSettings: () => settings,
      saveSettingsOnly,
      getCharacterName: () => adapter.getCurrentCharacterName(),
      ...platformCaps
    };
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
  lifecycle.track(() => manager.destroy());
  let openSpritesApp = () => {
  };
  const overlay = createOverlay(
    settings.overlay,
    (layout) => {
      settings = { ...settings, overlay: layout };
      adapter.saveSettings(settings);
    },
    () => manager.open(),
    // 悬浮窗 ✕：只隐藏窗体并记住状态，立绘功能（含楼层立绘）不受影响
    () => updateSettings({ ...settings, overlayHidden: true }),
    () => openSpritesApp()
  );
  lifecycle.track(() => overlay.destroy());
  overlay.setAutoSwitch(settings.autoSwitch, settings.autoSwitchSeconds);
  overlay.setOpacity(settings.spriteOpacity);
  const registry = new PhoneAppRegistry();
  function createAppContext(appId, goHome) {
    return createPhoneAppContext({
      ...createHostDeps(appId),
      updateSettings,
      goHome,
      openModal: (id, build) => {
        openTrackedAppModal(build, {
          onOpen: collapsePhone,
          onClose: () => phone.openApp(id)
        }, (cleanup) => hostTracker.track(cleanup));
      }
    });
  }
  const phone = createPhoneShell(settings.phone, {
    registry,
    createAppContext,
    onStateChange: (state) => {
      saveSettingsOnly({ ...settings, phone: state });
    }
  });
  lifecycle.track(() => phone.destroy());
  openSpritesApp = () => phone.openApp("sprites");
  function collapsePhone() {
    settings = { ...settings, phone: { ...settings.phone, open: false } };
    adapter.saveSettings(settings);
    phone.setState(settings.phone);
  }
  const newvarRuntime = createNewvarRuntime({
    getSettings: () => settings,
    inject: (prompt, depth) => adapter.injectChannel(NEWVAR_CHANNEL, prompt, depth)
  });
  lifecycle.track(() => newvarRuntime.dispose());
  lifecycle.track(() => adapter.injectChannel(NEWVAR_CHANNEL, ""));
  const getRendererSettings = () => normalizeRendererSettings(settings.apps[RENDERER_APP_ID]);
  const composerBridge = createComposerBridge();
  lifecycle.track(() => composerBridge.dispose());
  const rendererRuntime = createRendererRuntime({
    getSettings: getRendererSettings,
    factories: { gal: mountGalMode, cards: mountCardsMode, battle: mountBattleMode },
    modeDeps: {
      getSettings: getRendererSettings,
      resolvePortrait: (address) => {
        const packs = getActivePacks(settings, adapter.getCurrentCharacterName());
        return resolveSprite(packs, address)?.url ?? null;
      },
      resolveSpeakerPortrait: (speaker) => {
        const normalizedSpeaker = speaker.trim();
        if (!normalizedSpeaker) return null;
        const packs = getActivePacks(settings, adapter.getCurrentCharacterName());
        const pack = packs.find((candidate) => candidate.roleName?.trim() === normalizedSpeaker);
        return pack ? getPackCover(pack)?.url ?? null : null;
      },
      insertDraft: composerBridge.insertDraft
    }
  });
  lifecycle.track(() => rendererRuntime.dispose());
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
  lifecycle.track(() => newvarDesigner.close());
  const apiManager = createApiManager({
    getData: () => sanitizeAppData(settings.apps[API_APP_ID]),
    setData: (next) => {
      saveSettingsOnly({ ...settings, apps: { ...settings.apps, [API_APP_ID]: next } });
    },
    onClosed: () => phone.openApp("api")
  });
  lifecycle.track(() => apiManager.close());
  for (const app of createBuiltinApps({
    previewSpriteOpacity: (percent) => overlay.setOpacity(percent),
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
    },
    rendererRuntime
  })) {
    registry.register(app);
    runAppSetup(app, createHostDeps(app.id), hostTracker);
  }
  const registerQueue = installRegisterQueue(window.stStageQueue, (app) => {
    registry.register(app);
    runAppSetup(app, createHostDeps(app.id), hostTracker);
  });
  window.stStageQueue = registerQueue;
  window.stStage = {
    registerApp: (app) => registerQueue.push(app)
  };
  lifecycle.track(() => {
    delete window.stStage;
    delete window.stStageQueue;
  });
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
    const prompt = buildActiveSpritePrompt(settings, characterName);
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
  function displaySprites(addresses) {
    if (!settings.enabled || addresses.length === 0) return;
    const characterName = adapter.getCurrentCharacterName();
    const packs = getActivePacks(settings, characterName);
    if (packs.length === 0) return;
    const seq = resolveSprites(packs, addresses);
    preloadMatchedSprites(seq);
    if (seq.length > 0 && overlayAllowed()) {
      overlay.setSprites(seq);
      overlay.setVisible(true);
    }
  }
  let streamedText = "";
  let streamedTagCount = 0;
  function resetStreamState() {
    streamedText = "";
    streamedTagCount = 0;
  }
  const unsubscribeStream = adapter.onStreamText((text3) => {
    if (!text3.startsWith(streamedText)) streamedTagCount = 0;
    streamedText = text3;
    const addresses = extractTags(text3);
    const added = addresses.slice(streamedTagCount);
    streamedTagCount = addresses.length;
    displaySprites(added);
  });
  lifecycle.track(unsubscribeStream);
  lifecycle.track(adapter.onGenerationEnded(resetStreamState));
  const unsubscribeMessage = adapter.onMessageReceived((text3) => {
    appMessageHub.emit(text3);
    displaySprites(extractTags(text3));
    resetStreamState();
  });
  lifecycle.track(unsubscribeMessage);
  const storyCapture = createStoryImageCapture({
    getSettings: () => settings,
    updateSettings,
    getStoryContext: () => adapter.getStoryContext(),
    localize: (sprite, fileName, story) => localizeSprite(sprite, fileName, {
      fetch: window.fetch.bind(window),
      compress: compressImage,
      saveImage: (file, name) => adapter.saveImageFile(file, name, story.characterName)
    })
  });
  lifecycle.track(mountMessagePostprocess({
    getSettings: () => settings,
    getRawMessage: (messageId) => adapter.getRawMessage(messageId),
    decorateImages: storyCapture.decorate,
    cleanupImages: storyCapture.cleanup,
    processMessage: rendererRuntime.processMessage,
    reprocessMessages: rendererRuntime.reprocessAll,
    cleanupMessages: rendererRuntime.dispose
  }));
  let cancelPendingNavigation = () => {
  };
  const handleChatNavigation = () => {
    appCharacterHub.emit(null);
    refresh();
    manager.refreshIfOpen();
    resetStreamState();
    cancelPendingNavigation();
    const timer = setTimeout(() => {
      cancelPendingNavigation();
      refresh();
      reprocessAllMessages(settings);
    }, 200);
    cancelPendingNavigation = lifecycle.track(() => clearTimeout(timer));
  };
  const unsubscribeCharacter = adapter.onCharacterChanged(handleChatNavigation);
  const unsubscribeChatCreated = adapter.onChatCreated(handleChatNavigation);
  lifecycle.track(() => {
    cancelPendingNavigation();
    unsubscribeCharacter();
    unsubscribeChatCreated();
  });
  lifecycle.track(mountSettingsPanel({
    getSettings: () => settings,
    updateSettings
  }));
  refresh();
  newvarRuntime.start();
  phone.setState(settings.phone);
  phone.setVisible(settings.showPhone);
  const version = false ? "dev" : `v${"0.9.0"} · ${"2026-08-18 23:07"}`;
  console.log(`[sprite-overlay] 掌柜的（st-stage）已加载（含手机框架）${version}`);
}
var extensionLifecycle = beginExtensionLifecycle(window, document);
runWhenDomReady(document, extensionLifecycle, () => init(extensionLifecycle));
