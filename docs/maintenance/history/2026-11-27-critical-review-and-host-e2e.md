# 多子代理批判性审查、真实宿主验收、测试大瘦身与双仓发布（2026-11-28）

## 基线与交付边界

- 分支 `main`，产品与测试瘦身提交 `3ab47c942d0faf4e1807538b264c2dad84f54bda`（基于 `892f14c`），正式发布构建提交 `bc5e03ee9c80c9d430ab376766cbfa79d4969d6c`，已推送至 `origin/main`。
- 正式版 **0.9.0+202611280949**；通过 `release-full.mjs --publish` 同步至 `../st-stage-ext` 并推送（提交 `96be608348173fb3059cda7ddeb17adca1dacea4`，更新 `bundle.js`、`version.json` 共 2 个文件，其余 58 个文件不变）。
- 四处（根目录、`st-distribution/`、`public/`、`../st-stage-ext`）已通过 `verify-runtime-parity.mjs --committed` **60 文件 SHA-256** 一致性校验；主包 **768693 bytes**，SHA-256 `36758b9eb09cf7318ee4a19220a643f5b0ba35d3910e157c5206578044cb2663`。发布回执与备份留存于 `test-results/critical-review-publication-2026-11-28/release-full/`。

## 改了什么

1. **安全与立绘导入导出**：`image-persistence.ts`、`sprite-localize.ts` 拦截可执行 `image/svg+xml` 同源落盘；`core/pack-io.ts` 校验栅格 `data:`、无凭据 `http(s)` 与受控本地路径，`urlToDataUri` 强制位图 MIME；补齐 `story-image-capture.ts` 警告详情与 `appearance-app.ts` 文件输入重置。
2. **API 与幕后 AI**：`api/bridge.ts` 草稿新 Key 优先直连 `/models`、跨域回退 `/status` 后旋转恢复原密钥 ID 并删除临时 ID，写后端密钥后清空 `#api_key_*` 消除双倍写入；修正 `api/core.ts` 5 个渠道 `#model_<id>_select` 与嵌套错误提取；`api/manager.ts` 绑定异步草稿存活态；`story-ai.ts` 补全已知官方裸域名端点。
3. **叙事与陪伴模块**：`chronicle/calendar.ts` 与 `calendar-controller.ts` 阻断空/错配结果覆盖既有七天日历、无 AI 不锁死 `lastCheck`；新增 `StorySwitchedError` 消除纪要/手账/剧场/朋友圈共 8 处切聊天误报警告与错误残留；补齐「设为剧情今天」异常提示与星期同步、整理期间修订合并与草稿焦点保留、`butler-app.ts` 卸载落盘拦截、`theater` 前台消角标与裂图回退。
4. **变量隔离、壳层深链、导出与焦点性能**：`mvu-app.ts`、`newvar-app.ts` 切聊天清空编辑态并在提交前复核会话身份，`newvar/runtime.ts` 清空跨聊天 `lastParse`；`variable-tree.ts` 校验 `isSafePath`；`message-postprocess.ts` 前移 `decorateImages`；`export-app.ts` 单聊勾选联动关联世界书；`phone-shell.ts`、`index.ts`、`phone-mount.tsx` 补齐 `lifecycle.disposed` 保护、切聊天清角标/胶囊及 `tab` 深链；`core/dialog-focus.ts` 增加同轮祖先样式缓存与首焦点短路扫描。
5. **真实宿主 E2E 加固**：`scripts/test-st-host.mjs` 默认挂载 `st-distribution` 并在 `finally` 无条件先 `unlink` 断开 NTFS Junction、补齐 Windows 进程树清理；`host-e2e/host.spec.mjs` 修复重开手机进微信验草稿、`bounds()` 轮询收敛、移动端动态 viewport 刷新顺序及零 `[st-stage]` 警告断言。
6. **测试体系与历史脚本全面大扫除**：清理未跟踪 `.planning/` 废案与 `scripts/` 下已被 `test:mobile`／`test:host` 替代的 22 个旧 `verify-*-browser.mjs` 脚本（约 3750 行）并同步维护文档；消除纯英文翻译重复测试、源码 `indexOf` 脆弱断言、20 MiB 暴力解码及 1000 张立绘重绘循环；将微信（22→3）、管家（13→4）、共享/纪要/视口等碎片 `jsdom` 文件收拢并把纯逻辑测试切回 `node`，`vitest.config.ts` 放宽为稳健 `maxWorkers: 4`。

## 验证与遗留

- `pnpm test`：由 **151 文件／1677 项／197.95s** 精简提速至 **111 文件／1267 项／31.96s** 全通过（提速 6.2×）；`pnpm test:release` **26/26**；`pnpm typecheck`、`pnpm lint --max-warnings 0`、i18n **874 键／964 引用**、App 文档 **13 项**、Next 生产构建及四处 `--committed` **60 文件 SHA-256** 全通过。
- `pnpm test:mobile --workers=2`：**33/33** 通过；`pnpm test:host`：真实隔离 ST 1.18.0 + 酒馆助手 4.11.3 + MVU 桌面／手机 **2/2 全通过**（`test-results/host-acceptance-2026-11-27T06-50-43-836Z/`）。
- 已完成双仓 `main` 提交与推送；[暂缓事项](../DEFERRED.md)与实体手机/商业模型等[外部验收](../EXTERNAL-ACCEPTANCE.md)继续保留。
