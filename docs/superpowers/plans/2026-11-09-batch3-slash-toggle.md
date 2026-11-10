# 批次 3：斜杠命令开关手机

目标：用户可以在酒馆输入框或快捷回复（QR）里用命令打开/收起手机，或直接打开某个 App。悬浮图标被隐藏时也能用。

参考：玉子手机的 `/yuziphone-toggle`（只借思路）。

## 效果

- `/baigong` —— 手机收起时展开，展开时收起。
- `/baigong app=wechat-sister` —— 展开手机并直接进入该 App。`app` 填 App 的 id。id 不存在时返回一句提示文本，不报错。
- 命令在酒馆的斜杠命令帮助里有一行中文说明。

## 做法

- SillyTavern 1.18.0 的 `getContext()` 暴露 `SlashCommandParser`、`SlashCommand`、`SlashCommandNamedArgument`、`ARGUMENT_TYPE`。以本机源码为准核对：`D:\6.YULE\ST\SillyTavern-1.18.0\public\scripts\st-context.js` 和 `public/scripts/slash-commands/` 下对应文件。
- 用 `SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name, callback, namedArgumentList, helpString }))` 注册。
- 注册代码放在 `st-extension/src/index.ts` 手机壳创建之后（`phone` 和 `collapsePhone` 所在位置附近），或抽成 `st-extension/src/slash-commands.ts` 一个小函数，由 index 调用。
- 展开：参照 `collapsePhone()` 写一个对称的 `expandPhone()`（`settings.phone.open = true` → 保存 → `phone.setState`）。打开 App 直接用 `phone.openApp(id)`。
- 手机整体被设为隐藏（`setVisible(false)`）时，命令仍然生效：先 `setVisible(true)` 再展开。如果「隐藏」是用户的持久设置，命令只临时显示，不改持久设置——如果实现这点需要改动较多，改为直接改持久设置也可以，在 history 里写一句。
- 扩展热重载时会再注册一次同名命令。ST 对重复注册只打一条警告并用新的覆盖（`SlashCommandParser.js:78` 起），所以不需要额外处理。
- README 的使用说明加一行命令说明（找到描述手机打开方式的段落）。

## 不做

- 不做 QR 预设导出文件。
- 不加其他命令（如切换立绘、发朋友圈）。

## 验证

- 单测：用假的 `SlashCommandParser` / `SlashCommand` 验证注册了 `baigong`，callback 无参数时切换开合，`app=` 时调用 `openApp`，未知 id 返回提示文本。
- `pnpm typecheck`、`pnpm lint`、`pnpm build:ext`。
