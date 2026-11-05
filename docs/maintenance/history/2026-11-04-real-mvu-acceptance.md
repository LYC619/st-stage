# 2026-11-04 指定版本真实 MVU 与微信验收

后续补验：当晚的最终 `0.9.0+202611042230` 构建已重跑本脚本并增加 Variables App 编辑/取消/新增/删除/重载，6/6 通过。当前 `test-results/wechat-mvu-browser/results.json` 对应新构建；本文保留此前 `2042` 五项结果的时间边界。最新证据见 [集中收尾](2026-11-04-release-readiness.md)。

在路线 A/B/C 的本地交付后，继续完成此前缺失的第三方 MVU 验收。最终 5/5 通过，页面错误和宿主 API 失败均为 0。仅新增 `scripts/verify-wechat-mvu-browser.mjs` 和文档；产品源码、构建和候选包未改变，没有提交、推送或发布。

分支 `main`，HEAD / 本地 `origin/main` 为 `c8c73bb03fd874ca90217bde74652c4d9b3ecc55`，未 fetch。`4b615fec2898d55f4d71cfb25770d85abea3ac99` 的祖先与排除 Markdown 后产品差异检查均通过。此前路线实现仍未提交，详见 [产品交接](2026-11-04-roadmap-handoff.md)。

## 实际使用的实现

| 组件 | 来源和身份 |
| --- | --- |
| SillyTavern | 用户确认的 `D:/6.YULE/ST/SillyTavern-1.18.0` 程序副本；package 1.18.0，独立 runtime 和 `mvu-data` |
| 酒馆助手 | 安装目录 `public/scripts/extensions/third-party/JS-Slash-Runner` 的程序文件；manifest/package 4.11.3，本地 Git HEAD `e71c990607f6c92127151b1f8dad6c79fa03966e` |
| MVU | `reference/MVU/MagVarUpdate-beta/artifact/bundle.js` 原始产物；内嵌 commit `74f930e`，构建时间 `2026-07-20 16:16`，未修改、未重建 |
| 百工 | `0.9.0+202611042042`，隔离安装目录名 `baigong-acceptance`；浏览器实际取回的 bundle 与开发根目录完全一致 |
| 浏览器 | Edge `143.0.3650.80`，桌面 `1365×900` |

SHA-256：

- 酒馆助手 `dist/index.js`：`932c5267ad9ee0d6f36f3d70a9dd21a8f7effbcfef71cd26e87a1f310890da57`。
- MVU bundle：`6e4756ba99968f9eab2c20810d27ca035b28f36791f7fa7dd701a57af37241e1`。
- 百工 bundle：`1c7dfef83919c8231dd04c3c8c54c5760081fc76af04d6164ecba6d444ee99cc`。

助手通过真实全局脚本 iframe 加载本地 MVU，iframe ID 为 `TH-script--MVU controlled acceptance 74f930e--mvu-controlled-acceptance`。测试校验版本、源文件哈希和实际安装 bundle；没有用同名全局替身替代 MVU。

只检查/复制第三方程序资源，没有读取或迁移日常账户设置、密钥、角色卡、聊天或参考目录中的私人创作文件。测试角色和数据均为合成内容。浏览器只允许本地请求及 jsDelivr GET；18 个 CDN 依赖响应的 URL/哈希记录在结果中。AI 回复在本地请求入口拦截。MVU 更新检查被阻断，ST 后端仍尝试公共模型元数据请求并记录网络失败；本次不是完全离线环境。

## 验收路径和结果

| 检查 | 实际操作与断言 |
| --- | --- |
| 真实读取与显式映射 | 用实际 `Mvu.replaceMvuData` 写楼层变量，等待宿主保存；微信通过实际助手读取 `acceptance.*`，显示 mood 82、interest 35 |
| 解析、事件和界面刷新 | 实际 `TavernHelper.createChatMessages` 追加含 `_.set` 的合成 assistant 消息，触发真实 MESSAGE_RECEIVED → MVU parser → VARIABLE_UPDATE_ENDED；mood 变为 96，地点变为「真实MVU图书馆」，微信保持打开即更新 |
| 外部管理权与红包 | 发送 20 元红包只发生一次拦截的模型请求；实际楼层变量仍为 96/35/1000/真实MVU图书馆，心情/兴趣/地点设置禁用，界面钱包 1000 |
| 磁盘持久化 | 重载整个页面并重新加载助手/MVU，从原聊天读取四项状态仍与保存值相同 |
| 在途回复与会话隔离 | 预先保存 B 的 22/15/500/第二会话；挂起 A 的回复后切到 B，保持同一个微信 DOM 挂载，释放 A 回复再发送 B 消息。B 不出现 A 消息或延迟回复，四项 MVU 状态不变；切回 A 显示 96，且没有 B 消息/回复或 A 的过期回复 |

