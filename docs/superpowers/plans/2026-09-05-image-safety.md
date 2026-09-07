# 图片安全与元数据 Implementation Plan（批次 A）

> **For agentic workers:** REQUIRED SUB-SKILL: `executing-plans`，单代理串行；不得启动子代理。逐项勾选；本文仅规划，尚未实现。

**Goal:** 关闭 R1/R3/R5 的 ST 图片持久化漏洞，并关闭 R4 的 inventoryPrompt 往返丢失，为迁移提供可靠基础。

**Architecture:** 新建一个小型 ST 图片写入模块，统一随机命名、失败传播和字节读回校验；现有 adapter 保持三参数调用兼容。元数据沿用 core 的现有规范化函数，不改变包格式版本。

**Tech Stack:** TypeScript、Fetch/AbortController/Web Crypto、Vitest/jsdom；无新增依赖。

---

## 文件图

| 操作 | 完整路径 | 职责 |
| --- | --- | --- |
| 新增 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/image-persistence.ts` | ST 图片请求、唯一命名、响应路径和字节验证 |
| 新增 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/image-persistence.test.ts` | 真实写入语义的内存服务、故障矩阵 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/st-adapter.ts` | saveImage/saveImageFile 委托，移除内嵌 fallback |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/st-adapter.test.ts` | 适配器能力/往返集成 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/core/adapter.ts` | 文档明确 Web 内嵌与 ST 文件模式，不改调用者默认接口 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/sprite-localize.ts` | 拒绝 embedded/非用户图片路径结果 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/sprite-localize.test.ts` | 保存伪成功时不更新原 sprite |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/sprite-manager.ts` | 替换/批量/localize 错误与并发编辑保护 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/st-extension/src/sprite-manager.test.ts` | 生产管理器的失败计数与旧引用不变 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/core/migrate.ts` | migratePack 保留 inventoryPrompt |
| 修改 | `D:/8.Project/0_0_维护/st-stage/core/pack-io.ts` | @3 JSON 导入导出保留 inventoryPrompt |
| 修改 | `D:/8.Project/0_0_维护/st-stage/core/migrate.test.ts` | 规范化、旧版本兼容 |
| 修改 | `D:/8.Project/0_0_维护/st-stage/core/pack-io.test.ts` | 元数据完整往返 |

读取复用但默认不改：`D:/8.Project/0_0_维护/st-stage/core/sprite-metadata.ts` 的 `normalizeInventoryPrompt`；`D:/8.Project/0_0_维护/st-stage/core/sprite-store.ts` 的 `localUserImagePath`；`D:/8.Project/0_0_维护/st-stage/core/types.ts` 已有两个 inventoryPrompt 类型字段。

## Task A1：ST 保存成功契约（R1、R3、R5）

### 设计契约

新增导出，供 A2/C 调用；`fileName`/`characterName` 三参数兼容由 adapter 保留，但不再将显示名用作物理文件身份。

```ts
export interface ImageSaveOptions { signal?: AbortSignal }
export interface STImagePersistenceDeps {
  fetch: typeof fetch
  getRequestHeaders?: () => Record<string, string>
}
export const ST_IMAGE_SAVE_TIMEOUT_MS = 30_000
export const ST_IMAGE_MAX_BYTES = 20 * 1024 * 1024
```

新增 `persistSTImage(dataUri: string, deps: STImagePersistenceDeps, options: ImageSaveOptions = {}): Promise<string>`。默认单图上限 20 MiB（与已有远程本地化限制同量级）；超限明确拒绝、保留原值，不隐式降质或截断。迁移/导入显示此限制。

- [ ] **A1.1 写失败测试**：在 adapter 测试中用下面的内存服务复现 ST 固定路径覆盖。服务的 POST 按指定 filename 覆盖 Map，GET 返回对应字节；修复前两次返回同一路径，修复后旧文件字节保持不变。

