# 第二轮 · 批次 0：合并夜间分支与收尾

## 要做的

1. 工作区里有 Claude 审查时的未提交修复（`st-extension/src/apps/theater/generate.ts` 和 `generate.test.ts`）：小剧场只要求正文类字段，装饰字段缺失时留空；所有条目都不合格时报「格式不对」；AI 没给直播时保留上一场。在 `codex/overnight-2026-11-09` 上提交，信息 `fix(theater): accept partial AI posts and keep previous live show`。
2. 剧情状态：背包道具的「使用」草稿只在 `数量 > 1` 时写「（剩余 ×N）」。改 `st-extension/src/apps/story-state/drafts.ts` 和对应测试。
3. 单测并发：在 `vitest.config.ts` 的 `test` 里加 `maxWorkers: 2`（Vitest 4，只需这一项），旁边一行注释说明原因。原因：默认并发下微信设置类测试会集体超时，夜间和审查时都出现过。
4. `pnpm build:ext`，提交 `chore: rebuild after overnight review fixes`。
5. 合并到 `main`：`git switch main && git merge --no-ff codex/overnight-2026-11-09`。
6. 合并后在 main 上跑 `pnpm vitest run`、`pnpm typecheck`、`pnpm lint`、`pnpm test:mobile`。
7. 更新 `CURRENT.md`：phase 改为 `round2-in-progress`，正文写「夜间批次已合并到 main，未发布」。

## 推送与发布

只有用户在 goal 提示里明确写了「发布」才做：按 `docs/RELEASE.md` 用 `pnpm release:full`。没写就不推送。

## 不做

- 不删除 `codex/overnight-2026-11-09` 分支。
