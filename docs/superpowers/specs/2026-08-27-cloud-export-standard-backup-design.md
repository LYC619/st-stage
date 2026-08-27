# Cloud Export 标准备份与批量导出设计

## 目标

将内置“导出”App 改造成面向 STE 导入流程的选择式 SillyTavern 备份工具：用户选择资产后只下载一个 `default-user-YYYYMMDD-HHmmss.zip`，ZIP 内使用 SillyTavern `data/default-user/` 的原生目录路径，同时避免打开 App 时读取全部聊天和世界书正文。

本轮不是完整账户备份。它只导出当前已支持并被用户选中的角色卡、角色聊天、世界书、OpenAI Settings 预设和全局正则；不包含 `secrets.json`、API Key、群组、Persona、附件、主题、快捷回复或向量索引。

## 已确认问题

当前 `loadSnapshot()` 在 App 打开时执行以下重操作：

1. 读取角色列表后，逐个串行读取每个角色的聊天列表。
2. 读取世界书列表后，立即并行读取全部世界书正文。
3. 无论用户是否查看预设或正则，都立即请求完整 `/api/settings/get`。
4. 全部请求完成前，界面只有“正在读取”状态。

因此角色和世界书越多，首次打开越慢。现有“全选当前列表”也只选择角色卡，不会快捷选择角色的全部聊天，无法形成实用的批量导出流程。

参考脚本提供了清单与内容分离、分类批量选择、搜索结果批量操作和统一 ZIP 打包等可借鉴模式，但本实现继续使用已经按 SillyTavern 1.18.0 源码核对的 HTTP API，不依赖脚本环境中的内部全局函数。

## 用户流程

### 首次打开

- 立即显示 App 框架、分类按钮、搜索和导出摘要。
- 只加载默认分类“角色卡”的角色清单。
- 角色卡清单返回后即可选择，不等待聊天、世界书或设置数据。
- 切换到世界书、预设或正则时，首次按需加载该分类，之后复用本次挂载期间的缓存。

### 角色和聊天

- 勾选角色只选择该角色卡 PNG。
- 展开某个角色时才读取其聊天清单。
- 角色行提供“选择角色及全部聊天”的批量动作；该动作在需要时加载该角色的聊天清单并全选。
- 分类级“全选角色及聊天”以有限并发读取全部角色的聊天清单，然后选择所有角色卡与聊天。
- 普通“全选当前结果”只操作当前搜索结果中的角色卡，不隐式产生大量网络请求。

### 其他分类

- 世界书列表只加载名称、文件名和更新时间；正文到导出时才读取。
- 预设和全局正则依赖 `/api/settings/get`，只在首次打开相应分类或导出已选内容需要时读取一次并缓存。
- 每个分类提供全选当前搜索结果、反选当前搜索结果和清空当前分类。

### 导出

- 页面始终显示已选角色、聊天、世界书、预设和正则数量。
- 未选择任何资产时禁止生成 ZIP，并给出明确提示。
- 点击导出后锁定选择操作，按有限并发读取选中的角色卡、聊天正文和世界书正文。
- 进度文案区分“读取资产 N/M”和“压缩 N%”。
- 任一资产读取失败时报告具体资产，不生成或下载半成品 ZIP。
- 全部读取成功后只触发一次浏览器下载。

## ZIP 契约

文件名：

```text
default-user-YYYYMMDD-HHmmss.zip
```

内部路径：

```text
settings.json
characters/<avatar>.png
chats/<character>/<chat>.jsonl
worlds/<worldbook>.json
OpenAI Settings/<preset>.json
```

只写入包含已选内容的目录，不伪造截图中其他未支持分类的空目录。STE 应按 SillyTavern `default-user` 根目录规则扫描这些标准路径。

`settings.json` 继续保持最小、脱敏和可导入：

- 全局正则写入 `extension_settings.regex`。
- 已选世界书名称写入 `world_info_settings.world_info.globalSelect`。
- 不写入 `secrets.json`、密钥或未选择的完整系统设置。

