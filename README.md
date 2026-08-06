# 掌柜的（st-stage）— SillyTavern 的「小手机」功能平台

> 酒馆里的事，掌柜的都管。

「掌柜的」是一个 SillyTavern 扩展形态的**功能平台**（扩展列表里显示为「掌柜的」，仓库名 st-stage）：装好后聊天界面出现一个可拖动的 **📱 图标**，展开是一部带状态栏、返回键和 Home 键的小手机——所有功能都是手机里的 **App**。

**装一个扩展 = 一套会持续长大的工具箱**：

- 🧩 **App 化架构**：每个功能是独立 App，互不干扰；以后新功能直接作为 App 加入，不用再装新扩展
- ⚡ **热更新**（v0.6+）：扩展更新后无需清浏览器缓存，刷新页面自动加载新版（设置面板可见当前版本号）
- 📱 **双端一致**：同一套手机与 App 在真实 ST 和网页模拟器里行为一致，方便开发调试
- 🚫 **不喜欢手机形态？** ST 扩展设置里可一键关掉手机，已有功能照常工作

当前内置 App：

| App | 一句话 |
| --- | --- |
| 🎭 **立绘** | 给任何纯文字角色卡加视觉小说式立绘（旗舰功能，见下） |
| 🗂 **图库** | 立绘包管理：上传/分组/绑定/分享/图床 |
| 🧹 **管家** | ST 性能管家：一键性能模式 + 改动前快照还原、逐项微调、体检与优化指南（[说明](docs/BUTLER.md)） |
| 🔢 **MVU** | MVU 版角色卡的变量面板：树状查看/编辑/删除 + 变化高亮（[说明](docs/VARIABLES.md)） |
| 🧮 **新变量** | 内置轻量变量追踪：任何普通卡 GUI 定义变量，AI 自动维护，模板一键起步（[说明](docs/VARIABLES.md)） |
| 🔌 **API** | OpenAI 兼容接口站点一键切换：手机页快切 + 全屏管理弹窗（站点/Key/模型/附加参数随站点走） |

> 🔐 **密钥存储说明**：「图库」的 imgbb Key 和「API」的站点密钥都**明文**保存在 ST 扩展设置里（随 ST 服务端 `settings.json` 落盘）。扩展自己的导出文件和分享串不含任何密钥，但请不要把 ST 的 `settings.json` 或完整备份直接发给别人。

---

## 安装

1. 打开 SillyTavern，点顶部的 **扩展**（Extensions，积木图标）
2. 点 **安装扩展**（Install extension）
3. 粘贴本仓库地址，点安装：

```
https://github.com/LYC619/st-stage
```

4. 安装完成后，聊天界面会出现一个**立绘悬浮窗**（初次是占位提示）和一个可拖动的 **📱 悬浮图标**

> ⚠️ **更新扩展后界面没变化？**先看 ST 扩展设置面板底部的版本号（v0.6 起显示 `vX.Y.Z（构建 时间）`）：版本号变了说明已加载新版；没变则多半是**仓库没重新构建/提交**，不是缓存。v0.6 起 `index.js` 是稳定加载器，每次都用 `version.json` 拉最新版本号给 `bundle.js`/`style.css` 破缓存，正常情况无需手动清缓存；极端情况电脑 Ctrl+F5 兜底。

> 📍 **设置在哪？** ST 扩展设置页（「掌柜的」抽屉）只留两个总开关（**启用立绘功能**、**显示手机**）。功能设置都在对应 App 里：立绘的显示/轮播/Prompt（含智能精简模式）在「🎭 立绘」App，图包与图床在「🗂 图库」App。

---

## 🎭 旗舰功能：角色立绘

给**任何纯文字角色卡**加上视觉小说式的立绘：插件悄悄告诉 AI「回复带上表情标签」，再从回复里读出 `[立绘:微笑]` 实时切换立绘。**不需要角色卡作者配合，不依赖表情识别模型**，自带两套立绘包装完即用。

能做到的效果：

