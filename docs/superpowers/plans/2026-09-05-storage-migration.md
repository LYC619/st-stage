# 存量图片迁移与导入落盘 Implementation Plan（批次 C）

> **For agentic workers:** REQUIRED SUB-SKILL: `executing-plans`，单代理串行；不得启动子代理。本文仅规划，所有执行步骤保持未完成。

**Goal:** 完成 S1：让旧 settings 中可识别的内嵌立绘可备份、可取消、可迁移、可恢复，并禁止 ST 的 JSON/分享串安装入口重新写入内嵌图片。

**Architecture:** 纯函数负责发现引用、比较最新引用并生成设置补丁；ST 服务只串行暂存已校验的新图片，不自行保存 settings。独立迁移对话框负责备份/确认/应用；导入先准备完整图包，再进入现有冲突处理和安装逻辑。

**Tech Stack:** TypeScript、现有 PluginSettings/STAdapter、Blob 下载、原生 DOM、Vitest/jsdom；复用 A 的严格图片持久化，无新增运行时依赖。

---

## 前置条件与不会做的事

- 必须先完成 A1–A3，尤其是错误不降级 base64、唯一新文件名和 R4 元数据往返。B 可独立实现，但默认按主计划 A → B → C 串行。
- 启动和 `loadSettings()` **不触发上传、替换或清理**。不改 SETTINGS_VERSION，不把迁移完成标记写成“以后永远不用检查”。
- 自动迁移对象是**当前有效的自定义包 `sprites[].url`**。旧“（本地）”预设副本只要仍作为自定义包存在，也在范围内。不因名称像预设而重绑定或合并。
- 当前 `presetOverrides.localSprites` 只接受 ST 本地路径；不放宽 sanitizer 来重新接纳 data URI。有效的同 ID 预设覆盖无需迁移。
- 对仍存在于宿主当前原始值、但未出现在有效设置中的旧 preset 内嵌值，备份附录保留位置和原值，**阻止本次自动迁移，提示先恢复为自定义图包**。不能假装它们已经迁移或在应用时顺手丢弃。若早先保存已丢掉原值，本功能无法追回；需要用户升级前的 settings 备份。这里不新增启动时大对象副本。
- App 私有数据只原样进入备份，最多统计其内嵌字符串数量和字节估计，不递归改 URL。其他扩展设置、角色卡、聊天文件和 ST 的磁盘图片不属于本插件备份。
- 暂存期间取消或失败可留下新建孤儿文件；**不删除旧图，也不自动删除新文件**。迁移保留原始图像字节，包括 GIF，不经 canvas/压缩器重编码。
- 推荐一次只运行一个迁移或图包导入操作；这是 UI 操作锁，不是跨标签页服务器事务。其他设置变更通过应用前最新值比较保护；跨页面同时操作仍需提示用户避免。

## 文件图

