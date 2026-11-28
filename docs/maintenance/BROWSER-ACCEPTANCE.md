# 浏览器与真实宿主验收入口

早期分散的单功能 `scripts/verify-*-browser.mjs` 脚本已统一收敛为两套标准 Playwright 套件：

1. **网页端移动与触摸多视口回归（无需酒馆环境）**：
   ```powershell
   pnpm test:mobile
   ```
   覆盖 `e2e/mobile.spec.ts`、`e2e/phone-gestures.spec.ts` 与 `e2e/butler.spec.ts`（含 320×667、390×844、横屏及桌面视口，左缘返回手势、图库、外观包、Renderer 三模式及管家弹层）。

2. **真实 SillyTavern 1.18 + 酒馆助手 + MVU 隔离挂载验收**：
   ```powershell
   pnpm build:all
   pnpm test:host
   ```
   在系统临时目录新建宿主与合成数据，通过 NTFS Junction 默认挂载本仓 `st-distribution/`（可传 `--release ../st-stage-ext` 校验安装仓），串行验收桌面 `1440×1000` 与手机 `390×844`（含全部 13 个内置 App、流式 SSE 生成、MVU 读写隔离、立绘三级寻址、卡片渲染、320×480 短视口、150% 视觉缩放、纪要日历、小剧场深链与微信草稿保留）。详见 [host-e2e 说明](../../host-e2e/README.md)。

## 验收边界与 Windows 终端闪窗补丁

- 局部 axe 扫描、浏览器尺寸模拟和本地受控 SSE 响应不能替代真实商业模型、麦克风／TTS、实体手机输入法与完整读屏验证；仍需人工关闭的项目见 [外部环境验收记录](EXTERNAL-ACCEPTANCE.md)。
- ST 1.18.0 的 `command-exists@1.2.9` 在后台读取版本时会用 `where git` 弹出终端。`pnpm test:host` 内部自动调用 `scripts/fix-st-terminal-flash.mjs` 的 `ensureSilentCommandExists(runtime)` 生成仅属于临时测试副本的静默补丁，共享 `node_modules` 保持只读不动；原理见 [终端闪窗修复](history/2026-11-08-terminal-flash-fix.md)。