- 悬浮窗实时变表情，或把立绘直接**渲染进聊天楼层**（标签原位显示，可逆恢复）
- 一条回复**多张立绘按剧情顺序播放**（点击/自动轮播），支持每次回复输出 N 张
- **多角色/换装**：一个聊天启用多个图包，`[立绘:鸣人/居家服/微笑]` 三级地址严格寻址，绝不串图
- **一行分享串**把整个立绘包发到群里，对方粘贴即用（imgbb 图床自动直传）

**📖 完整使用指南（三分钟上手、自建图包、多角色、分享、FAQ）：[docs/SPRITE.md](docs/SPRITE.md)**

---

## 📱 小手机怎么用

点 📱 图标展开手机：顶部左上 **‹ 返回**、右上 **✕ 收起**（恢复成可拖动图标），底部圆形 **Home 键**返回主屏。图标可拖到任意位置，小屏设备会按真实尺寸完整收回屏幕内。

> 💡 不想要手机？ST 扩展设置 → 取消勾选「**显示手机**」。立绘功能不受影响，图库仍可从悬浮窗 ⚙ 打开。

## 🎬 Renderer 怎么用

Renderer 是手机里的「🎬 渲染」App。第一次使用时：

1. 打开 📱 → Home → **渲染**。
2. 点「**启用推荐设置**」，或手动打开「启用渲染」和至少一个模式。
3. 回到聊天发送普通消息。AI 回复只有在返回合法的 `<STStageRender>...</STStageRender>` 块时才会出现渲染面板；普通回复仍按原文显示。

- **Galgame**：连续对话和分镜节拍。
- **卡片选择**：2-8 个选项；点击后只填入输入框，不会自动发送。
- **战斗**：在面板内执行攻击、技能、物品和逃跑等本地确定性操作。

如果没有出现面板，先确认总开关和对应模式仍然开启，再发送下一条消息，并检查扩展设置底部的构建版本是否已更新。

---

## 🧹 管家：让 ST 更流畅

手机里的「🧹 管家」App 帮你把 SillyTavern 调顺，尤其适合**手机端 / 低端机 / 长聊天**卡顿：

- **一键性能模式**：一个按钮关模糊/阴影/动画、降流式帧率、降消息加载数（手机更激进）。**改动前自动保存原设置快照**，随时一键还原，放心试。
- **逐项微调**：想自己拿捏就展开手动微调，每个开关右侧都有 ⓘ——桌面**悬浮**看说明、手机**点开**看说明，告诉你这项是什么、什么时候该调。
- **体检 + 优化指南**：提示禁用扩展数 / Quick Reply 集合数，并给出浏览器与服务端 `config.yaml` 里管家改不了、需你手动做的优化建议。

**📖 每个选项的含义、推荐值与何时调整：[docs/BUTLER.md](docs/BUTLER.md)**

> 管家改的是 ST 自身的性能设置（`power_user`）。在网页模拟器里会降级为只读指南，请到真实 SillyTavern 里使用。

---

## 🔢🧮 变量：看见 AI 维护的故事状态

两个变量 App，覆盖两种场景（可同装、互不干扰）：

- **🔢 MVU**——角色卡是 MVU 版？直接得到一块变量面板：树状展开好感度/状态/时间等所有变量，点值就能改（`[值,描述]` 二元组的描述自动保留），AI 回复后自动刷新并给出**绿涨红跌变化徽标**。
- **🧮 新变量**——普通卡也想要变量系统？不依赖 MVU/酒馆助手/世界书：在**全屏「变量设计」弹窗**里 GUI 定义变量（类型/范围/枚举/更新规则），或从**内置模板**（恋爱单/多角色、RPG、日常）一键导入；启用后自动向 AI 注入状态与规则、解析回复末尾的更新块、逐楼保存快照，越界值自动修正、未定义路径自动拒绝（解析日志逐条可查）。做好的变量系统还能**存成自定义模板**换卡复用。

**📖 两个 App 怎么选、变量设计详解、更新规则写法与 FAQ：[docs/VARIABLES.md](docs/VARIABLES.md)**

---

## 🛠 给开发者：写你自己的 App

给 st-stage 加新功能不用写独立 ST 扩展——加一个内部 App 模块就行。完整开发流程（必读文件、接入三步、硬规则、验证与排错）收录在仓库自带的 skill 里：**[.claude/skills/st-app/SKILL.md](.claude/skills/st-app/SKILL.md)**。