自动运行：

```powershell
node scripts/verify-wechat-mvu-browser.mjs --url http://127.0.0.1:18771 --isolated-data
```

结果：`Real MVU acceptance: 5 passed`，退出 0。报告为 `test-results/wechat-mvu-browser/results.json`，截图为同目录 `completed.png`。报告记录版本、哈希、事件值、每次请求/实际聊天 ID、页面错误、宿主 API 失败和 CDN 依赖。合成楼层数据保留在 `test-results/roadmap-2026-11-04/mvu-data`，不纳入 Git。

`node --check scripts/verify-wechat-mvu-browser.mjs` 和 `git diff --check` 通过。根目录/预览/分发/既有候选包的 58 文件一致性重新通过；候选仍为 `test-results/release-2026-11-04-2042/package`。本轮没有改产品实现，沿用交接记录中的 1365 项单测、类型/lint/翻译和 Next 构建证据，没有重复宣称新跑全套。

## 环境调查与复现前提

初始合成变量仅有 `stat_data`，真实 MVU 要求同时有 `schema` 才识别为 MVU 数据。补齐实际结构后，解析事件和界面刷新通过；未据夹具失误修改桥接代码。

其后切回聊天时，ST 写角色卡出现 Windows `EPERM` 原子替换失败。宿主仍返回成功并重新读回旧聊天名，导致聊天 ID 与已加载内容不符，触发完整性校验。失败前后的聊天 ID/表单值和截图保留为 `test-results/roadmap-2026-11-04/mvu-before-symlinks.{json,png}`，原服务日志为 `mvu-server.log`。

隔离 runtime 使用 junction 复用 `node_modules`。Node 默认解析到原安装路径，使图片 WASM 被宿主的目录边界检查拒绝。改用 `--preserve-symlinks` 启动后，模块 URL 保留在隔离 runtime 内；最终日志不再出现该路径错误、EPERM 或聊天完整性失败。此结果不证明所有 Windows 文件占用均由 WASM 错误引起。没有关闭宿主路径/完整性校验，也没有修改 ST 或百工代码。最终服务日志为 `mvu-server-symlinks.log`。

复现需要先按路线 A 方法准备隔离 runtime，安装匹配哈希的百工、酒馆助手和 MVU：

1. 将助手的 `dist`、`lib`、`i18n` 与 manifest 放入隔离 `public/scripts/extensions/third-party/JS-Slash-Runner`，只在副本中禁用 auto_update。
2. 将原始 MVU bundle/license 放入隔离 `public/mvu-acceptance/`。在独立测试用户中启用助手全局脚本，ID `mvu-controlled-acceptance`，名字 `MVU controlled acceptance 74f930e`，脚本内容为 `import 'http://127.0.0.1:18771/mvu-acceptance/bundle.js';`，不注入测试版 Mvu 对象。
3. 从隔离 runtime 启动服务，明确独立数据目录；随后从开发仓库运行上述验收脚本。脚本会重置该测试用户的微信配置，并创建带时间标识的合成聊天，不能指向日常用户。

```powershell
node --preserve-symlinks server.js --port 18771 --dataRoot 'D:/8.Project/0_0_维护/st-stage/test-results/roadmap-2026-11-04/mvu-data' --browserLaunchEnabled false
```

交接前已停止本任务的隔离服务，确认 18771 不再监听。

## 关闭范围与下一步

指定版本下，微信与真实 MVU 的读取、解析事件、只读结算、重载及在途回复切换已取得证据。测试通过真实 MVU API 写变量，不表示微信会回写变量；红包仍只是微信消息。

其他 MVU 版本、Variables App 的编辑界面、同一会话旧读取晚返回，以及数值评估等待中外部字段管理权变化，不由这次集成测试关闭；后两项保留现有受控回归证据。真实模型调用、实体手机/OS 输入法和完整读屏仍需各自环境，见 [外部验收表](../EXTERNAL-ACCEPTANCE.md)。本次也未改变原生整包 ZIP 导入、其他 DEFERRED 项或发布授权的边界。
