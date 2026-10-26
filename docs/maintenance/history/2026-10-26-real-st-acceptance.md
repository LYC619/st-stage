# 2026-10-26 真实 SillyTavern 自动验收

## 环境与边界

- 宿主为本机 `SillyTavern-1.18.0`，监听 `127.0.0.1:18769`；数据目录为仓库忽略的 `test-results/real-st/data`，仅创建合成角色、聊天与设置，没有读取或修改日常 SillyTavern 数据。
- 浏览器为 Edge `143.0.3650.80`。桌面为 1365×900；移动结果来自 Playwright 浏览器模拟，其中微信额外覆盖 320×667，不等同于物理设备或 OS 输入法验收。
- 隔离安装的 `index.js`、`bundle.js`、`style.css`、`version.json` 与开发仓库 SHA-256 一致；`manifest.json` 只将 `auto_update` 改为 `false`，避免验收时自动更新。构建版本为 `0.9.0+202610261121`。
- 所有外部浏览器请求均被阻断。微信回复和状态结算使用本地拦截的合成响应，没有真实 AI、密钥或外部模型调用。

## 最终结果

- i18n/基础布局：10/10 场景通过，覆盖中英文桌面/移动、浏览器语言回退、宿主不支持语言、英文资源 404/损坏/超时及双资源超时；页面错误为 0。
- Gallery：4/4 场景通过，中英文桌面/移动；页面错误为 0。
- Variables：4/4 场景通过，中英文桌面/移动；定义、模板原始数据、聊天与重载持久化、HUD/编辑器布局均通过，页面错误为 0。
- Cloud Export：4/4 场景通过，中英文桌面/移动；其批次中的实际 ZIP 内容检查保持通过。
- 微信：桌面与 320×667 两个场景通过。验收覆盖 full-bleed 布局、输入栏/发送键边界与横向溢出、四个打包素材 HTTP 200、真实 ST 角色头像、主聊天上下文进入微信 system prompt，以及同角色两个主聊天对应的微信会话隔离。

## 验收脚本问题与修正

- 首次 i18n 运行中，`settingsReady` 先于 onboarding DOM 出现；在隔离数据中以合成人设完成一次 onboarding 后，10 个产品场景全部通过。该现象没有形成产品断言失败。
- Variables 首次运行稳定复现：`settingsReady` 后角色列表仍需约 4.4 秒异步水合，脚本过早检查默认角色、重复创建合成角色，最终以 `Missing synthetic character` 失败。`4b615fec2898d55f4d71cfb25770d85abea3ac99` 在 `ready()` 中等待 `characters.length > 0`；修正后聚焦场景和最终 4/4 全量场景通过。
- 微信曾有一次桌面首次打开超时，失败截图仍停留在带微信图标的 Home 栅格，且无页面 JavaScript 错误。加入事件/挂载诊断后未再复现：桌面聚焦运行和随后桌面+320px 全量运行的三次打开均记录到 Enter 到达已连接图标并成功挂载。证据不足以将该单次时序故障归为产品缺陷，因此没有修改产品代码。

## 未扩大声明

- 宿主加载了用户级全局第三方扩展，变量脚本检测到 `window.TavernHelper`/`window.Mvu` 条件为真；这不能证明真实第三方 MVU 的读写、事件或结算协议已完成受控验收。实际第三方 MVU 集成仍未验。
- 本轮不声称物理设备、OS 键盘/输入法、完整屏幕阅读器、WAVE 或 WCAG AA 通过，也不声称真实外部 AI 调用通过。
- 图片迁移/恢复、标准 ZIP 导入和 `DEFERRED.md` 中的其余历史项目没有因本轮宿主自动化而关闭。

## 继续会话后的交付核对

- 重新读取本机忽略目录中的 `test-results/{i18n,gallery,variables,export}-browser/results.json` 和 `test-results/real-st/wechat/results.json`：分别为 10、4、4、4、2 个场景，全部 `passed`，页面错误均为 0。这是核对已有验收证据，没有重新运行宿主场景。
- 重新执行 `node --check scripts/verify-variables-browser.mjs` 和 `node scripts/verify-runtime-parity.mjs --root . --distribution st-distribution --release ../st-stage-ext`，均退出 0；7 个运行文件三方一致，分发与安装仓库 README 一致。微信素材在源目录、预览、分发和安装仓库四处的文件清单及 SHA-256 均为相同的 50 项。
- 从远端刷新确认开发仓库 `main` 为 `4b615fe`，安装仓库 `main` 为 `0b24014`。仅保留本地 `main` 和开发仓库远端旧分支 `v0/2405142193-6702-70a2066c`；后者仍含未合入提交 `4e1d1ac`，继续保留。
- `18769` 端口已无监听；隔离验收服务已停止，忽略的本地验收输出保留以便追溯。维护文档陈旧性检查通过，产品文件未因本次收尾修改。
