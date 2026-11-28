# Codex 审查 3 项 P2 缺陷修复与回归验证（2026-11-28）

## 基线与交付边界

- 分支 `main`，基线提交 `2fe00e1268469422527c4b1e4b542a6000b17943`（已提交构建基线 `bc5e03ee9c80c9d430ab376766cbfa79d4969d6c`）。按任务约定保留全部修复与同时间戳三路构建产物 **0.9.0+202611281256** 为未提交工作区改动，未自动执行 `git commit`。
- 外部安装仓 `../st-stage-ext` 未改动，仍保持正式已发布版 **0.9.0+202611280949**（`96be608348173fb3059cda7ddeb17adca1dacea4`）。

## 改了什么与为什么

1. **STAGE-001 · 20 字符上限标签冲突改名与回导保真**（`core/pack-split.ts`）：原 `autoRenameTag` 直接截断 `${desired}_${i}` 至 20 字符，在原标签满 20 字符时始终退回旧名并落入未截断的 29 字符时间戳后缀，`importPack` 回导规范化时与旧标签撞车去重丢图。现改为先按后缀长度截短基础名（避开孤立高代理项与尾随空白）再拼接 `normalizeTag`，循环与多轮时间戳兜底均保证长度 `≤ 20` 且规范化形式唯一；`planUploads` 同步记录归一化占用集合并跳过空标签占位。
2. **STAGE-002 · 网页体验台异步上传陈旧状态覆盖修复**（`components/config-panel.tsx`、`core/sprite-store.ts`、`app/page.tsx`）：原 `handleUpload` 在压缩与图床上传完成后把触发时闭包捕获的旧 `settings` 与 `pack` 整包回写，回滚上传期间的设置切换与新建图包，且并发上传会互相覆盖。现由 `core/sprite-store.ts` 导出 `findSameSprite`，`ConfigPanel` 通过最新设置引用在每次异步落盘前重新定位目标包并按立绘三级身份增量合并（`app/page.tsx` 同步支持函数式更新）；目标包被删或同身份立绘被外部修改时安全提示冲突，绝不复活已删包或覆盖其他配置。
3. **STAGE-003 · 新变量设计器编辑期间删除前序行写错目标修复**（`st-extension/src/apps/newvar/designer.ts`）：原设计器仅用 `editingIndex` 定位编辑项，打开 `B` 编辑期间删除前序行 `A` 后未递减索引，保存时覆写 `C`（不改名时还会误触发重名拦截）。现引入稳定身份 `editingKey` 配合 `resolveEditingIndex`，删除行时同步维护索引/清空被删编辑项，渲染选中态与保存提交前均复核目标路径身份。

## 怎么验证的

- 单 worker 串行关联与回归单测（`vitest run --maxWorkers=1 --no-file-parallelism`）：8 文件／196 项全通过（含 `core/pack-split.test.ts`、`components/config-panel.test.tsx`、`st-extension/src/apps/newvar-app.test.ts`、`st-extension/build.test.ts` 等；`vitest.config.ts` 已纳入 `components/**/*.test.{ts,tsx}`）。
- 静态与契约校验：`npx tsc --noEmit --incremental false` 零错误、`pnpm lint --max-warnings 0` 零警告、i18n **874 键／964 引用**、内置 App 文档 **13 项**、`pnpm test:release` **26/26** 全通过。
- 仓内三路构建一致性：`pnpm build:all` 与 `verify-runtime-parity.mjs --root . --distribution st-distribution --preview public` **60 文件 SHA-256** 全通过（主包 **769691 bytes**，SHA-256 `d4db859d9d9bfec119a628748aa8c4d8411fb5ecaab30a84e0f0ff87f8984972`）。

## 遗留事项

- 工作区改动待维护者审阅确认后提交，并按需通过 `release-full.mjs --publish` 同步至 `../st-stage-ext`；[暂缓事项](../DEFERRED.md)与[外部环境验收](../EXTERNAL-ACCEPTANCE.md)继续保留。
