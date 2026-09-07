# 2026-09-05 修复计划交接记录

## 状态

- 本记录对应维护规划阶段，不包含产品源码、测试、生成产物、用户 settings、用户备份、发布仓库或 Git 提交的修改。
- 代码基线仍为 `a942d5708e5cdb32921709d11d401985b3dddbe3`；发布仓库审查基线仍为 `d6e8a892dbb7529a5b5fc8f53e4443e1bc33c03b`。两者是审查证据，不是本记录产生的新代码提交。
- `verified_code_head` 的 staleness 检查在本次规划前已通过；计划阶段未修改产品文件，因此没有新的代码 head 可记录。

## 交接内容

已形成五个串行执行批次：

1. A：图片物理文件安全、上传成功契约、`inventoryPrompt` 往返和 TypeScript 门禁。
2. B：标准备份目录/ZIP 冲突拒绝和搜索输入节点稳定性。
3. C：备份优先的旧 base64 迁移、迁移回执、JSON 导入的全量落盘后安装。
4. D：变量 HUD 按展开面板真实尺寸钳位、真实 Edge 回归、搜索逐键/IME 回归。
5. E：全套测试、根目录与 `st-distribution` 产物 parity、只读发布仓库比较和发布决策边界。

计划文件：

- `docs/superpowers/plans/2026-09-05-maintenance-repairs.md`
- `docs/superpowers/plans/2026-09-05-image-safety.md`
- `docs/superpowers/plans/2026-09-05-backup-reliability.md`
- `docs/superpowers/plans/2026-09-05-storage-migration.md`
- `docs/superpowers/plans/2026-09-05-hud-release-gates.md`

批次 C 的示例接口已与批次 A 统一：manager 注入 `saveDataUri(dataUri, options)`，由适配层调用 `persistSTImage(dataUri, deps, options)`；没有把现有三参数 `PlatformAdapter.saveImage` 扩成不存在的四参数接口。

## 下一步

等待用户明确授权后，由当前代理按 A → B → C → D → E 单线程实施。授权前不修改产品代码、不迁移任何真实 settings、不重建正式发布产物、不复制或清理发布仓库、不提交、不推送。完成实施后再用真实测试和实际 hash 更新本记录及 `CURRENT.md`；当前所有 R1–R8/S1 仍保持未修复、未接受发布风险。