**推荐用法**：用 AI 编程工具（Claude Code / Codex 等）在仓库根目录开一个会话，直接说——

> 按 `.claude/skills/st-app` 里的流程，给 st-stage 写一个「骰子」App：掷 d20 并在页内记录最近 10 次结果

Claude Code 会自动发现这个 skill；其他工具就在提示词开头加一句「先读 `.claude/skills/st-app/SKILL.md`」。把引号里的功能换成你要的即可，从写代码、装配到构建提交它都会照流程走完。

手写也一样：照 skill 的三步 + **[docs/APP-SPEC.md](docs/APP-SPEC.md)**（App 契约、ctx 能力、样式套件与安全红线）。

想做**独立发布**的 App（自己的仓库与版本、ST 扩展管理器启停、URL 安装分发）？写一个普通 ST 扩展，index.js 里一行 `;(window.stStageQueue ||= []).push(app)` 即接入，加载顺序无关、注册失败不拖垮你的扩展——可复制模板见 **[docs/templates/standalone-app/](docs/templates/standalone-app/)**。v0.9 起有 **ctx 能力层**：监听 AI 消息、注入提示词、toast、全屏弹窗直接从 `host`/`ctx` 拿，订阅与定时器由框架自动回收，不用裸摸 ST 协议。

---

## 本地开发

网页版是仿 ST 的聊天模拟器，用于本地开发和测试核心链路（注入 → 模拟 AI 回复 → 提取标签 → 切换立绘）：

```bash
pnpm install
pnpm dev        # 启动网页测试环境 http://localhost:3000
pnpm test       # core 层单元测试（vitest）
pnpm test:watch # 单测监听模式
pnpm test:mobile # 移动端 E2E（Playwright 移动视口跑 Web 模拟器；首次先 npx playwright install chromium）
pnpm lint       # ESLint
pnpm typecheck  # tsc --noEmit
pnpm build      # Next.js 生产构建（网页模拟器，CI 用作类型/构建门禁）
pnpm start      # 跑上一步的生产构建
pnpm build:ext  # 重新打包根目录 ST 兼容产物（index.js / bundle.js / version.json / style.css）
pnpm build:st   # 生成 st-distribution/，供未来独立 ST 仓库或发布流程使用
```

### 目录结构（平台 / 功能 App / 产物）

st-stage 的定位是「手机底座平台 + 可插拔功能 App」。**加新功能 = 在 `st-extension/src/apps/` 写一个 App 模块**（三步接入见 [docs/APP-SPEC.md](docs/APP-SPEC.md)），不需要新写 ST 扩展插件。