```ts
const disk = new Map<string, Uint8Array>()
vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input) === '/api/images/upload') {
    const payload = JSON.parse(String(init?.body)) as {
      ch_name: string; filename: string; format: string; image: string
    }
    const path = `/user/images/${payload.ch_name}/${payload.filename}.${payload.format}`
    disk.set(path, Uint8Array.from(atob(payload.image), c => c.charCodeAt(0)))
    return new Response(JSON.stringify({ path }), { status: 200 })
  }
  const bytes = disk.get(String(input))
  return bytes ? new Response(bytes as BodyInit) : new Response('', { status: 404 })
}))
window.SillyTavern = { getContext: () => ({
  getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
}) } as never
const adapter = new STAdapter()
const first = await adapter.saveImage('happy.webp', 'data:image/webp;base64,QUFB', 'Alice')
const second = await adapter.saveImage('happy.webp', 'data:image/webp;base64,QkJC', 'Alice')
expect(second).not.toBe(first)
expect(new TextDecoder().decode(disk.get(first))).toBe('AAA')
expect(new TextDecoder().decode(disk.get(second))).toBe('BBB')
```

- [ ] **A1.2 增加表驱动故障测试**，每项期望 reject 且返回值不可能是 data URI：413、500、fetch reject、POST 超时、GET 超时、缺少 getRequestHeaders、空对象、path 非字符串、data/https/blob 路径、`/user/images/../x`、编码路径穿越、不是本次 filename 的旧路径、GET 404、GET 字节不等。测试超时使用 fake timers 并在 finally 恢复；缺 headers 必须在 POST 前失败。

- [ ] **A1.3 跑红测试**。

```powershell
node node_modules/vitest/vitest.mjs run st-extension/src/st-adapter.test.ts st-extension/src/image-persistence.test.ts --maxWorkers=1 --no-file-parallelism --reporter=dot
```

期望新增的“不覆盖/失败必须抛出”断言失败，已有故事上下文/删除路径等控制测试仍通过；记录失败原因，不通过跳过断言制造红灯。

- [ ] **A1.4 实现无覆盖命名和合法数据解析**。核心片段：

