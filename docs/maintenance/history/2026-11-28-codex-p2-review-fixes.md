# Codex 审查 3 项 P2 缺陷修复、全量回归与双仓发布（2026-11-28）

## 基线与交付边界

- 分支 `main`，产品与回归测试提交 `65b06b33ddfcec009b11a3a8b7ce43fc3d7806be`（基于 `2fe00e1`），正式发布构建提交 `fe8c356ccde5e61de574e622ea35bf742cdb5ff2`，已推送至 `origin/main`。
- 正式版 **0.9.0+202611281322**；通过 `release-full.mjs --publish` 同步至 `../st-stage-ext` 并推送（提交 `b5905e95bab6c93a1fc18b728309a277158869dd`，更新 `bundle.js`、`version.json` 共 2 个文件，其余 58 个文件不变）。
- 四处（根目录、`st-distribution/`、`public/`、`../st-stage-ext`）已通过 `verify-runtime-parity.mjs --committed` **60 文件 SHA-256** 一致性校验；主包 **769691 bytes**，SHA-256 `12b1d9eb91fa4380938b478b162eb6f1c2b33e808204747c29ad5a37e2ae6b4d`。发布回执与备份留存于 `test-results/codex-p2-publication-2026-11-28/release-full/`。

## 改了什么与为什么

1. **STAGE-001 · 20 字符上限标签冲突改名与回导保真**（`core/pack-split.ts`）：原 `autoRenameTag` 直接截断 `${desired}_${i}` 至 20 字符，在原标签满 20 字符时始终退回旧名并落入未截断的 29 字符时间戳后缀，`importPack` 回导规范化时与旧标签撞车去重丢图。现改为先按后缀长度截短基础名（避开孤立高代理项与尾随空白）再拼接 `normalizeTag`，循环与多轮时间戳兜底均保证长度 `≤ 20` 且规范化形式唯一；`planUploads` 同步记录归一化占用集合并跳过空标签占位。
2. **STAGE-002 · 网页体验台异步上传陈旧状态覆盖修复**（`components/config-panel.tsx`、`core/sprite-store.ts`、`app/page.tsx`）：原 `handleUpload` 在压缩与图床上传完成后把触发时闭包捕获的旧 `settings` 与 `pack` 整包回写，回滚上传期间的设置切换与新建图包，且并发上传会互相覆盖。现由 `core/sprite-store.ts` 导出 `findSameSprite`，`ConfigPanel` 通过最新设置引用在每次异步落盘前重新定位目标包并按立绘三级身份增量合并（`app/page.tsx` 同步支持函数式更新）；目标包被删或同身份立绘被外部修改时安全提示冲突，绝不复活已删包或覆盖其他配置。
3. **STAGE-003 · 新变量设计器编辑期间删除前序行写错目标修复**（`st-extension/src/apps/newvar/designer.ts`）：原设计器仅用 `editingIndex` 定位编辑项，打开 `B` 编辑期间删除前序行 `A` 后未递减索引，保存时覆写 `C`（不改名时还会误触发重名拦截）。现引入稳定身份 `editingKey` 配合 `resolveEditingIndex`，删除行时同步维护索引/清空被删编辑项，渲染选中态与保存提交前均复核目标路径身份。

## 验证与遗留

- `release-full.mjs` 全量门禁：**112 文件／1273 单测**（`vitest.config.ts` 已纳入 `components/**/*.test.{ts,tsx}`）、**26/26** 发布工具测试、`tsc --noEmit --incremental false` 零错误、`eslint` 零警告、i18n **874 键／964 引用**、内置 App 文档 **13 项**、Next 生产构建及四处 `--committed` **60 文件 SHA-256** 全通过。
- 已完成双仓 `main` 提交与推送；[暂缓事项](../DEFERRED.md)与实体设备/商业模型等[外部环境验收](../EXTERNAL-ACCEPTANCE.md)继续保留。
