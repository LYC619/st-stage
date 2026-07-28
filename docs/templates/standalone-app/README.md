# st-stage 独立 App 模板

独立 App = 一个普通的 SillyTavern 扩展（manifest.json + index.js），靠一行队列注册接入 st-stage 的手机。把本目录复制成一个新仓库（或直接放进 SillyTavern 的 `public/scripts/extensions/third-party/<你的目录>/`），改三处即可发布：

1. `manifest.json`：`display_name` / `author` / `homePage`（填你的仓库地址，用户才能收到 auto_update）
2. `index.js`：`id`（全局唯一）、`name`、`icon`，以及 `mount` 里你的功能实现
3. 推到 GitHub 后，用户在 ST **扩展管理器 → 安装扩展** 粘贴仓库地址即可安装；启停也在扩展管理器（启停后需刷新页面）

前提：用户已安装 st-stage（掌柜的）。未装时 push 进的队列无人消费，静默无害，不会报错。

App 能力与约束（ctx 读写、生命周期契约、样式类、安全红线）：st-stage 仓库 [docs/APP-SPEC.md](../../APP-SPEC.md)。