```
根目录（ST 扩展产物，构建生成、必须提交）
├─ manifest.json          ST 扩展清单（版本号唯一定义点，发版记得 bump）
├─ index.js               加载器 stub（字节跨版本稳定，热更新入口）
├─ bundle.js              真实扩展代码（esbuild 单文件 ESM）
├─ version.json           热更新版本探针（stub 以 no-store 读取破缓存）
└─ style.css              st-extension/style.css + core/phone-shell.css 拼接

st-distribution/           可选生成的 ST 安装产物（不存放源码、参考图或模拟器资源）
├─ manifest.json           从根目录清单复制
├─ index.js / bundle.js    稳定加载器与扩展代码
├─ style.css / version.json
└─ README.md               生成边界说明

core/                     平台无关核心逻辑（双端共用，vitest 单测在旁边）
│  ── 手机平台框架 ──
├─ phone-registry.ts      App 注册表 + PhoneApp/PhoneAppContext 契约 + ctx 工厂
├─ phone-shell.ts/.css    手机壳（图标/状态栏/Home 栅格/App 生命周期驱动）
├─ adapter.ts             PlatformAdapter 接口（ST 端/Web 端各自实现）
├─ types.ts / migrate.ts  设置模型、默认值与版本迁移（含 apps 私有存储命名空间）
│  ── 立绘功能（首个功能域）──
├─ sprite-store.ts        包/绑定 CRUD + 三级寻址（resolveSprite）
├─ address-policy.ts      有效地址与跨包冲突检测
├─ prompt-builder.ts      注入 prompt（full/精简/few-shot/自定义模板）
├─ tag-parser.ts          AI 回复中 [立绘:...] 标签提取
├─ inline-image.ts        楼层内插图标记解析
├─ pack-io/share-code/pack-split/pack-merge.ts   JSON 导入导出 / 分享串 / 拆包 / 合并
├─ imgbb.ts / image-compress.ts / sprite-preload.ts   图床直传 / 压缩 / 有界预加载
└─ naming.ts / presets.ts 名称清洗 / 内置预设包

st-extension/             ST 端（esbuild 打包为根目录产物）
├─ build.mjs              打包脚本（版本注入 + 热更新三段式产物）
├─ style.css              扩展基础样式（源文件）
└─ src/
   ├─ index.ts            接线层：初始化、注册内置 App、暴露 window.stStage
   ├─ st-adapter.ts       ST 平台适配（设置持久化/存图/prompt 注入/事件）
   ├─ settings-panel.ts   ST 扩展设置页（总开关 + 版本号显示）
   ├─ apps/               ★ 功能 App 都住这里（新功能从这加）
   │  ├─ index.ts         内置 App 装配清单（BuiltinAppDeps 注入框架能力）
   │  ├─ widgets.ts       App 共享 UI 小部件
   │  ├─ variable-tree.ts 共享变量树视图（折叠/类型感知编辑/delta 徽标，两变量 App 复用）
   │  ├─ path-utils.ts    点号路径嵌套读写（纯函数）
   │  ├─ sprite-app.ts    「立绘」App（显示/轮播/Prompt 设置）
   │  ├─ gallery-app.ts   「图库」App（包管理入口/图床双通道设置）
   │  ├─ butler-app.ts    「管家」App（ST 性能调优）
   │  ├─ mvu-app.ts       「MVU」App（MVU 楼层变量数据层）
   │  ├─ newvar-app.ts    「新变量」App（手机页：开关+状态树）
   │  ├─ newvar/          「新变量」引擎：engine(解析/门禁/注入,带单测)、runtime(常驻编排)、
   │  │                   config、templates(内置模板)、designer(变量设计弹窗)
   │  ├─ api-app.ts       「API」App（手机页：站点快切+在线状态）
   │  └─ api/             「API」支撑层：core(纯逻辑,带单测)、bridge(ST 耦合层，
   │                      直写 oai_settings/密钥槽位，在线状态走 ST 真事件)、manager(全屏管理弹窗)
   ├─ sprite-manager.ts   图库管理弹窗（上传/导入导出/分享/绑定，图库 App 打开）
   ├─ overlay-dom.ts      立绘悬浮窗
   └─ message-postprocess.ts   楼层内标签→图片渲染

app/ components/ lib/     Next.js 网页模拟器（同一套 core + 手机壳，本地开发调试用）
public/presets/           网页模拟器的示例预设立绘图片
docs/SPRITE.md            ★ 立绘 App 完整使用指南（含数据格式）
docs/VARIABLES.md         ★ 变量 App 指南（MVU + 新变量：选择、设计、更新规则、FAQ）
docs/BUTLER.md            ★ 管家 App 指南（每个性能选项的含义与推荐值）
docs/APP-SPEC.md          ★ App 开发规范：契约、ctx、样式、安全红线、三步接入
docs/DESIGN-WALKTHROUGH.md  设计走查 checklist（发版前人工过一遍，移动+PC）
docs/templates/standalone-app/  ★ 独立 App 可复制模板（manifest + index.js，一行队列注册）
docs/superpowers/         历史设计文档（plans/specs，归档参考）
```

> 注意：修改 `core/` 或 `st-extension/src/` 后必须运行 `pnpm build:ext` 并提交根目录产物，GitHub 安装的用户才能拿到更新（热更新会让他们免清缓存）。需要生成独立 ST 发布目录时再运行 `pnpm build:st`。`st-distribution/` 不会复制 `public/` 或 `reference/`；`.planning/`、`_analysis/`、`reference/` 等本地工作区目录已 gitignore，不随仓库分发。

## Built with v0

This repository is linked to a [v0](https://v0.app) project.

[Continue working on v0 →](https://v0.app/chat/projects/prj_D1rjqBadx2EAZHnDXoNJs9UVMFlP)