路径片段继续过滤斜杠、NUL 和纯点路径，避免 ZIP 路径穿越或目录错位。

## 代码边界

### `types.ts`

把“清单摘要”和“已读取正文”分开。世界书清单不再强制持有 `content`；角色聊天改为独立按角色加载。导出选择仍使用稳定 ID 集合。

### `bridge.ts`

桥接层改成按资源粒度的方法：

- `listCharacters()`
- `listChats(character)`
- `listWorldbooks()`
- `loadSettingsAssets()`
- `readWorldbook(worldbook)`
- `readCharacterCard(character)`
- `readChat(character, chat)`

桥接层继续集中处理 SillyTavern 返回结构差异，UI 和打包层不解析原始 API 响应。

### `export-loader.ts`

新增无 DOM 的导出编排单元，负责：

- 根据选择计算待读取任务。
- 以固定并发上限执行网络读取，默认上限为 4。
- 汇报已完成数、总数和当前资产名称。
- 仅在全部任务成功后返回完整 `ExportFile[]`。

这样可独立测试并发上限、失败不产出和标准路径，不把复杂异步逻辑继续堆入 `export-app.ts`。

### `export-app.ts`

只负责挂载状态、分类懒加载、选择交互和用户反馈。每类使用 `idle/loading/ready/error` 状态，失败后允许用户点击重试。卸载后忽略迟到的异步结果。

### `manifest.ts` 与 `zip.ts`

- `manifest.ts` 负责标准备份路径和最小 `settings.json`。
- `zip.ts` 负责一次性生成和下载 ZIP。
- ZIP 下载函数不接触 SillyTavern API。

## 性能与并发

- 首屏只发出 `/api/characters/all`，不自动请求聊天、世界书正文或设置。
- 单个角色聊天清单只请求一次并缓存。
- 分类清单只请求一次并缓存；显式重试除外。
- 导出网络读取采用最多 4 个并发任务，避免串行过慢，也避免无限 `Promise.all` 压垮 SillyTavern。
- ZIP 压缩继续使用 JSZip DEFLATE level 6；本轮不引入 Worker，先消除网络和初始化瓶颈。

## 错误处理

- 分类加载失败只影响该分类，已加载分类保持可用。
- 角色聊天加载失败显示在对应角色下，可单独重试。
- 导出错误包含资产类型和名称，例如“读取世界书《世界》失败”。
- 导出期间按钮禁用，避免重复请求和多次下载。
- 失败后恢复按钮和选择状态，用户可以重试。

## 测试策略

### 桥接层

- 首屏角色清单只调用 `/api/characters/all`。
- 角色聊天、世界书正文和设置在对应方法调用前不会请求。
- 聊天读取仍携带 `ch_name`、`avatar_url` 和 `file_name`。
- 正则仍读取 `extension_settings.regex`。

### 导出编排

- 只读取用户选中的资产。
- 并发任务数不超过 4。
- 读取失败时拒绝，不返回可下载的半成品文件。
- 生成的路径与 SillyTavern `default-user` 目录一致。

### App 交互

- 挂载后无需等待全部资源即可显示角色清单。
- 展开角色才加载聊天。
- “全选角色及聊天”包含角色卡和其全部聊天。
- 搜索结果的全选、反选和清空只影响当前可见集合。
- 空选择不会调用 ZIP 下载。

### 回归门禁

- Cloud Export 定向 Vitest。
- TypeScript typecheck。
- ESLint。
- 扩展构建和构建产物一致性检查。
- 不把真实 SillyTavern/STE 集成结果虚报为自动化通过；最终仍需在真实环境导出并交给 STE 扫描。

## 非目标

- 不调用 SillyTavern 的完整备份端点后再在浏览器拆 ZIP；这会重新引入全量下载和额外内存开销。
- 不在本轮增加导入、实时同步、增量同步或删除同步。
- 不扩展群组、Persona、附件、其他后端预设、主题、快捷回复或向量索引。
- 不改变 STE 导入协议，只保证当前支持资产使用标准 `default-user` 路径。
