# 备份正确性与连续搜索 Implementation Plan（批次 B）

> **For agentic workers:** REQUIRED SUB-SKILL: `executing-plans`，单代理串行；不得启动子代理。本文仅规划。

**Goal:** 修复 R2 的恢复目录错误/ZIP 静默丢文件，以及 R8 的搜索焦点与输入法节点被销毁。

**Architecture:** 用头像文件身份建立标准聊天目录；在 ZIP 生成前对所有资产路径做统一校验。备份 UI 创建一次搜索节点，状态更新只替换其兄弟区域，不靠重建后的 focus() 补救。

**Tech Stack:** TypeScript、原生 DOM、JSZip、Vitest/jsdom；真实浏览器验证在批次 D 统一执行。

---

## 文件图

| 操作 | 完整路径 | 职责 |
| --- | --- | --- |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/apps/cloud-export/manifest.ts` | 头像/chat 文件身份与导出路径 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/apps/cloud-export/manifest.test.ts` | 标准目录、同名角色、危险/含糊身份 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/apps/cloud-export/zip.ts` | 全资产重复/冲突路径预检 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/apps/cloud-export/zip.test.ts` | 真实 JSZip generate/load 与下载前拒绝 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/apps/cloud-export/export-loader.test.ts` | 生产加载器到清单的组合场景 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/apps/cloud-export/export-app.ts` | 稳定搜索节点、结果区域更新 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/apps/cloud-export/export-app.test.ts` | focus/caret/IME/懒加载期间输入 |

读取但不顺带改：`D:/8.Project/0_0_维护/st-stage/st-extension/src/apps/cloud-export/bridge.ts`（fallback-ID 和失败任务取消属于历史独立条目）；`D:/8.Project/0_0_维护/st-stage/st-extension/src/apps/cloud-export/types.ts` 的 ExportFile/ExportCharacter/ExportChat。

## Task B1：可恢复的角色与聊天目录（R2）

- [ ] **B1.1 写两条回归测试**。第一条 avatar 与显示名不同；第二条唯一 avatar、相同显示名和聊天名，保留两套聊天字节。

```ts
const selection: ExportSelection = {
  characterIds: new Set(['Alice1.png', 'Alice2.png']),
  chatIds: new Set(['c1', 'c2']), worldbookIds: new Set(), presetIds: new Set(), regex: false,
}
const files = [1, 2].flatMap(n => buildCharacterFiles({
  id: `Alice${n}.png`, avatar: `Alice${n}.png`, name: 'Alice',
  chats: [{ id: `c${n}`, name: '显示名称', path: 'first.jsonl' }],
}, new Uint8Array([n]), new Map([[`c${n}`, `{"id":${n}}\n`]]), selection))
expect(files.map(file => file.path)).toEqual([
  'characters/Alice1.png', 'chats/Alice1/first.jsonl',
  'characters/Alice2.png', 'chats/Alice2/first.jsonl',
])
expect(new Set(files.map(file => file.path)).size).toBe(4)
```

导入 `buildCharacterFiles` 与 `ExportSelection`。使用 `chat.path` 的文件名而不是 UI name，确保与读取的资源身份一致；没有 path 才使用 name。

- [ ] **B1.2 跑红测试**。

```powershell
node node_modules/vitest/vitest.mjs run st-extension/src/apps/cloud-export/manifest.test.ts --maxWorkers=1 --no-file-parallelism --reporter=dot
```

期望旧实现产生 `chats/Alice/显示名称.jsonl`，不满足规范；保留失败输出。

- [ ] **B1.3 用严格、保留身份的 segment 校验替代静默改名**。标准备份路径不能为了“安全”将一个真实文件名截断为另一个有效名字。对路径分隔符、控制字符、空名、`.`/`..` 或无法跨平台安全还原的名字显式报错，让用户知道哪项不能导出，不自己补 `-2`。

```ts
function archiveSegment(value: string, kind: string): string {
  if (!value || value.trim() !== value || /^[.]+$/.test(value) ||
      /[\\/\u0000-\u001f:*?"<>|]/.test(value) || /[. ]$/.test(value)) {
    throw new Error(`无法生成可恢复备份：${kind}文件名不合法`)
  }
  return value
}

function characterArchiveIdentity(avatar: string): { avatar: string; stem: string } {
  const name = archiveSegment(avatar, '角色头像')
  if (!/\.png$/i.test(name)) throw new Error('无法确定角色聊天目录：头像文件必须为 PNG')
  return { avatar: name, stem: archiveSegment(name.slice(0, -4), '角色目录') }
}
```

`buildCharacterFiles` 仅在所选角色/聊天确有输出时解析身份。card 路径用 `identity.avatar`；chat 目录用 `identity.stem`。chat 文件名取 `archiveSegment((chat.path || chat.name).replace(/\.jsonl$/i, ''), '聊天') + '.jsonl'`，不凭 display name 改头像目录。世界书/预设同样保留其 fileName，非法输入失败而非用共享 fallback 文件名覆盖。测试补中文、内部空格、多点头像、长名不被截断、空头像、分隔符和大小写扩展名。

- [ ] **B1.4 跑 manifest/export-loader 测试**；期望两个同显示名角色各四项输入/输出关系完整，既有选项语义不变。保留 settings 最小片段“未选字段不输出”的控制测试。

## Task B2：ZIP 全资产唯一性门禁（R2）

- [ ] **B2.1 写下载前拒绝测试**。两条不同 data、相同 path，即便字节相同也不可默认吞一条。`URL.createObjectURL` 与 anchor.click 均不能发生。

```ts
const create = vi.spyOn(URL, 'createObjectURL')
await expect(downloadSTBackup([
  { path: 'worlds/World.json', data: '{"v":1}' },
  { path: 'worlds/World.json', data: '{"v":2}' },
], 'backup.zip', vi.fn())).rejects.toThrow('备份路径冲突')
expect(create).not.toHaveBeenCalled()
```

参数表覆盖 cards/chats/worlds/presets/settings.json；补大小写/NFC 等价路径冲突、`a` 与 `a/x` 文件/目录冲突、绝对路径、反斜杠、`../`、空 segment。路径不做 URL 解码，ZIP 路径不是 URL。

- [ ] **B2.2 在 zip.ts 导出校验函数，并置于 new JSZip 之前**。兼容 Windows/Linux 恢复，跨平台冲突**拒绝并解释**，不在包内悄悄重命名。

```ts
export function assertUniqueArchivePaths(files: Pick<ExportFile, 'path'>[]): void {
  const seen = new Map<string, string>()
  for (const { path } of files) {
    const parts = path.split('/')
    if (!path || path.startsWith('/') || /[\\\u0000-\u001f:]/.test(path) ||
        parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part))) {
      throw new Error(`备份路径不合法：${path}`)
    }
    const canonical = path.normalize('NFC').toLowerCase()
    if (seen.has(canonical)) throw new Error(`备份路径冲突：${seen.get(canonical)} 与 ${path}`)
    seen.set(canonical, path)
  }
  for (const [canonical, path] of seen) {
    const parts = canonical.split('/')
    for (let length = 1; length < parts.length; length += 1) {
      if (seen.has(parts.slice(0, length).join('/'))) throw new Error(`备份路径冲突：${path}`)
    }
  }
}
```

把字符规则与 manifest 的输入约束对齐；最后路径校验还须拒绝 Windows 保留文件名/不支持字符，避免其他调用者绕过 manifest。错误文案包含冲突路径，但不能记录文件正文。

- [ ] **B2.3 用真实 JSZip 做生成/加载测试**。捕获下载 blob，jsdom 中通过 FileReader 读为 ArrayBuffer，调用 `JSZip.loadAsync`；过滤 `dir` 自动目录条目后，断言 B1 四个文件全部存在，两段 chat 的内容分别为 id1/id2。不得 mock `zip.file` 后仅 assert called four times（那会漏掉真实覆盖行为）。

- [ ] **B2.4 组合测试 export-loader + manifest + ZIP**：选中两个角色及其聊天，桥接返回不同 PNG 和 JSONL，检查最终文件数/内容；故意制造重复输出时 UI 只有失败通知，不能出现“已下载”。

```powershell
node node_modules/vitest/vitest.mjs run st-extension/src/apps/cloud-export/manifest.test.ts st-extension/src/apps/cloud-export/zip.test.ts st-extension/src/apps/cloud-export/export-loader.test.ts --maxWorkers=1 --no-file-parallelism --reporter=dot
```

期望全绿；R2 不再依赖用户“不要使用相同显示名”的规避方法。

## Task B3：稳定搜索 DOM 与输入法（R8）

- [ ] **B3.1 用生产 cloudExportApp.mount 写失败测试**。复用该测试文件已有 fakeBridge/context/settle；container 必须接入 document.body。逐字符派发事件，不一次赋完整搜索词。

```ts
const container = document.createElement('div')
document.body.append(container)
const app = cloudExportApp(fakeBridge(), vi.fn())
app.mount(container, context())
await settle()
const input = container.querySelector<HTMLInputElement>('input.so-app-input')!
input.focus()
for (const character of ['A', 'l', 'i']) {
  input.setRangeText(character, input.selectionStart ?? 0, input.selectionEnd ?? 0, 'end')
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: character }))
  expect(container.querySelector('input.so-app-input')).toBe(input)
  expect(document.activeElement).toBe(input)
}
expect(input.value).toBe('Ali')
expect(input.selectionStart).toBe(3)
app.unmount?.()
container.remove()
```

运行前核对工厂现有参数形式，保持原测试 fixture 的构造方式，不为测试改 public API。

- [ ] **B3.2 补输入法与异步场景**：compositionstart → composing input → bridge resolve/render → compositionend；期望同一个 input、草稿不被 lower/trim、光标/选区未跳。另测中间插字、Backspace、粘贴、选择列表行引发 render、分类懒加载返回。导出 busy 是明确禁用输入的例外，不要求 disabled 控件保焦。

- [ ] **B3.3 一次创建布局骨架**。mount 内创建 `title/desc/tabs/search/results/footer`，仅调用一次 `container.replaceChildren(...)`。render 改为 `tabs.replaceChildren()`、`results.replaceChildren(actions, list)`、`footer.replaceChildren(...)`；搜索节点不是它们的子节点，绝不 detach/reappend。现有滚动恢复和 selection/展开状态继续使用。

```ts
let rawQuery = ''
let query = ''
let composing = false
const search = document.createElement('input')
search.className = 'text_pole so-app-input'
search.setAttribute('aria-label', '搜索当前分类')
search.addEventListener('compositionstart', () => { composing = true })
const applyQuery = () => {
  rawQuery = search.value
  query = rawQuery.trim().toLowerCase()
  render()
}
search.addEventListener('input', (event) => {
  rawQuery = search.value
  if (!composing && !(event as InputEvent).isComposing) applyQuery()
})
search.addEventListener('compositionend', () => {
  composing = false
  applyQuery()
})
```

render 只设置 `search.disabled = busy`，不写 search.value。切换分类的事件显式清空 `rawQuery/query/search.value`，保留原有“分类切换清空查询”的行为；销毁时清掉 mounted DOM/闭包引用，异步结果仍由 disposed guard 拒绝。

- [ ] **B3.4 跑现有 UI 全组及新用例**。

```powershell
node node_modules/vitest/vitest.mjs run st-extension/src/apps/cloud-export/export-app.test.ts --maxWorkers=1 --no-file-parallelism --reporter=dot
```

期望搜索断言从红转绿，勾选关联聊天/世界书、取消、全选反选、分类懒加载、滚动位置等既有功能不回归。D 批追加真实浏览器逐键输入；合成 composition 事件不能替代真实中文输入法验收。

## 批次 B 检查点

- [ ] 整个 cloud-export 目录的测试、tsc、lint、diff check 通过。
- [ ] 将两个唯一头像但同显示名角色的 ZIP 在**隔离 ST 用户数据目录**恢复，验证角色卡对应两组聊天；不覆盖真实用户数据。没有测试环境则标为未验收，不能称 R2 已完成发布验收。
- [ ] 若有提交授权，按 R2 / R8 两个边界提交明确文件列表。旧 fallback-ID 等历史条目不标已解决。
- [ ] 进入 C；R8 浏览器/真机验收仍列在 D/E 门禁。