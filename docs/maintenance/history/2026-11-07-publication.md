# 五阶段演进与复审修复发布

用户明确授权合并、提交、推送和同步安装仓库。检查时仅有 `main`，全部实现位于该工作区，没有待合并功能分支或附属工作树。开发远端基线 `2b642a416924b301d8b0bd0def9cdf92dbaa540b`，安装远端基线 `6e6eb9593b8bbc9bf93baeda88d1dd9395b1f156`；两仓 fetch 与远端查询均确认没有新增变更。

## 发布结果

- 开发代码/产物提交：`9eeeb44b66bc9967921300bd6c0559862b6baf12`，包含五阶段功能和全部复审修复，已正常推送至 `LYC619/st-stage` 的 `main`。
- 安装仓库提交：`eaa9ca333348084b72767fcd7b64de62486f19b8`，已正常推送至 `LYC619/st-stage-ext` 的 `main`。
- 发布版本：`0.9.0+202611071003`；主包 614748 bytes，SHA-256 `b35358be6cc134914f2092730e79cd8f8ff6fe14b81b71f2c81e4ef560343840`。
- 实际调用 `pnpm release:full` 准备候选，再以 `--resume --publish` 完成备份、同步、提交及双仓推送。回执状态为 `complete`，`sourcePushed` 与 `releasePushed` 均为 true。没有强推。
- 安装仓库新增两个哈希分块，更新 bundle/style/version；60 个分发文件与根目录、分发、预览及验收候选一致。

本地完整回执：`test-results/publication-2026-11-07/release-full.json`；候选/逐文件哈希：同目录 `candidate/`；安装仓库原文件与同步回执：同目录 `backup/`。原验收候选 `test-results/review-fixes-2026-11-07/candidate-1003/` 保留。

## 发布验证

固定 `ST_STAGE_BUILD_TIME=2026-11-07 10:03`、`VITEST_MAX_WORKERS=2` 执行真实发布准备流程。类型、lint、119 文件/1470 项单测、855 翻译键/931 源引用、25 项发布工具测试及 Next 生产构建均通过；重建三个通道的全部 60 文件 SHA-256 与已验收候选完全相同。

提交后 `verify-runtime-parity.mjs --committed` 在真实开发仓库通过，确认新分块确已进入 HEAD；同步后含安装仓库的四通道 parity 通过。发布工具在每次推送后用 `ls-remote` 核对远端提交，最终两仓工作区干净。维护记录以单独文档提交补充，不改变已验收产物。

发布流程日志：`test-results/review-fixes-2026-11-07/publication-prepare.log`、`publication-push.log`。真实 ST 微信 104 项、移动 E2E 25 项、导出四场景和 44 次微信 axe 扫描的证据仍属于同一字节完全一致的版本，见 [修复验收](2026-11-07-five-phase-repairs.md)，本次不重复启动浏览器服务。

## 保留边界

GitHub Actions 状态未能通过当前可用 API 认证读取，因此只确认远端提交已到达及本地等价检查通过，不宣称远端 CI 已通过。真实 AI、音频供应商、实体设备/OS 输入法、完整读屏和历史 axe 不确定项仍按原记录保留。双仓发布不等于这些环境验收完成。

原 18771 测试入口和数据保留，未更新日常 SillyTavern 安装；同步对象是独立的 `st-stage-ext` Git 安装仓库。本次未新建工作树或临时服务。