| 操作 | 完整路径 | 职责 |
| --- | --- | --- |
| 新增 | `D:/8.Project/0_0_维护/st-stage/core/image-storage.ts` | 明确 schema 的扫描、引用身份、compare-before-apply |
| 新增 | `D:/8.Project/0_0_维护/st-stage/core/image-storage.test.ts` | 去重身份、重排/并发编辑、纯函数不改输入 |
| 新增 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/image-storage.ts` | 串行暂存、取消、同任务 URI 去重、导入前整包准备 |
| 新增 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/image-storage.test.ts` | 上传失败/取消/原始字节/导入无半包 |
| 新增 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/image-storage-backup.ts` | 插件备份、迁移回执、配对验证、保守图片回退 |
| 新增 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/image-storage-backup.test.ts` | 备份往返、错配/损坏拒绝、恢复不覆盖后续编辑 |
| 新增 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/image-storage-dialog.ts` | 存储统计、备份门禁、进度/取消、成功项确认、恢复入口 |
| 新增 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/image-storage-dialog.test.ts` | 生产 DOM 事件与状态机；不得绕过确认 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/st-adapter.ts` | 复用持久化投影；显式读取当前插件原始值供备份诊断 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/st-adapter.test.ts` | 读取诊断无写入/上传；投影与保存一致 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/sprite-manager.ts` | 图库入口、共享导入准备、关闭/销毁取消 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/sprite-manager.test.ts` | 真实 JSON/分享串安装路径与迁移入口 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/style.css` | 仅新增迁移对话框进度/滚动/错误清单样式 |

读取既有约束：`D:/8.Project/0_0_维护/st-stage/core/presets.ts`、`D:/8.Project/0_0_维护/st-stage/core/preset-overrides.ts`、`D:/8.Project/0_0_维护/st-stage/core/sprite-store.ts`、`D:/8.Project/0_0_维护/st-stage/core/pack-io.ts`、`D:/8.Project/0_0_维护/st-stage/st-extension/src/index.ts`。不改 WebAdapter；便携 JSON 导出仍可内嵌，不拿 `exportPack()` 当迁移备份，因为它可能重新编码图片。

## Task C1：纯扫描与有条件应用

- [ ] **C1.1 建立以下导出契约与红测试**。使用 JSON 元组作引用键，不使用数组 index 或 `|` 拼接。相同 packId、group、outfit、tag 出现歧义时列为冲突，不猜第一项。

```ts
export interface ImageRef {
  packId: string
  group: string
  outfit: string
  tag: string
}
export interface EmbeddedImageCandidate {
  ref: ImageRef
  sourceUrl: string
}
export interface ImageChange {
  ref: ImageRef
  expectedUrl: string
  nextUrl: string
}
export interface StorageScan {
  candidates: EmbeddedImageCandidate[]
  ambiguous: ImageRef[]
  embeddedReferenceCount: number
  uniqueEmbeddedCount: number
  embeddedTextBytes: number
}
export interface ImageApplyResult {
  settings: PluginSettings
  applied: ImageChange[]
  conflicts: ImageChange[]
}
export const imageRefKey = (ref: ImageRef): string =>
  JSON.stringify([ref.packId, ref.group, ref.outfit, ref.tag])
