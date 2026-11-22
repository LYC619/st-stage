# Shared Agent Guidance

Before changing this repository:

1. Read `docs/maintenance/CURRENT.md` and `docs/maintenance/PROTOCOL.md`.
2. Validate `verified_code_head` from `CURRENT.md` using the staleness check in `PROTOCOL.md`.
3. If code changed after that commit, reconcile the status from Git and `docs/maintenance/history/` before implementation.
4. Read `docs/maintenance/DEFERRED.md` when the requested scope may overlap a deferred item.

Git is the primary source of truth. Agent-private memory, old chat summaries, and attachments are supporting context only. At a handoff or merge boundary, update the shared maintenance documents according to `PROTOCOL.md`.

## 协作与任务推进

- **交互式开发**：需求清晰时直接选择最简洁、低侵入的方案推进；需求存在关键分歧时先向用户确认，不盲目猜测。
- **按计划执行**：若任务明确指定执行 `docs/superpowers/plans/` 下的某份批次计划，按计划边界执行；发现接口或前提不成立时如实说明原因并调整，不硬套失效假设。
- **跨仓库发布边界**：`st-stage` 是源码与网页模拟器仓库；根目录、`st-distribution/` 与 `public/` 存放同时间戳扩展构建产物；`../st-stage-ext` 是面向用户的轻量安装仓库。未获明确发布授权时，不修改或推送 `../st-stage-ext`。

## 代码与模块整洁

- **边界校验**：只在**外部数据入口**做类型与存在性检查（SillyTavern `context`/全局对象、持久化设置与 `chatMetadata`、网络响应、AI 返回 JSON、用户输入、局域网非 HTTPS 浏览器 API）。内部模块之间信任 TypeScript 类型，不层层重复防御。
- **拒绝静默吞错**：除了存储可用性探测或纯格式校验外，禁止写无日志、无反馈的空 `catch {}`。后台任务、导出、图片处理或宿主同步失败时，必须保留 `console.warn` 或向界面给出明确状态反馈。
- **单一职责模块**：新功能拆清「纯数据/协议逻辑」与「DOM 视图」，样式按域放入 `st-extension/styles/`（壳层公共样式在 `core/phone-shell.css`），避免堆出数千行混杂单文件。

## 验证与产物同步

- **日常迭代必跑**：相关单测、`pnpm typecheck`、`pnpm lint`。
- **文案与内置 App 变动必跑**：`node scripts/verify-i18n-completeness.mjs`（保持源码 `t(key, fallback)`、`zh-CN.json`、`en-US.json` 三端一致）与 `node scripts/verify-docs-apps.mjs`（保持内置 App 清单与 `README.md` 同步）。
- **改了手机壳、共享样式或触摸交互加跑**：`pnpm test:mobile`。
- **提交扩展源码或样式改动前后**：运行 `pnpm build:all` 同时间戳更新根目录、`st-distribution/` 与 `public/`（注意一并暂存新增或移除的 `chunk-*.js`），提交前跑 `node scripts/verify-runtime-parity.mjs --root . --distribution st-distribution --preview public`，提交后跑 `node scripts/verify-runtime-parity.mjs --committed --root . --distribution st-distribution --preview public` 校验暂存无漏。发布前再跑 `pnpm test:release` 与 `pnpm release:prepare`。

## 维护文档与文案风格

- **维护记录**：每轮重要交付在 `docs/maintenance/history/` 留一篇简明记录（建议 40 行左右，涵盖：改了什么 / 为什么 / 怎么验证的 / 遗留事项，参考 `docs/maintenance/history/2026-11-14-round2-closeout.md`）。
- **状态同步**：`CURRENT.md` 正文保持精炼（25 行左右），只写当前状态与有效提交哈希；未完成的外部环境验证集中记在 `docs/maintenance/EXTERNAL-ACCEPTANCE.md` 并链接引用；`DEFERRED.md` 只保留仍未解决的事项，解决即删。
- **界面文案语感**：系统与工具设置写直白人话，少用开发黑话与生硬翻译腔；剧情与陪伴类 App 保持自然、鲜活的酒馆生活感。
