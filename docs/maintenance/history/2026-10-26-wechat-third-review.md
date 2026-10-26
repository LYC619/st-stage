# 2026-10-26 微信第三轮审查：状态桥接与异步读取

## 范围与结论

复查 [第二轮修复记录](2026-10-26-wechat-round2-repairs.md) 对 W1/W2/W4/W5 的完成声明。审查对象为 `main` 未提交工作区，构建 `0.9.0+202610260058`。

本轮有实质修复：W2 的稳定存储键和迁移、W5 的完整资源分发已验证；W4 原先的 LLM 回复/状态评估切换保护也已补上。角色卡、首批聊天及平铺数值确实进入新桥接，不能再称为“只读取角色名”。但异步上下文读取与真实状态保持仍有可复现缺陷，新增角色头像 URL 回归。以下按六个可独立修复的问题记录；尚不能关闭全部适配事项。

## 1. W4 / P1：异步上下文与变量读取未绑定发起时的会话

位置：`st-extension/src/apps/wechat/wechat-app.ts:459-485`，尤其 `470-474`。

`switchScope` 会同时更新可变的 `currentScopeSession` 与 `activeScopeSessionId`，所以初始 `resolveConversationScope` 返回时比较这两者仍然相等，无法识别请求来自旧会话。角色切换后的变量刷新也有同样问题；`onMessageReceived` 的读取只在 await 前检查挂载状态，完成后不再检查。

受控复现：Alice 的首次变量读取延迟；切到 Bob 后先完成 Bob 的读取，页面为 Bob/22；最后完成 Alice 的读取，页面退回 Alice/82，而宿主仍在 Bob。另一个复现中，消息触发的变量读取在卸载后返回，旧会话状态仍从 82 改到 99。

修复需要给每次异步读取捕获不可变的挂载代次、作用域代次及作用域键，在完成后核对后再写回。不能只修复两个 LLM 调用；初始化、角色事件、消息事件的读取都必须遵守同一边界。

## 2. W1a / P1：字段未映射成功仍把默认值声明为真实外部状态

位置：`st-extension/src/apps/wechat/bridge.ts:64-78`（其他读取分支有相同逻辑）；`wechat-app.ts:113-121,403-415`。

当前只要变量对象非空，就返回非 none 来源；没有要求 mood/interest 等实际解析成功。数值仅接受标量数字/数字字符串，而仓库既有 MVU 视图明确支持 `[值, 描述]` 叶子（`apps/variable-tree.ts:26-31`），MVU bridge 会原样返回该 stat_data。嵌套角色树、描述元组、只有部分映射字段或只有无关变量时，其余默认值也会被统称为外部状态。

复现输入 `{ mood: [82, 'mood-note'], interest: [35, 'interest-note'] }`：页面显示 60/15，隐藏“独立”标识，并显示“已连接外部变量（host）”。提示词随后也把这些默认数值描述为外部状态。此处不能以非空变量包代替字段映射成功。

应按支持的数据形状解包，明确字段映射及逐字段来源，未映射字段保留独立/不可用标识；失去来源时也需要清理旧的 external 标记。并非要求猜测任意角色卡 schema，而是不得把没有读到的值冒充读到的值。

## 3. W1b / P2：主聊天与变量更新后，上下文不会完整刷新

位置：`st-extension/src/apps/wechat/wechat-app.ts:477-485`；`bridge.ts:204-212`。

消息事件只读取外部数值，没有重新获取 `stRecentMessages`。微信保持打开时，主 ST 对话追加的新内容不会进入后续微信生成提示词。变量方面仅监听消息到达，没有监听 MVU 更新结束/初始化、swipe 或删楼等事件。已有 `apps/mvu/bridge.ts:309-337` 的 `subscribeVarEvents` 覆盖这些事件，但新微信没有使用。

仓库参考源码支持此时序风险：`reference/MVU/MagVarUpdate-beta/src/function/update/index.ts` 在 MESSAGE_RECEIVED 上触发更新处理，`on_message_received.ts` 可异步等待额外模型；更新结束另发 `mag_variable_update_ended`。因此先收到消息并不保证变量已结算。

复现：挂载时外部心情 82，追加新的主聊天标记并发消息事件；随后将外部值改为 96 并发变量更新结束事件。微信订阅该变量事件数量为 0，仍显示 82；下一次微信发送捕获到的近期聊天中也没有新标记。

应在适当的宿主/变量事件后更新当前会话快照，并在发送前保证所用上下文足够新；异步更新同时遵守 W4 的作用域检查。

## 4. W1c / P2：独立模拟继续修改外部状态，却保留外部来源标签

位置：`st-extension/src/apps/wechat/wechat-app.ts:738-743`，相关路径 `789-791,809-815`。