export const spriteImageRef = (pack: SpritePack, sprite: Sprite): ImageRef => ({
  packId: pack.id, group: sprite.group ?? '', outfit: sprite.outfit ?? '', tag: sprite.tag,
})
// 同文件实现：scanEmbeddedImages(settings): StorageScan
// 同文件实现：applyImageChanges(latest, changes): ImageApplyResult
```

测试 fixture 直接使用 `createDefaultSettings()`；不启动 ST：

```ts
const data = 'data:image/png;base64,QUFB'
const settings = { ...createDefaultSettings(), packs: [{
  id: 'custom', name: '原名', inventoryPrompt: '不要丢失',
  sprites: [{ tag: '微笑', url: data }, { tag: '微笑', outfit: '礼服', url: data }],
}] }
const scan = scanEmbeddedImages(settings)
expect(scan.candidates).toHaveLength(2)
expect(scan.uniqueEmbeddedCount).toBe(1)
const changes = scan.candidates.map((candidate, index) => ({
  ref: candidate.ref, expectedUrl: candidate.sourceUrl,
  nextUrl: `/user/images/sprite_overlay/test_${index}.png`,
}))
const latest = { ...settings, packs: [{ ...settings.packs[0],
  name: '用户刚改名', sprites: [...settings.packs[0].sprites].reverse(),
}], apps: { private: { text: data } } }
const result = applyImageChanges(latest, changes)
expect(result.applied).toHaveLength(2)
expect(result.settings.packs[0].name).toBe('用户刚改名')
expect(result.settings.packs[0].inventoryPrompt).toBe('不要丢失')
expect(result.settings.apps).toBe(latest.apps)
expect(settings.packs[0].sprites[0].url).toBe(data)
```

- [ ] **C1.2 跑红测试**。

```powershell
node node_modules/vitest/vitest.mjs run core/image-storage.test.ts --maxWorkers=1 --no-file-parallelism --reporter=dot
```

期望缺少新实现而失败；保存输出。后续补充删包、改图、改 tag/outfit/group、重复 packId、重复 sprite 身份、重复 change、重复应用等用例。

- [ ] **C1.3 实现纯函数**。扫描只收集非预设包内 `url` 以 `data:` 开始的条目，不在扫描阶段同时解码所有图片。`embeddedTextBytes` 对唯一 URI 使用 `TextEncoder` 计字节，另列引用数；不要把 URI 文本字节说成已写磁盘的图片字节。应用使用最新 pack/sprite 和唯一身份，并要求 `current.url === expectedUrl`；不覆盖整份旧 settings。

```ts
// applyImageChanges 内：先建立最新身份索引、拒绝重复 change，再计算 accepted。
const accepted = new Map<string, ImageChange>()
const conflicts: ImageChange[] = []
const changeCounts = new Map<string, number>()
for (const change of changes) {
  const key = imageRefKey(change.ref)
  changeCounts.set(key, (changeCounts.get(key) ?? 0) + 1)
}
for (const change of changes) {
  const key = imageRefKey(change.ref)
  const targets = latest.packs.filter(p => !isPresetPack(p.id) && p.id === change.ref.packId)
    .flatMap(p => p.sprites.filter(s => imageRefKey(spriteImageRef(p, s)) === key))
  if (changeCounts.get(key) !== 1 || targets.length !== 1 ||
      targets[0].url !== change.expectedUrl || !change.nextUrl) {
    conflicts.push(change)
  } else accepted.set(key, change)
}
const packs = latest.packs.map(pack => {
  let changed = false
  const sprites = pack.sprites.map(sprite => {
    const change = accepted.get(imageRefKey(spriteImageRef(pack, sprite)))
    if (!change || isPresetPack(pack.id)) return sprite
    changed = true
    return { ...sprite, url: change.nextUrl }
  })
  return changed ? { ...pack, sprites } : pack
})
return {
  settings: accepted.size ? { ...latest, packs } : latest,
  applied: [...accepted.values()], conflicts,
}
```

此纯函数负责比较，不决定“允许内嵌保存”：正向调用只能来自 C2 已校验的本地路径；反向调用只能来自 C3 配对验证的备份。保持全部非 URL 字段不变，包括 code/remoteUrl、bindings、App 数据、inventoryPrompt；不清除共享文件引用。

- [ ] **C1.4 跑绿测试**，并通过 frozen 输入验证无原地修改；所有冲突均不改变目标。

## Task C2：串行暂存与整包准备

- [ ] **C2.1 明确服务契约，先写失败测试**。服务不接收 `updateSettings`，从类型上避免上传第一张就写 settings。

```ts
export interface ImageStorageDeps {
  save(dataUri: string, options: ImageSaveOptions): Promise<string>
}
export interface ImageStageResult {
  ready: ImageChange[]
  failed: Array<{ candidate: EmbeddedImageCandidate; message: string }>
  unprocessed: EmbeddedImageCandidate[]
  cancelled: boolean
}
export interface ImageStageOptions extends ImageSaveOptions {
  onProgress?: (completed: number, total: number) => void
}
// stageEmbeddedImages(candidates, deps, options = {}): Promise<ImageStageResult>
// prepareImportedPack(pack, deps, options = {}): Promise<SpritePack>
```

`ImageSaveOptions` 从 A 的 `image-persistence.ts` 导入。测试同一 URI 两个引用只上传一次；不同 URI 顺序上传；第 2 张拒绝，第 3 张仍可继续；Abort 后不启动下一次上传。主动取消应丢弃本次暂存，不自动应用取消前成功项。

```ts
const pack = { id: 'incoming', name: '导入', inventoryPrompt: '保留此字段', sprites: [
  { tag: '一', url: 'data:image/png;base64,QUFB' },
  { tag: '二', url: 'data:image/png;base64,QkJC' },
] }
const save = vi.fn().mockResolvedValueOnce('/user/images/sprite_overlay/one.png')
  .mockRejectedValueOnce(new Error('HTTP 413'))
