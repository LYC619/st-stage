# Shared Agent Guidance

Before changing this repository:

1. Read `docs/maintenance/CURRENT.md` and `docs/maintenance/PROTOCOL.md`.
2. Validate `verified_code_head` from `CURRENT.md` using the staleness check in `PROTOCOL.md`.
3. If code changed after that commit, reconcile the status from Git and `docs/maintenance/history/` before implementation.
4. Read `docs/maintenance/DEFERRED.md` when the requested scope may overlap a deferred item.

Git is the primary source of truth. Agent-private memory, old chat summaries, and attachments are supporting context only. At a handoff or merge boundary, update the shared maintenance documents according to `PROTOCOL.md`.

## 计划与执行

功能批次的计划在 `docs/superpowers/plans/` 里。执行时以计划为准：

- 只做计划列出的内容；计划写了「不做」的不做。
- 计划没说清的地方，选最简单、改动最少的做法继续推进，并在 history 记录的「偏离计划」里写一句。不要因为想到一种可能的边界情况就扩大范围。
- 发现计划本身错了（接口不存在、做法行不通），停在当前批次，写明原因，不要绕着计划另起炉灶。

## 代码风格：检查只放在边界上

- 只在**外部数据进来的地方**做类型和存在性检查：SillyTavern 的 context/全局对象、读回来的设置和 chat metadata、网络响应、AI 返回的 JSON、用户输入。
- 项目内部模块之间互相调用时，信任 TypeScript 类型，不重复 `typeof`/`Array.isArray`/`?? 默认值`。
- 不为没有发生过、计划也没要求的情况加分支、重试、回滚或兜底提示。一个 catch 能讲清楚的错误，不要拆成多层。
- 新函数先写最直接的版本；只有测试或真实问题证明需要时才加防护。
- 同一个检查不要在调用方和被调用方各写一遍。

## 验证：跟着改动范围走

- 每批必跑：相关单测、`pnpm typecheck`、`pnpm lint`、`pnpm build:ext`。
- 改了手机壳、共享样式或触摸交互时加跑 `pnpm test:mobile`。
- 四种尺寸的完整浏览器验收、axe 扫描、产物 parity 只在**准备发布**时跑，不在每批跑。
- 测试只写能抓住真实回归的用例；不为每个防御分支写测试。

## 文档：短、写结论

- 每批一篇 history，**不超过 40 行**，固定四段：改了什么 / 为什么 / 怎么验证的 / 遗留与偏离计划。参考 `docs/maintenance/history/2026-11-08-ux-review.md` 的写法。
- `CURRENT.md` 正文不超过 25 行，只写当前状态，不写过程。
- 环境限制（真实模型、麦克风/TTS、实体手机、读屏、真实 MVU 尚未验证）只记在 `docs/maintenance/EXTERNAL-ACCEPTANCE.md`，其他地方需要时链接过去，不要重复。
- `DEFERRED.md` 只放**仍未解决**的事项。解决了就删掉，历史由 Git 保留。
- 不写免责句（「不等于」「不能据此宣称」「不代表」之类）。没验证的事列成一条就够了。
- 写给人看的说明用中文、短句、先说结论。
