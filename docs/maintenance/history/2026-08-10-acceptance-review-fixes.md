# 2026-08-10 CC 审查复核与修复

## 结论

CC 审查意见总体接受，但按影响分层处理。预设本地化、删除路径安全性与失败可重试属于发布前必须修复；Prompt 取舍和解析器宽松度属于产品语义校准；官方删除 API 契约已通过 SillyTavern `release/src/endpoints/images.js` 源码复核，真实 ST 网络行为仍保留在验收清单中。

## 已修复

1. 批量管理不再把预设包排除在选择之外。全选包含预设；上传云端、保存本地、复制分享串均可作用于预设；删除按钮只统计和删除非预设包。预设保存本地时保留原始远程预设，并生成带“（本地）”后缀的普通图包副本，替换当前绑定，确保 ST 设置持久化后仍使用本地图片。
2. 删除路径统一由 `core/sprite-store.ts` 解码一次、再规范化反斜杠并检查 `/user/images/` 范围；适配器复用同一个安全校验 helper，不再二次解码。`%25`、编码反斜杠和目录穿越均有回归测试。
3. 删除物理文件改为先完成全部请求，再提交图包元数据。失败时保留图包，用户可以重试；SillyTavern 端对 404 按“文件已经不存在”处理，避免部分成功后重试被已删文件卡住。
4. 两段地址解析增加精确服装优先级，避免短服装名被角色名的模糊匹配遮蔽。
5. 移除 `getPresetPacks` 的无效 `baseUrl` 参数；修正三份计划/规格文档的 EOF 空行，使提交区间 `git diff --check` 与工作区检查一致为绿。
6. Prompt UI、App 说明、类型注释和用户指南改为如实说明：角色级相对地址格式只要短于全量就优先；否则在旧场景压缩和全量格式中取更短者。解析器比 Prompt 生成条件更宽松是有意的兼容策略。API fixture 的定位记录为已对照官方源码的回归守卫，不宣称其独立证明上游正确性。

## 官方 API 复核

SillyTavern release 源码的 `/api/images/delete` 路由要求请求体 `{ path }`，路径是相对用户根目录的 `user/images/...`；文件不存在返回 404，存在时删除后返回 200。当前适配器的 `path.slice(1)` 与该契约一致。真实 ST 第 10-12 项仍需维护者在 Network 面板和实际用户图片目录中确认。

## Fresh Verification

- Vitest：54 files / 631 passed。
- TypeScript `tsc --noEmit`：通过。
- ESLint：通过。
- 扩展构建测试：15/15 通过。
- Next.js 16.2.6 webpack production build：通过。
- Mobile Playwright：Pixel 7 与 Galaxy S8 共 22/22 通过。
- 固定构建时间 `2026-08-10 19:11` 生成 `0.9.0+202608101911`；根目录与 `st-distribution/` 的 `index.js`、`bundle.js`、`style.css`、`version.json` SHA-256 一致。
- `st-distribution/` 共 6 个文件，图片、`public/`、`reference/`、预设源命中数为 0。
- 工作区 `git diff --check` 与 `origin/main..HEAD` 提交区间检查通过。

## Boundary

分支为 `codex/acceptance-round2`，代码提交 `3582644`；未合并、未推送。真实 SillyTavern 模型输出、流式注入、图库文件实际删除/本地化和四个常用 API 渠道仍未标记为完成。产品语义版本仍为 `0.9.0`，待真实验收通过后再决定 `1.0.0`。
