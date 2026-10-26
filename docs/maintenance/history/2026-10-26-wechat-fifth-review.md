# 2026-10-26 微信第五次审查（第四轮修正复核）

## 结论与范围

审查 [第四轮修复](2026-10-26-wechat-round4-repairs.md) 后的未提交工作区，构建 `0.9.0+202610260159`。上一轮五项发现的修复均通过独立复核，本次限定范围内未发现新的阻塞问题。可进入真实 SillyTavern 环境验收；本结论不代表实机、提交或发布完成。

本轮集中验证上一轮明确缺陷及修改的直接回归，没有重新扩大到已通过的无关功能。保留业务代码、测试与构建产物，只更新维护记录。

## 五项修复复核

| 原发现 | 本轮证据 | 结论 |
| --- | --- | --- |
| W9 / P1：测试回调类型不兼容 | deferred resolver 与消息回调匹配 AppHost 契约；全工作区 `tsc --noEmit --incremental false` 退出 0 | 通过 |
| W4 / P2：同会话旧读取覆盖新快照 | 初始读取挂起，变量事件的新读取先返回 mood=96；旧读取再返回 82，保存状态与 DOM 均保持 96 | 通过 |
| W1c / P2：等待本地评估期间外部接管失效 | 初始仅外部 money=1000；发送后确认 `requestStatImpact` 已进入挂起状态，再用变量事件接管 mood=82、interest=35；返回 +0.4/+0.4 后仍为 82/35，正常角色回复也保留 | 通过 |
| W1c / P2：红包篡改外部钱包 | 外部 mood=82、interest=35、money=1000，点击 20 元红包后消息成功入库，钱包仍为 1000 且外部字段标记保持 true | 通过 |
| W1a / P2：无效首候选遮蔽角色别名 | `{Alice:{mood:'calm',happiness:[82,'note']},mood:12}` 返回 82；空 location 不遮蔽角色 place。独立复核也验证宿主读取链路、stat_data、tuple、零值/负数及角色过滤 | 通过 |

上述业务复现使用当前源码的内存 esbuild 编译和 jsdom 挂载，注入宿主接口与实际订阅的 `mag_variable_update_ended` 事件。Promise 返回顺序由夹具控制，LLM 回复与状态评估仅用桩替代；未调用真实 LLM，未写入业务源码或新增测试文件。

运行时一致性测试仅将 describe 的 timeout 调为 15000ms，断言与执行路径未减弱。本轮全量测试未出现上轮超时；单次通过不能证明未来绝不超时。

## 新鲜验证证据

1. `pnpm test -- --reporter=dot --silent`：91 文件 / 1219 测试全部通过，退出 0，约 43.03 秒；包含 29 项微信测试。
2. `pnpm exec tsc --noEmit --incremental false`：退出 0，无类型错误。
3. `pnpm lint`：退出 0。
4. 根目录与 `st-distribution` 的七个运行文件（manifest、index、bundle、style、version、两个 locale）SHA-256 全部一致，版本为 `0.9.0+202610260159`。
5. `assets/`、`public/assets/`、`st-distribution/assets/` 各 50 文件，文件集合与 SHA-256 三处一致。
6. 上表四个业务补充复现全部通过；别名与测试契约还经过独立审查者只读复核。

本轮未执行扩展或 Next 生产构建。上一轮修复报告记录的 Next 构建通过保留为历史证据，不计为本轮新鲜验证。哈希一致性确认当前两套安装产物一致，不等同于真实 ST 安装验收。

## 仍待验收

- 真实 SillyTavern 中的角色/聊天切换、MVU 状态结算同步、主聊天上下文连贯性及素材加载。
- 物理设备的输入法与窄屏交互。
- 维护者决定如何提交未提交修改、处理未合入分支及同步独立分发仓库。W1–W9 按协议保留在 DEFERRED，不能因本轮通过就删除。

## Git 与交接

`main` / HEAD `25d62bd79860dc592cce8adf666882cb8e994400`，本地 `origin/main=1989c2fab99a28b8b204073bcb32f59b73800079`，领先 2 提交。本轮未 fetch 或验证远端。`verified_code_head=26a40d8c142eae9bd17dc5cc59efe5f682e090c7` 的祖先检查与排除文档后的已提交产品差异检查均退出 0；该基线不包含本轮未提交微信功能。

开始时已有手机壳/注册表/入口、构建脚本与测试、bundle/style/version、locale、README 和维护文档修改；微信目录、三处 assets、`.user/` 与多份维护记录为未跟踪内容。本轮仅更新 CURRENT、DEFERRED 并新增本记录，移除 CURRENT 中重复且过时的待修问题块，并补齐当前发布需携带微信 assets 的说明。未修改业务代码、测试、素材或构建产物，未提交、合并、推送或改动独立发布仓库。