```ts
function uniqueImageName(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return `sprite_${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`
}

function parseImageData(dataUri: string): { image: string; format: string; bytes: Uint8Array } {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(dataUri)
  if (!match || match[2].length % 4 !== 0) throw new Error('图片数据格式不正确')
  const formats: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
    'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg',
    'image/avif': 'avif', 'image/bmp': 'bmp',
  }
  const format = formats[match[1].toLowerCase()]
  if (!format) throw new Error('不支持的图片格式，请转换为 PNG、WebP 或 GIF 后重试')
  const expectedBytes = match[2].length * 3 / 4 - (match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0)
  if (expectedBytes > ST_IMAGE_MAX_BYTES) throw new Error('单张图片不能超过 20 MiB')
  const binary = atob(match[2])
  if (!binary.length) throw new Error('图片数据为空')
  return { image: match[2], format, bytes: Uint8Array.from(binary, c => c.charCodeAt(0)) }
}
```

输入 MIME 决定扩展名，不信任传入 `.webp` 文件名。GIF/SVG 不重新压缩，避免动图静态化；服务端若不支持某格式，应原样报错，不改格式欺骗接口。测试至少覆盖 png/jpeg/webp/gif 和明确拒绝。使用安全随机标识防止显示名碰撞，不能承诺一个非排他写入的服务端具备数学上的零碰撞。

- [ ] **A1.5 实现上传、校验、取消清理**。固定目录 `sprite_overlay`；缺能力立即拒绝。一次 AbortController 覆盖 POST + GET，连接外部 signal 与 30 秒 timer，finally 清理 timer/listener。不得记录 image 字节或服务器返回的整段 HTML。

```ts
export async function persistSTImage(
  dataUri: string, deps: STImagePersistenceDeps, options: ImageSaveOptions = {},
): Promise<string> {
  if (!deps.getRequestHeaders) throw new Error('当前酒馆未提供图片保存所需的请求头能力')
  const headers = deps.getRequestHeaders()
  const data = parseImageData(dataUri)
  const filename = uniqueImageName()
  const expectedPath = `/user/images/sprite_overlay/${filename}.${data.format}`
  const controller = new AbortController()
  const onAbort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', onAbort, { once: true })
  if (options.signal?.aborted) onAbort()
  const timer = setTimeout(() => controller.abort(new Error('图片保存超时')), ST_IMAGE_SAVE_TIMEOUT_MS)
  try {
    const response = await deps.fetch('/api/images/upload', {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ image: data.image, format: data.format, ch_name: 'sprite_overlay', filename }),
    })
    if (!response.ok) throw new Error(`图片上传失败：HTTP ${response.status}`)
    const result: unknown = await response.json()
    const path = result && typeof result === 'object' && 'path' in result ? result.path : null
    if (typeof path !== 'string' || localUserImagePath(path) !== expectedPath || path !== expectedPath) {
      throw new Error('图片上传响应未返回本次保存的安全本地路径')
    }
    const readback = await deps.fetch(path, {
      cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
    })
    if (!readback.ok) throw new Error(`图片保存后校验失败：HTTP ${readback.status}`)
    const actual = new Uint8Array(await readback.arrayBuffer())
    if (actual.length !== data.bytes.length || actual.some((byte, index) => byte !== data.bytes[index])) {
      throw new Error('图片保存后校验失败：文件内容不一致')
    }
    return path
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}
```

从 `../../core/sprite-store` 导入 `localUserImagePath`。GET 不转发 POST 的敏感自定义 headers；仅请求本次生成的同源路径。读回失败留下可能未引用文件，不调用 deleteImage。

- [ ] **A1.6 adapter 委托并补充文档**。移除旧 saveBase64AsFile 类型强转、文件名拼接、fallback 和误导注释；optional 方法先捕获再检查，不能写 `ctx.getRequestHeaders!()`。

```ts
async saveImage(
  _fileName: string, base64Data: string, _characterName: string,
  options: ImageSaveOptions = {},
): Promise<string> {
  const ctx = getContext()
  const headers = ctx.getRequestHeaders
  return persistSTImage(base64Data, {
    fetch,
    getRequestHeaders: headers ? () => headers.call(ctx) : undefined,
  }, options)
}

async saveImageFile(
  file: File, fileName: string, characterName: string,
  options: ImageSaveOptions = {},
): Promise<string> {
  return this.saveImage(fileName, await blobToDataUri(file), characterName, options)
}
```

- [ ] **A1.7 运行 A1 定向测试与 tsc**；期望测试绿、tsc 从已知 TS2722 转为退出 0。新增对 `crypto.getRandomValues` 不可用/抛错的失败测试，不加时间戳兜底。

## Task A2：调用边界与用户可见失败（R1、R3）

- [ ] **A2.1 在 localize 测试补 data/blob/扩展目录伪成功结果**。沿用现有 fetch/压缩 fixture，期望全部 reject、原 sprite 完全不变。

```ts
await expect(localizeSprite(remote, '微笑.webp', {
  fetch: vi.fn(async () => new Response(new Blob(['AAA'], { type: 'image/png' }))) as unknown as typeof fetch,
  compress: vi.fn(async () => ({ dataUri: 'data:image/webp;base64,QUFB', bytes: 3, compressed: true })),
  saveImage: vi.fn(async () => 'data:image/webp;base64,QUFB'),
})).rejects.toThrow('平台未返回本地地址')
```

- [ ] **A2.2 替换 localize 的宽松 `getSpriteSource !== hosted` 判断**，使用 `localUserImagePath(localUrl)` 非空检查；该函数只服务 ST 图片本地化，不修改 WebAdapter 的显式内嵌模式。

```ts
if (!localUrl || !localUserImagePath(localUrl)) {
  throw new Error('保存本地图片失败：平台未返回本地地址')
}
```

- [ ] **A2.3 在 manager 正式测试补三条路径**：单张替换 saveImage reject 时旧图不变；批量上传一成功一失败只计一张成功且失败项不入库；批量本地化失败不增加 localizedCount。复用本文件 `installFilePicker`/`openUploadPreview` 等 fixture，不额外搭一个脱离生产 UI 的计数器。

- [ ] **A2.4 在替换的两个 await 边界守住最新引用**。上传前记住 `beforeSave.sprite.url`；上传回来只在目标 URL 未变时替换；图床上传回来只在本地 URL 仍等于本次 `url` 时补 code/remoteUrl。否则提示“目标已更改，本次结果未应用”，保留新文件但不覆盖新编辑。

```ts
const target = latestTarget()
if (!target || target.sprite.url !== beforeSave.sprite.url) {
  toast(currentManagerBody(), '目标已更改，本次结果未应用')
  return
}
```

对应测试在 deferred promise 未结束前换图/删包，再 resolve，确认用户新编辑没有被旧结果覆盖。批量保存/localize 已有 compare-before-commit 逻辑应保留，不回退成一次旧 settings 全量写回。

- [ ] **A2.5 跑定向测试**；期望所有失败路径显式通知、不持久化 embedded、不改变旧引用。

```powershell
node node_modules/vitest/vitest.mjs run st-extension/src/image-persistence.test.ts st-extension/src/st-adapter.test.ts st-extension/src/sprite-localize.test.ts st-extension/src/sprite-manager.test.ts --maxWorkers=1 --no-file-parallelism --reporter=dot
```

## Task A3：inventoryPrompt 完整往返（R4）

- [ ] **A3.1 先把两条真实往返写成失败测试**。adapter 测试用已存在的 context settings fixture；pack-IO 使用远程 URL，避免导出测试依赖网络。

```ts
const pack = { id: 'custom', name: '自定义', inventoryPrompt: '  只在换装时列出图片  ',
  sprites: [{ tag: '微笑', url: 'https://example.invalid/smile.webp' }] }
const loaded = importPack(JSON.stringify(await exportPack(pack)))
expect(loaded.inventoryPrompt).toBe('只在换装时列出图片')
```

另在 `STAdapter.saveSettings → loadSettings` 路径断言同一字段，不能只测 migrate 的返回对象。参数表包含 undefined、null、数字、纯空格、800/801 Unicode 码点、多行文字；期望完全复用 `normalizeInventoryPrompt`。

- [ ] **A3.2 跑红测试**。

```powershell
node node_modules/vitest/vitest.mjs run core/migrate.test.ts core/pack-io.test.ts st-extension/src/st-adapter.test.ts --maxWorkers=1 --no-file-parallelism --reporter=dot
```

期望新加两条往返失败为 undefined，不改现有 v1/v2/v3 兼容断言。

- [ ] **A3.3 在三个序列化入口加同一规范化字段**：migratePack 使用 `p.inventoryPrompt`；exportPack 使用 `pack.inventoryPrompt`；importPack 使用 `file.inventoryPrompt`。在各自 metadata 局部计算并条件 spread，沿用现有格式；类型已存在，不 bump settings/pack 版本。

```ts
const inventoryPrompt = normalizeInventoryPrompt(p.inventoryPrompt)
// 放入 migratePack 的返回对象，紧邻 promptNote：
...(inventoryPrompt ? { inventoryPrompt } : {}),
```

另两个入口只替换读取对象为 `pack` / `file`，导入同一函数。预设 override 的 null 表示显式清空，不改为缺字段；增加控制测试确保没有误伤。

- [ ] **A3.4 重跑 A3 测试并核对所有元数据**：coverTag、labels、group/outfit、remoteUrl、promptNotePlacement、sourceStoryKey、outfitNotes 不因补字段丢失。JSON 不比较新生成 id/导出时间的字节相等；只比较规范化后的领域值。

## 批次 A 检查点

- [ ] A1–A3 定向测试、tsc、lint、`git diff --check` 均绿；不重建根产物。
- [ ] 若用户授权提交，仅 stage 本文件图中实际修改的源码/测试及维护记录；建议提交边界：`fix: enforce verified collision-safe ST image persistence`、`fix: preserve inventory prompt metadata round trips`。不提交本机探针、用户 CSS 或真实备份。
- [ ] 维护文档记录实际修复提交；S1 仍未完成。进入批次 B，随后才进入依赖 A 的迁移实现。