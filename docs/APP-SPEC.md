# st-stage 手机 App 开发规范（v1）

st-stage 在 SillyTavern 聊天界面提供一个「手机」悬浮框架：一个可拖拽的 📱 图标，展开后是带状态栏和 Home 键的手机屏幕，屏幕上是 App 栅格。立绘、图库、设置都是内置 App。**第三方扩展可以把自己的功能注册成一个 App**，获得手机内的入口、页面容器和私有存储。

## 一分钟接入

在你自己的 ST 扩展脚本里（st-stage 加载之后）：

```js
// window.stStage 由 st-stage 扩展暴露
window.stStage?.registerApp({
  id: 'dice-roller',        // 唯一 ID：小写字母开头，字母/数字/连字符，2–32 字符
  name: '骰子',              // Home 屏名称，建议 ≤ 4 个汉字
  icon: '🎲',               // 单个 emoji
  order: 50,                // 排序权重，小的在前（内置：立绘 1、图库 2、设置 90）
  mount(container, ctx) {
    // container：手机屏幕内的空 div，往里渲染原生 DOM
    const btn = document.createElement('div')
    btn.className = 'menu_button so-app-btn'
    btn.textContent = '掷 d20'
    btn.addEventListener('click', () => {
      const result = 1 + Math.floor(Math.random() * 20)
      ctx.setAppData({ last: result })
      btn.textContent = `d20 → ${result}`
    })
    container.append(btn)
  },
  unmount() {
    // 离开 App 时清理定时器/全局事件（可选）
  },
})
```

`registerApp` 对非法/重复 id 会**抛错**，建议用 `try/catch` 包住，注册失败不应影响你扩展的其余功能。

## 生命周期

| 时机 | 调用 |
| --- | --- |
| 用户在 Home 屏点你的图标 | `mount(container, ctx)` |
| 用户按 Home 键 / `ctx.goHome()` / 收起手机 | `unmount()`（如果提供） |
| 再次打开 | 重新 `mount`（container 是新的空 div，**不做状态保持**） |

约定：

- `mount` 必须同步返回；异步数据自己 fetch 后再填充 DOM
- `mount` 抛错时框架会显示错误占位页并打印控制台，不影响其他 App
- 不要在 `mount` 外持有 container 引用（离开后即失效）

## PhoneAppContext（ctx）

| 方法 | 说明 |
| --- | --- |
| `getSettings()` | 读 st-stage 当前完整设置（只读视角，每次调用取最新） |
| `updateSettings(next)` | 提交新设置（持久化 + 框架刷新）。**除非你明确要改核心设置，否则用 setAppData** |
| `getCharacterName()` | 当前对话角色名，无对话为空串 |
| `getAppData<T>()` | 读你的私有存储（`settings.apps[你的id]`），无则 `undefined` |
| `setAppData<T>(data)` | 写私有存储（整体替换）。必须可 JSON 序列化；**不要存 base64 图片**（settings 体积敏感），图片走图床 URL |
| `goHome()` | 编程式返回 Home 屏（会触发你的 unmount） |

## 样式

手机屏幕内可直接使用这些现成类（双端一致，暗色调）：

- `so-app-section` — 圆角卡片分组容器
- `so-app-title` / `so-app-desc` — 分组标题 / 说明文字
- `so-app-btn`（配合 ST 的 `menu_button`）— 全宽按钮
- `so-app-toggle` — 开关行（label + checkbox）
- `so-app-input` — 全宽输入框（配合 ST 的 `text_pole`）
- `so-app-sprite-strip` — 三列图片网格

自定义样式请加你自己的前缀（如 `dice-`），不要覆写 `so-phone-*` / `so-app-*`。

## 安全红线

1. **所有用户可控文本一律 `textContent`**，禁止拼 `innerHTML`（角色名、包名、聊天内容都可能含 HTML）
2. 外链图片只用 `https:` URL；不要往 `settings` 写函数/DOM 引用/循环结构
3. 你的 App 运行在 ST 页面主上下文里，权限与 ST 本身等同——不要引入远程执行的代码

## 内置 App 一览（参考实现）

| id | 名称 | 说明 | 源码 |
| --- | --- | --- | --- |
| `sprites` | 立绘 | 当前绑定概览、表情预览、拉回悬浮窗 | `st-extension/src/phone-apps.ts` |
| `gallery` | 图库 | 打开立绘包管理弹窗 | 同上 |
| `settings` | 设置 | 开关与图床前缀 | 同上 |

框架源码：注册表 `core/phone-registry.ts`、手机壳 `core/phone-shell.ts`、样式 `core/phone-shell.css`。
