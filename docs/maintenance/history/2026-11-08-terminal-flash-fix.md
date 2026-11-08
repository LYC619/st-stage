# 2026-11-08 SillyTavern 测试服务终端闪窗修复

分支 `main`，基线 HEAD／origin/main `0bf8ae2444000b92058d015bea9b2e0168801f70`。CURRENT 的 `verified_code_head` 祖先检查与排除维护文档的提交差异检查均通过。工作区已有其他批次的未提交产品、构建及文档改动，本次仅修复本地测试运行环境，未提交、未推送、未重建产品。

## 原因与证据

凌晨的 Codex 沙箱错误与本次闪窗无直接关系。本次 14:02:54—14:03:46 的窗口事件监听捕捉到 18774 测试实例（PID 4444）多次启动 `cmd.exe /d /s /c "where "git""` 并显示 Windows Terminal。调用链是 `/version` → `src/util.js:getVersion()` → `command-exists@1.2.9`。依赖的 Windows 同步／异步执行选项未设置 `windowsHide`。

该测试实例的 node_modules 经目录联接最终指向日常安装 `D:\6.YULE\ST\SillyTavern-1.18.0\node_modules`。本次未修改该共享依赖。

## 改动

- 新增 `scripts/fix-st-terminal-flash.mjs`，导出 `ensureSilentCommandExists(runtime)`，也支持 CLI：`node scripts/fix-st-terminal-flash.mjs <runtime目录>`。检查依赖版本及源码形态后，将添加了 `windowsHide: true` 的独立副本写到该 runtime 的 `src/command-exists-silent.cjs`，并调整 `util.js`、`plugin-loader.js`、`git/client.js` 的导入。保留原行为和原文件备份，可重复执行；不写入共享 node_modules。依赖升级后版本保护会要求重新审核，不静默应用不匹配补丁。
- 已应用到 `test-results/wechat-social-upgrade/runtime`、`test-results/ux-review-2026-11-08/runtime`、`test-results/ux-follow-up-2026-11-08/runtime`，三个对应 `start-runtime.mjs` 在建立依赖联接后自动调用修复函数。新建其他测试实例时同样调用该函数，或从已修复的 src 复制。
- 被替换的 runtime 源文件旁保留 `.before-terminal-flash` 备份。启动脚本备份保存在诊断目录。
- 仅将 18774 服务从 PID 4444 重启为 PID 40016，保留原 runtime、端口与 `../data` 参数，隐藏启动后 HTTP 首页恢复 200。未通过原启动脚本复制或重置扩展、候选、数据。

## 验证

- 隐藏版命令检测：同步、Promise、callback 查找 Git 成功；不存在的命令同步返回 false、Promise 拒绝。
- 三个修改后的启动脚本均通过 Node 语法检查。
- 修复脚本第二次运行返回 `changed: false`、`updatedImports: []`，确认幂等。
- 14:13:39—14:13:47 连续请求 10 次 `http://127.0.0.1:18774/version`，全部 HTTP 200，版本 1.18.0。
- 14:13:28 开始的 50 秒真实 Windows 窗口事件监听：仍捕捉到服务执行 Git 检测，但可见终端显示事件为 0。
- 修复后的独立副本 SHA-256：`f0d5c6d2e6453257712d11469174b801e62e107ea4a80d94f57330fa8618ef20`。

本次无需重跑扩展产品的全量测试；验证范围为实际后台子进程窗口、Git 探测行为和版本接口。未声称未修改的日常安装或其他第三方程序已修复。

## 本机证据与恢复

诊断目录：`D:\8.Project\9.中转区\.diagnostics`。

- `window-events-20261108-140346.json`：修复前。
- `window-events-20261108-141418.json`：修复后窗口及进程事件。
- `terminal-flash-version-verification.json`、`terminal-flash-fix-result.json`：版本请求和验证摘要。
- `terminal-flash-restart.json`：重启身份和日志路径。

如需回退，恢复三个 runtime 源文件的 `.before-terminal-flash` 备份和各启动脚本备份，再重启对应测试服务；原共享依赖始终保持原样。新增修复脚本及维护说明保留未提交；test-results 下的本地改动被 Git 忽略。
