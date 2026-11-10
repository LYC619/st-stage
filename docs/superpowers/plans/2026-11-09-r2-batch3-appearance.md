# 第二轮 · 批次 3：「外观」App（壁纸 / 图标 / 字体 / 外观包）

参考：玉子手机外观设置 `reference/st-yuzi-phone-main/modules/settings-app/pages/appearance.js` 和 `modules/settings-app/services/appearance-settings/`（字体库、图标上传、外观包导入导出）。可以直接照搬做法。

## 用户看到的效果

主屏新 App「外观」🎨，页面从上到下：

1. **壁纸**：预览小图；「上传图片」「填图片网址」「恢复默认」。壁纸铺满主屏（只影响主屏，不影响各 App 内部），上面加一层渐变暗角保证图标文字可读。
2. **图标**：列出所有已注册 App。每行：当前图标、App 名、「换图标」——可以填一个 emoji，或上传图片、填图片网址；「恢复」。
3. **字体**：下拉选「系统默认」或已添加的字体；「添加网络字体」填两项：字体 CSS 网址（必须 https）、字体名（font-family）。只作用于手机壳内部。
4. **外观包**：「导出」复制一段 JSON 到剪贴板并下载为 `.json`；「导入」粘贴 JSON 或选文件。导入时图标按 App id 对上，对不上的忽略。导入前确认会覆盖当前外观。

设置立即生效，不用刷新。

## 数据

App 私有数据 `settings.apps.appearance`：

```ts
interface AppearanceData {
  wallpaper: string            // 图片 URL，'' = 默认
  icons: Record<string, { emoji?: string; image?: string }>   // key = App id
  fonts: Array<{ name: string; cssUrl: string; family: string }>
  activeFont: string           // fonts[].name，'' = 系统默认
}
```

**不存 base64。** 上传图片走现有的 `adapter.saveDataUri(dataUri)`（存进 ST 的用户图片目录，返回 URL），上传前用 `core/image-compress.ts` 的 `compressImage` 压缩：壁纸最长边 1280，图标最长边 128。

## 怎么接到手机壳

- `core/phone-shell.ts` 的 `PhoneShellController` 加 `setAppearance(appearance: PhoneAppearance)`：
  - 壁纸：给主屏容器设 CSS 变量 `--so-wallpaper: url("...")`（URL 用 `CSS.escape` 或 `JSON.stringify` 包住），`core/phone-shell.css` 里主屏背景用这个变量 + 渐变暗角。
  - 图标：渲染主屏格子时（`phone-shell.ts` 约 444–458 行），有 image 就用 `<img>`（`alt` 为 App 名，加载失败退回原 emoji），有 emoji 就替换 `textContent`。
  - 字体：在 `document.head` 维护一个 `<link rel="stylesheet" data-so-font>`，切换时改 href；给 `.so-phone-shell` 设 `font-family`。
- `PhoneAppearance` 类型放 `core/types.ts` 或 `core/phone-shell.ts`，Web 模拟器那边不需要支持（不传就是默认外观）。
- `st-extension/src/index.ts`：启动时读 `settings.apps.appearance` 调一次 `phone.setAppearance`。App 通过新的 `BuiltinAppDeps.applyAppearance(data)` 通知入口重新应用（照 `openGalleryManager` 的注入方式）；上传通过新的 `BuiltinAppDeps.saveImage(dataUri)` 调 `adapter.saveDataUri`。
- 字体 CSS 网址只接受 `https://` 开头。

## 文件

- `st-extension/src/apps/appearance/appearance-app.ts`、`appearance/pack.ts`（导入导出与校验）+ 测试
- `core/phone-shell.ts`、`core/phone-shell.css`、`core/phone-shell.test.ts`（setAppearance：壁纸变量、图标替换、图片失败回退、字体 link）
- `st-extension/src/apps/index.ts`、`st-extension/src/index.ts`
- 样式前缀 `ap-`，追加到 `st-extension/style.css`。`apps/index.ts` order 90（放最后）。`docs/APP-SPEC.md` 加一行。

## 不做

- 不打包字体文件，不下载、不缓存远程字体。
- 不做主题配色、气泡样式、App 内部换肤。
- 不做图标库/内置图标包。

## 验证

- 单测：外观包导出→导入往返一致；导入未知 App id 被忽略；非 https 字体被拒；phone-shell 的 setAppearance 断言（jsdom）。
- 改了手机壳，加跑 `pnpm test:mobile`。
- `pnpm typecheck`、`pnpm lint`、`pnpm build:ext`。
