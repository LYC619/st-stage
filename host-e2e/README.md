# 真实 SillyTavern 挂载验收

从源码仓执行 `pnpm build:all` 更新产物后运行 `pnpm test:host`。运行器在系统临时目录新建宿主、配置和数据，通过 junction 默认挂载本仓 `st-distribution/`（发布验收时可传 `--release ../st-stage-ext` 校验安装仓），启动本地 SSE 服务和 Playwright，串行验收桌面 1440×1000、手机 390×844。无需外部模型密钥。

默认复用本机旧验收目录中的 **程序**（不读取旧数据）；其他机器可显式提供依赖：

```powershell
pnpm test:host --host-source C:/tools/SillyTavern-1.18.0 --helper-source C:/tools/JS-Slash-Runner --mvu-source C:/tools/MVU/artifact/bundle.js --release st-distribution
```

- 已验依赖：Node 22、ST 1.18.0（含已安装 node_modules）、酒馆助手 4.11.3、MVU `74f930e`、Playwright/Edge。可通过 `PLAYWRIGHT_CHANNEL` 选择已安装浏览器。
- 只复制 `default/public/src/server.js/plugins.js/webpack.config.js/package.json` 程序白名单；排除源宿主的 third-party。宿主原配置、账户数据、备份和密钥均不复制。依赖目录只读复用，启动保留 symlink 路径；临时副本使用已有的 Windows 隐藏终端补丁。
- 临时配置禁用扩展自动更新和模型自动下载，保留 CSRF、聊天完整性及路径检查。运行器不接受已有数据目录或任意宿主 URL，避免误测日常账户。
- 真实助手加载未改动的 MVU bundle。MVU 依赖 CDN 网络；响应哈希保存在每个视口的诊断 JSON 中。上游版本检查/模型元数据请求可能留下警告，不等同于扩展脚本异常；套件额外断言扩展自身无 `[st-stage]` 控制台错误或警告。
- 主聊天走真实发送按钮 → ST 生成接口 → 本地 OpenAI 兼容 SSE → ST 事件和 DOM。额外异常用例仅将一张合成图片暂时置为 HTTP 503，观察错误提示后取消拦截验证重试。
- 覆盖 MVU 编辑/错误 JSON/事件/落盘/重载/聊天隔离、角色/服装/标签寻址、渲染卡片/坏协议恢复、13 App 可达性、图库弹层、剧情任务/日历/日记联动和微信草稿。
- 覆盖 320×480 短视口和 150% visual viewport。ST 默认禁止手机缩放；手机缩放项明确模拟浏览器无障碍覆盖该策略，随后恢复原 meta。没有伪造 `visualViewport`。

每次证据输出到全新的 `test-results/host-acceptance-<UTC>/`，可用 `--output <新目录>` 指定；不覆盖旧证据。保留截图、环境/组件哈希、两视口诊断、SSE 请求统计、Playwright JSON 和失败 trace。`--project desktop|mobile` 可定向排查，完整验收省略此参数。

运行结束（无论通过、失败还是 `--keep-temp`）都在 `finally` 中停止服务并先断开全部 NTFS junction 挂载点，杜绝 `%TEMP%` 残留指向宿主依赖或扩展目录的活体链接；通过且未加 `--keep-temp` 时一并清理本次临时目录。此套件验证真实宿主集成和浏览器触摸模拟，不代表实体手机、系统输入法或真实商业模型内容验收。
