# i18n 使用指南

本页按当前 `main` 的 `core/i18n.ts` 核对（2026-10-24）。这里只是基础设施，尚未代表界面已全面接入；较新的翻译、参数插值和键盘成果在 `codex/i18n-acceptance`，请读该分支自己的同名指南。[当前状态](maintenance/CURRENT.md) 记录位置和验收边界。

## 基本用法

```typescript
import { t } from '../core/i18n'

// 简单翻译
const confirmText = t('common.confirm')  // "确认" 或 "Confirm"

// 第二个参数是缺失键的回退文本，不是插值参数对象
const fallback = t('missing.key', '默认文本')

// 嵌套路径
const title = t('sprite.manager.title')  // "立绘图库管理"
```

## 添加新的翻译

1. 编辑 `st-extension/locales/zh-CN.json`：
```json
{
  "myFeature": {
    "title": "我的功能",
    "description": "这是描述"
  }
}
```

2. 编辑 `st-extension/locales/en-US.json`：
```json
{
  "myFeature": {
    "title": "My Feature",
    "description": "This is a description"
  }
}
```

3. 在代码中使用：
```typescript
const title = t('myFeature.title')
```

## 切换语言

```typescript
import { setLocale, getLocale } from '../core/i18n'

// 获取当前语言
const current = getLocale()  // 'zh-CN' 或 'en-US'

// 切换语言
setLocale('en-US')
```

切换前必须通过 `loadTranslations(locale, dict)` 加载非空字典，否则 `setLocale` 抛错。main 的 ST 初始化入口是 `st-extension/src/st-adapter.ts` 的 `initI18n()`，按浏览器语言选择；当前加载路径和错误降级仍需真实宿主验证，不要把后续分支的宿主语言检测结论套用到这里。

## 注意事项

- 所有翻译键使用点分隔的路径（如 `common.confirm`）
- 当前语言缺失时先查回退语言（默认中文），仍缺失则返回传入的回退文本，最后才返回键本身
- 运行 `pnpm build:ext` 或 `pnpm build:st` 会自动复制 locale 文件到产物目录
- locale 文件使用 UTF-8 编码，支持所有 Unicode 字符