await expect(prepareImportedPack(pack, { save })).rejects.toThrow(/未安装|失败/)
expect(pack.sprites[0].url).toBe('data:image/png;base64,QUFB')
expect(save).toHaveBeenCalledTimes(2)
```

- [ ] **C2.2 跑红测试**。

```powershell
node node_modules/vitest/vitest.mjs run st-extension/src/image-storage.test.ts --maxWorkers=1 --no-file-parallelism --reporter=dot
```

- [ ] **C2.3 用普通 `for...of` 串行实现暂存**。保存结果仍用 `localUserImagePath` 校验，防假 adapter 返回 data URI；`Map<string, Promise<string>>` 仅存在于本次任务，把同 URI 的成功和失败都去重，不无限重试。前/后 await 都检查取消；下一轮重试开新 Map。

```ts
const savedByUri = new Map<string, Promise<string>>()
const result: ImageStageResult = { ready: [], failed: [], unprocessed: [], cancelled: false }
for (let index = 0; index < candidates.length; index += 1) {
  const candidate = candidates[index]
  if (options.signal?.aborted) {
    result.cancelled = true
    result.unprocessed = candidates.slice(index)
    break
  }
  try {
    let saved = savedByUri.get(candidate.sourceUrl)
    if (!saved) {
      saved = deps.save(candidate.sourceUrl, { signal: options.signal }).then(url => {
        const local = localUserImagePath(url)
        if (!local) throw new Error('保存失败：平台未返回本地图片路径')
        return local
      })
      savedByUri.set(candidate.sourceUrl, saved)
    }
    const nextUrl = await saved
    if (options.signal?.aborted) {
      result.cancelled = true
      result.unprocessed = candidates.slice(index)
      break
    }
    result.ready.push({ ref: candidate.ref, expectedUrl: candidate.sourceUrl, nextUrl })
  } catch (error) {
    if (options.signal?.aborted) {
      result.cancelled = true
      result.unprocessed = candidates.slice(index)
      break
    }
    result.failed.push({ candidate, message: error instanceof Error ? error.message : '保存失败' })
  }
  options.onProgress?.(index + 1, candidates.length)
}
return result
```

不调用 `compressImage`、不把原 URI 写进日志。引用字符串只在内存共享；每次调用 A 的保存服务只解码当前唯一图片，避免 `Promise.all` 同时展开 30 MB 以上图包。单图限额和超时沿用 A 的显式常量；超限项保留原值并报告。

- [ ] **C2.4 实现完整导入准备**。对 `pack.sprites[].url` 为 data URI 的条目调用相同暂存；失败、歧义或取消一律抛错，不能返回半个 pack。全成功后构造新 pack，仅替换对应 url，保持 id/metadata/remoteUrl；网络 URL 和已有本地 URL 不额外下载。返回前再次确认输出没有 data URI。

```ts
const stagingSettings = { ...createDefaultSettings(), packs: [pack] }
const scan = scanEmbeddedImages(stagingSettings)
if (scan.ambiguous.length) throw new Error('图包含重复图片身份，未安装')
const staged = await stageEmbeddedImages(scan.candidates, deps, options)
if (staged.cancelled || staged.failed.length || staged.unprocessed.length) {
  throw new Error(`内嵌图片准备未完成，图包未安装（失败 ${staged.failed.length}）`)
}
const applied = applyImageChanges(stagingSettings, staged.ready)
const prepared = applied.settings.packs[0]
if (applied.conflicts.length || prepared.sprites.some(s => /^data:/i.test(s.url))) {
  throw new Error('图包仍有未落盘图片，未安装')
}
return prepared
```

ST 分享串解码后同样经过此边界。内置代码预设不是导入 pack；若外部调用给出保留 preset id，明确拒绝，不能绕过 scanner 后安装。

- [ ] **C2.5 跑绿测试**：增加 PNG/JPEG/WebP/GIF、非法 data URI、20 MiB 上下边界、保存返回远程/data/空路径、外部取消和重试。对真实图片 bytes 的一致性由 A 的 GET 校验保证，本层断言原 URI原样传给 save，禁止用伪“压缩成功”替代。

## Task C3：备份、回执和可验证恢复

- [ ] **C3.1 先写可恢复性测试并固定文件格式**。选择**完整当前插件状态备份 + 小型迁移回执**：备份在上传前下载；回执包含计划替换的坐标和新路径，不重复 base64。应用前必须下载并确认回执保存。这样刷新后仍能恢复，且不会为“备份”再把旧图片塞回 settings。

```ts
export interface StorageBackupV1 {
  format: 'st-stage-storage-backup@1'
  backupId: string
  createdAt: string
  settings: PluginSettings // 持久化投影，不包含动态计算的代码内预设列表
  unmappedEmbedded: Array<{ location: string; value: string }>
}
export interface MigrationReceiptV1 {
  format: 'st-stage-image-migration-receipt@1'
  backupId: string
  entries: Array<{ ref: ImageRef; localUrl: string }>
}
// createStorageBackup(settings, rawSettings, backupId, createdAt): StorageBackupV1
// parseStorageBackup(text): StorageBackupV1
// createMigrationReceipt(backup, ready): MigrationReceiptV1
// parseMigrationReceipt(text, backup): MigrationReceiptV1
// restoreMigratedImages(latest, backup, receipt): ImageApplyResult
```

备份 ID 为本次生成的 128-bit 安全随机十六进制；创建/读取固定使用相同 ID，不依赖包名、文件名或客户端时间来匹配。日期只用于文件名和展示。新解析器严格验证 format、ID、字段类型和重复身份；只支持本格式的已知 schema，拒绝未来版本和含糊输入，不把任意 JSON 强转为 PluginSettings。使用既有 `migrateSettings` 作字段校验时须检查是否发生信息丢弃，不能静默“修复”受损备份后说完整恢复。

测试用上文两图 settings 生成备份、JSON round-trip、暂存/应用后配对回执恢复，要求原 base64 字符串和 metadata 完整保留。另改其中一图为其他路径，恢复时只回退未变那张，冲突项仍是用户新值；Apps 和新改包名也保持最新。

- [ ] **C3.2 提取 ST 持久化投影并测试**。在 adapter 同文件导出 `persistableSTSettings(settings)`，供 saveSettings 和备份共同使用；新增实例方法 `getStoredSettingsForBackup(): unknown` 只读返回当前 `extensionSettings[MODULE_NAME]`。只有显式打开迁移/备份时读取，不在启动阶段 stringify/复制大对象。

```ts
export function persistableSTSettings(settings: PluginSettings): PluginSettings {
  return { ...settings, packs: settings.packs.filter(pack => !isPresetPack(pack.id)) }
}
// STAdapter.saveSettings 内使用：
ctx.extensionSettings[MODULE_NAME] = persistableSTSettings(settings)
// STAdapter 新方法体：
return getContext().extensionSettings[MODULE_NAME]
```

`createStorageBackup` 同步序列化当前有效投影；对 raw 中已知 `packs[].sprites[].url` 与 `presetOverrides.*.localSprites.*` 的未映射内嵌值另存附录。有效图片不重复保存一份 raw 全量副本。备份标签明确为“当前插件状态”，不是升级前原始 settings.json 的逐字节档案。遇到附录非空，C4 禁止正向自动迁移，保留备份并说明需恢复为自定义包；已从 raw 消失的字节不作恢复承诺。

- [ ] **C3.3 实现回执校验和保守恢复**。回执每个引用必须在备份的可迁移候选中唯一存在；`localUrl` 必须是安全 ST 用户图片路径；不同 backupId、重复条目、无来源引用全部拒绝。回执不含 API Key/base64；完整备份可能包含私人提示词、API Key，下载前明确“仅保存在自己设备，不要公开上传”。

```ts
const sourceByRef = new Map(scanEmbeddedImages(backup.settings).candidates
  .map(candidate => [imageRefKey(candidate.ref), candidate]))
