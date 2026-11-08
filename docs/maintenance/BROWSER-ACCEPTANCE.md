# 浏览器验收入口

以下微信脚本使用独立的 SillyTavern 测试实例、合成数据和受控模型响应。它们会创建角色和修改设置，不能对日常数据运行。统一参数为：

```text
node scripts/<script>.mjs --url http://127.0.0.1:<测试端口> --isolated-data --candidate-root <候选目录> --output <报告目录>
```

候选目录必须含 `version.json` 和 `bundle.js`，实际服务的扩展必须与候选哈希一致。可加 `--width 1365` 只跑桌面；默认依次跑 1365、320、390、667 像素宽度。默认使用本机 Edge，可用 `PLAYWRIGHT_CHANNEL` 指定其他已安装的 Chromium 通道。

| 入口 | 当前用途 |
| --- | --- |
| `verify-wechat-profile-browser` | 通用／联系人配置、模板、图库草稿与图片快照、保存重载、主线记忆开关，以及微信不读写外部变量的边界。内含 600 张合成图库的设置打开耗时采样。 |
| `verify-wechat-evolution-browser` | 聊天、群聊、状态、朋友圈、取消／失败重试、持久化及布局。 |
| `verify-wechat-experience-browser` | 兼容旧命令，直接运行 evolution 套件，所有参数保持有效。无需重复跑两者。 |
| `verify-wechat-social-browser` | 主线与原生世界书读取、三页导航、自动及私密朋友圈。 |
| `verify-wechat-ux` / `verify-wechat-ux-phase2` | evolution 内部调用的图片、键盘、媒体与语音交互子流程，不是独立命令。 |

资料设置脚本的 `--measure-only` 用于同一场景的旧／新候选性能对比，只采样，不代表功能验收通过。报告保留首次及五次后续打开耗时、隐藏素材节点数和候选哈希；耗时受机器负载影响。

## MVU 旧契约退役

`verify-wechat-mvu-browser.mjs` 现明确退出码 2 并说明替代入口。它原来验证微信钱包、数值评估和主聊天变量同步，已不属于当前微信功能，安装 MVU/TavernHelper 也不能使旧断言适用于新产品。

原脚本保存在 `scripts/archive/verify-wechat-mvu-legacy.mjs`，仅供使用匹配历史构建及真实依赖的环境复现，必须显式传入 `--legacy-contract`。历史真实 MVU 验收记录保留。

当前微信不读写外部变量的检查由 profile 套件负责；Variables App 继续使用 `verify-variables-browser.mjs`，参数见该脚本。没有真实 MVU/TavernHelper 时的不可用状态或受控计数器，不代表真实供应商集成已验收。

局部 axe 扫描、浏览器尺寸模拟和受控 AI／语音响应不能替代真实模型、麦克风／TTS、实体手机输入法与完整读屏验证。各次运行的通过数、未确定项和证据位置见对应维护历史。

## Windows 测试服务闪窗

ST 1.18.0 的 `command-exists@1.2.9` 在后台读取版本时会用 `where git` 弹出终端。建立测试 runtime 和 node_modules 联接后、启动服务前，执行 `node scripts/fix-st-terminal-flash.mjs <runtime目录>`，或在启动脚本中调用导出的 `ensureSilentCommandExists(runtime)`。该工具生成仅属于测试 runtime 的静默副本，并保留原引用文件备份；共享 node_modules 保持原样。已有服务需重启一次才会加载改动。依赖版本升级时先审查补丁再应用。具体证据和回退方式见 [终端闪窗修复](history/2026-11-08-terminal-flash-fix.md)。
