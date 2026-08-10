# 2026-08-10 第二轮验收分支合并推送

## Boundary

- `codex/acceptance-round2` 已以 `--ff-only` 快进合并到 `main`。
- 合并后的 `main` 已推送到 `origin/main`，集成提交为 `9e5b4d1`。
- 产品版本仍为 `0.9.0`，构建戳为 `0.9.0+202608101952`；本次不升到 `1.0.0`。
- 验收分支保留，未删除；没有强制推送或其他破坏性 Git 操作。

## Verification Before Push

- 合并前验收分支：Vitest 54 files / 634 passed，TypeScript、ESLint 通过。
- 合并后主分支：Vitest 54 files / 634 passed，TypeScript、ESLint 通过。
- 构建器测试 15/15、Next.js webpack 构建和移动端 Playwright 22/22 已在合并前最终代码上通过。
- 根目录与 `st-distribution/` 的共享产物 SHA-256 一致；分发目录为 6 个安装文件且不含图片、`public/` 或 `reference/`。
- 合并前 `origin/main..HEAD` 可快进，提交区间 `git diff --check` 通过；合并后工作区干净并与 `origin/main` 同步。

## Next Boundary

维护者现在从 `main` 安装或更新扩展，按 `docs/maintenance/CURRENT.md` 的 20 项真实 SillyTavern 清单实测。真实模型输出、缓存更新、图库文件 API、本地保存和四个常用 API 渠道仍未标记完成。仅修复真实验收暴露的问题；全部阻断项通过后，再决定 `manifest.json` 的 `1.0.0` 升版并重新执行发布门禁。