const changes = receipt.entries.map(entry => {
  const source = sourceByRef.get(imageRefKey(entry.ref))
  if (!source || !localUserImagePath(entry.localUrl)) throw new Error('迁移回执与备份不匹配')
  return { ref: entry.ref, expectedUrl: entry.localUrl, nextUrl: source.sourceUrl }
})
return applyImageChanges(latest, changes)
```

恢复入口只回退匹配的图片引用，**不整体覆盖 settings、App 配置或后续新图包**；这是用户显式选择的回滚例外，会使 settings 恢复内嵌体积，先提示并下载当前插件备份。完整快照保留用于人工灾难恢复，不额外实现任意版本全量设置恢复器。失败文件和未应用回执条目不会找到匹配新路径，自然跳过。

- [ ] **C3.4 跑绿测试**。

```powershell
node node_modules/vitest/vitest.mjs run core/image-storage.test.ts st-extension/src/image-storage-backup.test.ts st-extension/src/st-adapter.test.ts --maxWorkers=1 --no-file-parallelism --reporter=dot
```

另验证：备份序列化失败、下载函数抛错、损坏格式都不能解锁迁移；读取/创建备份不调用 upload/saveSettings。Blob URL 下载只证明浏览器接收下载请求，必须用户确认文件保存，不能将 click() 当落盘 ACK。

## Task C4：迁移对话框和导入入口集成

- [ ] **C4.1 使用生产 dialog mount 写门禁失败测试**。定义入口与生命周期：

```ts
export interface ImageStorageDialogDeps {
  adapter: STAdapter
  getSettings(): PluginSettings
  updateSettings(next: PluginSettings): void
  onClosed(): void
}
// openImageStorageDialog(deps): { close(): void }
```

挂载后“开始上传”默认 disabled。用户下载备份且勾选“已确认备份保存在本机”后才可点击；附录/身份歧义存在则禁用并给出具体理由。备份之后当前可迁移候选集合发生变化时，要求重新扫描/备份，不迁移未进入备份的新图片。

- [ ] **C4.2 实现最小状态机和按钮行为**，保持弹窗 DOM 稳定，不在进度回调中销毁输入/复选框。

```ts
type MigrationPhase = 'inspect' | 'backed-up' | 'staging' | 'staged' | 'queued' | 'closed'
let phase: MigrationPhase = 'inspect'
let controller: AbortController | null = null
let runToken = 0
// 开始：确认备份与候选匹配后设置 phase='staging'、++runToken，并创建 controller。
// 取消/关闭：controller?.abort(); ++runToken；清空 staged 引用；不得 updateSettings。
// 进度/返回：只有 token === runToken && phase !== 'closed' 才更新 UI。
```

必有五类摘要：上传校验成功、失败、应用冲突、未处理、未支持。上传全部完成后也只到 staged；不自动调用 `updateSettings`。单独“下载迁移回执”和“确认应用成功项”按钮；无成功项时不能应用。应用 handler 在同步段中读取最新设置并 compare：

```ts
const applied = applyImageChanges(deps.getSettings(), staged.ready)
if (applied.applied.length) deps.updateSettings(applied.settings)
phase = 'queued'
// 展示：已更新 N 项并请求宿主保存；冲突 M 项未改。请保留备份与回执，重载后复查。
```

这里 staged、backup、receipt 均是本对话框内已验证状态；按钮双击/重复回调由 phase 防重入。关闭释放大字符串引用、AbortController、DOM/监听器和已不再使用的下载 ObjectURL；文件下载使用现有 Blob/link 方式且延后 revoke，不把数据 URI放进 innerHTML、console 或维护文档。

- [ ] **C4.3 集成图库入口与导入**。在 manager 列表页常规操作区始终提供“存储检查与迁移”（空库也能备份/恢复）；manager close/destroy 关闭子对话框并取消待处理导入。JSON 和 shareBtn 统一经 `prepareImportedPack` 再进 `installImportedPack`，保留后者最新 settings 的合并/重命名/仅安装选择。

```ts
const prepared = await prepareImportedPack(pack, {
  saveDataUri: (dataUri, options) => deps.saveDataUri(dataUri, options),
}, { signal: importController.signal, onProgress: updateImportProgress })
if (importController.signal.aborted || destroyed || !backdrop) return
const activeBody = currentManagerBody()
if (!activeBody) return
if (!installImportedPack(prepared, activeBody)) return
```

`deps.saveDataUri` 必须是 manager 注入的适配函数，不把 `PlatformAdapter.saveImage` 扩展成不存在的四参数接口。生产注入在 ST 边界统一调用批次 A 的 `persistSTImage`：`saveDataUri: (dataUri, options) => persistSTImage(dataUri, { fetch: window.fetch.bind(window), getRequestHeaders: () => requireRequestHeaders() }, options)`；模拟器可注入自己的等价实现。`persistSTImage` 的参数顺序、返回值和失败语义以批次 A 为唯一来源。

生产实现先保存当前 body 的空检查，不用上面示意的非空断言绕过关闭态：

```ts
const activeBody = currentManagerBody()
if (!activeBody || importController.signal.aborted || destroyed) return
if (!installImportedPack(prepared, activeBody)) return
```

`importController`、`updateImportProgress` 在 manager 的单次导入操作中创建：控制器保存为 manager 级可取消引用；进度函数只更新本次操作的状态节点 `textContent`。用 try/finally 释放导入锁；失败可重试，不能留下 disabled 永久锁。旧“大 JSON”文案改为说明临时内存和本地文件上传成本，不再暗示导入后会永久保存 base64；按 `File.size` 展示真实字节值。用户在现有安装冲突选择中取消时 settings 不变，新文件仍可能孤立。

- [ ] **C4.4 补 UI/实际调用链验收测试**：未确认备份不 upload；取消/关闭不更新 settings；上传失败保留原图；部分成功只有显式确认才应用；回执未保存不应用；应用时改图/删包报告冲突；JSON 第二张失败安装调用为零；share 远程包不上传且正常安装；manager 关闭后迟到 resolve 不安装；全成功导入的保存对象没有 data URI。

```powershell
node node_modules/vitest/vitest.mjs run core/image-storage.test.ts st-extension/src/image-storage.test.ts st-extension/src/image-storage-backup.test.ts st-extension/src/image-storage-dialog.test.ts st-extension/src/sprite-manager.test.ts --maxWorkers=1 --no-file-parallelism --reporter=dot
```

期望全绿；CSS 使用现有 so-manager/按钮视觉约定，错误列表限高滚动，取消/确认按钮在 375×667 可达。不引入新的 UI 框架或重构整份 manager。

## 批次 C 检查点

- [ ] 定向测试、tsc、lint、diff check 通过；新模块职责与接口没有漂移。正式产物等到 E 同时间戳构建。
- [ ] 在隔离 ST 用户目录用**合成 30+ MB settings**演练完整流程：下载并打开备份 → 迁移 → 再确认回执/应用 → 等宿主保存后重载 → 图片可见且这些内嵌串已消失 → 备份/回执保守恢复 → 再迁移。记录真实 settings 文件字节数前后变化，不用 JSON 字符数冒充整个文件大小。
- [ ] 同一环境重现一次 413/离线/取消，验证原值和文件不被误删；在变更期间编辑另一张图，确认不覆盖新编辑。用 GIF 验证动画与原始字节；用带私人配置的合成 App 对象验证完全不被扫写。
- [ ] `saveSettingsDebounced(): void` 没有服务器落盘回执。只能记录“已请求保存”；**重载后验证**才是本次宿主持久化验收。UI 不提示“磁盘事务已原子完成”，也不因异步失败直接用旧整份 settings 回滚覆盖新编辑。
- [ ] 没有真实 ST 环境时保留上述未验收，不关闭 S1 的发布验收；绝不将真实用户备份、密钥或本机路径样本提交到仓库。
- [ ] 如有提交授权，按纯逻辑/备份/入口三个可验证边界提交明确文件清单；维护文档记录实际修复证据，不顺手关闭历史 App 或渲染器条目。
