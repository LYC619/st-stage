# 双仓发布

`pnpm release:full` 从干净的开发仓库 `main` 开始，运行类型、lint、单测、翻译、发布工具、Next 构建和三个通道的扩展构建，再生成候选目录与 SHA-256 清单。默认只准备候选；实现改动应先经过审查并提交，命令只自动提交构建产物。

安装仓库必须是独立的 `st-stage-ext` checkout，位于 `main`，无未提交改动，且 HEAD 等于 origin/main。开发分支可领先 origin/main，但不能落后或分叉。命令检查 fetch/push URL，默认分别为 `https://github.com/LYC619/st-stage.git` 和 `https://github.com/LYC619/st-stage-ext.git`。非默认克隆路径或远端使用显式参数。

```powershell
pnpm release:full --release ../st-stage-ext --output test-results/release-YYYYMMDD-HHMM
pnpm release:full --release ../st-stage-ext --output test-results/release-YYYYMMDD-HHMM --resume --publish
```

第一次命令会改变本地构建文件；第二次复用已验证候选，检查远端及工作区漂移，提交开发构建、备份并同步安装仓库、提交安装版本，然后依次正常推送两个 main。不会强推。版本仍使用 `0.9.0+YYYYMMDDHHmm`；如需固定构建时间，可设置 `ST_STAGE_BUILD_TIME='2026-11-07 01:38'`。

`--output` 应使用新的被 Git 忽略目录，推荐 `test-results/`。`candidate/package/` 是可安装包，`candidate/release-report.json` 保存逐文件哈希，`backup/` 保存安装仓库原文件和同步回执，顶层 `release-full.json` 记录基线、两个提交和每一步状态。提交前必须保留这些本地证据；其中不应保存密钥或聊天数据。

## 中断恢复

- `prepared`：可以检查候选后用相同参数 `--resume --publish`；不会重新构建。
- 第一仓已推送、第二仓失败：排除网络或权限问题后使用相同恢复命令。回执和远端 HEAD 双重核对，成功的提交不重复创建。
- 同步出现异常：先检查 `backup/sync-report.json`。同步工具会尝试回滚；回执不是 `applied` 时发布停止，需依原文件备份核对恢复后再建立新的候选。
- `checking` 中断：保留回执，审查工作区的构建改动。恢复到明确、干净的已审查状态后，使用新的输出目录重新运行检查。
- 强制终止恰好发生在 Git commit 成功、回执尚未写入之间：工具拒绝自动认领不匹配的 HEAD。核对 Git 日志、候选哈希和两个远端，再由维护者决定接续记录或建立新批次；不要盲目改写回执或回退已发布历史。
- 任一仓库出现无关改动、候选被修改或远端前进：停止发布，先审查差异。`--resume` 不绕过检查。

主包必须小于 1,000,000 bytes。`chunk-*.js` 与主包、样式、locales、50 个微信资源一起分发；清单验证缺失、孤立或跨通道不同的分块。安装时复制完整候选目录，不能只替换 `bundle.js`。JSZip 分块在第一次生成 ZIP 时从本地安装目录读取；旧的哈希分块由构建/同步工具处理。

CI 重建后执行 `verify-runtime-parity.mjs --committed`，核对三个通道的完整产物均存在于 HEAD，并检查暂存及未暂存的产物变化，防止新生成的未跟踪分块掩盖漏提交。准备未提交候选时使用普通 parity 校验；只有提交完整产物后才应通过 `--committed`。

`pnpm test:release` 使用临时本地 Git 双仓和 bare remote，覆盖完整发布、备份、部分推送失败恢复、脏目录、错误 origin、检查失败、远端漂移及候选篡改。它不推送真实 GitHub 仓库。当前候选及是否实际发布见 [共享状态](maintenance/CURRENT.md)。