外部变量读入同一个 state 后，第二阶段状态分析器仍直接加减数值；设置滑块、下一天发放生活费也修改同一对象。它们没有写回外部状态源，却继续保留 `hasExternalState=true`。这使页面与下一次提示词把 App 的模拟值描述成当前 ST/MVU 值。

复现：宿主始终返回 mood=82，微信发送后本地评估 +0.4，存储变为 82.4 且 hasExternalState 仍为 true。外部源并未改变。

应明确区分外部只读快照和独立模拟状态；在外部模式下不要用独立分析器覆盖读取值。若未来产品需要同步写回，应另行定义写回契约，不能以只改本地缓存代替真实更新。

## 5. W1d / P2：外部实际地点在提示词中丢失

位置：`st-extension/src/apps/wechat/pipeline.ts:119-120,144`。

桥接允许任意 location 字符串，状态类型也放宽成 string，但提示词仍只查原游戏的固定地点枚举。外部地点未命中枚举时，被替换为“角色名当前位置”，真实地点没有传给模型。

复现：读入 location=`CUSTOM_LIBRARY_LOCATION` 后，scope/state 中仍保存该字符串，但调用真实 `buildSystemPrompt` 生成的提示词不包含它。应在非枚举地点时使用已读取的实际值，而非无信息的占位词。

## 6. W8 / P2：ST 头像文件名没有转换成可加载 URL

位置：`st-extension/src/apps/wechat/wechat-app.ts:499`。

新头像渲染直接把 `card.avatar` 赋给 img.src。ST 卡的 avatar 通常是文件名（如 Alice.png），不是页面相对 URL。独立 Edge 完整 App 夹具中，该值解析为宿主 `/Alice.png`，naturalWidth=0，且没有 onerror 兜底。

仓库参考酒馆助手实现 `reference/MVU/JS-Slash-Runner-main/src/function/character.ts:256-270` 使用 `getThumbnailUrl('avatar', filename)` 后再赋给图像。新代码应通过 ST 头像/缩略图接口生成 URL，并在失败时使用备用头像。

## 已修复部分的验证

- W2：实际键生成优先 `card.avatar`，其次 characterId/name，再拼接 chatId。Alice 在角色数组中从 index 0 移到 1，键仍为 Alice.png::first；同名不同头像、同卡不同聊天均独立。旧单名键与扁平数据迁移保留历史并删除旧字段，新聊天不会再复制旧记录。这里确认存储逻辑；当前活动视图仍受 W4 影响。
- W4：LLM 发送固定了 targetConv、targetScopeKey、作用域代次，返回和状态评估完成均检查代次。原先 A 的 LLM 结果直接写 B 的分支已经修复；新的未覆盖点是桥接自身的异步读取。
- W5：`build.mjs` 已增加 assets 复制；源码 `assets/wechat`、预览 `public/assets/wechat`、分发 `st-distribution/assets/wechat` 各 50 文件 / 15,724,437 字节，50/50 SHA-256 全匹配。当前解析器的分发安装夹具返回 200。
- W3/W6/W7 保持此前代码修复结论，本轮现有相关测试通过；未发现需要重新打开这些问题的证据。

## 本轮验证与限制

- `pnpm test -- --reporter=dot --silent`：91 文件 / 1209 测试通过。
- `pnpm exec tsc --noEmit --incremental false`、`pnpm lint` 均退出 0。
- 两处 version 为 `0.9.0+202610260058`，七个运行文件 SHA-256 全一致；图片完整性见 W5。
- 使用当前源码内存 esbuild + jsdom 验证上述异步与数据问题；独立审查使用 Edge 夹具验证稳定键、资源与头像。测试使用本地桩，无外部模型请求。
- 现有 19 项微信测试使用立即可得的平铺外部值，未覆盖迟到上下文、MVU 描述元组、变量更新结束、持续主聊天刷新或外部来源与模拟值分离。因此套件通过不推翻这些复现。
- 未重建扩展或 Next 产物，未做真实 ST/MVU 安装及物理设备验收。此前生产构建通过是修复方的历史证据。

## Git 与交接

`main` / HEAD `25d62bd79860dc592cce8adf666882cb8e994400`，本地 `origin/main=1989c2fab99a28b8b204073bcb32f59b73800079`，领先 2 提交。`verified_code_head=26a40d8c142eae9bd17dc5cc59efe5f682e090c7` 祖先和已提交产品差异检查均退出 0；未提交更新仍须按工作区验证，未刷新远端引用。

本轮开始已有前几轮源码/文档/构建/locale 修改，以及新增的 bridge、资源目录和构建测试。保留这些内容，仅修改 CURRENT、DEFERRED 并添加本记录。业务源码、资产和构建产物未改，未提交、合并或推送，独立发布仓库未动。
